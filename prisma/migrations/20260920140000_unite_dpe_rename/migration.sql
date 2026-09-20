-- Phase 7 — Renommage sémantique Batiment (DPE/logement) -> Unite.
--
-- Contexte (voir prisma/schema.prisma, ancien commentaire sur
-- BatimentPhysique) : le modèle "Batiment" a toujours été, en réalité, un
-- enregistrement DPE/logement (jusqu'à 101 DPE réels pour une même
-- adresse, Phase 5B), jamais un bâtiment physique. "BatimentPhysique"
-- (source RNB) reste STRICTEMENT INCHANGÉ dans cette migration — déjà
-- déployé et testé en production (Phase 5H-D, 566k lignes réelles sur
-- AWS) ; le renommer en "Batiment" comme évoqué dans une note antérieure
-- aurait été un remaniement cosmétique pur, sans nécessité démontrée,
-- décision explicitement tranchée par l'utilisateur pour cette phase.
--
-- Vérification de l'identifiant chronologique de cette migration : les 12
-- dossiers de prisma/migrations/ existants avant celui-ci sont la seule
-- source consultable directement dans cet environnement (accès direct à
-- _prisma_migrations sur RDS impossible : bastion EC2/SSM cassé, TCP brut
-- non supporté par le proxy réseau de cet environnement — voir CLAUDE.md).
-- Le dernier dossier réel est 20260915100000_batiment_physique_partition ;
-- celui-ci (20260920140000) est chronologiquement après. L'historique
-- documenté (rapport Phase 5H-B) confirme que les 9 migrations couvertes
-- par app/api/admin/run-migration/route.ts (dont 20260915100000) étaient
-- toutes appliquées sur RDS à cette date — c'est la meilleure preuve
-- disponible, pas une simple supposition, mais pas non plus une lecture
-- directe de _prisma_migrations : à confirmer avant application réelle
-- (voir le rapport final, section "écarts").
--
-- RENAME non destructif : aucune ligne, aucun id, aucun numeroDpe, aucune
-- relation Site perdue. Testé réellement sur une base PostgreSQL 16 +
-- PostGIS locale avant d'écrire cette migration (voir le rapport).

ALTER TABLE "Batiment" RENAME TO "Unite";
ALTER TABLE "Unite" RENAME CONSTRAINT "Batiment_siteId_fkey" TO "Unite_siteId_fkey";
ALTER INDEX "Batiment_numeroDpe_key" RENAME TO "Unite_numeroDpe_key";
ALTER INDEX "Batiment_siteId_idx" RENAME TO "Unite_siteId_idx";
ALTER INDEX "Batiment_pkey" RENAME TO "Unite_pkey";

-- Champs Phase 7 — réellement fournis par lib/data-sources/dpe.ts
-- (DpeRecord), jamais persistés jusqu'ici. Tous nullables : additif,
-- aucun impact sur les lignes existantes.
ALTER TABLE "Unite" ADD COLUMN "identifiantBan" TEXT;
ALTER TABLE "Unite" ADD COLUMN "codeInseeBan" TEXT;
ALTER TABLE "Unite" ADD COLUMN "numeroEtageAppartement" INTEGER;
ALTER TABLE "Unite" ADD COLUMN "dateEtablissement" TEXT;
ALTER TABLE "Unite" ADD COLUMN "statutGeocodage" TEXT;
ALTER TABLE "Unite" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Unite" ADD COLUMN "latitude" DOUBLE PRECISION;

-- État de résolution persistant (correction utilisateur) — distingue
-- explicitement "jamais traité" de "traité, aucun bâtiment trouvé", ce
-- qu'une simple absence de ligne UniteBatimentPhysique ne permettrait pas
-- de distinguer autrement.
CREATE TYPE "UniteResolutionStatus" AS ENUM ('PENDING', 'VALID', 'NOT_FOUND', 'AMBIGUOUS');
ALTER TABLE "Unite" ADD COLUMN "batimentPhysiqueResolutionStatus" "UniteResolutionStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Unite" ADD COLUMN "batimentPhysiqueResolvedAt" TIMESTAMP(3);

-- Relation Unite <-> BatimentPhysique — résolution spatiale uniquement
-- (aucune référence source directe, contrairement à RNB.plots/addresses) :
-- ST_Covers(bâtiment, point DPE). NOT_FOUND n'est jamais matérialisé en
-- ligne ici (voir batimentPhysiqueResolutionStatus ci-dessus pour cet
-- état) — seuls VALID (1 ligne) et AMBIGUOUS (N lignes, une par candidat,
-- jamais de sélection arbitraire) le sont.
CREATE TABLE "UniteBatimentPhysique" (
    "id" TEXT NOT NULL,
    "uniteId" TEXT NOT NULL,
    "batimentId" TEXT NOT NULL,
    "referenceStatus" "ReferenceStatus" NOT NULL,
    "relationMethod" TEXT NOT NULL DEFAULT 'SPATIAL_COVERS',
    "source" TEXT NOT NULL DEFAULT 'dpe-ademe-spatial',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UniteBatimentPhysique_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "UniteBatimentPhysique" ADD CONSTRAINT "UniteBatimentPhysique_uniteId_fkey" FOREIGN KEY ("uniteId") REFERENCES "Unite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UniteBatimentPhysique" ADD CONSTRAINT "UniteBatimentPhysique_batimentId_fkey" FOREIGN KEY ("batimentId") REFERENCES "BatimentPhysique"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "UniteBatimentPhysique_uniteId_batimentId_key" ON "UniteBatimentPhysique"("uniteId", "batimentId");
CREATE INDEX "UniteBatimentPhysique_uniteId_idx" ON "UniteBatimentPhysique"("uniteId");
CREATE INDEX "UniteBatimentPhysique_batimentId_idx" ON "UniteBatimentPhysique"("batimentId");
