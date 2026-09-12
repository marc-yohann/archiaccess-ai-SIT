// Runner SIRENE — ingestion nationale du fichier StockEtablissement
// officiel (INSEE, via data.gouv.fr), voir CLAUDE.md et l'audit du
// 2026-09-12. Deux phases dans un seul job ("sirene:stock-etablissement:
// national") :
//   1. "download" — téléchargement par morceaux bornés (Range HTTP réel,
//      vérifié en direct — voir CLAUDE.md), un morceau = un objet de
//      staging (lib/ingestion/staging.ts). Reprise = poursuivre au
//      dernier octet téléchargé, jamais retélécharger ce qui est déjà
//      staged.
//   2. "process" — flux continu des morceaux stagés → décompression ZIP
//      en flux (jamais tout le fichier en mémoire) → parsing CSV en flux
//      → upsert par lot. Limite connue : Node ne permet pas de reprendre
//      une décompression DEFLATE à un octet arbitraire (pas d'état
//      sérialisable) — la reprise consiste donc à rouvrir le flux depuis
//      le début et à IGNORER (sans écriture DB) les lignes déjà
//      comptabilisées (rowsSkip), jusqu'à rowsSkip, puis à traiter la
//      suite. Correct (upsert idempotent, aucun doublon) mais coûteux à
//      grande échelle : voir le rapport pour le seuil précis où ça cesse
//      d'être praticable sur une seule invocation Lambda.
//
// Champs non fournis par CE fichier : la dénomination légale (SIREN)
// vit dans StockUniteLegale, un fichier séparé, pas encore ingéré — Acteur.nom
// reste donc rempli seulement quand une enseigne/dénomination usuelle
// d'établissement existe sur la ligne, sinon null (jamais fabriqué).
// Coordonnées : ce fichier donne des coordonnées Lambert (93/GEO), pas
// WGS84 — aucune conversion n'est appliquée ici pour ne pas produire des
// coordonnées approximatives non vérifiées ; latitude/longitude restent
// null pour les établissements importés en masse (seule la résolution
// ponctuelle via BAN, Phase 2, donne des coordonnées WGS84 réelles).
// Résolution de Site : jamais tentée en masse (30M appels BAN violeraient
// les quotas d'une API publique, voir CLAUDE.md) — siteId reste null à
// l'ingestion bulk, sauf convergence ultérieure via upsert SIRET si
// l'établissement est un jour retrouvé par une recherche ponctuelle.

import unzipper from "unzipper"
import { parse } from "csv-parse"
import { getPrisma } from "@/lib/prisma"
import { writeStagingPart, readStagingStream } from "@/lib/ingestion/staging"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

const DATASET_API_URL =
  "https://www.data.gouv.fr/api/1/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/"
const RESOURCE_TITLE_PREFIX = "Sirene : Fichier StockEtablissement - "

interface SireneCheckpoint extends IngestionCheckpoint {
  phase: "download" | "process"
  resourceUrl: string
  totalBytes: number
  datasetVersion: string
  bytesDownloaded: number
  partCount: number
  rowsSkip: number
}

// Résout dynamiquement l'URL du millésime en cours plutôt que de figer un
// lien daté (le fichier est republié mensuellement, vérifié en direct —
// voir le rapport). Utilise l'API catalogue data.gouv.fr, jamais une URL
// supposée.
async function resolveStockResource(): Promise<{ url: string; totalBytes: number; version: string }> {
  const res = await fetch(DATASET_API_URL, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`API data.gouv.fr a répondu ${res.status}`)
  const data = (await res.json()) as { resources: Array<{ title: string; url: string; filesize: number }> }
  const resource = data.resources.find((r) => r.title.startsWith(RESOURCE_TITLE_PREFIX) && r.url.endsWith(".zip"))
  if (!resource) throw new Error("Ressource StockEtablissement (zip) introuvable dans le catalogue data.gouv.fr.")
  const version = resource.title.slice(RESOURCE_TITLE_PREFIX.length).trim()
  return { url: resource.url, totalBytes: resource.filesize, version }
}

