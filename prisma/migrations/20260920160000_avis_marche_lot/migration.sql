-- Phase 9 — Marchés/Lots (AvisMarche/Lot/AvisMarcheCpv/LotCpv).
--
-- 1 ligne AvisMarche = 1 AVIS/publication BOAMP, jamais un "marché"
-- unique reconstitué sur tout son cycle de vie — voir le rapport d'audit
-- Phase 9 (validé par l'utilisateur) : idweb identifie un avis, pas un
-- marché ; un même marché réel publie en général plusieurs avis distincts
-- dans le temps (initial, rectificatif(s), résultat), sans identifiant
-- canonique fiable les reliant tous. Identité : source + sourceId
-- (sourceId = idweb), jamais recordId (identifiant interne opendatasoft,
-- conservé uniquement pour traçabilité technique).
--
-- CPV en tables de jointure (AvisMarcheCpv/LotCpv) plutôt qu'en colonne :
-- la source BOAMP peut fournir un CPV unique (objet JSON) ou plusieurs
-- (tableau JSON) selon l'avis, vérifié réellement — une table dédiée
-- conserve tous les codes sans jamais en écraser un silencieusement.
--
-- Vérification de l'identifiant chronologique : 15 dossiers existent déjà
-- dans prisma/migrations/ au moment d'écrire celle-ci, le dernier étant
-- 20260920150000_etablissement_site_resolution (Phase 8, déployée). Même
-- limite d'accès documentée que les migrations précédentes (pas de
-- lecture directe de _prisma_migrations sur RDS depuis cet environnement)
-- : le mécanisme de déploiement (app/api/admin/run-migration/route.ts)
-- revérifie lui-même les migrations réellement appliquées à chaque appel
-- avant d'exécuter celle-ci, donc l'ordre exact n'a pas besoin d'être
-- deviné pour que ce déploiement soit sûr.
--
-- Additif et non destructif : aucune table existante modifiée. Acteur
-- reçoit 3 nouvelles relations inverses (déclaratives côté Prisma
-- seulement, aucune colonne ajoutée à "Acteur"). Testé réellement sur une
-- base PostgreSQL 16 + PostGIS locale avant application (voir le rapport
-- Phase 9).

CREATE TABLE "AvisMarche" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'boamp',
    "sourceId" TEXT NOT NULL,
    "recordId" TEXT,
    "objet" TEXT,
    "natureAvis" TEXT,
    "typeProcedure" TEXT,
    "typeMarche" TEXT,
    "datePublication" TEXT,
    "dateLimiteReponse" TEXT,
    "montant" DOUBLE PRECISION,
    "montantDevise" TEXT,
    "acheteurNom" TEXT,
    "acheteurId" TEXT,
    "titulaireNom" TEXT,
    "titulaireId" TEXT,
    "codeDepartement" TEXT,
    "urlAvis" TEXT,
    "referenceAvisAnterieurSourceId" TEXT,
    "lieuExecution" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisMarche_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AvisMarche_source_sourceId_key" ON "AvisMarche"("source", "sourceId");
CREATE INDEX "AvisMarche_acheteurId_idx" ON "AvisMarche"("acheteurId");
CREATE INDEX "AvisMarche_titulaireId_idx" ON "AvisMarche"("titulaireId");
CREATE INDEX "AvisMarche_codeDepartement_idx" ON "AvisMarche"("codeDepartement");

ALTER TABLE "AvisMarche" ADD CONSTRAINT "AvisMarche_acheteurId_fkey" FOREIGN KEY ("acheteurId") REFERENCES "Acteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AvisMarche" ADD CONSTRAINT "AvisMarche_titulaireId_fkey" FOREIGN KEY ("titulaireId") REFERENCES "Acteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AvisMarcheCpv" (
    "id" TEXT NOT NULL,
    "avisMarcheId" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "AvisMarcheCpv_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AvisMarcheCpv_avisMarcheId_code_key" ON "AvisMarcheCpv"("avisMarcheId", "code");
CREATE INDEX "AvisMarcheCpv_avisMarcheId_idx" ON "AvisMarcheCpv"("avisMarcheId");

ALTER TABLE "AvisMarcheCpv" ADD CONSTRAINT "AvisMarcheCpv_avisMarcheId_fkey" FOREIGN KEY ("avisMarcheId") REFERENCES "AvisMarche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "avisMarcheId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "description" TEXT,
    "montant" DOUBLE PRECISION,
    "montantDevise" TEXT,
    "titulaireNom" TEXT,
    "titulaireId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lot_avisMarcheId_numero_key" ON "Lot"("avisMarcheId", "numero");
CREATE INDEX "Lot_avisMarcheId_idx" ON "Lot"("avisMarcheId");
CREATE INDEX "Lot_titulaireId_idx" ON "Lot"("titulaireId");

ALTER TABLE "Lot" ADD CONSTRAINT "Lot_avisMarcheId_fkey" FOREIGN KEY ("avisMarcheId") REFERENCES "AvisMarche"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_titulaireId_fkey" FOREIGN KEY ("titulaireId") REFERENCES "Acteur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LotCpv" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "LotCpv_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LotCpv_lotId_code_key" ON "LotCpv"("lotId", "code");
CREATE INDEX "LotCpv_lotId_idx" ON "LotCpv"("lotId");

ALTER TABLE "LotCpv" ADD CONSTRAINT "LotCpv_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
