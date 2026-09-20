import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getIngestToken } from "@/lib/secrets"
import { getPrisma } from "@/lib/prisma"

// Route temporaire — exécute les migrations Prisma en attente contre RDS
// depuis la Lambda (seul chemin réseau prouvé fonctionnel vers RDS
// actuellement, le bastion EC2+SSM étant cassé — voir CLAUDE.md, section
// "Pièges"). Authentifiée par jeton bearer plutôt que session, même
// pattern que app/api/sit/documents/bulk déjà en prod.
//
// Conservée entre les phases (décision utilisateur du 2026-09-12) plutôt
// que recréée à chaque migration — une seule liste ordonnée, chaque
// migration marquée dans _prisma_migrations une fois appliquée pour ne
// jamais être rejouée. À retirer définitivement une fois le bastion
// réparé — ne pas laisser une route d'exécution SQL arbitraire en
// production plus longtemps que nécessaire.
//
// Le SQL est dupliqué ici (plutôt que lu depuis les fichiers .sql) car le
// bundle Lambda (zip manuel de .open-next/server-functions/default) ne
// garantit pas d'inclure des fichiers non-JS non tracés statiquement —
// voir CLAUDE.md sur les pièges de bundling déjà rencontrés.

interface PendingMigration {
  name: string
  // sha256 hex du fichier prisma/migrations/<name>/migration.sql
  // correspondant — confirmé identique à celui que `prisma migrate
  // deploy` calcule lui-même (vérifié en local avant chaque commit), pour
  // qu'un futur `prisma migrate deploy` (bastion réparé) reconnaisse
  // cette migration comme déjà appliquée plutôt que de la rejouer.
  checksum: string
  statements: string[]
}

