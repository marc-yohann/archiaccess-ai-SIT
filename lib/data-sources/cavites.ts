// Client pour l'API Géorisques — cavités souterraines (carrières, mines,
// ouvrages civils...) recensées à l'échelle de la commune (code INSEE).
// Pas de clé requise. Complète le connecteur risques existant
// (lib/data-sources/georisques.ts) : une cavité connue à proximité d'un
// projet est un point de vigilance géotechnique direct pour une étude
// AMO/OPC. Validé par appel réel avant d'écrire ce code (voir CLAUDE.md).

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://georisques.gouv.fr/api/v1/cavites"
const PAGE_SIZE = 20

export interface Cavite {
  identifiant: string
  type: string // ex: "carrière", "cave", "ouvrage civil"
  nom: string | null
  reperageGeo: string | null
  longitude: number
  latitude: number
}

export interface CavitesResult {
  total: number
  cavites: Cavite[]
}

interface RawCavite {
  identifiant: string
  type: string
  nom: string | null
  reperage_geo: string | null
  longitude: number
  latitude: number
}

interface CavitesResponse {
  results: number
  data: RawCavite[]
}

export async function getCavitesForCommune(codeInsee: string): Promise<CavitesResult> {
  return withVault("cavites", codeInsee, () => fetchCavitesLive(codeInsee))
}

async function fetchCavitesLive(codeInsee: string): Promise<CavitesResult> {
  const url = new URL(BASE_URL)
  url.searchParams.set("code_insee", codeInsee)
  url.searchParams.set("page", "1")
  url.searchParams.set("page_size", String(PAGE_SIZE))

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API Géorisques (cavités) a répondu ${res.status}`)
  }

  const data = (await res.json()) as CavitesResponse
  return {
    total: data.results,
    cavites: data.data.map((c) => ({
      identifiant: c.identifiant,
      type: c.type,
      nom: c.nom,
      reperageGeo: c.reperage_geo,
      longitude: c.longitude,
      latitude: c.latitude,
    })),
  }
}