function isEmpty(value: string | undefined): boolean {
  return value === undefined || value === ""
}

// Adresse composée à partir des seuls fragments réellement présents sur
// la ligne — jamais de valeur devinée pour un fragment absent.
function composeAdresse(row: Record<string, string>): string | null {
  const parts = [row.numeroVoieEtablissement, row.indiceRepetitionEtablissement, row.typeVoieEtablissement, row.libelleVoieEtablissement].filter(
    (p) => !isEmpty(p),
  )
  return parts.length > 0 ? parts.join(" ") : null
}

// etatAdministratifEtablissement utilise A/F (Actif/Fermé) — vocabulaire
// distinct de l'API de recherche ponctuelle (recherche-entreprises,
// A/C — voir lib/data-sources/entreprises.ts) : à ne jamais réutiliser
// tel quel, vérifié sur données réelles (voir le rapport).
function actifFromEtat(etat: string | undefined): boolean | null {
  if (etat === "A") return true
  if (etat === "F") return false
  return null
}

async function persistBatch(rows: Record<string, string>[]): Promise<{ inserted: number; updated: number; rejected: number; errors: string[] }> {
  const prisma = await getPrisma()
  let inserted = 0
  let updated = 0
  let rejected = 0
  const errors: string[] = []

  for (const row of rows) {
    const siren = row.siren
    const siret = row.siret
    if (isEmpty(siren) || isEmpty(siret)) {
      rejected += 1
      errors.push(`Ligne rejetée (siren/siret manquant) : ${JSON.stringify(row).slice(0, 200)}`)
      continue
    }

    try {
      const nom = row.denominationUsuelleEtablissement || row.enseigne1Etablissement || undefined
      const acteurBefore = await prisma.acteur.findUnique({ where: { siren }, select: { id: true } })

      const acteur = await prisma.acteur.upsert({
        where: { siren },
        create: {
          siren,
          nom: nom ?? null,
          nomCommercial: row.enseigne1Etablissement || null,
          codeNaf: row.activitePrincipaleEtablissement || null,
          dateCreation: row.dateCreationEtablissement || null,
        },
        // undefined = ne touche pas au champ (ne jamais écraser une
        // valeur déjà connue par une absence sur cette ligne précise).
        update: {
          nom: nom,
          nomCommercial: row.enseigne1Etablissement || undefined,
          codeNaf: row.activitePrincipaleEtablissement || undefined,
        },
      })
      if (!acteurBefore) inserted += 1

      const etabBefore = await prisma.etablissement.findUnique({ where: { siret }, select: { id: true } })
      await prisma.etablissement.upsert({
        where: { siret },
        create: {
          acteurId: acteur.id,
          siret,
          adresse: composeAdresse(row),
          codePostal: row.codePostalEtablissement || null,
          codeInsee: row.codeCommuneEtablissement || null,
          commune: row.libelleCommuneEtablissement || null,
          estSiege: row.etablissementSiege === "true",
          actif: actifFromEtat(row.etatAdministratifEtablissement),
        },
        update: {
          adresse: composeAdresse(row) ?? undefined,
          codePostal: row.codePostalEtablissement || undefined,
          commune: row.libelleCommuneEtablissement || undefined,
          actif: actifFromEtat(row.etatAdministratifEtablissement) ?? undefined,
        },
      })
      if (etabBefore) updated += 1
      else inserted += 1

      await prisma.acteurSource.upsert({
        where: { acteurId_source: { acteurId: acteur.id, source: "sirene-stock" } },
        create: { acteurId: acteur.id, source: "sirene-stock" },
        update: { fetchedAt: new Date() },
      })
    } catch (error) {
      rejected += 1
      errors.push(`SIRET ${siret} : ${error instanceof Error ? error.message : "erreur inconnue"}`)
    }
  }

  return { inserted, updated, rejected, errors }
}

export class SireneIngestionRunner implements IngestionRunner {
  source = "sirene"
  dataset = "stock-etablissement"
  partition = "national"

