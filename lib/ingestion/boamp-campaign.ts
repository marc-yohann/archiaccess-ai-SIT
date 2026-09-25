// Orchestration de la campagne nationale BOAMP (mission "PASSER BOAMP EN
// INGESTION NATIONALE AUTOMATISÉE", 2026-09-25) — persistante (tout l'état
// vit en Postgres, jamais en mémoire process), reprenable (chaque tick
// relit l'état réel avant d'agir), idempotente (BoampNationalCampaign est
// un singleton, IngestionJob reste l'unique source de vérité par
// département). Aucune nouvelle brique d'infrastructure : réutilise le
// même mécanisme déjà en place pour /api/admin/ingestion/run (invocation
// bornée, déclenchée par EventBridge Scheduler — voir ce fichier) plutôt
// que SQS/Step Functions, absents du projet et non justifiés pour ~101
// lignes d'état.
//
// Un "tick" = un pas borné, sûr à appeler autant de fois que nécessaire
// (EventBridge Scheduler périodique) : il ne fait JAMAIS d'hypothèse sur
// l'état laissé par le tick précédent, toujours relu depuis la DB.

import { getPrisma } from "@/lib/prisma"
import { getOrCreateJob } from "@/lib/ingestion/job"
import { runOneInvocation } from "@/lib/ingestion/runner"
import { BoampIngestionRunner } from "@/lib/ingestion/sources/boamp"
import { preflightDepartment } from "@/lib/data-sources/boamp"
import { BOAMP_DEPARTMENTS } from "@/lib/ingestion/boamp-departments"

const SOURCE = "boamp"
const DATASET = "avis-marche"

// Nombre de départements preflightés par tick — un appel BOAMP rows=0 est
// rapide (mesuré <1s en pratique cette mission), 20/tick reste très en
// dessous du budget d'une invocation (voir getMaxBatchDurationMs) même
// avec de la marge pour la latence réseau réelle.
const PREFLIGHT_BATCH_SIZE = 20

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

// Taille allouée réelle du volume RDS (gp3, voir CLAUDE.md) — configurable
// sans changement de code si l'instance est redimensionnée.
function rdsAllocatedStorageGb(): number {
  return envFloat("RDS_ALLOCATED_STORAGE_GB", 20)
}

function maxConcurrencyDefault(): number {
  return envInt("BOAMP_MAX_CONCURRENCY", 1)
}

function minFreeStorageGbDefault(): number {
  return envFloat("BOAMP_MIN_FREE_STORAGE_GB", 2)
}

export async function getOrCreateCampaign() {
  const prisma = await getPrisma()
  const existing = await prisma.boampNationalCampaign.findFirst({ orderBy: { createdAt: "asc" } })
  if (existing) return existing
  return prisma.boampNationalCampaign.create({
    data: {
      totalDepartments: BOAMP_DEPARTMENTS.length,
      pendingDepartments: BOAMP_DEPARTMENTS.length,
      maxConcurrency: maxConcurrencyDefault(),
      minFreeStorageGb: minFreeStorageGbDefault(),
    },
  })
}

