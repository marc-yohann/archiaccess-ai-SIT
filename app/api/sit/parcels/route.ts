import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getParcelsNear } from "@/lib/data-sources/cadastre"
import { getPrisma } from "@/lib/prisma"

const MAX_BBOX_RESULTS = 500 // jamais renvoyer des dizaines de milliers de géométries lourdes sans limite (Phase 4, section 14 du brief)
const MAX_CODEINSEE_RESULTS = 500 // même limite que bbox — une commune dense peut compter des dizaines de milliers de parcelles

// Contrat existant préservé : ?lon=&lat= reste la recherche ponctuelle à
// la demande (apicarto, Phase 1). ?bbox= (Phase 4), ?idu= et ?codeInsee=
// (Phase 4.5, section 15 du brief — recherche par référence cadastrale /
// code INSEE) lisent le référentiel déjà en base plutôt que l'API externe.
export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const bbox = params.get("bbox")
  if (bbox) {
    return handleBboxSearch(bbox)
  }
  const idu = params.get("idu")
  if (idu) {
    return handleIduSearch(idu)
  }
  const codeInsee = params.get("codeInsee")
  if (codeInsee) {
    return handleCodeInseeSearch(codeInsee)
  }

  const lon = Number(params.get("lon"))
  const lat = Number(params.get("lat"))
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return NextResponse.json({ success: false, error: "Paramètres lon/lat (ou bbox/idu/codeInsee) manquants ou invalides." }, { status: 400 })
  }

  try {
    const parcels = await getParcelsNear(lon, lat)
    return NextResponse.json({ success: true, parcels })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}

interface ParcelleRow {
  id: string
  idu: string
  codeInsee: string
  commune: string | null
  contenanceM2: number
  geometry: unknown
}

// Sites associés (Phase 4.5 — une Parcelle peut réellement en avoir
// plusieurs, voir SiteParcelle/prisma/schema.prisma et le rapport de
// consolidation) — jamais un seul siteId choisi arbitrairement.
async function attachSites(rows: ParcelleRow[]) {
  const prisma = await getPrisma()
  const parcelleIds = rows.map((r) => r.id)
  const links =
    parcelleIds.length > 0
      ? await prisma.siteParcelle.findMany({
          where: { parcelleId: { in: parcelleIds } },
          select: { parcelleId: true, siteId: true, relationMethod: true, ambiguous: true, distanceMeters: true },
        })
      : []
  const linksByParcelle = new Map<string, typeof links>()
  for (const link of links) {
    const list = linksByParcelle.get(link.parcelleId) ?? []
    list.push(link)
    linksByParcelle.set(link.parcelleId, list)
  }
  return rows.map((r) => ({ ...r, sites: linksByParcelle.get(r.id) ?? [] }))
}

// bbox = minLon,minLat,maxLon,maxLat (WGS84, cohérent avec geom SRID 4326)
async function handleBboxSearch(bbox: string): Promise<NextResponse> {
  const parts = bbox.split(",").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ success: false, error: "bbox invalide (attendu: minLon,minLat,maxLon,maxLat)." }, { status: 400 })
  }
  const [minLon, minLat, maxLon, maxLat] = parts

  const prisma = await getPrisma()
  const rows = await prisma.$queryRaw<ParcelleRow[]>`
    SELECT "id", "idu", "codeInsee", "commune", "contenanceM2", "geometry"
    FROM "Parcelle"
    WHERE "geom" IS NOT NULL
      AND "geom" && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
    LIMIT ${MAX_BBOX_RESULTS}
  `
  const parcels = await attachSites(rows)
  return NextResponse.json({ success: true, parcels, truncated: rows.length >= MAX_BBOX_RESULTS })
}

// idu = identifiant cadastral officiel complet, jamais recomposé — voir
// lib/ingestion/sources/cadastre.ts.
async function handleIduSearch(idu: string): Promise<NextResponse> {
  const prisma = await getPrisma()
  const rows = await prisma.$queryRaw<ParcelleRow[]>`
    SELECT "id", "idu", "codeInsee", "commune", "contenanceM2", "geometry" FROM "Parcelle" WHERE "idu" = ${idu}
  `
  const parcels = await attachSites(rows)
  return NextResponse.json({ success: true, parcels, truncated: false })
}

// codeInsee = code commune INSEE (déjà utilisé comme clé Parcelle.codeInsee).
async function handleCodeInseeSearch(codeInsee: string): Promise<NextResponse> {
  const prisma = await getPrisma()
  const rows = await prisma.$queryRaw<ParcelleRow[]>`
    SELECT "id", "idu", "codeInsee", "commune", "contenanceM2", "geometry" FROM "Parcelle" WHERE "codeInsee" = ${codeInsee} LIMIT ${MAX_CODEINSEE_RESULTS}
  `
  const parcels = await attachSites(rows)
  return NextResponse.json({ success: true, parcels, truncated: rows.length >= MAX_CODEINSEE_RESULTS })
}
