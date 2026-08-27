// Client pour l'API Carto (IGN) — cadastre/parcelles. Pas de clé requise.
// Un point exact tombe souvent sur la voirie plutôt que sur une parcelle
// (le géocodage BAN place le point sur l'entrée du bâtiment, côté rue) :
// on interroge donc une petite emprise (bbox) autour du point plutôt que
// le point exact, et on retourne les parcelles qui l'intersectent —
// vérifié par appel réel (voir CLAUDE.md).

const CADASTRE_URL = "https://apicarto.ign.fr/api/cadastre/parcelle"

export interface Parcel {
  idu: string
  section: string
  numero: string
  contenanceM2: number
  codeInsee: string
  commune: string
  geometry: GeoJSON.MultiPolygon
}

interface CadastreFeature {
  properties: {
    idu: string
    section: string
    numero: string
    contenance: number
    code_insee: string
    nom_com: string
  }
  geometry: GeoJSON.MultiPolygon
}

interface CadastreResponse {
  features: CadastreFeature[]
}

function bboxAround(lon: number, lat: number, bufferMeters: number): GeoJSON.Polygon {
  const dLat = bufferMeters / 111_320
  const dLon = bufferMeters / (111_320 * Math.cos((lat * Math.PI) / 180))
  return {
    type: "Polygon",
    coordinates: [
      [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ],
    ],
  }
}

export async function getParcelsNear(lon: number, lat: number, bufferMeters = 20): Promise<Parcel[]> {
  const url = new URL(CADASTRE_URL)
  url.searchParams.set("geom", JSON.stringify(bboxAround(lon, lat, bufferMeters)))

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API Carto (cadastre) a répondu ${res.status}`)
  }

  const data = (await res.json()) as CadastreResponse
  return data.features.map((f) => ({
    idu: f.properties.idu,
    section: f.properties.section,
    numero: f.properties.numero,
    contenanceM2: f.properties.contenance,
    codeInsee: f.properties.code_insee,
    commune: f.properties.nom_com,
    geometry: f.geometry,
  }))
}
