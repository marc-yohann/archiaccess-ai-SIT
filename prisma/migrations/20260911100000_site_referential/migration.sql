-- Référentiel territorial du SIT (Phase 1) — Site/Parcelle/Bâtiment,
-- structure et relie la donnée déjà réellement récupérée par les
-- connecteurs existants (cadastre, DPE, BAN). Voir prisma/schema.prisma
-- pour le contexte complet.

-- CreateTable
CREATE TABLE "Site" (
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
);

-- CreateTable
CREATE TABLE "Parcelle" (
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
);

-- CreateTable
CREATE TABLE "Batiment" (
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
);

-- CreateTable
CREATE TABLE "SiteSource" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_citycode_label_key" ON "Site"("citycode", "label");

-- CreateIndex
CREATE INDEX "Site_citycode_idx" ON "Site"("citycode");

-- CreateIndex
CREATE UNIQUE INDEX "Parcelle_idu_key" ON "Parcelle"("idu");

-- CreateIndex
CREATE INDEX "Parcelle_siteId_idx" ON "Parcelle"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Batiment_numeroDpe_key" ON "Batiment"("numeroDpe");

-- CreateIndex
CREATE INDEX "Batiment_siteId_idx" ON "Batiment"("siteId");

-- CreateIndex
CREATE INDEX "SiteSource_siteId_idx" ON "SiteSource"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSource_siteId_source_key" ON "SiteSource"("siteId", "source");

-- AddForeignKey
ALTER TABLE "Parcelle" ADD CONSTRAINT "Parcelle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batiment" ADD CONSTRAINT "Batiment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSource" ADD CONSTRAINT "SiteSource_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
