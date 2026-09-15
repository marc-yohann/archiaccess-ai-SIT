-- Phase 5E : partition territoriale technique sur BatimentPhysique —
-- lacune identifiée pendant la validation multi-départements Phase 5D
-- (aucune colonne ne permettait de savoir "quel département" pour une
-- ligne BatimentPhysique sans recouper via une jointure Parcelle/Site,
-- ce qui a nécessité une approximation par préfixe de référence brute
-- pendant cette validation — voir le rapport Phase 5D). Entièrement
-- additive : "Batiment" (DPE), DPE, Projet/Marché/Lot/Besoin non
-- concernés, aucune ligne BatimentPhysique existante supprimée.

-- 1. Colonne + index. Nullable : renseignée directement par l'application
--    pour toute NOUVELLE ingestion (voir lib/ingestion/sources/rnb.ts,
--    RnbIngestionRunner connaît son département dès la construction) —
--    seules d'éventuelles lignes plus anciennes en dépendent du backfill
--    ci-dessous.
ALTER TABLE "BatimentPhysique" ADD COLUMN "sourcePartition" TEXT;
CREATE INDEX "BatimentPhysique_sourcePartition_idx" ON "BatimentPhysique"("sourcePartition");

-- 2. Backfill best-effort pour des lignes préexistantes qui n'auraient
--    jamais eu cette colonne (aucune donnée de ce type n'existe en base
--    de PRODUCTION au moment de cette migration — AWS indisponible, les
--    ingestions réelles Phase 5C/5D n'ont eu lieu que dans des bases de
--    diagnostic locales supprimées après chaque phase, voir le rapport
--    Phase 5E section 5 — ce backfill est donc un filet de sécurité
--    générique, testé sur un jeu de données simulé réaliste, jamais
--    exécuté ici contre de vraies données de production).
--
--    Priorité 2 (voir le rapport, section 3) : dérivé de la Parcelle
--    validée (référence la plus fiable et la plus complète mesurée en
--    Phase 5C/5D — 99%+ de VALID). Département extrait de
--    Parcelle.codeInsee (5 chiffres) : 3 premiers caractères si le code
--    commence par "97" (DOM), 2 sinon (2A/2B sont déjà des codes à 2
--    caractères dans la nomenclature INSEE réelle, jamais "20xxx" —
--    vérifié, aucune conversion supplémentaire nécessaire). Un bâtiment
--    dont les parcelles validées pointent vers PLUSIEURS départements
--    différents (frontière administrative réelle, ou donnée erronée)
--    n'est JAMAIS résolu arbitrairement : laissé NULL (voir la clause
--    "HAVING count(DISTINCT ...) = 1" ci-dessous), ce cas est documenté
--    comme observable via une requête dédiée en admin plutôt que résolu
--    silencieusement.
WITH parcelle_dept AS (
  SELECT
    bp."batimentId",
    (CASE WHEN LEFT(p."codeInsee", 2) = '97' THEN LEFT(p."codeInsee", 3) ELSE LEFT(p."codeInsee", 2) END) AS dept
  FROM "BatimentPhysiqueParcelle" bp
  JOIN "Parcelle" p ON p.id = bp."parcelleId"
  WHERE bp."referenceStatus" = 'VALID'
),
parcelle_dept_unique AS (
  SELECT "batimentId", min(dept) AS dept
  FROM parcelle_dept
  GROUP BY "batimentId"
  HAVING count(DISTINCT dept) = 1
)
UPDATE "BatimentPhysique" b
SET "sourcePartition" = pdu.dept
FROM parcelle_dept_unique pdu
WHERE b.id = pdu."batimentId" AND b."sourcePartition" IS NULL;

-- 3. Priorité 3 : pour les bâtiments encore NULL après l'étape 2 (aucune
--    parcelle validée) — dérivé du Site validé (Site.citycode, déjà un
--    code INSEE direct, même règle 2/3 caractères). Même discipline :
--    jamais résolu arbitrairement en cas de désaccord.
WITH site_dept AS (
  SELECT
    bs."batimentId",
    (CASE WHEN LEFT(s.citycode, 2) = '97' THEN LEFT(s.citycode, 3) ELSE LEFT(s.citycode, 2) END) AS dept
  FROM "BatimentPhysiqueSite" bs
  JOIN "Site" s ON s.id = bs."siteId"
  WHERE bs."referenceStatus" = 'VALID'
),
site_dept_unique AS (
  SELECT "batimentId", min(dept) AS dept
  FROM site_dept
  GROUP BY "batimentId"
  HAVING count(DISTINCT dept) = 1
)
UPDATE "BatimentPhysique" b
SET "sourcePartition" = sdu.dept
FROM site_dept_unique sdu
WHERE b.id = sdu."batimentId" AND b."sourcePartition" IS NULL;

-- 4. Les bâtiments toujours NULL après les étapes 2 et 3 (aucune
--    référence validée du tout, ou désaccord entre départements) restent
--    NULL — jamais une valeur devinée. Observable via :
--    SELECT count(*) FROM "BatimentPhysique" WHERE "sourcePartition" IS NULL;
