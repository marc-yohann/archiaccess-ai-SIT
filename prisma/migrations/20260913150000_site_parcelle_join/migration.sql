-- Phase 4.5 : consolidation du modèle géospatial Site<->Parcelle.
-- Remplace Parcelle.siteId (scalaire, plafonnait une Parcelle à au plus un
-- Site) par une relation explicite N:N (SiteParcelle) — mesuré réellement
-- avant cette migration que la donnée contredit l'hypothèse 1:1 (voir le
-- rapport Phase 4.5). Additive autant que possible : la géométrie
-- (Parcelle.geom, Site.geom, source de vérité des relations SPATIAL_CONTAINS)
-- n'est jamais touchée ; seules les relations SPATIAL_NEARBY historiques
-- (créées via la recherche à la demande, non recomposables depuis la seule
-- géométrie) sont explicitement copiées avant suppression de l'ancienne
-- colonne — voir l'étape 4 ci-dessous.

-- 1. L'ancien type énuméré n'a plus qu'une seule valeur historique
--    (SPATIAL) et doit être remplacé par un type plus riche portant le
--    même nom — renommé temporairement pour éviter le conflit de nom.
ALTER TYPE "SiteParcelleRelationMethod" RENAME TO "SiteParcelleRelationMethod_old";

CREATE TYPE "SiteParcelleRelationMethod" AS ENUM ('SPATIAL_CONTAINS', 'SPATIAL_NEARBY', 'DETERMINISTIC');

-- 2. Nouvelle table de relation explicite.
CREATE TABLE "SiteParcelle" (
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
);

CREATE UNIQUE INDEX "SiteParcelle_siteId_parcelleId_key" ON "SiteParcelle"("siteId", "parcelleId");
CREATE INDEX "SiteParcelle_siteId_idx" ON "SiteParcelle"("siteId");
CREATE INDEX "SiteParcelle_parcelleId_idx" ON "SiteParcelle"("parcelleId");

ALTER TABLE "SiteParcelle" ADD CONSTRAINT "SiteParcelle_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteParcelle" ADD CONSTRAINT "SiteParcelle_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Aucune perte de données : identifie et migre ce qui n'est PAS
--    recomposable depuis la seule géométrie. Deux catégories dans
--    l'ancien Parcelle.siteId :
--    a) relationMethod = 'SPATIAL' (chemin bulk, ST_Contains) : la
--       géométrie (Parcelle.geom, Site.geom) reste intacte, un job de
--       résolution différée (lib/ingestion/sources/site-parcelle.ts,
--       Phase 4.5) RECALCULE ces relations à l'identique après cette
--       migration ET détecte en prime les cas ambigus que l'ancien modèle
--       laissait invisibles (voir le rapport) — volontairement PAS copiées
--       ici pour ne pas dupliquer une logique de résolution à deux
--       endroits.
--    b) relationMethod IS NULL (chemin à la demande, apicarto bbox ~20 m,
--       Phase 1) : cette relation n'est PAS un containment géométrique
--       exact et ne peut PAS être recalculée depuis la géométrie seule —
--       copiée explicitement ci-dessous avant suppression de la colonne.
INSERT INTO "SiteParcelle" ("id", "siteId", "parcelleId", "relationMethod", "ambiguous", "distanceMeters", "source", "retrievedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "siteId", "id", 'SPATIAL_NEARBY', false, NULL, COALESCE("source", 'cadastre-apicarto'), COALESCE("retrievedAt", "createdAt"), "createdAt", "updatedAt"
FROM "Parcelle"
WHERE "siteId" IS NOT NULL AND "relationMethod" IS NULL;

-- 4. Ancienne colonne devenue redondante — supprimée seulement après
--    l'INSERT ci-dessus (aucune donnée non recomposable perdue).
ALTER TABLE "Parcelle" DROP CONSTRAINT "Parcelle_siteId_fkey";
ALTER TABLE "Parcelle" DROP COLUMN "relationMethod";
ALTER TABLE "Parcelle" DROP COLUMN "siteId";
DROP INDEX IF EXISTS "Parcelle_siteId_idx";

DROP TYPE "SiteParcelleRelationMethod_old";
