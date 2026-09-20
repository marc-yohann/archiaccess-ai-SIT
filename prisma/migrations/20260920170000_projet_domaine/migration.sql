-- Phase 10 — Projet : objet de travail interne permettant à Archiaccess
-- de regrouper manuellement plusieurs éléments réels du SIT autour d'une
-- opération, étude ou dossier. JAMAIS une donnée externe canonique — voir
-- le rapport d'audit Phase 10 (validé par l'utilisateur) : aucun des 14
-- connecteurs existants ne fournit d'objet Projet/Opération identifiable,
-- donc pas de source/sourceId/sourceUrl/retrievedAt comme pour AvisMarche
-- ou Site. Créé explicitement par un employé (createdById), jamais déduit
-- automatiquement d'un AvisMarche/Site/Acteur.
--
-- 4 tables de jointure N:N (ProjetSite/ProjetActeur/ProjetAvisMarche/
-- ProjetLot) plutôt qu'une simple Projet.siteId : un Projet peut concerner
-- plusieurs sites (instruction explicite). Chaque relation résulte d'une
-- action utilisateur explicite — aucune résolution automatique n'est
-- exécutée par cette migration ni par le code applicatif associé.
--
-- Vérification de l'identifiant chronologique : 16 dossiers existent déjà
-- dans prisma/migrations/ au moment d'écrire celle-ci, le dernier étant
-- 20260920160000_avis_marche_lot (Phase 9, déployée). Même limite d'accès
-- documentée que les migrations précédentes (pas de lecture directe de
-- _prisma_migrations sur RDS depuis cet environnement) : le mécanisme de
-- déploiement (app/api/admin/run-migration/route.ts) revérifie lui-même
-- les migrations réellement appliquées à chaque appel avant d'exécuter
-- celle-ci, donc l'ordre exact n'a pas besoin d'être deviné pour que ce
-- déploiement soit sûr.
--
-- Additif et non destructif : aucune table existante modifiée. User reçoit
-- une relation inverse déclarative seulement (aucune colonne ajoutée à
-- "User"). Testé réellement sur une base PostgreSQL 16 + PostGIS locale
-- avant application (voir le rapport Phase 10).

CREATE TABLE "Projet" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT,
    "statut" TEXT,
    "description" TEXT,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "montant" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Projet_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Projet" ADD CONSTRAINT "Projet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProjetSite" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjetSite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjetSite_projetId_siteId_key" ON "ProjetSite"("projetId", "siteId");
CREATE INDEX "ProjetSite_projetId_idx" ON "ProjetSite"("projetId");
CREATE INDEX "ProjetSite_siteId_idx" ON "ProjetSite"("siteId");

ALTER TABLE "ProjetSite" ADD CONSTRAINT "ProjetSite_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjetSite" ADD CONSTRAINT "ProjetSite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjetActeur" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "acteurId" TEXT NOT NULL,
    "role" "ActeurType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjetActeur_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjetActeur_projetId_acteurId_key" ON "ProjetActeur"("projetId", "acteurId");
CREATE INDEX "ProjetActeur_projetId_idx" ON "ProjetActeur"("projetId");
CREATE INDEX "ProjetActeur_acteurId_idx" ON "ProjetActeur"("acteurId");

ALTER TABLE "ProjetActeur" ADD CONSTRAINT "ProjetActeur_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjetActeur" ADD CONSTRAINT "ProjetActeur_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Acteur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjetAvisMarche" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "avisMarcheId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjetAvisMarche_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjetAvisMarche_projetId_avisMarcheId_key" ON "ProjetAvisMarche"("projetId", "avisMarcheId");
CREATE INDEX "ProjetAvisMarche_projetId_idx" ON "ProjetAvisMarche"("projetId");
CREATE INDEX "ProjetAvisMarche_avisMarcheId_idx" ON "ProjetAvisMarche"("avisMarcheId");

ALTER TABLE "ProjetAvisMarche" ADD CONSTRAINT "ProjetAvisMarche_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjetAvisMarche" ADD CONSTRAINT "ProjetAvisMarche_avisMarcheId_fkey" FOREIGN KEY ("avisMarcheId") REFERENCES "AvisMarche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjetLot" (
    "id" TEXT NOT NULL,
    "projetId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjetLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjetLot_projetId_lotId_key" ON "ProjetLot"("projetId", "lotId");
CREATE INDEX "ProjetLot_projetId_idx" ON "ProjetLot"("projetId");
CREATE INDEX "ProjetLot_lotId_idx" ON "ProjetLot"("lotId");

ALTER TABLE "ProjetLot" ADD CONSTRAINT "ProjetLot_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjetLot" ADD CONSTRAINT "ProjetLot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
