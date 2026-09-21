-- Phase 11 — Domaine documentaire SIT (DocumentSit), STRICTEMENT DISTINCT
-- du modèle "Document" existant (corpus réglementaire indexé pour le
-- copilote, pgvector) — voir le rapport d'audit Phase 11 (validé par
-- l'utilisateur). Aucune table du corpus RAG ("Document", "DocumentChunk")
-- n'est modifiée par cette migration.
--
-- DocumentSit représente un document technique/administratif/contractuel
-- (DCE, CCTP, rapport, plan, PV...) rattaché à un ou plusieurs objets réels
-- du SIT (Site/Projet/AvisMarche/Lot/Acteur), avec 4 tables de jointure
-- N:N (jamais une simple FK unique — un document peut concerner plusieurs
-- objets, ex. un CCTP pour tout un marché à plusieurs lots).
--
-- Provenance jamais inventée : source/sourceId/sourceUrl/retrievedAt tous
-- nullables — aucune source actuelle (BOAMP/BODACC) ne fournit de fichier
-- réellement téléchargeable, seulement des URL de portail/page de détail
-- (vérifié réellement, voir le rapport d'audit Phase 11). storageKey
-- prépare une future évolution de stockage binaire (lib/storage.ts reste
-- markdown-only, non modifié par cette phase) — sa présence ne signifie
-- jamais que le fichier est réellement stocké.
--
-- Pas de DocumentVersion, pas d'embedding/vectorisation, pas de connexion
-- à DocumentChunk : aucun besoin réel démontré à ce stade.
--
-- Vérification de l'identifiant chronologique : 17 dossiers existent déjà
-- dans prisma/migrations/ au moment d'écrire celle-ci, le dernier étant
-- 20260920170000_projet_domaine (Phase 10, déployée). Même limite d'accès
-- documentée que les migrations précédentes (pas de lecture directe de
-- _prisma_migrations sur RDS depuis cet environnement) : le mécanisme de
-- déploiement (app/api/admin/run-migration/route.ts) revérifie lui-même
-- les migrations réellement appliquées à chaque appel avant d'exécuter
-- celle-ci, donc l'ordre exact n'a pas besoin d'être deviné.
--
-- Additif et non destructif : aucune table existante modifiée (ni
-- "Document"/"DocumentChunk", ni Site/Projet/AvisMarche/Lot/Acteur au-delà
-- d'une relation inverse déclarative Prisma, sans nouvelle colonne).
-- Testé réellement sur une base PostgreSQL 16 + PostGIS locale avant
-- application (voir le rapport Phase 11).

CREATE TYPE "DocumentSitType" AS ENUM ('DCE', 'RC', 'CCAP', 'CCTP', 'AE', 'BPU', 'DPGF', 'ETUDE', 'DIAGNOSTIC', 'RAPPORT', 'PLAN', 'DOE', 'PV', 'OPR', 'RESERVE', 'COMPTE_RENDU', 'PLANNING');

CREATE TABLE "DocumentSit" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "DocumentSitType",
    "description" TEXT,
    "source" TEXT,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "checksum" TEXT,
    "mimeType" TEXT,
    "tailleOctets" BIGINT,
    "dateDocument" TIMESTAMP(3),
    "storageKey" TEXT,
    "contenuExtrait" TEXT,
    "contenuExtraitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentSitSite" (
    "id" TEXT NOT NULL,
    "documentSitId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSitSite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentSitSite_documentSitId_siteId_key" ON "DocumentSitSite"("documentSitId", "siteId");
CREATE INDEX "DocumentSitSite_documentSitId_idx" ON "DocumentSitSite"("documentSitId");
CREATE INDEX "DocumentSitSite_siteId_idx" ON "DocumentSitSite"("siteId");

ALTER TABLE "DocumentSitSite" ADD CONSTRAINT "DocumentSitSite_documentSitId_fkey" FOREIGN KEY ("documentSitId") REFERENCES "DocumentSit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSitSite" ADD CONSTRAINT "DocumentSitSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocumentSitProjet" (
    "id" TEXT NOT NULL,
    "documentSitId" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSitProjet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentSitProjet_documentSitId_projetId_key" ON "DocumentSitProjet"("documentSitId", "projetId");
CREATE INDEX "DocumentSitProjet_documentSitId_idx" ON "DocumentSitProjet"("documentSitId");
CREATE INDEX "DocumentSitProjet_projetId_idx" ON "DocumentSitProjet"("projetId");

ALTER TABLE "DocumentSitProjet" ADD CONSTRAINT "DocumentSitProjet_documentSitId_fkey" FOREIGN KEY ("documentSitId") REFERENCES "DocumentSit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSitProjet" ADD CONSTRAINT "DocumentSitProjet_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocumentSitAvisMarche" (
    "id" TEXT NOT NULL,
    "documentSitId" TEXT NOT NULL,
    "avisMarcheId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSitAvisMarche_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentSitAvisMarche_documentSitId_avisMarcheId_key" ON "DocumentSitAvisMarche"("documentSitId", "avisMarcheId");
CREATE INDEX "DocumentSitAvisMarche_documentSitId_idx" ON "DocumentSitAvisMarche"("documentSitId");
CREATE INDEX "DocumentSitAvisMarche_avisMarcheId_idx" ON "DocumentSitAvisMarche"("avisMarcheId");

ALTER TABLE "DocumentSitAvisMarche" ADD CONSTRAINT "DocumentSitAvisMarche_documentSitId_fkey" FOREIGN KEY ("documentSitId") REFERENCES "DocumentSit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSitAvisMarche" ADD CONSTRAINT "DocumentSitAvisMarche_avisMarcheId_fkey" FOREIGN KEY ("avisMarcheId") REFERENCES "AvisMarche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocumentSitLot" (
    "id" TEXT NOT NULL,
    "documentSitId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSitLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentSitLot_documentSitId_lotId_key" ON "DocumentSitLot"("documentSitId", "lotId");
CREATE INDEX "DocumentSitLot_documentSitId_idx" ON "DocumentSitLot"("documentSitId");
CREATE INDEX "DocumentSitLot_lotId_idx" ON "DocumentSitLot"("lotId");

ALTER TABLE "DocumentSitLot" ADD CONSTRAINT "DocumentSitLot_documentSitId_fkey" FOREIGN KEY ("documentSitId") REFERENCES "DocumentSit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSitLot" ADD CONSTRAINT "DocumentSitLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocumentSitActeur" (
    "id" TEXT NOT NULL,
    "documentSitId" TEXT NOT NULL,
    "acteurId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSitActeur_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentSitActeur_documentSitId_acteurId_key" ON "DocumentSitActeur"("documentSitId", "acteurId");
CREATE INDEX "DocumentSitActeur_documentSitId_idx" ON "DocumentSitActeur"("documentSitId");
CREATE INDEX "DocumentSitActeur_acteurId_idx" ON "DocumentSitActeur"("acteurId");

ALTER TABLE "DocumentSitActeur" ADD CONSTRAINT "DocumentSitActeur_documentSitId_fkey" FOREIGN KEY ("documentSitId") REFERENCES "DocumentSit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSitActeur" ADD CONSTRAINT "DocumentSitActeur_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Acteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
