// Moteur générique de découpage des gros fichiers bulk ZIP→CSV (Phase 3,
// voir CLAUDE.md) — remplace la stratégie "redécompresser depuis le
// début + ignorer N lignes déjà traitées" dont le test SIRENE (Phase 3.1)
// a démontré la limite à l'échelle nationale.
//
// Trois étapes distinctes, chacune avec sa propre partition IngestionJob
// (voir section B du brief) :
//
//   1. StagingRunner (partition "stage") — télécharge le fichier
//      original par morceaux bornés (Range HTTP réel, resumable comme
//      avant, voir lib/ingestion/staging.ts).
//   2. preprocessManifest() — PAS un IngestionRunner : décompresse le
//      fichier stagé EN UNE SEULE PASSE CONTINUE et le découpe en chunks
//      CSV.gz indépendants (staging + DatasetChunk). Cette passe ne peut
//      pas être interrompue puis reprise à un octet arbitraire (Node ne
//      permet pas de sérialiser l'état d'un flux DEFLATE) — elle doit
//      tourner à son terme dans un contexte à connexion longue (cette
//      session, ou plus tard un job Fargate/Batch), jamais dans une seule
//      invocation Lambda de 30s pour un fichier de plusieurs Go. Voir le
//      rapport pour le calcul du seuil.
//   3. ChunkIngestionRunner (partition "ingest") — une fois le manifeste
//      READY, ingère chunk par chunk : reprise = quel chunk, quelle ligne
//      DANS ce chunk (jamais depuis le début du fichier), donc bornée et
//      rapide même après des millions de lignes déjà traitées.

import { createHash } from "node:crypto"
import { gzipSync, gunzipSync } from "node:zlib"
import unzipper from "unzipper"
import {
  writeStagingPart,
  readStagingPart,
  readStagingStream,
  stagingKeyFor,
} from "@/lib/ingestion/staging"
import { getOrCreateManifest, setManifestStatus, addChunk, finalizeManifest, getNextPendingChunk, markChunkIngested, updateChunkRowOffset } from "@/lib/ingestion/manifest"
import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

export interface ResolvedResource {
  url: string
  totalBytes: number
  version: string
}

interface StagingCheckpoint extends IngestionCheckpoint {
  manifestId: string
  resourceUrl: string
  totalBytes: number
  datasetVersion: string
  bytesDownloaded: number
  partCount: number
}

// Étape 1 — télécharge le fichier ORIGINAL par morceaux bornés, stocké
// sous un espace de noms de staging distinct ("<dataset>/original") des
// chunks produits à l'étape 2 ("<dataset>/chunks").
export class StagingRunner implements IngestionRunner {
  source: string
  dataset: string
  partition = "stage"

  constructor(
    source: string,
    dataset: string,
    private resolveResource: () => Promise<ResolvedResource>,
    private chunkTargetRows: number,
  ) {
    this.source = source
    this.dataset = dataset
  }

  async runBatch(checkpoint: IngestionCheckpoint | null): Promise<BatchResult> {
    if (!checkpoint) {
      const { url, totalBytes, version } = await this.resolveResource()
      const manifest = await getOrCreateManifest(this.source, this.dataset, version, url, BigInt(totalBytes), this.chunkTargetRows)
      await setManifestStatus(manifest.id, "STAGING")
      const initial: StagingCheckpoint = {
        manifestId: manifest.id,
        resourceUrl: url,
        totalBytes,
        datasetVersion: version,
        bytesDownloaded: 0,
        partCount: 0,
      }
      return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: initial, done: false }
    }

    const cp = checkpoint as StagingCheckpoint
    if (cp.bytesDownloaded >= cp.totalBytes) {
      // Déjà entièrement téléchargé (peut arriver si l'invocation
      // précédente a atteint pile la fin sans que le harnais ne s'arrête
      // à temps) — ne JAMAIS redemander une plage au-delà de la fin du
      // fichier (416 réel obtenu pendant la validation, voir le rapport).
      return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: cp, done: true }
    }
    const chunkSize = getBatchSize(8_000_000, "INGESTION_DOWNLOAD_CHUNK_BYTES")
    const rangeEnd = Math.min(cp.bytesDownloaded + chunkSize - 1, cp.totalBytes - 1)

    const res = await fetch(cp.resourceUrl, {
      headers: { Range: `bytes=${cp.bytesDownloaded}-${rangeEnd}` },
      signal: AbortSignal.timeout(25000),
    })
    if (res.status !== 206 && res.status !== 200) {
      throw new Error(`Téléchargement (staging) : réponse ${res.status}`)
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeStagingPart(this.source, `${this.dataset}/original`, cp.datasetVersion, cp.partCount, buffer)

    const bytesDownloaded = cp.bytesDownloaded + buffer.length
    const done = bytesDownloaded >= cp.totalBytes
    if (done) {
      await setManifestStatus(cp.manifestId, "PREPROCESSING")
    }
    const next: StagingCheckpoint = { ...cp, bytesDownloaded, partCount: cp.partCount + 1 }
    return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: next, done }
  }
}