const MIGRATIONS: PendingMigration[] = [
  {
    name: "20260911100000_site_referential",
    checksum: "62396df95da57f5e518a7478ef22a0d9eb400332c99febeb8b6a8ae76ac80b32",
    statements: [
      `CREATE TABLE "Site" (
        "id" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "citycode" TEXT NOT NULL,
        "postcode" TEXT NOT NULL,
        "city" TEXT NOT NULL,
        "longitude" DOUBLE PRECISION NOT NULL,
        "latitude" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE "Parcelle" (
        "id" TEXT NOT NULL,
        "siteId" TEXT NOT NULL,
        "idu" TEXT NOT NULL,
        "section" TEXT NOT NULL,
        "sectionPrefixe" TEXT NOT NULL,
        "numero" TEXT NOT NULL,
        "contenanceM2" DOUBLE PRECISION NOT NULL,
        "codeInsee" TEXT NOT NULL,
        "commune" TEXT NOT NULL,
        "geometry" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Parcelle_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE "Batiment" (
        "id" TEXT NOT NULL,
        "siteId" TEXT NOT NULL,
        "numeroDpe" TEXT,
        "typeBatiment" TEXT,
        "surfaceHabitable" DOUBLE PRECISION,
        "etiquetteEnergie" TEXT,
        "etiquetteGes" TEXT,
        "anneeConstruction" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Batiment_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE "SiteSource" (
        "id" TEXT NOT NULL,
        "siteId" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SiteSource_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX "Site_citycode_label_key" ON "Site"("citycode", "label")`,
      `CREATE INDEX "Site_citycode_idx" ON "Site"("citycode")`,
      `CREATE UNIQUE INDEX "Parcelle_idu_key" ON "Parcelle"("idu")`,
      `CREATE INDEX "Parcelle_siteId_idx" ON "Parcelle"("siteId")`,
      `CREATE UNIQUE INDEX "Batiment_numeroDpe_key" ON "Batiment"("numeroDpe")`,
      `CREATE INDEX "Batiment_siteId_idx" ON "Batiment"("siteId")`,
      `CREATE INDEX "SiteSource_siteId_idx" ON "SiteSource"("siteId")`,
      `CREATE UNIQUE INDEX "SiteSource_siteId_source_key" ON "SiteSource"("siteId", "source")`,
      `ALTER TABLE "Parcelle" ADD CONSTRAINT "Parcelle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "Batiment" ADD CONSTRAINT "Batiment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "SiteSource" ADD CONSTRAINT "SiteSource_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ],
  },
  {
    name: "20260912090000_acteur_referential",
    checksum: "086f7d8b72a58b4aa8bded15329d0456b2cc9af52b697709b4c07ecdcb38d6c9",
    statements: [
      `CREATE TYPE "ActeurType" AS ENUM ('ARCHITECTE', 'BUREAU_ETUDES', 'AMO', 'OPC', 'ECONOMISTE', 'GEOMETRE', 'CONTROLEUR_TECHNIQUE', 'COORDONNATEUR_SPS', 'DIAGNOSTIQUEUR', 'ENTREPRISE_GENERALE', 'ENTREPRISE_SPECIALISEE', 'FOURNISSEUR', 'FABRICANT', 'PROMOTEUR', 'MAITRE_OUVRAGE', 'ACHETEUR_PUBLIC')`,
      `CREATE TABLE "Acteur" (
        "id" TEXT NOT NULL,
        "siren" TEXT NOT NULL,
        "nom" TEXT NOT NULL,
        "nomCommercial" TEXT,
        "codeNaf" TEXT,
        "statut" TEXT,
        "dateCreation" TEXT,
        "type" "ActeurType",
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Acteur_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE "Etablissement" (
        "id" TEXT NOT NULL,
        "acteurId" TEXT NOT NULL,
        "siret" TEXT NOT NULL,
        "adresse" TEXT,
        "codePostal" TEXT,
        "codeInsee" TEXT,
        "commune" TEXT,
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "estSiege" BOOLEAN NOT NULL DEFAULT false,
        "actif" BOOLEAN,
        "siteId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Etablissement_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE "ActeurSource" (
        "id" TEXT NOT NULL,
        "acteurId" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ActeurSource_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX "Acteur_siren_key" ON "Acteur"("siren")`,
      `CREATE UNIQUE INDEX "Etablissement_siret_key" ON "Etablissement"("siret")`,
      `CREATE INDEX "Etablissement_acteurId_idx" ON "Etablissement"("acteurId")`,
      `CREATE INDEX "Etablissement_siteId_idx" ON "Etablissement"("siteId")`,
      `CREATE INDEX "ActeurSource_acteurId_idx" ON "ActeurSource"("acteurId")`,
      `CREATE UNIQUE INDEX "ActeurSource_acteurId_source_key" ON "ActeurSource"("acteurId", "source")`,
      `ALTER TABLE "Etablissement" ADD CONSTRAINT "Etablissement_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Acteur"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "Etablissement" ADD CONSTRAINT "Etablissement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      `ALTER TABLE "ActeurSource" ADD CONSTRAINT "ActeurSource_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Acteur"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ],
  },
  {
    name: "20260912150000_ingestion_engine",
    checksum: "33456d7d252c0ae4444318e6640ff7d667fc76c8c5d21b4ba83f7fa573f8b2ae",
    statements: [
      `ALTER TABLE "Acteur" ALTER COLUMN "nom" DROP NOT NULL`,
      `CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED')`,
      `CREATE TABLE "IngestionJob" (
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
      )`,
      `CREATE TABLE "Risque" (
        "id" TEXT NOT NULL,
        "codeInsee" TEXT NOT NULL,
        "commune" TEXT NOT NULL,
        "risks" JSONB NOT NULL,
        "seismicZone" TEXT,
        "radonPotential" TEXT,
        "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Risque_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX "IngestionJob_source_dataset_partition_key" ON "IngestionJob"("source", "dataset", "partition")`,
      `CREATE INDEX "IngestionJob_source_status_idx" ON "IngestionJob"("source", "status")`,
      `CREATE UNIQUE INDEX "Risque_codeInsee_key" ON "Risque"("codeInsee")`,
      `CREATE INDEX "Risque_codeInsee_idx" ON "Risque"("codeInsee")`,
    ],
  },
  {
    name: "20260912190000_dataset_chunking",
    checksum: "5c33dd9c2e1db001b8839db738e56c5a6293ae75c8348b526d77d9423907f632",
    statements: [
      `ALTER TABLE "Acteur" ADD COLUMN "categorieJuridique" TEXT`,
      `ALTER TABLE "Acteur" ADD COLUMN "categorieEntreprise" TEXT`,
      `ALTER TABLE "Acteur" ADD COLUMN "trancheEffectifs" TEXT`,
      `CREATE TYPE "ManifestStatus" AS ENUM ('PENDING', 'STAGING', 'PREPROCESSING', 'READY', 'FAILED')`,
      `CREATE TYPE "ChunkStatus" AS ENUM ('PENDING', 'INGESTED', 'FAILED')`,
      `CREATE TABLE "DatasetManifest" (
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
      )`,
      `CREATE TABLE "DatasetChunk" (
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
      )`,
      `CREATE UNIQUE INDEX "DatasetManifest_source_dataset_datasetVersion_key" ON "DatasetManifest"("source", "dataset", "datasetVersion")`,
      `CREATE INDEX "DatasetManifest_source_dataset_idx" ON "DatasetManifest"("source", "dataset")`,
      `CREATE UNIQUE INDEX "DatasetChunk_manifestId_chunkIndex_key" ON "DatasetChunk"("manifestId", "chunkIndex")`,
      `CREATE INDEX "DatasetChunk_manifestId_status_idx" ON "DatasetChunk"("manifestId", "status")`,
      `ALTER TABLE "DatasetChunk" ADD CONSTRAINT "DatasetChunk_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "DatasetManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ],
  },
  {
    name: "20260913000000_postgis",
    checksum: "7ef4a9b062160e455d3858326ec31976d81c178ba778a9640854a7571f4dbdfa",
    statements: [
      `CREATE EXTENSION IF NOT EXISTS postgis`,
      `ALTER TABLE "Site" ADD COLUMN "geom" geometry(Point, 4326)`,
      `ALTER TABLE "Parcelle" ADD COLUMN "geom" geometry(MultiPolygon, 4326)`,
      `UPDATE "Site" SET "geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326) WHERE "geom" IS NULL`,
      `UPDATE "Parcelle" SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON("geometry"::text), 4326)) WHERE "geom" IS NULL`,
      `CREATE INDEX "Site_geom_idx" ON "Site" USING GIST ("geom")`,
      `CREATE INDEX "Parcelle_geom_idx" ON "Parcelle" USING GIST ("geom")`,
    ],
  },
  {
    name: "20260913120000_cadastre_bulk",
    checksum: "56231d4d2ec96df34bd9184df94a7fa5118d1ba5865c6367e4f84a33358fac39",
    statements: [
      `CREATE TYPE "SiteParcelleRelationMethod" AS ENUM ('SPATIAL')`,
      `ALTER TABLE "Parcelle" ALTER COLUMN "siteId" DROP NOT NULL`,
      `ALTER TABLE "Parcelle" ALTER COLUMN "commune" DROP NOT NULL`,
      `ALTER TABLE "Parcelle" ADD COLUMN "relationMethod" "SiteParcelleRelationMethod"`,
      `ALTER TABLE "Parcelle" ADD COLUMN "source" TEXT`,
      `ALTER TABLE "Parcelle" ADD COLUMN "dataset" TEXT`,
      `ALTER TABLE "Parcelle" ADD COLUMN "datasetVersion" TEXT`,
      `ALTER TABLE "Parcelle" ADD COLUMN "retrievedAt" TIMESTAMP(3)`,
      `ALTER TABLE "Parcelle" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE "Parcelle" DROP CONSTRAINT "Parcelle_siteId_fkey"`,
      `ALTER TABLE "Parcelle" ADD CONSTRAINT "Parcelle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
      `CREATE INDEX "Parcelle_codeInsee_idx" ON "Parcelle"("codeInsee")`,
    ],
  },
  {
    name: "20260913150000_site_parcelle_join",
    checksum: "511adf5fb7dfe0abb202882b8af6f24f4885882e5a6a59167a67319a53fbc558",
    statements: [
      `ALTER TYPE "SiteParcelleRelationMethod" RENAME TO "SiteParcelleRelationMethod_old"`,
      `CREATE TYPE "SiteParcelleRelationMethod" AS ENUM ('SPATIAL_CONTAINS', 'SPATIAL_NEARBY', 'DETERMINISTIC')`,
      `CREATE TABLE "SiteParcelle" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "parcelleId" TEXT NOT NULL,
    "relationMethod" "SiteParcelleRelationMethod" NOT NULL,
    "ambiguous" BOOLEAN NOT NULL DEFAULT false,
    "distanceMeters" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteParcelle_pkey" PRIMARY KEY ("id")
)`,
      `CREATE UNIQUE INDEX "SiteParcelle_siteId_parcelleId_key" ON "SiteParcelle"("siteId", "parcelleId")`,
      `CREATE INDEX "SiteParcelle_siteId_idx" ON "SiteParcelle"("siteId")`,
      `CREATE INDEX "SiteParcelle_parcelleId_idx" ON "SiteParcelle"("parcelleId")`,
      `ALTER TABLE "SiteParcelle" ADD CONSTRAINT "SiteParcelle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "SiteParcelle" ADD CONSTRAINT "SiteParcelle_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `INSERT INTO "SiteParcelle" ("id", "siteId", "parcelleId", "relationMethod", "ambiguous", "distanceMeters", "source", "retrievedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "siteId", "id", 'SPATIAL_NEARBY', false, NULL, COALESCE("source", 'cadastre-apicarto'), COALESCE("retrievedAt", "createdAt"), "createdAt", "updatedAt"
FROM "Parcelle"
WHERE "siteId" IS NOT NULL AND "relationMethod" IS NULL`,
      `ALTER TABLE "Parcelle" DROP CONSTRAINT "Parcelle_siteId_fkey"`,
      `ALTER TABLE "Parcelle" DROP COLUMN "relationMethod"`,
      `ALTER TABLE "Parcelle" DROP COLUMN "siteId"`,
      `DROP INDEX IF EXISTS "Parcelle_siteId_idx"`,
      `DROP TYPE "SiteParcelleRelationMethod_old"`,
    ],
  },
  {
    name: "20260914120000_batiment_physique_rnb",
    checksum: "9f6fb9573b0dcf06ff6992b725e1ade29dc8f6e22a4296814a9a442b01d01354",
    statements: [
      `ALTER TABLE "Site" ADD COLUMN "banId" TEXT`,
      `CREATE INDEX "Site_banId_idx" ON "Site"("banId")`,
      `CREATE TYPE "BatimentRelationMethod" AS ENUM ('SOURCE_PROVIDED')`,
      `CREATE TYPE "ReferenceStatus" AS ENUM ('VALID', 'NOT_FOUND', 'INVALID_FORMAT', 'AMBIGUOUS')`,
      `CREATE TABLE "BatimentPhysique" (
    "id" TEXT NOT NULL,
    "rnbId" TEXT NOT NULL,
    "geom" geometry(Geometry, 4326),
    "geomType" TEXT,
    "status" TEXT,
    "source" TEXT NOT NULL DEFAULT 'rnb-opendata-bulk',
    "datasetVersion" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatimentPhysique_pkey" PRIMARY KEY ("id")
)`,
      `CREATE UNIQUE INDEX "BatimentPhysique_rnbId_key" ON "BatimentPhysique"("rnbId")`,
      `CREATE INDEX "BatimentPhysique_geomType_idx" ON "BatimentPhysique"("geomType")`,
      `CREATE INDEX "BatimentPhysique_geom_idx" ON "BatimentPhysique" USING GIST ("geom")`,
      `CREATE TABLE "BatimentPhysiqueParcelle" (
    "id" TEXT NOT NULL,
    "batimentId" TEXT NOT NULL,
    "parcelleId" TEXT,
    "parcelleRef" TEXT NOT NULL,
    "relationMethod" "BatimentRelationMethod" NOT NULL DEFAULT 'SOURCE_PROVIDED',
    "referenceStatus" "ReferenceStatus" NOT NULL,
    "coverageRatio" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'rnb-opendata-bulk',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatimentPhysiqueParcelle_pkey" PRIMARY KEY ("id")
)`,
      `CREATE UNIQUE INDEX "BatimentPhysiqueParcelle_batimentId_parcelleRef_key" ON "BatimentPhysiqueParcelle"("batimentId", "parcelleRef")`,
      `CREATE INDEX "BatimentPhysiqueParcelle_batimentId_idx" ON "BatimentPhysiqueParcelle"("batimentId")`,
      `CREATE INDEX "BatimentPhysiqueParcelle_parcelleId_idx" ON "BatimentPhysiqueParcelle"("parcelleId")`,
      `ALTER TABLE "BatimentPhysiqueParcelle" ADD CONSTRAINT "BatimentPhysiqueParcelle_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentPhysique"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "BatimentPhysiqueParcelle" ADD CONSTRAINT "BatimentPhysiqueParcelle_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `CREATE TABLE "BatimentPhysiqueSite" (
    "id" TEXT NOT NULL,
    "batimentId" TEXT NOT NULL,
    "siteId" TEXT,
    "addressRef" TEXT NOT NULL,
    "relationMethod" "BatimentRelationMethod" NOT NULL DEFAULT 'SOURCE_PROVIDED',
    "referenceStatus" "ReferenceStatus" NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'rnb-opendata-bulk',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatimentPhysiqueSite_pkey" PRIMARY KEY ("id")
)`,
      `CREATE UNIQUE INDEX "BatimentPhysiqueSite_batimentId_addressRef_key" ON "BatimentPhysiqueSite"("batimentId", "addressRef")`,
      `CREATE INDEX "BatimentPhysiqueSite_batimentId_idx" ON "BatimentPhysiqueSite"("batimentId")`,
      `CREATE INDEX "BatimentPhysiqueSite_siteId_idx" ON "BatimentPhysiqueSite"("siteId")`,
      `ALTER TABLE "BatimentPhysiqueSite" ADD CONSTRAINT "BatimentPhysiqueSite_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentPhysique"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "BatimentPhysiqueSite" ADD CONSTRAINT "BatimentPhysiqueSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    ],
  },
  {
    name: "20260915100000_batiment_physique_partition",
    checksum: "5a0502423ec1677df2bfaab397e8889238a95cb03c811680c1fbc0a8757060a0",
    statements: [
      `ALTER TABLE "BatimentPhysique" ADD COLUMN "sourcePartition" TEXT`,
      `CREATE INDEX "BatimentPhysique_sourcePartition_idx" ON "BatimentPhysique"("sourcePartition")`,
      `WITH parcelle_dept AS (
  SELECT
    bp."batimentId",
    (CASE WHEN LEFT(p."codeInsee", 2) = '97' THEN LEFT(p."codeInsee", 3) ELSE LEFT(p."codeInsee", 2) END) AS dept
  FROM "BatimentPhysiqueParcelle" bp
  JOIN "Parcelle" p ON p.id = bp."parcelleId"
  WHERE bp."referenceStatus" = 'VALID'
),
parcelle_dept_unique AS (
  SELECT "batimentId", min(dept) AS dept
  FROM parcelle_dept
  GROUP BY "batimentId"
  HAVING count(DISTINCT dept) = 1
)
UPDATE "BatimentPhysique" b
SET "sourcePartition" = pdu.dept
FROM parcelle_dept_unique pdu
WHERE b.id = pdu."batimentId" AND b."sourcePartition" IS NULL`,
      `WITH site_dept AS (
  SELECT
    bs."batimentId",
    (CASE WHEN LEFT(s.citycode, 2) = '97' THEN LEFT(s.citycode, 3) ELSE LEFT(s.citycode, 2) END) AS dept
  FROM "BatimentPhysiqueSite" bs
  JOIN "Site" s ON s.id = bs."siteId"
  WHERE bs."referenceStatus" = 'VALID'
),
site_dept_unique AS (
  SELECT "batimentId", min(dept) AS dept
  FROM site_dept
  GROUP BY "batimentId"
  HAVING count(DISTINCT dept) = 1
)
UPDATE "BatimentPhysique" b
SET "sourcePartition" = sdu.dept
FROM site_dept_unique sdu
WHERE b.id = sdu."batimentId" AND b."sourcePartition" IS NULL`,
    ],
  },
  {
    // Phase 7 — voir prisma/migrations/20260920140000_unite_dpe_rename/
    // migration.sql pour le contexte complet. Cette route re-vérifie
    // _prisma_migrations en direct à chaque appel (voir POST ci-dessous) :
    // ajouter cette entrée en 10e position est sûr indépendamment de toute
    // supposition sur le nombre exact de migrations déjà appliquées.
    name: "20260920140000_unite_dpe_rename",
    checksum: "f972e704faa74a3b10b5db9c4ba94c8e798e7999fea0ab29756a52c2ab595d8c",
    statements: [
      `ALTER TABLE "Batiment" RENAME TO "Unite"`,
      `ALTER TABLE "Unite" RENAME CONSTRAINT "Batiment_siteId_fkey" TO "Unite_siteId_fkey"`,
      `ALTER INDEX "Batiment_numeroDpe_key" RENAME TO "Unite_numeroDpe_key"`,
      `ALTER INDEX "Batiment_siteId_idx" RENAME TO "Unite_siteId_idx"`,
      `ALTER INDEX "Batiment_pkey" RENAME TO "Unite_pkey"`,
      `ALTER TABLE "Unite" ADD COLUMN "identifiantBan" TEXT`,
      `ALTER TABLE "Unite" ADD COLUMN "codeInseeBan" TEXT`,
      `ALTER TABLE "Unite" ADD COLUMN "numeroEtageAppartement" INTEGER`,
      `ALTER TABLE "Unite" ADD COLUMN "dateEtablissement" TEXT`,
      `ALTER TABLE "Unite" ADD COLUMN "statutGeocodage" TEXT`,
      `ALTER TABLE "Unite" ADD COLUMN "longitude" DOUBLE PRECISION`,
      `ALTER TABLE "Unite" ADD COLUMN "latitude" DOUBLE PRECISION`,
      `CREATE TYPE "UniteResolutionStatus" AS ENUM ('PENDING', 'VALID', 'NOT_FOUND', 'AMBIGUOUS')`,
      `ALTER TABLE "Unite" ADD COLUMN "batimentPhysiqueResolutionStatus" "UniteResolutionStatus" NOT NULL DEFAULT 'PENDING'`,
      `ALTER TABLE "Unite" ADD COLUMN "batimentPhysiqueResolvedAt" TIMESTAMP(3)`,
      `CREATE TABLE "UniteBatimentPhysique" (
    "id" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "batimentId" TEXT NOT NULL,
    "referenceStatus" "ReferenceStatus" NOT NULL,
    "relationMethod" TEXT NOT NULL DEFAULT 'SPATIAL_COVERS',
    "source" TEXT NOT NULL DEFAULT 'dpe-ademe-spatial',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniteBatimentPhysique_pkey" PRIMARY KEY ("id")
)`,
      `ALTER TABLE "UniteBatimentPhysique" ADD CONSTRAINT "UniteBatimentPhysique_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "Unite"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `ALTER TABLE "UniteBatimentPhysique" ADD CONSTRAINT "UniteBatimentPhysique_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentPhysique"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
      `CREATE UNIQUE INDEX "UniteBatimentPhysique_uniteId_batimentId_key" ON "UniteBatimentPhysique"("uniteId", "batimentId")`,
      `CREATE INDEX "UniteBatimentPhysique_uniteId_idx" ON "UniteBatimentPhysique"("uniteId")`,
      `CREATE INDEX "UniteBatimentPhysique_batimentId_idx" ON "UniteBatimentPhysique"("batimentId")`,
    ],
  },
]

export async function POST(request: Request) {
  const auth = request.headers.get("authorization")
  const expected = await getIngestToken()
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const prisma = await getPrisma()
  const applied = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "_prisma_migrations"`,
  )
  const alreadyApplied = new Set(applied.map((m) => m.migration_name))

  const results: { name: string; status: "already_applied" | "applied" | "failed"; error?: string }[] = []

  for (const migration of MIGRATIONS) {
    if (alreadyApplied.has(migration.name)) {
      results.push({ name: migration.name, status: "already_applied" })
      continue
    }

    const startedAt = new Date()
    try {
      await prisma.$transaction(migration.statements.map((sql) => prisma.$executeRawUnsafe(sql)))
    } catch (error) {
      results.push({ name: migration.name, status: "failed", error: error instanceof Error ? error.message : "Erreur inconnue." })
      // Une migration doit s'appliquer dans l'ordre — on n'essaie pas les
      // suivantes si celle-ci échoue (elles dépendent probablement de ses
      // tables).
      break
    }

    // Enregistre la migration comme appliquée dans le suivi Prisma
    // standard — même table, mêmes colonnes et même valeur "1" pour
    // applied_steps_count que `prisma migrate deploy` aurait renseignées
    // (vérifié en local : Prisma compte 1 "étape" par fichier de
    // migration, quel que soit son nombre d'instructions SQL).
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      randomUUID(),
      migration.checksum,
      migration.name,
      startedAt,
      new Date(),
    )
    results.push({ name: migration.name, status: "applied" })
  }

  const success = !results.some((r) => r.status === "failed")
  return NextResponse.json({ success, results }, { status: success ? 200 : 500 })
}
