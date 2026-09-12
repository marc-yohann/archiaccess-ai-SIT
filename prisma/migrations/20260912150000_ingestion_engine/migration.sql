-- Moteur d'ingestion national (IngestionJob) + référentiel Risque
-- (Géorisques à l'échelle nationale) — voir prisma/schema.prisma. Rend
-- également Acteur.nom nullable : le fichier StockEtablissement (SIRENE,
-- ingestion nationale) ne porte pas la dénomination légale (elle vit
-- dans StockUniteLegale, pas encore ingéré) — jamais de valeur fabriquée
-- pour combler l'absence.

-- AlterTable
ALTER TABLE "Acteur" ALTER COLUMN "nom" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "dataset" TEXT NOT NULL,
    "partition" TEXT NOT NULL,
    "datasetVersion" TEXT,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "checkpoint" JSONB,
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsInserted" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsRejected" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risque" (
    "id" TEXT NOT NULL,
    "codeInsee" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "risks" JSONB NOT NULL,
    "seismicZone" TEXT,
    "radonPotential" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionJob_source_dataset_partition_key" ON "IngestionJob"("source", "dataset", "partition");

-- CreateIndex
CREATE INDEX "IngestionJob_source_status_idx" ON "IngestionJob"("source", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Risque_codeInsee_key" ON "Risque"("codeInsee");

-- CreateIndex
CREATE INDEX "Risque_codeInsee_idx" ON "Risque"("codeInsee");
