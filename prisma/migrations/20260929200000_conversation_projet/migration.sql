-- Jonction d'Archiaccess AI au SIT (2026-09-29) — chaque conversation peut
-- être rattachée au projet et à l'étape sur lesquels elle porte :
-- Archiaccess AI retrouve le contexte du projet où qu'on la reprenne
-- (panneau du SIT ou plein écran), et la liste des conversations est
-- rangée par projet.
--
-- 1. "Conversation"."projetId" (projet supprimé → conversation conservée,
--    détachée) et "etapeCode" (code d'étape du référentiel).
-- 2. Rattachement des conversations existantes nées sur un projet : leur
--    titre suit la convention « SIT · <projet> » (projet personnel) ou
--    « Équipe · <projet> » (projet collaboratif), uniquement vers un projet
--    auquel leur auteur a accès (créateur du projet personnel ; membre du
--    projet collaboratif ou administrateur).
--
-- Additif et non destructif : aucune colonne existante modifiée, aucune
-- donnée supprimée.

ALTER TABLE "Conversation" ADD COLUMN "projetId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "etapeCode" TEXT;

CREATE INDEX "Conversation_userId_projetId_idx" ON "Conversation"("userId", "projetId");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Conversation" c SET "projetId" = p."id"
FROM "Projet" p
WHERE c."projetId" IS NULL
  AND (c."title" = 'SIT · ' || p."nom" OR c."title" = 'Équipe · ' || p."nom")
  AND (
    (p."espace" = 'PERSONNEL' AND p."createdById" = c."userId")
    OR (p."espace" = 'COLLABORATIF' AND (
      EXISTS (SELECT 1 FROM "ProjetMembre" m WHERE m."projetId" = p."id" AND m."userId" = c."userId")
      OR EXISTS (SELECT 1 FROM "User" u WHERE u."id" = c."userId" AND u."isAdmin")
    ))
  );
