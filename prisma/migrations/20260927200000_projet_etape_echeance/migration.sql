-- Espace projet — échéance par étape (2026-09-27), pour le tableau de bord
-- (« À traiter », retards). Séparée de 20260927120000_espace_projet pour ne
-- jamais modifier une migration déjà embarquée dans le code déployé.
-- Additif : une colonne nullable, aucune donnée touchée.

ALTER TABLE "ProjetEtape" ADD COLUMN "echeance" TIMESTAMP(3);