// Mesure directe en base (aucune permission IAM CloudWatch requise,
// contrairement à un appel à l'API CloudWatch depuis la Lambda — non
// vérifié disponible pour le rôle d'exécution, voir le rapport de
// mission). pg_database_size() couvre TOUTE la base (protection du
// disque RDS partagé, pas seulement les tables BOAMP) — c'est le
// comportement voulu du garde-fou.
async function freeStorageGb(): Promise<number> {
  const prisma = await getPrisma()
  const rows = await prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`
  const usedGb = Number(rows[0]?.bytes ?? 0) / 1024 ** 3
  return rdsAllocatedStorageGb() - usedGb
}

export interface PreflightBatchResult {
  checked: number
  remaining: number
  complete: boolean
}

// Preflighte jusqu'à PREFLIGHT_BATCH_SIZE départements pas encore
// vérifiés — persiste CHAQUE résultat immédiatement (upsert par
// département), jamais en fin de lot : un timeout Lambda en cours de
// route ne perd donc jamais la progression déjà faite.
export async function runPreflightBatch(): Promise<PreflightBatchResult> {
  const prisma = await getPrisma()
  const already = await prisma.boampDepartmentPreflight.findMany({ select: { department: true } })
  const alreadySet = new Set(already.map((r) => r.department))
  const remaining = BOAMP_DEPARTMENTS.filter((d) => !alreadySet.has(d))

  const batch = remaining.slice(0, PREFLIGHT_BATCH_SIZE)
  for (const department of batch) {
    const result = await preflightDepartment(department)
    await prisma.boampDepartmentPreflight.upsert({
      where: { department },
      create: {
        department,
        queryCode: result.queryCode,
        httpStatus: result.httpStatus,
        nhits: result.nhits,
        ok: result.ok,
        error: result.error,
      },
      update: {
        queryCode: result.queryCode,
        httpStatus: result.httpStatus,
        nhits: result.nhits,
        ok: result.ok,
        error: result.error,
        checkedAt: new Date(),
      },
    })
  }

  const remainingAfter = remaining.length - batch.length
  return { checked: batch.length, remaining: remainingAfter, complete: remainingAfter === 0 }
}

export async function preflightSummary() {
  const prisma = await getPrisma()
  const rows = await prisma.boampDepartmentPreflight.findMany({ orderBy: { department: "asc" } })
  const checkedCount = rows.length
  const okCount = rows.filter((r) => r.ok).length
  const failedRows = rows.filter((r) => !r.ok)
  const zeroHitsRows = rows.filter((r) => r.ok && (r.nhits ?? 0) === 0)
  return {
    totalDepartments: BOAMP_DEPARTMENTS.length,
    checkedCount,
    okCount,
    failedCount: failedRows.length,
    complete: checkedCount === BOAMP_DEPARTMENTS.length,
    failed: failedRows.map((r) => ({ department: r.department, queryCode: r.queryCode, httpStatus: r.httpStatus, error: r.error })),
    zeroHits: zeroHitsRows.map((r) => ({ department: r.department, queryCode: r.queryCode })),
    rows: rows.map((r) => ({ department: r.department, queryCode: r.queryCode, httpStatus: r.httpStatus, nhits: r.nhits, ok: r.ok, error: r.error })),
  }
}

// Recalcule TOUJOURS les compteurs depuis IngestionJob — jamais un
// compteur tenu à part qui pourrait diverger de la réalité.
async function recomputeCounters() {
  const prisma = await getPrisma()
  const jobs = await prisma.ingestionJob.findMany({
    where: { source: SOURCE, dataset: DATASET, partition: { in: [...BOAMP_DEPARTMENTS] } },
    select: { status: true },
  })
  const byStatus = { completed: 0, running: 0, failed: 0, pending: 0 }
  for (const j of jobs) {
    if (j.status === "COMPLETED") byStatus.completed += 1
    else if (j.status === "RUNNING") byStatus.running += 1
    else if (j.status === "FAILED" || j.status === "FAILED_REQUIRES_REVIEW") byStatus.failed += 1
    else byStatus.pending += 1
  }
  // Les départements jamais encore vus (aucun IngestionJob créé) comptent
  // aussi comme "pending" — n'existe pas encore en DB tant que start() ou
  // un tick n'a pas appelé getOrCreateJob() pour eux.
  const seeded = jobs.length
  byStatus.pending += BOAMP_DEPARTMENTS.length - seeded
  return byStatus
}

// Crée (si besoin) la ligne IngestionJob PENDING de chaque département
// pas déjà COMPLETED — idempotent (getOrCreateJob n'écrase jamais un job
// existant, quel que soit son statut). Départements déjà COMPLETED :
// aucun nouveau job, jamais réingérés.
export async function seedDepartmentJobs(): Promise<{ seeded: number; alreadyCompleted: number }> {
  const prisma = await getPrisma()
  const existingCompleted = await prisma.ingestionJob.findMany({
    where: { source: SOURCE, dataset: DATASET, partition: { in: [...BOAMP_DEPARTMENTS] }, status: "COMPLETED" },
    select: { partition: true },
  })
  const completedSet = new Set(existingCompleted.map((j) => j.partition))
  let seeded = 0
  for (const department of BOAMP_DEPARTMENTS) {
    if (completedSet.has(department)) continue
    await getOrCreateJob(SOURCE, DATASET, department)
    seeded += 1
  }
  return { seeded, alreadyCompleted: completedSet.size }
}

export interface TickResult {
  action: "preflight" | "storage-paused" | "ingest" | "idle"
  campaignStatus: string
  detail: unknown
}

// Un pas d'orchestration — voir l'en-tête du fichier. Jamais de nouvelle
// invocation HTTP concurrente de la Lambda sur elle-même (c'est
// précisément ce qui a produit les timeouts proxy mesurés lors de la
// Vague 1 manuelle) : à concurrence > 1, les départements actifs du tick
// sont traités SÉQUENTIELLEMENT, in-process, dans la même invocation.
export async function runCampaignTick(): Promise<TickResult> {
  const prisma = await getPrisma()
  const campaign = await getOrCreateCampaign()

  await prisma.boampNationalCampaign.update({ where: { id: campaign.id }, data: { lastTickAt: new Date() } })

  if (campaign.status === "PAUSED") {
    return { action: "idle", campaignStatus: "PAUSED", detail: { reason: campaign.lastError ?? "campagne en pause" } }
  }
  if (campaign.status === "COMPLETED" || campaign.status === "FAILED") {
    return { action: "idle", campaignStatus: campaign.status, detail: null }
  }

  // Garde-fou stockage — vérifié à CHAQUE tick, avant tout travail
  // (preflight comme ingestion), jamais seulement au lancement.
  const free = await freeStorageGb()
  if (free < campaign.minFreeStorageGb) {
    await prisma.boampNationalCampaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED", lastError: `Stockage RDS libre (${free.toFixed(2)} Go) sous le seuil configuré (${campaign.minFreeStorageGb} Go).` },
    })
    return { action: "storage-paused", campaignStatus: "PAUSED", detail: { freeGb: free, thresholdGb: campaign.minFreeStorageGb } }
  }

  // Phase 1 — preflight incrémental, tant qu'il n'est pas complet.
  const summary = await preflightSummary()
  if (!summary.complete) {
    const batch = await runPreflightBatch()
    return { action: "preflight", campaignStatus: campaign.status, detail: batch }
  }
  if (!campaign.preflightCompletedAt) {
    await prisma.boampNationalCampaign.update({ where: { id: campaign.id }, data: { preflightCompletedAt: new Date() } })
  }

  // Phase 2 — ingestion réelle, uniquement si la campagne a été
  // explicitement passée en RUNNING (jamais automatique après un
  // preflight — voir startCampaign()).
  if (campaign.status !== "RUNNING") {
    return { action: "idle", campaignStatus: campaign.status, detail: { reason: "preflight terminé, en attente de lancement explicite" } }
  }

  const runningJobs = await prisma.ingestionJob.findMany({
    where: { source: SOURCE, dataset: DATASET, partition: { in: [...BOAMP_DEPARTMENTS] }, status: "RUNNING" },
    select: { partition: true },
    orderBy: { updatedAt: "asc" },
  })
  const maxConcurrency = campaign.maxConcurrency
  const active = runningJobs.map((j) => j.partition)
  const slotsAvailable = Math.max(0, maxConcurrency - active.length)

  if (slotsAvailable > 0) {
    const pendingJobs = await prisma.ingestionJob.findMany({
      where: { source: SOURCE, dataset: DATASET, partition: { in: [...BOAMP_DEPARTMENTS] }, status: "PENDING" },
      select: { partition: true },
      orderBy: { createdAt: "asc" },
      take: slotsAvailable,
    })
    active.push(...pendingJobs.map((j) => j.partition))
  }

  const results: Array<{ department: string; status: string; anomaly?: string }> = []
  for (const department of active.slice(0, maxConcurrency)) {
    const result = await runOneInvocation(new BoampIngestionRunner(department))

    if (result.status === "COMPLETED" && !result.skipped) {
      // Validation avant COMPLETED (mission section 9, critique) :
      // sourceExpected (nhits réel du preflight) > 0 mais recordsRead = 0
      // ne doit JAMAIS rester COMPLETED — c'est exactement le bug réel
      // rencontré Vague 1 (départements 01-09, zero-padding). Défense en
      // profondeur : le bug racine est corrigé, ce contrôle protège contre
      // toute régression future similaire, jamais supposé inutile.
      const job = await prisma.ingestionJob.findUnique({
        where: { source_dataset_partition: { source: SOURCE, dataset: DATASET, partition: department } },
        select: { recordsRead: true },
      })
      const preflight = await prisma.boampDepartmentPreflight.findUnique({ where: { department } })
      const sourceExpected = preflight?.nhits ?? null
      if (sourceExpected !== null && sourceExpected > 0 && (job?.recordsRead ?? 0) === 0) {
        await prisma.ingestionJob.update({
          where: { source_dataset_partition: { source: SOURCE, dataset: DATASET, partition: department } },
          data: {
            status: "FAILED_REQUIRES_REVIEW",
            lastError: `Anomalie de validation : preflight annonçait ${sourceExpected} avis réels mais recordsRead=0 — jamais accepté comme COMPLETED automatiquement.`,
          },
        })
        results.push({ department, status: "FAILED_REQUIRES_REVIEW", anomaly: "sourceExpected>0 mais recordsRead=0" })
        continue
      }
    }

    results.push({ department, status: result.status })
  }

  const counters = await recomputeCounters()
  const allDone = counters.completed + counters.failed === BOAMP_DEPARTMENTS.length && counters.running === 0 && counters.pending === 0
  await prisma.boampNationalCampaign.update({
    where: { id: campaign.id },
    data: {
      completedDepartments: counters.completed,
      runningDepartments: counters.running,
      failedDepartments: counters.failed,
      pendingDepartments: counters.pending,
      lastDepartment: active[0] ?? campaign.lastDepartment,
      status: allDone ? "COMPLETED" : campaign.status,
      completedAt: allDone ? new Date() : campaign.completedAt,
    },
  })

  return { action: active.length > 0 ? "ingest" : "idle", campaignStatus: allDone ? "COMPLETED" : campaign.status, detail: { results, counters } }
}

export async function startCampaign(): Promise<{ started: boolean; campaign: unknown; preflight: PreflightBatchResult | { complete: true } }> {
  const prisma = await getPrisma()
  const campaign = await getOrCreateCampaign()

  if (campaign.status === "RUNNING") {
    return { started: false, campaign, preflight: { complete: true } }
  }

  await seedDepartmentJobs()

  const summary = await preflightSummary()
  if (!summary.complete) {
    const batch = await runPreflightBatch()
    const updated = await prisma.boampNationalCampaign.findUniqueOrThrow({ where: { id: campaign.id } })
    return { started: false, campaign: updated, preflight: batch }
  }

  // Preflight déjà complet : cet appel de start() est le déclenchement
  // EXPLICITE de l'ingestion réelle (jamais automatique — voir
  // runCampaignTick).
  const counters = await recomputeCounters()
  const startedCampaign = await prisma.boampNationalCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "RUNNING",
      startedAt: campaign.startedAt ?? new Date(),
      preflightCompletedAt: campaign.preflightCompletedAt ?? new Date(),
      completedDepartments: counters.completed,
      runningDepartments: counters.running,
      failedDepartments: counters.failed,
      pendingDepartments: counters.pending,
    },
  })
  return { started: true, campaign: startedCampaign, preflight: { complete: true } }
}
