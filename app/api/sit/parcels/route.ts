import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getParcelsNear } from "@/lib/data-sources/cadastre"
import { getPrisma } from "@/lib/prisma"

const MAX_BBOX_RESULTS = 500 // jamais renvoyer des dizaines de milliers de géométries lourdes sans limite (Phase 4, section 14 du brief)

// Contrat existant préservé : ?lon=&lat= reste la recherche ponctuelle à
// la demande (apicarto, Phase 1). ?bbox= est un AJOUT (Phase 4) — lit le
// référentiel déjà en base (Parcelle, ingestion bulk) plutôt que l'API
// externe, pour une recherche spatiale par zone.
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

  const lon = Number(params.get("lon"))
  const lat = Number(params.get("lat"))
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return NextResponse.json({ success: false, error: "Paramètres lon/lat (ou bbox) manquants ou invalides." }, { status: 400 })
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

// bbox = minLon,minLat,maxLon,maxLat (WGS84, cohérent avec geom SRID 4326)
async function handleBboxSearch(bbox: string): Promise<NextResponse> {
  const parts = bbox.split(",").map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ success: false, error: "bbox invalide (attendu: minLon,minLat,maxLon,maxLat)." }, { status: 400 })
  }
  const [minLon, minLat, maxLon, maxLat] = parts

  const prisma = await getPrisma()
  const rows = await prisma.$queryRaw<Array<{ id: string; idu: string; codeInsee: string; commune: string | null; contenanceM2: number; geometry: unknown; siteId: string | null }>>`
    SELECT "id", "idu", "codeInsee", "commune", "contenanceM2", "geometry", "siteId"
    FROM "Parcelle"
    WHERE "geom" IS NOT NULL
      AND "geom" && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
    LIMIT ${MAX_BBOX_RESULTS}
  `
  return NextResponse.json({ success: true, parcels: rows, truncated: rows.length >= MAX_BBOX_RESULTS })
}
