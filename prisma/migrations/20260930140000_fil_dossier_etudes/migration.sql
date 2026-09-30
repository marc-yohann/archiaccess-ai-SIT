-- Fil de l'étape, dossier du projet et études du SIT (2026-09-30, maquette
-- validée « Fil, dossier et études »).
--
-- 1. "ProjetElement" : note, fichier déposé, réponse d'Archiaccess AI
--    jointe (copie, la conversation reste privée) ou lien, rattaché à un
--    projet et, s'il a un etapeCode, au fil de cette étape.
-- 2. "ProjetEtape"."responsableId" : responsable de l'étape.
-- 3. "ajouteParId" sur les rattachements site / acteur / avis / lot : qui
--    les a ajoutés (nul pour les rattachements antérieurs).
-- 4. "Document"."auteurId" et "discipline" : auteur et discipline des
--    études du SIT (nuls pour les textes chargés en lot et les études
--    ajoutées avant cette date).
-- 5. Reprise des notes d'étape existantes comme premières entrées du fil
--    (auteur = dernier à avoir modifié l'étape, date = dernière
--    modification). La colonne "note" est conservée.
--
-- Additif et non destructif : aucune colonne existante modifiée ni
-- supprimée, aucune donnée supprimée.

CREATE TYPE "ProjetElementType" AS ENUM ('NOTE', 'FICHIER', 'REPONSE_IA', 'LIEN');

ALTER TABLE "Document" ADD COLUMN "auteurId" TEXT, ADD COLUMN "discipline" TEXT;

ALTER TABLE "ProjetEtape" ADD COLUMN "responsableId" TEXT;

ALTER TABLE "ProjetSite" ADD COLUMN "ajouteParId" TEXT;

ALTER TABLE "ProjetActeur" ADD COLUMN "ajouteParId" TEXT;

ALTER TABLE "ProjetAvisMarche" ADD COLUMN "ajouteParId" TEXT;

ALTER TABLE "ProjetLot" ADD COLUMN "ajouteParId" TEXT;

CREATE TABLE "ProjetElement" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "etapeCode" TEXT,
    "type" "ProjetElementType" NOT NULL,
    "titre" TEXT,
    "texte" TEXT,
    "message" TEXT,
    "url" TEXT,
    "storageKey" TEXT,
    "nomFichier" TEXT,
    "mimeType" TEXT,
    "tailleOctets" INTEGER,
    "auteurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjetElement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjetElement_projetId_etapeCode_idx" ON "ProjetElement"("projetId", "etapeCode");

CREATE INDEX "ProjetElement_projetId_createdAt_idx" ON "ProjetElement"("projetId", "createdAt");

ALTER TABLE "Document" ADD CONSTRAINT "Document_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjetEtape" ADD CONSTRAINT "ProjetEtape_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjetElement" ADD CONSTRAINT "ProjetElement_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjetElement" ADD CONSTRAINT "ProjetElement_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjetSite" ADD CONSTRAINT "ProjetSite_ajouteParId_fkey" FOREIGN KEY ("ajouteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjetActeur" ADD CONSTRAINT "ProjetActeur_ajouteParId_fkey" FOREIGN KEY ("ajouteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjetAvisMarche" ADD CONSTRAINT "ProjetAvisMarche_ajouteParId_fkey" FOREIGN KEY ("ajouteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjetLot" ADD CONSTRAINT "ProjetLot_ajouteParId_fkey" FOREIGN KEY ("ajouteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ProjetElement" ("id", "projetId", "etapeCode", "type", "texte", "auteurId", "createdAt", "updatedAt")
SELECT 'note_' || e."id", e."projetId", e."etapeCode", 'NOTE', e."note", e."updatedById", e."updatedAt", e."updatedAt"
FROM "ProjetEtape" e
WHERE e."note" IS NOT NULL AND btrim(e."note") <> '';
