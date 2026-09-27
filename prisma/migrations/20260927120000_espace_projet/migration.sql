-- Espace projet (2026-09-27) — premier jalon de la réorientation du SIT
-- vers un espace de travail AMO/OPC (voir CLAUDE.md, "État actuel", et
-- docs/referentiel/README.md).
--
-- 1. Profil de l'opération sur "Projet" : statut du maître d'ouvrage,
--    montage contractuel, typologie d'ouvrage, mission Archiaccess,
--    réhabilitation. Texte libre côté base, validé côté application contre
--    lib/referentiel/libelles.ts (le référentiel évolue sans migration
--    d'enum). Colonnes nullables : les Projets existants restent valides.
-- 2. "ProjetEtape" : avancement d'un Projet sur une étape du référentiel
--    (statut + note), une ligne par étape renseignée.
--
-- Additif et non destructif : aucune colonne existante modifiée, aucune
-- donnée touchée.

ALTER TABLE "Projet" ADD COLUMN "statutMoa" TEXT;
ALTER TABLE "Projet" ADD COLUMN "montage" TEXT;
ALTER TABLE "Projet" ADD COLUMN "typologie" TEXT;
ALTER TABLE "Projet" ADD COLUMN "mission" TEXT;
ALTER TABLE "Projet" ADD COLUMN "rehabilitation" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "ProjetEtapeStatut" AS ENUM ('A_FAIRE', 'EN_COURS', 'FAIT', 'SANS_OBJET');

CREATE TABLE "ProjetEtape" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "etapeCode" TEXT NOT NULL,
    "statut" "ProjetEtapeStatut" NOT NULL DEFAULT 'A_FAIRE',
    "note" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjetEtape_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjetEtape_projetId_etapeCode_key" ON "ProjetEtape"("projetId", "etapeCode");
CREATE INDEX "ProjetEtape_projetId_idx" ON "ProjetEtape"("projetId");

ALTER TABLE "ProjetEtape" ADD CONSTRAINT "ProjetEtape_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjetEtape" ADD CONSTRAINT "ProjetEtape_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
