// Moteur générique de découpage des gros fichiers bulk GeoJSON.gz (Phase
// 4, Cadastre) — même principe que lib/ingestion/chunked-zip.ts (SIRENE,
// CSV-in-ZIP) mais pour un format structurellement différent : un
// FeatureCollection GeoJSON est UN SEUL objet JSON englobant un tableau
// "features", pas des lignes indépendantes — on ne peut pas le découper
// par simple séparateur de ligne. Utilise stream-json (Pick + StreamArray)
// pour extraire chaque Feature en flux, sans jamais charger l'arbre JSON
// complet en mémoire.
//
// Réutilise StagingRunner tel quel (générique, ne connaît rien du format
// du contenu téléchargé) — seule la décompression/l'extraction change
// (gzip simple ici, pas un conteneur ZIP ; JSON structuré, pas du CSV).

import { createHash } from "node:crypto"
import { gzipSync, gunzipSync, createGunzip } from "node:zlib"
import { parser } from "stream-json"
import { pick } from "stream-json/filters/pick.js"
import { streamArray } from "stream-json/streamers/stream-array.js"
import chain from "stream-chain"
import { readStagingStream, readStagingPart, stagingKeyFor, writeStagingPart } from "@/lib/ingestion/staging"
import { getOrCreateManifest, setManifestStatus, addChunk, finalizeManifest, getNextPendingChunk, markChunkIngested, updateChunkRowOffset } from "@/lib/ingestion/manifest"
import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

export { StagingRunner } from "@/lib/ingestion/chunked-zip"

export interface GeoJsonFeature {
  type: "Feature"
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: unknown } | null
}

export async function preprocessGeoJsonManifest(
  manifestId: string,
  source: string,
  dataset: string,
  datasetVersion: string,
  originalPartCount: number,
  chunkTargetRows: number,
): Promise<{ totalChunks: number; totalRows: number }> {
  try {
    return await preprocessGeoJsonManifestInner(manifestId, source, dataset, datasetVersion, originalPartCount, chunkTargetRows)
  } catch (error) {
    await setManifestStatus(manifestId, "FAILED", error instanceof Error ? error.message : "Erreur inconnue.")
    throw error
  }
}

async function preprocessGeoJsonManifestInner(
  manifestId: string,
  source: string,
  dataset: string,
  datasetVersion: string,
  originalPartCount: number,
  chunkTargetRows: number,
): Promise<{ totalChunks: number; totalRows: number }> {
  const stream = readStagingStream(source, `${dataset}/original`, datasetVersion, originalPartCount)
  const gunzipped = stream.pipe(createGunzip())
  const pipeline = chain([gunzipped, parser(), pick({ filter: "features" }), streamArray()])

  let pending: GeoJsonFeature[] = []
  let chunkIndex = 0
  let totalRows = 0

  const flushChunk = async () => {
    if (pending.length === 0) return
    const ndjson = pending.map((f) => JSON.stringify(f)).join("\n") + "\n"
    const gz = gzipSync(Buffer.from(ndjson, "utf8"))
    const checksum = createHash("sha256").update(gz).digest("hex")
    await writeStagingPart(source, `${dataset}/chunks`, datasetVersion, chunkIndex, gz)
    const s3Key = stagingKeyFor(source, `${dataset}/chunks`, datasetVersion, chunkIndex)
    await addChunk(manifestId, chunkIndex, s3Key, checksum, gz.length, pending.length)
    totalRows += pending.length
    chunkIndex += 1
    pending = []
  }

  // Garde process.on('uncaughtException') — même précaution que
  // lib/ingestion/chunked-zip.ts : un flux gzip tronqué/corrompu peut
  // faire planter une librairie de (dé)compression en dehors de toute
  // promesse suivie. Retirée après usage, qu'elle ait servi ou non.
  let settled = false
  let rejectOuter: (err: Error) => void = () => {}
  const crashGuard = (err: unknown) => {
    if (settled) return
    settled = true
    rejectOuter(err instanceof Error ? err : new Error(String(err)))
  }
  try {
    await new Promise<void>((resolve, reject) => {
      rejectOuter = reject
      process.once("uncaughtException", crashGuard)
      pipeline.on("data", ({ value }: { value: GeoJsonFeature }) => {
        pipeline.pause()
        void (async () => {
          try {
            pending.push(value)
            if (pending.length >= chunkTargetRows) {
              await flushChunk()
            }
            pipeline.resume()
          } catch (err) {
            settled = true
            reject(err)
          }
        })()
      })
      pipeline.on("end", () => {
        settled = true
        resolve()
      })
      pipeline.on("error", (err: Error) => {
        settled = true
        reject(err)
      })
    })
  } finally {
    process.removeListener("uncaughtException", crashGuard)
  }
  await flushChunk() // dernier chunk, potentiellement incomplet

  await finalizeManifest(manifestId, chunkIndex, totalRows)
  return { totalChunks: chunkIndex, totalRows }
}

interface ChunkIngestCheckpoint extends IngestionCheckpoint {
  manifestId: string
  chunkIndex: number
  rowOffset: number
}

// datasetVersion transmis par runBatch (déjà résolu une fois par lot) —
// ne jamais le requêter à nouveau par ligne (constaté réellement pendant
// la validation : un re-lookup par ligne coûtait cher à l'échelle,
// voir le rapport).
export type FeaturePersister = (feature: GeoJsonFeature, datasetVersion: string) => Promise<{ inserted: boolean; updated: boolean; rejected: boolean; error?: string }>

export class GeoJsonChunkIngestionRunner implements IngestionRunner {
  source: string
  dataset: string
  partition = "ingest"

  constructor(source: string, dataset: string, private persistFeature: FeaturePersister) {
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
      const lines = gunzipSync(gz).toString("utf8").split("\n").filter((l) => l.length > 0)

      let processedInChunk = 0
      for (let i = rowOffset; i < lines.length; i += 1) {
        if (read >= batchSize || Date.now() >= deadlineMs) break
        let feature: GeoJsonFeature
        try {
          feature = JSON.parse(lines[i]) as GeoJsonFeature
        } catch {
          rejected += 1
          errors.push(`Ligne non-JSON dans le chunk ${chunk.chunkIndex} (position ${i})`)
          read += 1
          processedInChunk += 1
          continue
        }

        try {
          const result = await this.persistFeature(feature, manifest.datasetVersion)
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

      if (rowOffset >= lines.length) {
        await markChunkIngested(chunk.id, "")
        rowOffset = 0
        chunk = await getNextPendingChunk(manifest.id)
      } else {
        await updateChunkRowOffset(chunk.id, rowOffset)
        break
      }

      if (read >= batchSize) break
    }

    const done = !chunk
    const next: ChunkIngestCheckpoint = { manifestId: manifest.id, chunkIndex: chunk?.chunkIndex ?? -1, rowOffset }
    return { read, inserted, updated, rejected, errors, checkpoint: next, done }
  }
}
