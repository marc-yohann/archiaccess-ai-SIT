-- Mission "PASSER BOAMP EN INGESTION NATIONALE AUTOMATISÉE" (2026-09-25).
-- Ajout pur : nouvelle valeur d'enum (jamais une valeur existante modifiée)
-- + deux nouvelles tables. Aucune table métier existante (AvisMarche, Lot,
-- IngestionJob...) n'est modifiée ou recréée.

ALTER TYPE "IngestionStatus" ADD VALUE 'FAILED_REQUIRES_REVIEW';

CREATE TABLE "BoampNationalCampaign" (
    "id" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "totalDepartments" INTEGER NOT NULL DEFAULT 101,
    "completedDepartments" INTEGER NOT NULL DEFAULT 0,
    "runningDepartments" INTEGER NOT NULL DEFAULT 0,
    "failedDepartments" INTEGER NOT NULL DEFAULT 0,
    "pendingDepartments" INTEGER NOT NULL DEFAULT 101,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 1,
    "minFreeStorageGb" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "preflightCompletedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastTickAt" TIMESTAMP(3),
    "lastDepartment" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoampNationalCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoampDepartmentPreflight" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "queryCode" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "nhits" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoampDepartmentPreflight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoampDepartmentPreflight_department_key" ON "BoampDepartmentPreflight"("department");
CREATE INDEX "BoampDepartmentPreflight_ok_idx" ON "BoampDepartmentPreflight"("ok");
