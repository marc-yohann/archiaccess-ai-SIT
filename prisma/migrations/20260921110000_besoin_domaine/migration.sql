-- Phase 12 — Domaine Besoin : une nécessité métier/technique explicitement
-- identifiée (étude structure, mission OPC, diagnostic, travaux de
-- façade, maintenance...), TOUJOURS créée par un employé — voir le
-- rapport d'audit Phase 12 : aucune source externe du dépôt ne fournit
-- d'objet "besoin" identifiable, même constat que Projet (Phase 10).
--
-- Aucun enum créé pour type/discipline/problematique/typeOuvrage/statut :
-- vérifié à l'audit qu'aucune taxonomie stable réutilisable n'existe dans
-- ce dépôt (la taxonomie UI des ~40 disciplines, app/sit/page.tsx, est en
-- phrases longues avec parenthèses, jamais des identifiants d'enum
-- valides) — tous ces champs restent du texte libre nullable.
--
-- 6 tables de jointure N:N (BesoinSite/Projet/Acteur/AvisMarche/Lot/
-- DocumentSit), cardinalités confirmées par la consigne Phase 12
-- elle-même (notamment Lot : "un lot peut contenir plusieurs besoins, un
-- besoin peut concerner plusieurs lots"). Pas de relation directe vers
-- Parcelle/BatimentPhysique/Unite/DPE : déjà accessibles via Site.
--
-- Pas de createdBy/createdById (à la différence de Projet, Phase 10) :
-- absent de la liste de champs minimale demandée pour cette phase.
--
-- Vérification de l'identifiant chronologique : 18 dossiers existent déjà
-- dans prisma/migrations/ au moment d'écrire celle-ci, le dernier étant
-- 20260921100000_document_sit_domaine (Phase 11B, déployée). Même limite
-- d'accès documentée que les migrations précédentes (pas de lecture
-- directe de _prisma_migrations sur RDS depuis cet environnement) : le
-- mécanisme de déploiement (app/api/admin/run-migration/route.ts)
-- revérifie lui-même les migrations réellement appliquées à chaque appel
-- avant d'exécuter celle-ci.
--
-- Additif et non destructif : aucune table existante modifiée (Site/
-- Projet/Acteur/AvisMarche/Lot/DocumentSit reçoivent uniquement une
-- relation inverse déclarative Prisma, sans nouvelle colonne). Testé
-- réellement sur une base PostgreSQL 16 + PostGIS locale avant
-- application (voir le rapport Phase 12).

CREATE TABLE "Besoin" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "statut" TEXT,
    "type" TEXT,
    "discipline" TEXT,
    "problematique" TEXT,
    "typeOuvrage" TEXT,
    "source" TEXT,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Besoin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BesoinSite" (
    "id" TEXT NOT NULL,
    "besoinId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BesoinSite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BesoinSite_besoinId_siteId_key" ON "BesoinSite"("besoinId", "siteId");
CREATE INDEX "BesoinSite_besoinId_idx" ON "BesoinSite"("besoinId");
CREATE INDEX "BesoinSite_siteId_idx" ON "BesoinSite"("siteId");

ALTER TABLE "BesoinSite" ADD CONSTRAINT "BesoinSite_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "Besoin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BesoinSite" ADD CONSTRAINT "BesoinSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BesoinProjet" (
    "id" TEXT NOT NULL,
    "besoinId" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BesoinProjet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BesoinProjet_besoinId_projetId_key" ON "BesoinProjet"("besoinId", "projetId");
CREATE INDEX "BesoinProjet_besoinId_idx" ON "BesoinProjet"("besoinId");
CREATE INDEX "BesoinProjet_projetId_idx" ON "BesoinProjet"("projetId");

ALTER TABLE "BesoinProjet" ADD CONSTRAINT "BesoinProjet_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "Besoin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BesoinProjet" ADD CONSTRAINT "BesoinProjet_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BesoinActeur" (
    "id" TEXT NOT NULL,
    "besoinId" TEXT NOT NULL,
    "acteurId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BesoinActeur_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BesoinActeur_besoinId_acteurId_key" ON "BesoinActeur"("besoinId", "acteurId");
CREATE INDEX "BesoinActeur_besoinId_idx" ON "BesoinActeur"("besoinId");
CREATE INDEX "BesoinActeur_acteurId_idx" ON "BesoinActeur"("acteurId");

ALTER TABLE "BesoinActeur" ADD CONSTRAINT "BesoinActeur_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "Besoin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BesoinActeur" ADD CONSTRAINT "BesoinActeur_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Acteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BesoinAvisMarche" (
    "id" TEXT NOT NULL,
    "besoinId" TEXT NOT NULL,
    "avisMarcheId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BesoinAvisMarche_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BesoinAvisMarche_besoinId_avisMarcheId_key" ON "BesoinAvisMarche"("besoinId", "avisMarcheId");
CREATE INDEX "BesoinAvisMarche_besoinId_idx" ON "BesoinAvisMarche"("besoinId");
CREATE INDEX "BesoinAvisMarche_avisMarcheId_idx" ON "BesoinAvisMarche"("avisMarcheId");

ALTER TABLE "BesoinAvisMarche" ADD CONSTRAINT "BesoinAvisMarche_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "Besoin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BesoinAvisMarche" ADD CONSTRAINT "BesoinAvisMarche_avisMarcheId_fkey" FOREIGN KEY ("avisMarcheId") REFERENCES "AvisMarche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BesoinLot" (
    "id" TEXT NOT NULL,
    "besoinId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BesoinLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BesoinLot_besoinId_lotId_key" ON "BesoinLot"("besoinId", "lotId");
CREATE INDEX "BesoinLot_besoinId_idx" ON "BesoinLot"("besoinId");
CREATE INDEX "BesoinLot_lotId_idx" ON "BesoinLot"("lotId");

ALTER TABLE "BesoinLot" ADD CONSTRAINT "BesoinLot_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "Besoin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BesoinLot" ADD CONSTRAINT "BesoinLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BesoinDocumentSit" (
    "id" TEXT NOT NULL,
    "besoinId" TEXT NOT NULL,
    "documentSitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BesoinDocumentSit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BesoinDocumentSit_besoinId_documentSitId_key" ON "BesoinDocumentSit"("besoinId", "documentSitId");
CREATE INDEX "BesoinDocumentSit_besoinId_idx" ON "BesoinDocumentSit"("besoinId");
CREATE INDEX "BesoinDocumentSit_documentSitId_idx" ON "BesoinDocumentSit"("documentSitId");

ALTER TABLE "BesoinDocumentSit" ADD CONSTRAINT "BesoinDocumentSit_besoinId_fkey" FOREIGN KEY ("besoinId") REFERENCES "Besoin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BesoinDocumentSit" ADD CONSTRAINT "BesoinDocumentSit_documentSitId_fkey" FOREIGN KEY ("documentSitId") REFERENCES "DocumentSit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
