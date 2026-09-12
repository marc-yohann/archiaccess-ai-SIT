// Runner BAN — ingestion nationale bulk (voir CLAUDE.md et l'audit du
// 2026-09-13, section I du brief Phase 3). Fichier officiel réel par
// département (adresse.data.gouv.fr, gzip simple — pas un ZIP), vérifié
// en direct : 101 départements réels (métropole + Corse 2A/2B + 5 DOM
// 971/972/973/974/976), tailles réelles constatées de 2,4 à 35,5 Mo
// compressés. Alimente le référentiel Site déjà existant (Phase 1) —
// même clé d'upsert (citycode, label), aucune nouvelle table.
//
// Partition technique par département (jamais une priorité métier) —
// contrairement à SIRENE, PAS de manifeste/découpage en chunks : chaque
// fichier départemental est assez petit (quelques dizaines de Mo max)
// pour qu'une reprise "redécompresser + ignorer N lignes" reste rapide
// même en fin de fichier (des dizaines/centaines de milliers de lignes,
// pas des dizaines de millions) — le problème qui a motivé le découpage
// en chunks pour SIRENE (fichier national unique, ~30M lignes) ne se pose
// pas à cette échelle. Ne pas sur-ingénierer.

import { gunzipSync } from "node:zlib"
import { getPrisma } from "@/lib/prisma"
import { writeStagingPart, readStagingStream } from "@/lib/ingestion/staging"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

const DEPARTEMENTS_API_URL = "https://geo.api.gouv.fr/departements?fields=code&format=json"
const BAN_BASE_URL = "https://adresse.data.gouv.fr/data/ban/adresses/latest/csv"

let departementsCache: string[] | null = null

async function getDepartementsSorted(): Promise<string[]> {
  if (departementsCache) return departementsCache
  const res = await fetch(DEPARTEMENTS_API_URL, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`API départements (geo.api.gouv.fr) a répondu ${res.status}`)
  const data = (await res.json()) as Array<{ code: string }>
  departementsCache = data.map((d) => d.code).sort()
  return departementsCache
}

