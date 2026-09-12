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
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      errorCount: { increment: 1 },
      retryCount,
      lastError: error,
      nextRunAt: computeBackoff(retryCount),
      lastHeartbeatAt: new Date(),
    },
  })
}
