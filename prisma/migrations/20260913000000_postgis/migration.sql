-- PostGIS (Phase 3, section H du brief) — additive uniquement : les
-- colonnes Float (Site.longitude/latitude) et Json (Parcelle.geometry)
-- existantes ne sont ni retirées ni transformées, "geom" est une colonne
-- nouvelle backfillée depuis elles. Compatibilité préservée : tout code
-- qui lit longitude/latitude/geometry continue de fonctionner à
-- l'identique.

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS postgis;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN "geom" geometry(Point, 4326);
ALTER TABLE "Parcelle" ADD COLUMN "geom" geometry(MultiPolygon, 4326);

-- Backfill depuis les colonnes existantes — jamais une valeur inventée,
-- uniquement une reprojection de ce qui est déjà réel.
UPDATE "Site" SET "geom" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326) WHERE "geom" IS NULL;
UPDATE "Parcelle" SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON("geometry"::text), 4326)) WHERE "geom" IS NULL;

-- CreateIndex (GiST — index spatial standard PostGIS)
CREATE INDEX "Site_geom_idx" ON "Site" USING GIST ("geom");
CREATE INDEX "Parcelle_geom_idx" ON "Parcelle" USING GIST ("geom");
