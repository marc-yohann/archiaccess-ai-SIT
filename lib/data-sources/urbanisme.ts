// Client pour l'API GPU (Géoportail de l'Urbanisme, IGN) — zonage
// réglementaire (PLU/POS) qui s'applique à une parcelle. Pas de clé
// requise. Même stratégie qu'avec le cadastre (lib/data-sources/cadastre.ts,
// voir CLAUDE.md) : interroge une petite emprise (bbox) autour du point
// plutôt que le point exact, pour ne pas rater la zone si le géocodage
// tombe légèrement à côté. Validé par appel réel avant d'écrire ce code.

import { withVault } from "@/lib/data-vault"

const GPU_URL = "https://apicarto.ign.fr/api/gpu/zone-urba"

export interface UrbanZone {
  label: string // ex: "US"
  description: string // ex: "Zone urbaine Sauvegardée"
  type: string | null // U, AU, N, A...
  idUrba: string | null
  document: string | null // nom du fichier réglementaire (PLU/POS)
}

interface GpuFeature {
  properties: {
    libelle: string
    libelong: string
    typezone: string | null
    idurba: string | null
    nomfic: string | null
  }
}

interface GpuResponse {
  features: GpuFeature[]
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

export async function getUrbanZonesNear(lon: number, lat: number, bufferMeters = 20): Promise<UrbanZone[]> {
  const key = `${lon.toFixed(5)},${lat.toFixed(5)},${bufferMeters}`
  return withVault("urbanisme", key, () => fetchUrbanZonesLive(lon, lat, bufferMeters))
}

async function fetchUrbanZonesLive(lon: number, lat: number, bufferMeters: number): Promise<UrbanZone[]> {
  const res = await fetch(GPU_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geom: bboxAround(lon, lat, bufferMeters) }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    throw new Error(`API GPU (urbanisme) a répondu ${res.status}`)
  }

  const data = (await res.json()) as GpuResponse
  return data.features.map((f) => ({
    label: f.properties.libelle,
    description: f.properties.libelong,
    type: f.properties.typezone,
    idUrba: f.properties.idurba,
    document: f.properties.nomfic,
  }))
}
