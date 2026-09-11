import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getIngestToken } from "@/lib/secrets"
import { getPrisma } from "@/lib/prisma"

// Route temporaire — exécute la migration Prisma "20260911100000_site_referential"
// contre RDS depuis la Lambda (seul chemin réseau prouvé fonctionnel vers
// RDS actuellement, le bastion EC2+SSM étant cassé — voir CLAUDE.md,
// section "Pièges"). Authentifiée par jeton bearer plutôt que session,
// même pattern que app/api/sit/documents/bulk déjà en prod.
//
// À RETIRER après déploiement de cette migration (accord explicite de
// l'utilisateur, 2026-09-11) — ne pas laisser une route d'exécution SQL
// arbitraire en production plus longtemps que nécessaire.
//
// Le SQL est dupliqué ici (plutôt que lu depuis le fichier .sql) car le
// bundle Lambda (zip manuel de .open-next/server-functions/default) ne
// garantit pas d'inclure des fichiers non-JS non tracés statiquement —
// voir CLAUDE.md sur les pièges de bundling déjà rencontrés.
const MIGRATION_NAME = "20260911100000_site_referential"

const STATEMENTS = [
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
]

// sha256 hex de prisma/migrations/20260911100000_site_referential/migration.sql
// — confirmé identique à celui que `prisma migrate deploy` calcule
// lui-même (vérifié en local contre une base fraîche avant ce commit),
// pour que _prisma_migrations reflète un état que `prisma migrate deploy`
// reconnaîtra comme déjà appliqué le jour où le bastion sera réparé,
// plutôt que de tenter de la rejouer.
const MIGRATION_CHECKSUM = "62396df95da57f5e518a7478ef22a0d9eb400332c99febeb8b6a8ae76ac80b32"

export async function POST(request: Request) {
  const auth = request.headers.get("authorization")
  const expected = await getIngestToken()
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const prisma = await getPrisma()

  const already = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = $1`,
    MIGRATION_NAME,
  )
  if (already.length > 0) {
    return NextResponse.json({ success: true, alreadyApplied: true })
  }

  const startedAt = new Date()
  try {
    await prisma.$transaction(STATEMENTS.map((sql) => prisma.$executeRawUnsafe(sql)))
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue.", statementsAttempted: STATEMENTS.length },
      { status: 500 },
    )
  }

  // Enregistre la migration comme appliquée dans le suivi Prisma standard
  // — même table, mêmes colonnes et même valeur "1" pour
  // applied_steps_count que `prisma migrate deploy` aurait renseignées
  // (vérifié en local : Prisma compte 1 "étape" par fichier de migration,
  // quel que soit son nombre d'instructions SQL).
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
     VALUES ($1, $2, $3, $4, $5, 1)`,
    randomUUID(),
    MIGRATION_CHECKSUM,
    MIGRATION_NAME,
    startedAt,
    new Date(),
  )

  return NextResponse.json({ success: true, alreadyApplied: false, statementsRun: STATEMENTS.length })
}
