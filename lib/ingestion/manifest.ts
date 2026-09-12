// Suivi persistant d'un DatasetManifest/DatasetChunk — voir
// prisma/schema.prisma et lib/ingestion/chunked-zip.ts. Sépare la
// mécanique de la table de celle du pipeline (même principe que
// lib/ingestion/job.ts pour IngestionJob).

import { getPrisma } from "@/lib/prisma"
import type { DatasetManifest } from "@/lib/generated/prisma/client"

export async function getOrCreateManifest(
  source: string,
  dataset: string,
  datasetVersion: string,
  sourceUrl: string,
  originalSizeBytes: bigint,
  chunkTargetRows: number,
): Promise<DatasetManifest> {
  const prisma = await getPrisma()
  return prisma.datasetManifest.upsert({
    where: { source_dataset_datasetVersion: { source, dataset, datasetVersion } },
    create: { source, dataset, datasetVersion, sourceUrl, originalSizeBytes, chunkTargetRows },
    update: {},
  })
}

export async function getLatestReadyManifest(source: string, dataset: string): Promise<DatasetManifest | null> {
  const prisma = await getPrisma()
  return prisma.datasetManifest.findFirst({
    where: { source, dataset, status: "READY" },
    orderBy: { createdAt: "desc" },
  })
}

export async function setManifestStatus(manifestId: string, status: "PENDING" | "STAGING" | "PREPROCESSING" | "READY" | "FAILED", error?: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.datasetManifest.update({ where: { id: manifestId }, data: { status, lastError: error ?? null } })
}

export async function addChunk(manifestId: string, chunkIndex: number, s3Key: string, checksum: string, byteSize: number, rowCount: number): Promise<void> {
  const prisma = await getPrisma()
  await prisma.datasetChunk.upsert({
    where: { manifestId_chunkIndex: { manifestId, chunkIndex } },
    create: { manifestId, chunkIndex, s3Key, checksum, byteSize, rowCount },
    update: { s3Key, checksum, byteSize, rowCount },
  })
}

export async function finalizeManifest(manifestId: string, totalChunks: number, totalRows: number): Promise<void> {
  const prisma = await getPrisma()
  await prisma.datasetManifest.update({
    where: { id: manifestId },
    data: { status: "READY", totalChunks, totalRows },
  })
}

// Prochain chunk PENDING dans l'ordre — c'est la définition même de
// "quels chunks manquent" (voir CLAUDE.md, section C du brief Phase 3).
export async function getNextPendingChunk(manifestId: string) {
  const prisma = await getPrisma()
  return prisma.datasetChunk.findFirst({
    where: { manifestId, status: "PENDING" },
    orderBy: { chunkIndex: "asc" },
  })
}

export async function markChunkIngested(chunkId: string, ingestionJobId: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.datasetChunk.update({
    where: { id: chunkId },
    data: { status: "INGESTED", ingestedAt: new Date(), ingestionJobId },
  })
}

export async function updateChunkRowOffset(chunkId: string, rowOffset: number): Promise<void> {
  const prisma = await getPrisma()
  await prisma.datasetChunk.update({ where: { id: chunkId }, data: { rowOffset } })
}
