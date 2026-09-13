-- Phase 4 : Cadastre bulk (Etalab/DGFiP) + relation Site<->Parcelle
-- explicite — voir prisma/schema.prisma. Additif sur une table
-- existante avec des lignes réelles en production (Parcelle, Phase 1) :
-- toute nouvelle colonne NOT NULL a un DEFAULT, aucune donnée existante
-- n'est perdue ou retirée.

-- CreateEnum
CREATE TYPE "SiteParcelleRelationMethod" AS ENUM ('SPATIAL');

-- AlterTable : siteId et commune deviennent nullable (une Parcelle
-- ingérée en masse n'a pas toujours de Site déjà connu, ni de nom de
-- commune fourni par la source bulk — voir le rapport).
ALTER TABLE "Parcelle" ALTER COLUMN "siteId" DROP NOT NULL;
ALTER TABLE "Parcelle" ALTER COLUMN "commune" DROP NOT NULL;

-- AlterTable : nouvelles colonnes, toutes nullables sauf updatedAt (qui
-- a besoin d'un DEFAULT pour ne pas casser les lignes déjà en
-- production).
ALTER TABLE "Parcelle" ADD COLUMN "relationMethod" "SiteParcelleRelationMethod";
ALTER TABLE "Parcelle" ADD COLUMN "source" TEXT;
ALTER TABLE "Parcelle" ADD COLUMN "dataset" TEXT;
ALTER TABLE "Parcelle" ADD COLUMN "datasetVersion" TEXT;
ALTER TABLE "Parcelle" ADD COLUMN "retrievedAt" TIMESTAMP(3);
ALTER TABLE "Parcelle" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable : la contrainte de clé étrangère siteId doit être recréée
-- avec ON DELETE SET NULL (elle était ON DELETE CASCADE quand la colonne
-- était NOT NULL).
ALTER TABLE "Parcelle" DROP CONSTRAINT "Parcelle_siteId_fkey";
ALTER TABLE "Parcelle" ADD CONSTRAINT "Parcelle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Parcelle_codeInsee_idx" ON "Parcelle"("codeInsee");
