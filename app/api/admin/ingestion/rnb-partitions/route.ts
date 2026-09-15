import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getDepartementsSorted } from "@/lib/ingestion/departements"

// Registre technique des 101 partitions RNB (Phase 5E, section 6 du
// brief) — PAS une nouvelle table : entièrement dérivé de IngestionJob
// (partitions "stage"/"ingest", déjà une ligne par département depuis
// Phase 5C) et DatasetManifest (checksum/version/chunks, déjà une ligne
// par département), croisés avec la liste officielle réelle des 101
// départements (geo.api.gouv.fr, déjà utilisée par BAN/Cadastre — voir
// lib/ingestion/departements.ts) et BatimentPhysique.sourcePartition
// (Phase 5E, voir prisma/schema.prisma). Aucune ingestion nationale
// déclenchée par cette route — lecture seule.
//
// Statut dérivé (PENDING/DOWNLOADING/STAGED/CHUNKED/RUNNING/DONE/FAILED/
// PAUSED, voir le rapport Phase 5E section 6) — IngestionStatus existant
// (PENDING/RUNNING/PAUSED/COMPLETED/FAILED/CANCELLED) ne distingue pas
// "en téléchargement" de "en ingestion" ni "staged" de "chunked" : cette
// route calcule un statut plus fin à partir de DEUX jobs (stage + ingest)
// et du manifeste, sans ajouter de nouvelle colonne de statut nulle part.
// CANCELLED (IngestionJob) est mappé sur PAUSED (registre) — le
// vocabulaire le plus proche existant, documenté ici plutôt que
// silencieux.
type PartitionStatus = "PENDING" | "DOWNLOADING" | "STAGED" | "CHUNKED" | "RUNNING" | "DONE" | "FAILED" | "PAUSED"

interface JobLike {
  status: string
  recordsRead: number
  errorCount: number
  lastError: string | null
  nextRunAt: Date | null
  updatedAt: Date
}

function deriveStatus(stageJob: JobLike | undefined, ingestJob: JobLike | undefined, manifestReady: boolean): PartitionStatus {
  if (ingestJob) {
    if (ingestJob.status === "COMPLETED") return "DONE"
    if (ingestJob.status === "RUNNING") return "RUNNING"
    if (ingestJob.status === "FAILED") return "FAILED"
    if (ingestJob.status === "CANCELLED") return "PAUSED"
  }
  if (manifestReady) return "CHUNKED"
  if (stageJob) {
    if (stageJob.status === "COMPLETED") return "STAGED"
    if (stageJob.status === "RUNNING") return "DOWNLOADING"
    if (stageJob.status === "FAILED") return "FAILED"
    if (stageJob.status === "CANCELLED") return "PAUSED"
  }
  return "PENDING"
}

export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user?.isAdmin) {
    return NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 })
  }

  const prisma = await getPrisma()
  const [departements, jobs, manifests, batimentCounts] = await Promise.all([
    getDepartementsSorted().catch(() => [] as string[]),
    prisma.ingestionJob.findMany({ where: { source: "rnb", dataset: { startsWith: "batiments/" } } }),
    prisma.datasetManifest.findMany({ where: { source: "rnb", dataset: { startsWith: "batiments/" } }, orderBy: { createdAt: "desc" } }),
    prisma.batimentPhysique.groupBy({ by: ["sourcePartition"], _count: { _all: true } }),
  ])

  const batimentCountByDept = new Map<string, number>()
  for (const row of batimentCounts) {
    if (row.sourcePartition) batimentCountByDept.set(row.sourcePartition, row._count._all)
  }

  const partitions = departements.map((dept) => {
    const dataset = `batiments/${dept}`
    const stageJob = jobs.find((j) => j.dataset === dataset && j.partition === "stage")
    const ingestJob = jobs.find((j) => j.dataset === dataset && j.partition === "ingest")
    // Le manifeste le plus récent pour ce département (createdAt desc,
    // voir la query ci-dessus) — un dataset ne devrait avoir qu'un
    // manifeste "READY" à la fois en pratique (voir DatasetManifest,
    // prisma/schema.prisma) mais on prend le plus récent par prudence.
    const manifest = manifests.find((m) => m.dataset === dataset)
    const status = deriveStatus(stageJob, ingestJob, manifest?.status === "READY")

    return {
      departement: dept,
      status,
      sourceUrl: manifest?.sourceUrl ?? null,
      originalSizeBytes: manifest?.originalSizeBytes ? manifest.originalSizeBytes.toString() : null,
      originalChecksum: manifest?.originalChecksum ?? null,
      datasetVersion: manifest?.datasetVersion ?? null,
      totalChunks: manifest?.totalChunks ?? null,
      totalRows: manifest?.totalRows ?? null,
      batiments: batimentCountByDept.get(dept) ?? 0,
      recordsRead: ingestJob?.recordsRead ?? 0,
      errorCount: (stageJob?.errorCount ?? 0) + (ingestJob?.errorCount ?? 0),
      lastError: ingestJob?.lastError ?? stageJob?.lastError ?? null,
      nextRunAt: ingestJob?.nextRunAt ?? stageJob?.nextRunAt ?? null,
      lastUpdatedAt: ingestJob?.updatedAt ?? stageJob?.updatedAt ?? null,
    }
  })

  const summary = {
    total: partitions.length,
    pending: partitions.filter((p) => p.status === "PENDING").length,
    downloading: partitions.filter((p) => p.status === "DOWNLOADING").length,
    staged: partitions.filter((p) => p.status === "STAGED").length,
    chunked: partitions.filter((p) => p.status === "CHUNKED").length,
    running: partitions.filter((p) => p.status === "RUNNING").length,
    done: partitions.filter((p) => p.status === "DONE").length,
    failed: partitions.filter((p) => p.status === "FAILED").length,
    paused: partitions.filter((p) => p.status === "PAUSED").length,
    batimentsTotal: partitions.reduce((acc, p) => acc + p.batiments, 0),
  }

  return NextResponse.json({ success: true, summary, partitions })
}
