-- Phase 5C : fondation du domaine BÂTIMENT PHYSIQUE (source RNB —
-- Référentiel National des Bâtiments, voir CLAUDE.md et le rapport).
-- Entièrement additive : aucune colonne existante retirée/modifiée,
-- aucune ligne "Batiment" (DPE/Unité, voir schema.prisma) touchée.
--
-- Décision de nommage documentée dans schema.prisma : le nouveau bâtiment
-- physique s'appelle "BatimentPhysique" (pas "Batiment", déjà pris par le
-- modèle DPE-scopé existant — renommage explicitement interdit cette
-- phase).

-- 1. Site.banId — identifiant natif BAN ("id" du fichier bulk), nécessaire
--    pour résoudre BatimentPhysiqueSite.addressRef (RNB "addresses[].cle_interop_ban"
--    = même référentiel). PAS unique (163 doublons réels mesurés sur BAN
--    dept 51 / 216 756 lignes, Phase 5B) — un index simple, jamais une
--    contrainte qui échouerait sur des données réelles connues.
ALTER TABLE "Site" ADD COLUMN "banId" TEXT;
CREATE INDEX "Site_banId_idx" ON "Site"("banId");

-- 2. Enums du nouveau domaine.
CREATE TYPE "BatimentRelationMethod" AS ENUM ('SOURCE_PROVIDED');
CREATE TYPE "ReferenceStatus" AS ENUM ('VALID', 'NOT_FOUND', 'INVALID_FORMAT', 'AMBIGUOUS');

-- 3. BatimentPhysique — identité RNB + géométrie réelle. Colonne
--    "geometry(Geometry, 4326)" volontairement non typée à un sous-type
--    précis (Point/Polygon/MultiPolygon) : RNB fournit réellement les
--    trois sur un même département (mesuré : 365 271 MultiPolygon,
--    13 348 Polygon, 2 188 Point sur le département 51 entier) — un type
--    de colonne strict rejetterait les lignes Point (constaté par un
--    ERROR PostGIS réel pendant la validation, voir le rapport).
CREATE TABLE "BatimentPhysique" (
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
);

CREATE UNIQUE INDEX "BatimentPhysique_rnbId_key" ON "BatimentPhysique"("rnbId");
CREATE INDEX "BatimentPhysique_geomType_idx" ON "BatimentPhysique"("geomType");
CREATE INDEX "BatimentPhysique_geom_idx" ON "BatimentPhysique" USING GIST ("geom");

-- 4. BatimentPhysiqueParcelle — relation N:N fournie nativement par RNB
--    ("plots"), jamais recalculée par ST_Contains. Unicité sur
--    (batimentId, parcelleRef) et non (batimentId, parcelleId) : parcelleId
--    est nullable (référence NOT_FOUND tant que non résolue), parcelleRef
--    (toujours fournie par la source) est la vraie clé naturelle — voir
--    schema.prisma pour la justification complète.
CREATE TABLE "BatimentPhysiqueParcelle" (
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
);

CREATE UNIQUE INDEX "BatimentPhysiqueParcelle_batimentId_parcelleRef_key" ON "BatimentPhysiqueParcelle"("batimentId", "parcelleRef");
CREATE INDEX "BatimentPhysiqueParcelle_batimentId_idx" ON "BatimentPhysiqueParcelle"("batimentId");
CREATE INDEX "BatimentPhysiqueParcelle_parcelleId_idx" ON "BatimentPhysiqueParcelle"("parcelleId");

ALTER TABLE "BatimentPhysiqueParcelle" ADD CONSTRAINT "BatimentPhysiqueParcelle_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentPhysique"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatimentPhysiqueParcelle" ADD CONSTRAINT "BatimentPhysiqueParcelle_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. BatimentPhysiqueSite — relation N:N fournie nativement par RNB
--    ("addresses"), résolue par exactitude contre Site.banId uniquement
--    (aucun rapprochement flou cette phase). Même logique d'unicité que
--    BatimentPhysiqueParcelle.
CREATE TABLE "BatimentPhysiqueSite" (
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
);

CREATE UNIQUE INDEX "BatimentPhysiqueSite_batimentId_addressRef_key" ON "BatimentPhysiqueSite"("batimentId", "addressRef");
CREATE INDEX "BatimentPhysiqueSite_batimentId_idx" ON "BatimentPhysiqueSite"("batimentId");
CREATE INDEX "BatimentPhysiqueSite_siteId_idx" ON "BatimentPhysiqueSite"("siteId");

ALTER TABLE "BatimentPhysiqueSite" ADD CONSTRAINT "BatimentPhysiqueSite_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentPhysique"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatimentPhysiqueSite" ADD CONSTRAINT "BatimentPhysiqueSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