async function resolveDepartementResource(deptCode: string): Promise<{ url: string; totalBytes: number }> {
  const url = `${BAN_BASE_URL}/adresses-${deptCode}.csv.gz`
  const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Fichier BAN département ${deptCode} : réponse ${res.status}`)
  const contentLength = res.headers.get("content-length")
  if (!contentLength) throw new Error(`Fichier BAN département ${deptCode} : Content-Length absent.`)
  return { url, totalBytes: Number(contentLength) }
}

interface BanCheckpoint extends IngestionCheckpoint {
  deptIndex: number
  deptCode: string
  phase: "download" | "process"
  resourceUrl: string
  totalBytes: number
  bytesDownloaded: number
  partCount: number
  rowsSkip: number
}

function isEmpty(v: string | undefined): boolean {
  return v === undefined || v === ""
}

function composeLabel(row: Record<string, string>): string | null {
  const numero = [row.numero, row.rep].filter((p) => !isEmpty(p)).join(row.rep ? " " : "")
  const parts = [numero, row.nom_voie, row.code_postal, row.nom_commune].filter((p) => !isEmpty(p))
  return parts.length > 0 ? parts.join(" ") : null
}

async function persistBanBatch(rows: Record<string, string>[]): Promise<{ inserted: number; updated: number; rejected: number; errors: string[] }> {
  const prisma = await getPrisma()
  let inserted = 0
  let updated = 0
  let rejected = 0
  const errors: string[] = []

  for (const row of rows) {
    const citycode = row.code_insee
    const label = composeLabel(row)
    const lon = Number(row.lon)
    const lat = Number(row.lat)

    if (isEmpty(citycode) || !label || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      rejected += 1
      errors.push(`Ligne rejetée (champ requis absent/invalide) : ${JSON.stringify(row).slice(0, 150)}`)
      continue
    }

    try {
      const before = await prisma.site.findUnique({ where: { citycode_label: { citycode, label } }, select: { id: true } })
      const site = await prisma.site.upsert({
        where: { citycode_label: { citycode, label } },
        create: {
          label,
          citycode,
          postcode: row.code_postal || "",
          city: row.nom_commune || "",
          longitude: lon,
          latitude: lat,
        },
        update: {
          postcode: row.code_postal || undefined,
          city: row.nom_commune || undefined,
          longitude: lon,
          latitude: lat,
        },
      })
      if (before) updated += 1
      else inserted += 1

      // geom (PostGIS, colonne additive) — Unsupported() côté Prisma,
      // mise à jour par SQL brut juste après l'upsert normal (même
      // patron que DocumentChunk.embedding pour pgvector).
      await prisma.$executeRaw`UPDATE "Site" SET "geom" = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326) WHERE "id" = ${site.id}`

      await prisma.siteSource.upsert({
        where: { siteId_source: { siteId: site.id, source: "ban" } },
        create: { siteId: site.id, source: "ban" },
        update: { fetchedAt: new Date() },
      })
    } catch (error) {
      rejected += 1
      errors.push(`${label} : ${error instanceof Error ? error.message : "erreur inconnue"}`)
    }
  }

  return { inserted, updated, rejected, errors }
}

export class BanIngestionRunner implements IngestionRunner {
  source = "ban"
  dataset = "adresses"
  partition = "national"

  async runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult> {
    if (!checkpoint) {
      const departements = await getDepartementsSorted()
      const deptCode = departements[0]
      const { url, totalBytes } = await resolveDepartementResource(deptCode)
      const initial: BanCheckpoint = {
        deptIndex: 0,
        deptCode,
        phase: "download",
        resourceUrl: url,
        totalBytes,
        bytesDownloaded: 0,
        partCount: 0,
        rowsSkip: 0,
      }
      return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: initial, done: false }
    }

    const cp = checkpoint as BanCheckpoint
    if (cp.phase === "download") return this.runDownloadBatch(cp)
    return this.runProcessBatch(cp, deadlineMs)
  }

  private async runDownloadBatch(cp: BanCheckpoint): Promise<BatchResult> {
    const chunkSize = getBatchSize(8_000_000, "INGESTION_DOWNLOAD_CHUNK_BYTES")
    const rangeEnd = Math.min(cp.bytesDownloaded + chunkSize - 1, cp.totalBytes - 1)

    const res = await fetch(cp.resourceUrl, {
      headers: { Range: `bytes=${cp.bytesDownloaded}-${rangeEnd}` },
      signal: AbortSignal.timeout(25000),
    })
    if (res.status !== 206 && res.status !== 200) {
      throw new Error(`Téléchargement BAN ${cp.deptCode} : réponse ${res.status}`)
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeStagingPart(this.source, this.dataset, cp.deptCode, cp.partCount, buffer)

    const bytesDownloaded = cp.bytesDownloaded + buffer.length
    const done = bytesDownloaded >= cp.totalBytes
    const next: BanCheckpoint = { ...cp, bytesDownloaded, partCount: cp.partCount + 1, phase: done ? "process" : "download" }
    return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: next, done: false }
  }

  private async runProcessBatch(cp: BanCheckpoint, deadlineMs: number): Promise<BatchResult> {
    const batchSize = getBatchSize(2000)
    const stream = readStagingStream(this.source, this.dataset, cp.deptCode, cp.partCount)
    const chunks: Buffer[] = []
    for await (const c of stream as AsyncIterable<Buffer>) chunks.push(c)
    const text = gunzipSync(Buffer.concat(chunks)).toString("utf8")
    const lines = text.split("\n").filter((l) => l.length > 0)
    const header = lines[0]?.split(";") ?? []
    const dataLines = lines.slice(1)

    let inserted = 0
    let updated = 0
    let rejected = 0
    const errors: string[] = []
    let rowsReadThisBatch = 0
    let batch: Record<string, string>[] = []

    const flush = async () => {
      if (batch.length === 0) return
      const result = await persistBanBatch(batch)
      inserted += result.inserted
      updated += result.updated
      rejected += result.rejected
      errors.push(...result.errors)
      batch = []
    }

    let i = cp.rowsSkip
    for (; i < dataLines.length; i += 1) {
      const values = dataLines[i].split(";")
      const row: Record<string, string> = {}
      header.forEach((key, idx) => (row[key] = values[idx] ?? ""))
      batch.push(row)
      rowsReadThisBatch += 1

      if (batch.length >= batchSize) {
        await flush()
        if (Date.now() >= deadlineMs) {
          i += 1
          break
        }
      }
    }
    await flush()

    const rowsSkip = i
    const deptDone = rowsSkip >= dataLines.length

    let next: BanCheckpoint
    let allDone = false
    if (deptDone) {
      const departements = await getDepartementsSorted()
      const nextIndex = cp.deptIndex + 1
      if (nextIndex >= departements.length) {
        allDone = true
        next = cp
      } else {
        const nextDept = departements[nextIndex]
        const { url, totalBytes } = await resolveDepartementResource(nextDept)
        next = {
          deptIndex: nextIndex,
          deptCode: nextDept,
          phase: "download",
          resourceUrl: url,
          totalBytes,
          bytesDownloaded: 0,
          partCount: 0,
          rowsSkip: 0,
        }
      }
    } else {
      next = { ...cp, rowsSkip }
    }

    return { read: rowsReadThisBatch, inserted, updated, rejected, errors, checkpoint: next, done: allDone }
  }
}
