// Harnais générique d'exécution — commun à tous les adapters
// (SireneIngestionRunner, GeorisquesIngestionRunner...). Un adapter ne
// sait que traiter SON lot (runBatch) ; ce fichier gère la reprise, le
// budget de temps par invocation (compatible Lambda 30s, voir CLAUDE.md),
// le heartbeat, et l'isolation entre "erreur systémique" (on arrête, on
// retente plus tard avec backoff) et "erreur isolée" (une commune, une
// ligne — comptée en rejet, jamais fatale).

import { getOrCreateJob, markRunning, applyBatchSuccess, markBatchFailed } from "@/lib/ingestion/job"
import { getMaxBatchDurationMs } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint } from "@/lib/ingestion/types"

export interface RunOneInvocationResult {
  jobId: string
  status: string
  batchesRun: number
  done: boolean
  skipped?: "already_completed" | "already_cancelled" | "backoff"
}

export async function runOneInvocation(runner: IngestionRunner, maxDurationMs = getMaxBatchDurationMs()): Promise<RunOneInvocationResult> {
  const job = await getOrCreateJob(runner.source, runner.dataset, runner.partition, runner.datasetVersion)

  if (job.status === "COMPLETED") {
    return { jobId: job.id, status: job.status, batchesRun: 0, done: true, skipped: "already_completed" }
  }
  if (job.status === "CANCELLED") {
    return { jobId: job.id, status: job.status, batchesRun: 0, done: false, skipped: "already_cancelled" }
  }
  if (job.status === "FAILED" && job.nextRunAt && job.nextRunAt.getTime() > Date.now()) {
    return { jobId: job.id, status: job.status, batchesRun: 0, done: false, skipped: "backoff" }
  }

  await markRunning(job.id)

  const deadline = Date.now() + maxDurationMs
  let checkpoint: IngestionCheckpoint | null = (job.checkpoint as IngestionCheckpoint | null) ?? null
  let batchesRun = 0
  let done = false

  while (Date.now() < deadline) {
    try {
      const result = await runner.runBatch(checkpoint, deadline)
      await applyBatchSuccess(job.id, result)
      checkpoint = result.checkpoint
      batchesRun += 1
      done = result.done
      if (done) break
    } catch (error) {
      await markBatchFailed(job.id, error instanceof Error ? error.message : "Erreur inconnue.")
      return { jobId: job.id, status: "FAILED", batchesRun, done: false }
    }
  }

  return { jobId: job.id, status: done ? "COMPLETED" : "RUNNING", batchesRun, done }
}
