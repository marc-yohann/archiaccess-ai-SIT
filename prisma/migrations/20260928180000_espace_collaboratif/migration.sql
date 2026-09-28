-- Espace collaboratif (2026-09-28) — projets d'équipe créés par un
-- administrateur, accessibles aux seuls membres qu'il désigne ; les
-- projets personnels ne sont visibles que de leur créateur.
--
-- 1. "Projet"."espace" : PERSONNEL (défaut — tous les projets existants le
--    restent) ou COLLABORATIF ; "archivedAt" pour retirer un projet
--    collaboratif des espaces des membres sans le supprimer.
-- 2. "ProjetMembre" : accès d'un collaborateur à un projet collaboratif,
--    avec son rôle (membre ou chef de projet) et qui l'a donné.
--
-- Additif et non destructif : aucune colonne existante modifiée, aucune
-- donnée touchée.

CREATE TYPE "ProjetEspace" AS ENUM ('PERSONNEL', 'COLLABORATIF');
CREATE TYPE "ProjetRole" AS ENUM ('MEMBRE', 'CHEF_DE_PROJET');

ALTER TABLE "Projet" ADD COLUMN "espace" "ProjetEspace" NOT NULL DEFAULT 'PERSONNEL';
ALTER TABLE "Projet" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "ProjetMembre" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjetRole" NOT NULL DEFAULT 'MEMBRE',
    "ajouteParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjetMembre_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjetMembre_projetId_userId_key" ON "ProjetMembre"("projetId", "userId");
CREATE INDEX "ProjetMembre_userId_idx" ON "ProjetMembre"("userId");

ALTER TABLE "ProjetMembre" ADD CONSTRAINT "ProjetMembre_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjetMembre" ADD CONSTRAINT "ProjetMembre_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjetMembre" ADD CONSTRAINT "ProjetMembre_ajouteParId_fkey" FOREIGN KEY ("ajouteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
