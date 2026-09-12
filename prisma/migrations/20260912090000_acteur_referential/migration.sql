-- Référentiel des acteurs du SIT (Phase 2) — Acteur/Etablissement,
-- structure et relie la donnée déjà réellement récupérée par
-- lib/data-sources/entreprises.ts (SIRENE). Voir prisma/schema.prisma.

-- CreateEnum
CREATE TYPE "ActeurType" AS ENUM ('ARCHITECTE', 'BUREAU_ETUDES', 'AMO', 'OPC', 'ECONOMISTE', 'GEOMETRE', 'CONTROLEUR_TECHNIQUE', 'COORDONNATEUR_SPS', 'DIAGNOSTIQUEUR', 'ENTREPRISE_GENERALE', 'ENTREPRISE_SPECIALISEE', 'FOURNISSEUR', 'FABRICANT', 'PROMOTEUR', 'MAITRE_OUVRAGE', 'ACHETEUR_PUBLIC');

-- CreateTable
CREATE TABLE "Acteur" (
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
);

-- CreateTable
CREATE TABLE "Etablissement" (
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
);

-- CreateTable
CREATE TABLE "ActeurSource" (
    "id" TEXT NOT NULL,
    "acteurId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActeurSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Acteur_siren_key" ON "Acteur"("siren");

-- CreateIndex
CREATE UNIQUE INDEX "Etablissement_siret_key" ON "Etablissement"("siret");

-- CreateIndex
CREATE INDEX "Etablissement_acteurId_idx" ON "Etablissement"("acteurId");

-- CreateIndex
CREATE INDEX "Etablissement_siteId_idx" ON "Etablissement"("siteId");

-- CreateIndex
CREATE INDEX "ActeurSource_acteurId_idx" ON "ActeurSource"("acteurId");

-- CreateIndex
CREATE UNIQUE INDEX "ActeurSource_acteurId_source_key" ON "ActeurSource"("acteurId", "source");

-- AddForeignKey
ALTER TABLE "Etablissement" ADD CONSTRAINT "Etablissement_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Acteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etablissement" ADD CONSTRAINT "Etablissement_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActeurSource" ADD CONSTRAINT "ActeurSource_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Acteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
