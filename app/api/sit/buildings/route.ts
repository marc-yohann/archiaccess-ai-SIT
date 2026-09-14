import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Lecture du référentiel BÂTIMENT PHYSIQUE (RNB, Phase 5C — voir
// prisma/schema.prisma pour la justification du nom "BatimentPhysique").
// Même discipline que /api/sit/parcels : contrat minimal validé par de
// vraies requêtes contre les données réellement ingérées (département 51,
// voir le rapport), pas encore branché à l'UI (aucun consommateur connu
// aujourd'hui) — préparé pour que la prochaine phase n'ait pas à
// redécouvrir ces patrons de requête PostGIS.

const MAX_BBOX_RESULTS = 500 // même limite que /api/sit/parcels (section 14 du brief Phase 4)

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const bbox = params.get("bbox")
  if (bbox) return handleBboxSearch(bbox)

  const rnbId = params.get("rnbId")
  if (rnbId) return handleRnbIdSearch(rnbId)

  const lon = Number(params.get("lon"))
  const lat = Number(params.get("lat"))
  if (Number.isFinite(lon) && Number.isFinite(lat)) return handlePointSearch(lon, lat)

  return NextResponse.json({ success: false, error: "Paramètres bbox, rnbId ou lon/lat requis." }, { status: 400 })
}

interface BatimentRow {
  id: string
  rnbId: string
  geomType: string | null
  status: string | null
  datasetVersion: string | null
}

async function attachRelations(rows: BatimentRow[]) {
  const prisma = await getPrisma()
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return rows.map((r) => ({ ...r, parcelles: [], sites: [] }))
  const [parcelleLinks, siteLinks] = await Promise.all([
    prisma.batimentPhysiqueParcelle.findMany({
      where: { batimentId: { in: ids } },
      select: { batimentId: true, parcelleId: true, parcelleRef: true, referenceStatus: true, coverageRatio: true, relationMethod: true },
    }),
    prisma.batimentPhysiqueSite.findMany({
      where: { batimentId: { in: ids } },
      select: { batimentId: true, siteId: true, addressRef: true, referenceStatus: true, relationMethod: true },
    }),
  ])
  const parcellesByBatiment = new Map<string, typeof parcelleLinks>()
  for (const l of parcelleLinks) {
    const list = parcellesByBatiment.get(l.batimentId) ?? []
    list.push(l)
    parcellesByBatiment.set(l.batimentId, list)
  }
  const sitesByBatiment = new Map<string, typeof siteLinks>()
  for (const l of siteLinks) {
    const list = sitesByBatiment.get(l.batimentId) ?? []
    list.push(l)
    sitesByBatiment.set(l.batimentId, list)
  }
  return rows.map((r) => ({
    ...r,
    parcelles: parcellesByBatiment.get(r.id) ?? [],
    sites: sitesByBatiment.get(r.id) ?? [],
  }))
}

// bbox = minLon,minLat,maxLon,maxLat (WGS84, cohérent avec geom SRID 4326)
async function handleBboxSearch(bbox: string): Promise<NextResponse> {
  const parts = bbox.split(",").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ success: false, error: "bbox invalide (attendu: minLon,minLat,maxLon,maxLat)." }, { status: 400 })
  }
  const [minLon, minLat, maxLon, maxLat] = parts
  const prisma = await getPrisma()
  const rows = await prisma.$queryRaw<BatimentRow[]>`
    SELECT "id", "rnbId", "geomType", "status", "datasetVersion"
    FROM "BatimentPhysique"
    WHERE "geom" IS NOT NULL
      AND "geom" && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
    LIMIT ${MAX_BBOX_RESULTS}
  `
  const buildings = await attachRelations(rows)
  return NextResponse.json({ success: true, buildings, truncated: rows.length >= MAX_BBOX_RESULTS })
}

async function handleRnbIdSearch(rnbId: string): Promise<NextResponse> {
  const prisma = await getPrisma()
  const rows = await prisma.$queryRaw<BatimentRow[]>`
    SELECT "id", "rnbId", "geomType", "status", "datasetVersion" FROM "BatimentPhysique" WHERE "rnbId" = ${rnbId}
  `
  const buildings = await attachRelations(rows)
  return NextResponse.json({ success: true, buildings, truncated: false })
}

// Bâtiment(s) dont la géométrie contient le point donné — jamais le plus
// proche : un point hors de toute empreinte réelle renvoie une liste vide,
// jamais une approximation.
async function handlePointSearch(lon: number, lat: number): Promise<NextResponse> {
  const prisma = await getPrisma()
  const rows = await prisma.$queryRaw<BatimentRow[]>`
    SELECT "id", "rnbId", "geomType", "status", "datasetVersion"
    FROM "BatimentPhysique"
    WHERE "geom" IS NOT NULL
      AND ST_Contains("geom", ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))
    LIMIT ${MAX_BBOX_RESULTS}
  `
  const buildings = await attachRelations(rows)
  return NextResponse.json({ success: true, buildings, truncated: false })
}
