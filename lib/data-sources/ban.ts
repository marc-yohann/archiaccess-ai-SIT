// Client pour l'API Adresse (Base Adresse Nationale, data.gouv.fr) —
// premier connecteur du hub SIT. Pas de clé requise, endpoint public.
// Sert de point d'entrée aux futurs connecteurs (cadastre, Géorisques,
// DVF...) qui ont tous besoin d'une adresse géocodée ou d'un code commune
// en entrée.

import { withVault } from "@/lib/data-vault"

const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/"

export interface AddressResult {
  label: string
  score: number
  housenumber?: string
  street?: string
  postcode: string
  city: string
  citycode: string
  context: string
  type: string
  coordinates: [number, number] // [longitude, latitude]
}

interface BanFeature {
  properties: {
    label: string
    score: number
    housenumber?: string
    street?: string
    postcode: string
    city: string
    citycode: string
    context: string
    type: string
  }
  geometry: {
    coordinates: [number, number]
  }
}

interface BanResponse {
  features: BanFeature[]
}

export async function searchAddress(query: string, limit = 5): Promise<AddressResult[]> {
  return withVault("ban", `q:${query.trim().toLowerCase()}`, () => fetchAddressLive(query, limit))
}

// Résolution nom de commune -> code INSEE, pour le mode de recherche
// "Secteur" (étude à l'échelle d'une commune entière, voir CLAUDE.md/page.tsx)
// — même API, filtrée sur type=municipality plutôt que sur une adresse
// précise. Vérifié par appel réel (voir CLAUDE.md) : "Reims" retourne bien
// citycode=51454, un résultat par commune candidate (score de pertinence
// si le nom est ambigu, ex. plusieurs communes homonymes).
export interface CommuneResult {
  label: string
  score: number
  citycode: string
  postcode: string
  city: string
  population: number | null
}

// Source de coffre distincte de "ban" (et non ajoutée à KNOWN_SOURCES côté
// vault-stats) : une résolution de commune n'est pas une nouvelle source
// fédérée à afficher dans "Sources fédérées", et la mélanger avec "ban"
// la ferait apparaître à tort dans "Reprendre une étude récente" (qui
// filtre sur STUDY_SOURCES = ["ban", "entreprises"] et rejoue l'entrée
// comme une adresse/entreprise — pas ce qu'attend une entrée "commune").
export async function searchCommune(query: string, limit = 5): Promise<CommuneResult[]> {
  return withVault("commune", query.trim().toLowerCase(), () => fetchCommuneLive(query, limit))
}

async function fetchCommuneLive(query: string, limit: number): Promise<CommuneResult[]> {
  const url = new URL(BAN_SEARCH_URL)
  url.searchParams.set("q", query)
  url.searchParams.set("type", "municipality")
  url.searchParams.set("limit", String(limit))

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API Adresse a répondu ${res.status}`)
  }

  const data = (await res.json()) as {
    features: Array<{ properties: { label: string; score: number; citycode: string; postcode: string; city: string; population?: number } }>
  }
  return data.features.map((f) => ({
    label: f.properties.label,
    score: f.properties.score,
    citycode: f.properties.citycode,
    postcode: f.properties.postcode,
    city: f.properties.city,
    population: f.properties.population ?? null,
  }))
}

async function fetchAddressLive(query: string, limit: number): Promise<AddressResult[]> {
  const url = new URL(BAN_SEARCH_URL)
  url.searchParams.set("q", query)
  url.searchParams.set("limit", String(limit))

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API Adresse a répondu ${res.status}`)
  }

  const data = (await res.json()) as BanResponse
  return data.features.map((f) => ({
    label: f.properties.label,
    score: f.properties.score,
    housenumber: f.properties.housenumber,
    street: f.properties.street,
    postcode: f.properties.postcode,
    city: f.properties.city,
    citycode: f.properties.citycode,
    context: f.properties.context,
    type: f.properties.type,
    coordinates: f.geometry.coordinates,
  }))
}