// Étape 2 — décompression en une seule passe continue + découpage en
// chunks CSV.gz. Découpage LIGNE À LIGNE (pas de reparsing/reformatage
// des champs CSV) : chaque chunk reste un texte CSV valide, en-tête
// répété en tête de chaque chunk pour qu'il soit parsable seul par
// csv-parse à l'étape 3. Hypothèse documentée : aucun champ du fichier
// SIRENE ne contient de retour à la ligne littéral à l'intérieur d'un
// champ entre guillemets (vérifié sur les échantillons réels — adresses/
// noms/enseignes, jamais de texte multi-ligne) ; un futur dataset qui
// violerait cette hypothèse nécessiterait un découpage CSV-aware.
export async function preprocessManifest(
  manifestId: string,
  source: string,
  dataset: string,
  datasetVersion: string,
  originalPartCount: number,
  chunkTargetRows: number,
): Promise<{ totalChunks: number; totalRows: number }> {
  try {
    return await preprocessManifestInner(manifestId, source, dataset, datasetVersion, originalPartCount, chunkTargetRows)
  } catch (error) {
    // Les chunks déjà flushés avant l'échec restent en base (traçables,
    // pas perdus) mais le manifeste ne passe jamais READY sur une
    // décompression incomplète — jamais present comme "prêt" ce qui ne
    // l'est pas.
    await setManifestStatus(manifestId, "FAILED", error instanceof Error ? error.message : "Erreur inconnue.")
    throw error
  }
}

async function preprocessManifestInner(
  manifestId: string,
  source: string,
  dataset: string,
  datasetVersion: string,
  originalPartCount: number,
  chunkTargetRows: number,
): Promise<{ totalChunks: number; totalRows: number }> {
  const stream = readStagingStream(source, `${dataset}/original`, datasetVersion, originalPartCount)
  const unzipped = stream.pipe(unzipper.ParseOne())

  let header: string | null = null
  let pending: string[] = []
  let chunkIndex = 0
  let totalRows = 0
  let leftover = ""

  // Flush réellement incrémental : appelé au fil de la lecture (via
  // for-await, qui suspend le flux tant qu'on est en train d'écrire —
  // backpressure naturelle), jamais après accumulation de tout le
  // fichier décompressé en mémoire.
  const flushChunk = async () => {
    if (pending.length === 0 || !header) return
    const csvText = header + "\n" + pending.join("\n") + "\n"
    const gz = gzipSync(Buffer.from(csvText, "utf8"))
    const checksum = createHash("sha256").update(gz).digest("hex")
    await writeStagingPart(source, `${dataset}/chunks`, datasetVersion, chunkIndex, gz)
    const s3Key = stagingKeyFor(source, `${dataset}/chunks`, datasetVersion, chunkIndex)
    await addChunk(manifestId, chunkIndex, s3Key, checksum, gz.length, pending.length)
    totalRows += pending.length
    chunkIndex += 1
    pending = []
  }

  // unzipper.ParseOne() n'implémente pas Symbol.asyncIterator (constaté
  // en conditions réelles : "unzipped is not async iterable") — flux
  // classique 'data'/'end'/'error' avec pause()/resume() manuels pour
  // garder une vraie backpressure pendant les écritures async
  // (writeStagingPart), plutôt qu'un for-await qui ne fonctionne pas ici.
  //
  // Garde supplémentaire (process.on('uncaughtException')) : constaté en
  // conditions réelles qu'un flux ZIP tronqué/corrompu fait parfois
  // planter unzipper avec une exception interne (FILE_ENDED, levée hors
  // de toute promesse, dans un handler interne de node:internal/streams)
  // qui ne remonte PAS via l'écouteur 'error' ci-dessous — un défaut
  // connu de la librairie, pas une erreur de ce code. Sans cette garde,
  // un seul fichier source corrompu planterait tout le processus plutôt
  // que de marquer le manifeste FAILED proprement. Retirée dans le
  // `finally`, qu'elle ait servi ou non.
  let settled = false
  const crashGuard = (err: unknown) => {
    if (settled) return
    settled = true
    rejectOuter(err instanceof Error ? err : new Error(String(err)))
  }
  let rejectOuter: (err: Error) => void = () => {}
  try {
    await new Promise<void>((resolve, reject) => {
      rejectOuter = reject
      process.once("uncaughtException", crashGuard)
      unzipped.on("data", (rawChunk: Buffer) => {
        unzipped.pause()
        void (async () => {
          try {
            leftover += rawChunk.toString("utf8")
            const lines = leftover.split("\n")
            leftover = lines.pop() ?? ""
            for (const line of lines) {
              if (header === null) {
                header = line
                continue
              }
              if (line === "") continue
              pending.push(line)
              if (pending.length >= chunkTargetRows) {
                await flushChunk()
              }
            }
            unzipped.resume()
          } catch (err) {
            settled = true
            reject(err)
          }
        })()
      })
      unzipped.on("end", () => {
        settled = true
        resolve()
      })
      unzipped.on("error", (err) => {
        settled = true
        reject(err)
      })
    })
  } finally {
    process.removeListener("uncaughtException", crashGuard)
  }
  if (leftover.trim() !== "" && header !== null) pending.push(leftover)
  await flushChunk() // dernier chunk, potentiellement incomplet

  await finalizeManifest(manifestId, chunkIndex, totalRows)
  return { totalChunks: chunkIndex, totalRows }
}

