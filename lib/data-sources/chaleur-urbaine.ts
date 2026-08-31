// Client pour l'API France Chaleur Urbaine (beta.gouv.fr) — éligibilité
// d'un point à un réseau de chaleur urbain existant ou en projet. Pas de
// clé requise. Recherche par coordonnées, comme le cadastre/l'urbanisme.
// Pertinent pour la discipline "Réseaux de chaleur et énergies
// renouvelables" (alternative à une chaufferie individuelle). Endpoint
// trouvé en testant le site officiel (non documenté publiquement),
// validé par appel réel avant d'écrire ce code (voir CLAUDE.md).

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://france-chaleur-urbaine.beta.gouv.fr/api/v1/eligibility"

export interface HeatNetworkEligibility {
  isEligible: boolean
  networkName: string | null
  distanceMeters: number | null
  manager: string | null
  futureNetwork: boolean
}

interface RawEligibility {
  isEligible: boolean
  name: string | null
  distance: number | null
  gestionnaire: string | null
  futurNetwork: boolean
}

export async function getHeatNetworkEligibility(lon: number, lat: number): Promise<HeatNetworkEligibility> {
  const key = `${lon.toFixed(5)},${lat.toFixed(5)}`
  return withVault("chaleur-urbaine", key, () => fetchHeatNetworkEligibilityLive(lon, lat))
}

async function fetchHeatNetworkEligibilityLive(lon: number, lat: number): Promise<HeatNetworkEligibility> {
  const url = new URL(BASE_URL)
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lon))

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API France Chaleur Urbaine a répondu ${res.status}`)
  }

  const data = (await res.json()) as RawEligibility
  return {
    isEligible: data.isEligible,
    networkName: data.name,
    distanceMeters: data.distance,
    manager: data.gestionnaire?.trim() || null,
    futureNetwork: data.futurNetwork,
  }
}
