import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"

// Contrôles qualité mesurables (voir CLAUDE.md, section M du brief Phase
// 3) — chaque métrique est une vraie requête SQL/Prisma, jamais une
// estimation. Les doublons SIREN/SIRET/codeInsee sont structurellement
// impossibles ici (contraintes UNIQUE en base) : exposés pour
// transparence, pas parce qu'un doublon est réellement possible.
export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user?.isAdmin) {
    return NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 })
  }

  const prisma = await getPrisma()

  const [totalActeurs, totalEtablissements, sirenValides, siretValides, acteursSansUniteLegale, siretDoublons, sirenDoublons] = await Promise.all([
    prisma.acteur.count(),
    prisma.etablissement.count(),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Acteur" WHERE "siren" ~ '^[0-9]{9}$'`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Etablissement" WHERE "siret" ~ '^[0-9]{14}$'`,
    prisma.acteur.count({ where: { sources: { none: { source: "sirene-stock-unite-legale" } } } }),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM (SELECT "siret" FROM "Etablissement" GROUP BY "siret" HAVING count(*) > 1) t`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM (SELECT "siren" FROM "Acteur" GROUP BY "siren" HAVING count(*) > 1) t`,
  ])

  const [totalSites, coordsValides, sitesDoublons] = await Promise.all([
    prisma.site.count(),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Site" WHERE "longitude" BETWEEN -180 AND 180 AND "latitude" BETWEEN -90 AND 90`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM (SELECT "citycode", "label" FROM "Site" GROUP BY "citycode", "label" HAVING count(*) > 1) t`,
  ])

  const [totalRisques, risquesVides, codeInseeDoublons] = await Promise.all([
    prisma.risque.count(),
    prisma.risque.count({ where: { seismicZone: null, radonPotential: null } }),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM (SELECT "codeInsee" FROM "Risque" GROUP BY "codeInsee" HAVING count(*) > 1) t`,
  ])

  const [totalParcelles, geomPresentes, geomValides, geomInvalides, geomVides, sridCorrect, idusValides, iduDoublons] = await Promise.all([
    prisma.parcelle.count(),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Parcelle" WHERE "geom" IS NOT NULL`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Parcelle" WHERE "geom" IS NOT NULL AND ST_IsValid("geom")`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Parcelle" WHERE "geom" IS NOT NULL AND NOT ST_IsValid("geom")`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Parcelle" WHERE "geom" IS NOT NULL AND ST_IsEmpty("geom")`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Parcelle" WHERE "geom" IS NOT NULL AND ST_SRID("geom") = 4326`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Parcelle" WHERE "idu" ~ '^[0-9]{5}[0-9A-Z]{4}[A-Z]{1,2}[0-9]{4}$'`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM (SELECT "idu" FROM "Parcelle" GROUP BY "idu" HAVING count(*) > 1) t`,
  ])

  // Relations Site<->Parcelle (Phase 4.5 — voir SiteParcelle,
  // prisma/schema.prisma, et le rapport de consolidation). "avec 1" /
  // "avec plusieurs" / "sans" sont mesurés sur les relations NON ambiguës
  // uniquement (une relation ambiguë n'est jamais comptée comme
  // "confirmée" d'un côté ou de l'autre) — les ambiguïtés sont un compteur
  // séparé, jamais forcées dans cette répartition. Tout vient de vraies
  // requêtes SQL sur SiteParcelle, jamais une estimation.
  const [
    relationsTotal,
    relationsSpatialesContains,
    relationsSpatialesNearby,
    relationsDeterministic,
    sitesAmbigus,
    lignesAmbigues,
    siteCounts,
    parcelleCounts,
  ] = await Promise.all([
    prisma.siteParcelle.count(),
    prisma.siteParcelle.count({ where: { relationMethod: "SPATIAL_CONTAINS", ambiguous: false } }),
    prisma.siteParcelle.count({ where: { relationMethod: "SPATIAL_NEARBY", ambiguous: false } }),
    prisma.siteParcelle.count({ where: { relationMethod: "DETERMINISTIC", ambiguous: false } }),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(DISTINCT "siteId") FROM "SiteParcelle" WHERE "ambiguous" = true`,
    prisma.siteParcelle.count({ where: { ambiguous: true } }),
    prisma.$queryRaw<{ n: bigint; count: bigint }[]>`
      SELECT n, count(*) FROM (SELECT "siteId", count(*) AS n FROM "SiteParcelle" WHERE "ambiguous" = false GROUP BY "siteId") t GROUP BY n
    `,
    prisma.$queryRaw<{ n: bigint; count: bigint }[]>`
      SELECT n, count(*) FROM (SELECT "parcelleId", count(*) AS n FROM "SiteParcelle" WHERE "ambiguous" = false GROUP BY "parcelleId") t GROUP BY n
    `,
  ])

  const sitesAvec1 = Number(siteCounts.find((r) => Number(r.n) === 1)?.count ?? 0)
  const sitesAvecPlusieurs = siteCounts.filter((r) => Number(r.n) > 1).reduce((acc, r) => acc + Number(r.count), 0)
  const sitesAvecAuMoins1 = siteCounts.reduce((acc, r) => acc + Number(r.count), 0)
  const sitesSansParcelle = totalSites - sitesAvecAuMoins1 - Number(sitesAmbigus[0]?.count ?? 0)

  const parcellesAvec1 = Number(parcelleCounts.find((r) => Number(r.n) === 1)?.count ?? 0)
  const parcellesAvecPlusieurs = parcelleCounts.filter((r) => Number(r.n) > 1).reduce((acc, r) => acc + Number(r.count), 0)
  const parcellesAvecAuMoins1 = parcelleCounts.reduce((acc, r) => acc + Number(r.count), 0)
  const parcellesSansSite = totalParcelles - parcellesAvecAuMoins1

  // BatimentPhysique (Phase 5C, RNB) — même discipline que siteParcelle :
  // tout vient de vraies requêtes SQL, jamais une estimation. geomType
  // compté tel quel (POINT/POLYGON/MULTIPOLYGON, lu du préfixe EWKT
  // source, jamais recalculé) — un bâtiment Point-only n'est JAMAIS
  // compté comme ayant une empreinte réelle.
  const [
    totalBatiments,
    geomPresentes5c,
    geomValides5c,
    geomInvalides5c,
    geomTypeCounts,
    rnbIdDoublons,
    parcelleRelTotal,
    parcelleRelValid,
    parcelleRelNotFound,
    parcelleRelInvalid,
    parcelleRelAmbiguous,
    siteRelTotal,
    siteRelValid,
    siteRelNotFound,
    siteRelInvalid,
    siteRelAmbiguous,
    batimentsAucuneRefParcelle,
    batimentsSansParcelleValidee,
    batimentsAucuneRefSite,
    batimentsSansSiteValide,
    parcelleCardCounts,
    siteCardCounts,
  ] = await Promise.all([
    prisma.batimentPhysique.count(),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "BatimentPhysique" WHERE "geom" IS NOT NULL`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "BatimentPhysique" WHERE "geom" IS NOT NULL AND ST_IsValid("geom")`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "BatimentPhysique" WHERE "geom" IS NOT NULL AND NOT ST_IsValid("geom")`,
    prisma.$queryRaw<{ geomType: string | null; count: bigint }[]>`SELECT "geomType", count(*) FROM "BatimentPhysique" GROUP BY "geomType"`,
    prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM (SELECT "rnbId" FROM "BatimentPhysique" GROUP BY "rnbId" HAVING count(*) > 1) t`, // structurellement 0 (contrainte UNIQUE)
    prisma.batimentPhysiqueParcelle.count(),
    prisma.batimentPhysiqueParcelle.count({ where: { referenceStatus: "VALID" } }),
    prisma.batimentPhysiqueParcelle.count({ where: { referenceStatus: "NOT_FOUND" } }),
    prisma.batimentPhysiqueParcelle.count({ where: { referenceStatus: "INVALID_FORMAT" } }),
    prisma.batimentPhysiqueParcelle.count({ where: { referenceStatus: "AMBIGUOUS" } }),
    prisma.batimentPhysiqueSite.count(),
    prisma.batimentPhysiqueSite.count({ where: { referenceStatus: "VALID" } }),
    prisma.batimentPhysiqueSite.count({ where: { referenceStatus: "NOT_FOUND" } }),
    prisma.batimentPhysiqueSite.count({ where: { referenceStatus: "INVALID_FORMAT" } }),
    prisma.batimentPhysiqueSite.count({ where: { referenceStatus: "AMBIGUOUS" } }),
    // Deux métriques distinctes, jamais confondues (bug réellement constaté
    // et corrigé pendant la validation Phase 5C — voir le rapport) :
    // "aucune référence" = le champ source RNB ("plots"/"addresses") était
    // vide (aucune ligne BatimentPhysiqueParcelle/Site écrite du tout,
    // JAMAIS une valeur "[]" JSON classique — mesuré réellement : le champ
    // CSV brut est une chaîne totalement vide sur ces lignes, ce que
    // JSON.parse("") rejette, correctement traité comme "aucune référence"
    // par safeJsonArray()) ; "sans X validé(e)" = au moins une référence a
    // été fournie mais AUCUNE ne s'est résolue (VALID) — inclut donc le
    // premier ensemble ET les bâtiments dont toutes les références sont
    // NOT_FOUND.
    prisma.batimentPhysique.count({ where: { parcelleLinks: { none: {} } } }),
    prisma.batimentPhysique.count({ where: { parcelleLinks: { none: { referenceStatus: "VALID" } } } }),
    prisma.batimentPhysique.count({ where: { siteLinks: { none: {} } } }),
    prisma.batimentPhysique.count({ where: { siteLinks: { none: { referenceStatus: "VALID" } } } }),
    prisma.$queryRaw<{ n: bigint; count: bigint }[]>`
      SELECT n, count(*) FROM (SELECT "batimentId", count(*) AS n FROM "BatimentPhysiqueParcelle" WHERE "referenceStatus" = 'VALID' GROUP BY "batimentId") t GROUP BY n
    `,
    prisma.$queryRaw<{ n: bigint; count: bigint }[]>`
      SELECT n, count(*) FROM (SELECT "batimentId", count(*) AS n FROM "BatimentPhysiqueSite" WHERE "referenceStatus" = 'VALID' GROUP BY "batimentId") t GROUP BY n
    `,
  ])

  const geomTypeMap: Record<string, number> = {}
  for (const r of geomTypeCounts) geomTypeMap[r.geomType ?? "NULL"] = Number(r.count)
  const parcelleAvec1 = Number(parcelleCardCounts.find((r) => Number(r.n) === 1)?.count ?? 0)
  const parcelleAvecPlusieurs = parcelleCardCounts.filter((r) => Number(r.n) > 1).reduce((acc, r) => acc + Number(r.count), 0)
  const siteAvec1 = Number(siteCardCounts.find((r) => Number(r.n) === 1)?.count ?? 0)
  const siteAvecPlusieurs = siteCardCounts.filter((r) => Number(r.n) > 1).reduce((acc, r) => acc + Number(r.count), 0)

  return NextResponse.json({
    success: true,
    quality: {
      sirene: {
        totalActeurs,
        totalEtablissements,
        sirenValides: Number(sirenValides[0]?.count ?? 0),
        siretValides: Number(siretValides[0]?.count ?? 0),
        acteursSansUniteLegale, // Acteur connu seulement via StockEtablissement, pas encore enrichi
        siretDoublons: Number(siretDoublons[0]?.count ?? 0), // structurellement 0 (contrainte UNIQUE)
        sirenDoublons: Number(sirenDoublons[0]?.count ?? 0), // structurellement 0 (contrainte UNIQUE)
      },
      ban: {
        totalSites,
        coordsValides: Number(coordsValides[0]?.count ?? 0),
        sitesDoublons: Number(sitesDoublons[0]?.count ?? 0), // structurellement 0 (contrainte UNIQUE citycode+label)
      },
      georisques: {
        totalRisques,
        risquesVides, // commune connue mais sans zone sismique ni potentiel radon renvoyés par l'API
        codeInseeDoublons: Number(codeInseeDoublons[0]?.count ?? 0), // structurellement 0 (contrainte UNIQUE)
      },
      cadastre: {
        totalParcelles,
        geomPresentes: Number(geomPresentes[0]?.count ?? 0),
        geomValides: Number(geomValides[0]?.count ?? 0),
        geomInvalides: Number(geomInvalides[0]?.count ?? 0),
        geomVides: Number(geomVides[0]?.count ?? 0),
        sridCorrect: Number(sridCorrect[0]?.count ?? 0),
        idusValides: Number(idusValides[0]?.count ?? 0),
        iduDoublons: Number(iduDoublons[0]?.count ?? 0), // structurellement 0 (contrainte UNIQUE)
      },
      siteParcelle: {
        totalSites,
        totalParcelles,
        relationsTotal, // toutes lignes SiteParcelle, ambiguës comprises
        relationsSpatialesContains: relationsSpatialesContains, // ST_Contains, ingestion bulk (non ambiguës)
        relationsSpatialesNearby: relationsSpatialesNearby, // bbox à la demande (non ambiguës)
        relationsDeterministic: relationsDeterministic, // toujours 0 aujourd'hui — aucun identifiant commun BAN/Cadastre n'existe
        sitesAmbigus: Number(sitesAmbigus[0]?.count ?? 0), // Sites dont le point est réellement contenu par >1 Parcelle — jamais résolus arbitrairement
        lignesAmbigues, // nombre de candidates ambiguës (>= 2 par Site ambigu)
        // "sans/avec 1/avec plusieurs" mesurés sur les relations NON ambiguës uniquement
        sitesSansParcelle,
        sitesAvec1Parcelle: sitesAvec1,
        sitesAvecPlusieursParcelles: sitesAvecPlusieurs,
        parcellesSansSite,
        parcellesAvec1Site: parcellesAvec1,
        parcellesAvecPlusieursSites: parcellesAvecPlusieurs,
      },
      // BatimentPhysique (Phase 5C, RNB) — voir prisma/schema.prisma. Un
      // bâtiment "sans parcelle/site" ici compte les references RÉSOLUES
      // (referenceStatus=VALID) uniquement — NOT_FOUND/AMBIGUOUS restent
      // des références réellement fournies par RNB, jamais assimilées à
      // "pas de relation" (voir le rapport, section observabilité).
      batimentPhysique: {
        total: totalBatiments,
        geomPresentes: Number(geomPresentes5c[0]?.count ?? 0),
        geomValides: Number(geomValides5c[0]?.count ?? 0),
        geomInvalides: Number(geomInvalides5c[0]?.count ?? 0),
        geomTypes: geomTypeMap, // { MULTIPOLYGON, POLYGON, POINT, NULL }
        rnbIdDoublons: Number(rnbIdDoublons[0]?.count ?? 0), // structurellement 0 (contrainte UNIQUE)
        relationsParcelle: {
          total: parcelleRelTotal,
          valid: parcelleRelValid,
          notFound: parcelleRelNotFound,
          invalidFormat: parcelleRelInvalid,
          ambiguous: parcelleRelAmbiguous,
          batimentsAucuneReference: batimentsAucuneRefParcelle, // champ RNB "plots" vide (chaîne vide, pas de référence fournie)
          batimentsSansParcelleValidee, // inclut le cas ci-dessus + les références fournies mais toutes NOT_FOUND
          batimentsAvec1Parcelle: parcelleAvec1,
          batimentsAvecPlusieursParcelles: parcelleAvecPlusieurs,
        },
        relationsSite: {
          total: siteRelTotal,
          valid: siteRelValid,
          notFound: siteRelNotFound,
          invalidFormat: siteRelInvalid,
          ambiguous: siteRelAmbiguous,
          batimentsAucuneReference: batimentsAucuneRefSite, // champ RNB "addresses" vide
          batimentsSansSiteValide, // inclut le cas ci-dessus + les références fournies mais toutes NOT_FOUND
          batimentsAvec1Site: siteAvec1,
          batimentsAvecPlusieursSites: siteAvecPlusieurs,
        },
      },
    },
  })
}
