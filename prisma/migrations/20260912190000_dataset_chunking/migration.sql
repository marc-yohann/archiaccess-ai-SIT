-- Phase 3 : remplace la stratégie "redécompresser depuis le début" par un
-- découpage en chunks (DatasetManifest/DatasetChunk) + enrichissement
-- Acteur via StockUniteLegale — voir prisma/schema.prisma.

-- AlterTable
ALTER TABLE "Acteur" ADD COLUMN "categorieJuridique" TEXT;
ALTER TABLE "Acteur" ADD COLUMN "categorieEntreprise" TEXT;
ALTER TABLE "Acteur" ADD COLUMN "trancheEffectifs" TEXT;

-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('PENDING', 'STAGING', 'PREPROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ChunkStatus" AS ENUM ('PENDING', 'INGESTED', 'FAILED');

-- CreateTable
CREATE TABLE "DatasetManifest" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "datasetVersion" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalChecksum" TEXT,
    "originalSizeBytes" BIGINT NOT NULL,
    "chunkTargetRows" INTEGER NOT NULL,
    "totalChunks" INTEGER,
    "totalRows" INTEGER,
    "status" "ManifestStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetChunk" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "rowCount" INTEGER,
    "status" "ChunkStatus" NOT NULL DEFAULT 'PENDING',
    "rowOffset" INTEGER NOT NULL DEFAULT 0,
    "ingestionJobId" TEXT,
    "ingestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DatasetManifest_source_dataset_datasetVersion_key" ON "DatasetManifest"("source", "dataset", "datasetVersion");

-- CreateIndex
CREATE INDEX "DatasetManifest_source_dataset_idx" ON "DatasetManifest"("source", "dataset");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetChunk_manifestId_chunkIndex_key" ON "DatasetChunk"("manifestId", "chunkIndex");

-- CreateIndex
CREATE INDEX "DatasetChunk_manifestId_status_idx" ON "DatasetChunk"("manifestId", "status");

-- AddForeignKey
ALTER TABLE "DatasetChunk" ADD CONSTRAINT "DatasetChunk_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "DatasetManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
