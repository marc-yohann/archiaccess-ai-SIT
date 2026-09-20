-- Phase 8 — Acteurs : statut de résolution Etablissement->Site persistant,
-- même principe que UniteResolutionStatus (Phase 7, migration précédente).
--
-- Contexte (voir CLAUDE.md, correction utilisateur validant l'audit Phase
-- 8) : app/api/sit/acteurs/route.ts résout un Site pour chaque
-- établissement via une recherche BAN top-1 depuis la Phase 2, sans
-- jamais persister si cette résolution a été tentée ni si elle a échoué.
-- Etablissement.siteId nul est donc actuellement ambigu : "jamais tenté"
-- et "tenté, aucun candidat trouvé" sont indiscernables. Cette migration
-- ajoute la colonne d'état sans toucher à la logique de résolution elle-
-- même (revue séparément dans lib/data-sources/ban.ts et
-- app/api/sit/acteurs/route.ts, voir le rapport Phase 8).
--
-- Vérification de l'identifiant chronologique : 13 dossiers existent déjà
-- dans prisma/migrations/ au moment d'écrire celle-ci, le dernier étant
-- 20260920140000_unite_dpe_rename (Phase 7, déployée). Même limite d'accès
-- documentée que la migration précédente (pas de lecture directe de
-- _prisma_migrations sur RDS depuis cet environnement) : le mécanisme de
-- déploiement (app/api/admin/run-migration/route.ts) revérifie lui-même
-- les migrations réellement appliquées à chaque appel avant d'exécuter
-- celle-ci, donc l'ordre exact n'a pas besoin d'être deviné pour que ce
-- déploiement soit sûr.
--
-- Backfill EXPLICITEMENT prescrit par l'utilisateur (ne pas dévier) :
--   siteId IS NOT NULL -> VALID (résolution déjà réussie, top-1 pré-Phase-8)
--   siteId IS NULL     -> PENDING (JAMAIS NOT_FOUND : l'historique ne
--                         permet pas de savoir si une résolution a même
--                         été tentée pour ces lignes)
-- siteResolvedAt reste NULL pour tout le backfill historique (date réelle
-- de résolution inconnue) — jamais une valeur approximée. Il n'est
-- renseigné que par le nouveau code de résolution, à partir de cette
-- migration.
--
-- Additif et non destructif : aucune ligne, aucun siret, aucun siteId
-- existant modifié ou perdu. Testé réellement sur une base PostgreSQL 16
-- + PostGIS locale avant application (voir le rapport Phase 8).

CREATE TYPE "EtablissementSiteResolutionStatus" AS ENUM ('PENDING', 'VALID', 'NOT_FOUND', 'AMBIGUOUS');

ALTER TABLE "Etablissement" ADD COLUMN "siteResolutionStatus" "EtablissementSiteResolutionStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Etablissement" ADD COLUMN "siteResolvedAt" TIMESTAMP(3);

-- Backfill conditionnel — la colonne vient d'être créée avec DEFAULT
-- 'PENDING' NOT NULL (déjà correct pour siteId IS NULL) ; seule la
-- correction des lignes déjà résolues est nécessaire.
UPDATE "Etablissement" SET "siteResolutionStatus" = 'VALID' WHERE "siteId" IS NOT NULL;