interface ChunkIngestCheckpoint extends IngestionCheckpoint {
  manifestId: string
  chunkIndex: number
  rowOffset: number
}

export type RowPersister = (row: Record<string, string>) => Promise<{ inserted: boolean; updated: boolean; rejected: boolean; error?: string }>

// Étape 3 — ingère les chunks du manifeste READY, un par un, dans
// l'ordre. Reprise bornée à un chunk (quelques dizaines de milliers de
// lignes), jamais au fichier entier.
export class ChunkIngestionRunner implements IngestionRunner {
  source: string
  dataset: string
  partition = "ingest"

  constructor(source: string, dataset: string, private persistRow: RowPersister) {
    this.source = source
    this.dataset = dataset
  }

  async runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult> {
    const prisma = await getPrisma()
    const manifest = await prisma.datasetManifest.findFirst({
      where: { source: this.source, dataset: this.dataset, status: "READY" },
      orderBy: { createdAt: "desc" },
    })
    if (!manifest) {
      throw new Error(`Aucun manifeste READY pour ${this.source}/${this.dataset} — lancer le staging + preprocessing d'abord.`)
    }

    const cp = (checkpoint as ChunkIngestCheckpoint | null) ?? { manifestId: manifest.id, chunkIndex: -1, rowOffset: 0 }

    let inserted = 0
    let updated = 0
    let rejected = 0
    let read = 0
    const errors: string[] = []
    const batchSize = getBatchSize(2000)

    let chunk =
      cp.chunkIndex >= 0
        ? await prisma.datasetChunk.findUnique({ where: { manifestId_chunkIndex: { manifestId: manifest.id, chunkIndex: cp.chunkIndex } } })
        : await getNextPendingChunk(manifest.id)

    if (!chunk) {
      return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: cp, done: true }
    }

    let rowOffset = cp.chunkIndex === chunk.chunkIndex ? cp.rowOffset : 0

    while (chunk && Date.now() < deadlineMs) {
      const gz = await readStagingPart(this.source, `${this.dataset}/chunks`, manifest.datasetVersion, chunk.chunkIndex)
      const text = gunzipSync(gz).toString("utf8")
      const lines = text.split("\n").filter((l) => l.length > 0)
      const header = lines[0]?.split(",") ?? []
      const dataLines = lines.slice(1)

      let processedInChunk = 0
      for (let i = rowOffset; i < dataLines.length; i += 1) {
        if (read >= batchSize || Date.now() >= deadlineMs) break
        const values = parseCsvLine(dataLines[i])
        const row: Record<string, string> = {}
        header.forEach((key, idx) => (row[key] = values[idx] ?? ""))

        try {
          const result = await this.persistRow(row)
          if (result.inserted) inserted += 1
          if (result.updated) updated += 1
          if (result.rejected) {
            rejected += 1
            if (result.error) errors.push(result.error)
          }
        } catch (error) {
          rejected += 1
          errors.push(error instanceof Error ? error.message : "erreur inconnue")
        }
        read += 1
        processedInChunk += 1
      }
      rowOffset += processedInChunk

      if (rowOffset >= dataLines.length) {
        await markChunkIngested(chunk.id, "")
        rowOffset = 0
        chunk = await getNextPendingChunk(manifest.id)
      } else {
        await updateChunkRowOffset(chunk.id, rowOffset)
        break // budget de lot atteint dans ce chunk, on s'arrête proprement
      }

      if (read >= batchSize) break
    }

    const done = !chunk
    const next: ChunkIngestCheckpoint = { manifestId: manifest.id, chunkIndex: chunk?.chunkIndex ?? -1, rowOffset }
    return { read, inserted, updated, rejected, errors, checkpoint: next, done }
  }
}

// Parseur CSV minimal (gère les champs entre guillemets avec virgules
// internes, comme produit par SIRENE) — volontairement simple plutôt que
// d'ajouter une dépendance pour un format déjà connu et stable.
function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (c === '"') {
        inQuotes = false
      } else {
        current += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      values.push(current)
      current = ""
    } else {
      current += c
    }
  }
  values.push(current)
  return values
}
