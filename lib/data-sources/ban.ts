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
