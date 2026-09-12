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
