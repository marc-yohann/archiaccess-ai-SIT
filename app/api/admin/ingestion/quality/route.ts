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
    },
  })
}