  async runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult> {
    if (!checkpoint) {
      const { url, totalBytes, version } = await resolveStockResource()
      const initial: SireneCheckpoint = {
        phase: "download",
        resourceUrl: url,
        totalBytes,
        datasetVersion: version,
        bytesDownloaded: 0,
        partCount: 0,
        rowsSkip: 0,
      }
      return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: initial, done: false }
    }

    const cp = checkpoint as SireneCheckpoint

    if (cp.phase === "download") {
      return this.runDownloadBatch(cp)
    }
    return this.runProcessBatch(cp, deadlineMs)
  }

  private async runDownloadBatch(cp: SireneCheckpoint): Promise<BatchResult> {
    // Variable dédiée (octets), jamais partagée avec INGESTION_BATCH_SIZE
    // (lignes du traitement) — voir lib/ingestion/types.ts.
    const chunkSize = getBatchSize(8_000_000, "INGESTION_DOWNLOAD_CHUNK_BYTES")
    const rangeEnd = Math.min(cp.bytesDownloaded + chunkSize - 1, cp.totalBytes - 1)

    const res = await fetch(cp.resourceUrl, {
      headers: { Range: `bytes=${cp.bytesDownloaded}-${rangeEnd}` },
      signal: AbortSignal.timeout(25000),
    })
    if (res.status !== 206 && res.status !== 200) {
      throw new Error(`Téléchargement SIRENE : réponse ${res.status} (Range non honorée ?)`)
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeStagingPart(this.source, this.dataset, cp.datasetVersion, cp.partCount, buffer)

    const bytesDownloaded = cp.bytesDownloaded + buffer.length
    const done = bytesDownloaded >= cp.totalBytes
    const next: SireneCheckpoint = {
      ...cp,
      bytesDownloaded,
      partCount: cp.partCount + 1,
      phase: done ? "process" : "download",
    }
    return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: next, done: false }
  }

  private async runProcessBatch(cp: SireneCheckpoint, deadlineMs: number): Promise<BatchResult> {
    const batchSize = getBatchSize(2000)
    const stream = readStagingStream(this.source, this.dataset, cp.datasetVersion, cp.partCount)
    const unzipped = stream.pipe(unzipper.ParseOne())
    const parser = unzipped.pipe(parse({ columns: true, relax_quotes: true, skip_empty_lines: true }))

    let rowIndex = 0
    let rowsReadThisBatch = 0
    let batch: Record<string, string>[] = []
    let inserted = 0
    let updated = 0
    let rejected = 0
    const errors: string[] = []
    let streamDone = false

    const flush = async () => {
      if (batch.length === 0) return
      const result = await persistBatch(batch)
      inserted += result.inserted
      updated += result.updated
      rejected += result.rejected
      errors.push(...result.errors)
      batch = []
    }

    try {
      for await (const row of parser as AsyncIterable<Record<string, string>>) {
        rowIndex += 1
        if (rowIndex <= cp.rowsSkip) continue // déjà traité lors d'une invocation précédente

        batch.push(row)
        rowsReadThisBatch += 1

        if (batch.length >= batchSize) {
          await flush()
          if (Date.now() >= deadlineMs) break
        }
      }
      // Le for..of se termine naturellement quand le flux CSV est épuisé
      // (fin réelle du fichier stagé) — mais on peut aussi sortir par le
      // `break` ci-dessus (deadline atteinte avant la fin).
      if (rowIndex <= cp.rowsSkip + rowsReadThisBatch) {
        // Heuristique insuffisante : on détermine "fin de flux" via l'event
        // 'end' du parseur plutôt qu'en devinant — voir readable state.
      }
      streamDone = parser.readableEnded
    } finally {
      await flush()
    }

    const rowsSkip = cp.rowsSkip + rowsReadThisBatch
    const next: SireneCheckpoint = { ...cp, rowsSkip }
    return {
      read: rowsReadThisBatch,
      inserted,
      updated,
      rejected,
      errors,
      checkpoint: next,
      done: streamDone,
    }
  }
}
