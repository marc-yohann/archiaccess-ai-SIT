// Suivi persistant d'un IngestionJob — toute la mécanique de lecture/
// écriture de la table, séparée du runner (lib/ingestion/runner.ts) pour
// que l'observabilité admin (à venir) puisse réutiliser les mêmes
// fonctions sans dépendre de la logique d'exécution.

import { getPrisma } from "@/lib/prisma"
import type { IngestionJob } from "@/lib/generated/prisma/client"
import type { IngestionCheckpoint } from "@/lib/ingestion/types"

export async function getOrCreateJob(
  source: string,
  dataset: string,
  partition: string,
  datasetVersion?: string,
): Promise<IngestionJob> {
  const prisma = await getPrisma()
  return prisma.ingestionJob.upsert({
    where: { source_dataset_partition: { source, dataset, partition } },
    create: { source, dataset, partition, datasetVersion },
    update: {},
  })
}

// Backoff exponentiel plafonné — jamais de valeur figée sans mesure, mais
// une base et un plafond raisonnables pour ne pas marteler une source
// publique après une panne (voir CLAUDE.md, respect des quotas).
const BASE_BACKOFF_MS = 30_000
const MAX_BACKOFF_MS = 30 * 60_000

// Plafond de retries (mission "BOAMP national", 2026-09-25) — générique à
// tous les connecteurs, pas seulement BOAMP : avant ce changement, un job
// FAILED était retenté indéfiniment (backoff croissant mais jamais de
// fin), sans jamais distinguer une panne transitoire (réseau, 5xx) d'une
// erreur permanente qui ne se résoudra jamais seule (format de données
// invalide, département incohérent). Au-delà de MAX_RETRIES, le job passe
// à FAILED_REQUIRES_REVIEW — jamais retenté automatiquement, doit être
// explicitement relancé (ex: /api/admin/ingestion/boamp/national/retry-failed
// après correction du problème sous-jacent).
const MAX_RETRIES = 5

export function computeBackoff(retryCount: number): Date {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** retryCount, MAX_BACKOFF_MS)
  return new Date(Date.now() + delay)
}

export async function markRunning(jobId: string): Promise<void> {
  const prisma = await getPrisma()
  const job = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: jobId } })
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: job.startedAt ?? new Date(),
      lastHeartbeatAt: new Date(),
    },
  })
}

export async function applyBatchSuccess(
  jobId: string,
  result: { read: number; inserted: number; updated: number; rejected: number; errors: string[]; checkpoint: IngestionCheckpoint; done: boolean },
): Promise<void> {
  const prisma = await getPrisma()
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: result.done ? "COMPLETED" : "RUNNING",
      checkpoint: result.checkpoint as object,
      recordsRead: { increment: result.read },
      recordsProcessed: { increment: result.read - result.rejected },
      recordsInserted: { increment: result.inserted },
      recordsUpdated: { increment: result.updated },
      recordsRejected: { increment: result.rejected },
      lastHeartbeatAt: new Date(),
      retryCount: 0,
      lastError: result.errors[result.errors.length - 1] ?? null,
      completedAt: result.done ? new Date() : null,
    },
  })
}

export async function markBatchFailed(jobId: string, error: string): Promise<void> {
  const prisma = await getPrisma()
  const job = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: jobId } })
  const retryCount = job.retryCount + 1
  const exhausted = retryCount >= MAX_RETRIES
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: exhausted ? "FAILED_REQUIRES_REVIEW" : "FAILED",
      errorCount: { increment: 1 },
      retryCount,
      lastError: exhausted ? `${error} (plafond de ${MAX_RETRIES} tentatives atteint, révision manuelle requise)` : error,
      // Un job FAILED_REQUIRES_REVIEW n'est plus jamais retenté
      // automatiquement (voir runOneInvocation) — nextRunAt n'a alors plus
      // de sens, laissé null plutôt qu'un backoff qui ne serait jamais lu.
      nextRunAt: exhausted ? null : computeBackoff(retryCount),
      lastHeartbeatAt: new Date(),
    },
  })
}
