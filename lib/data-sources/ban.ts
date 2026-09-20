// Client pour l'API Adresse (Base Adresse Nationale, data.gouv.fr) —
// premier connecteur du hub SIT. Pas de clé requise, endpoint public.
// Sert de point d'entrée aux futurs connecteurs (cadastre, Géorisques,
// DVF...) qui ont tous besoin d'une adresse géocodée ou d'un code commune
// en entrée.

import { withVault } from "@/lib/data-vault"

const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/"

export interface AddressResult {
  // Identifiant d'adresse BAN natif (ex: "51454_1685") — un point réel et
  // stable par adresse, distinct de l'UUID "banId" observé séparément
  // dans certaines réponses. Utilisé pour distinguer deux candidats
  // réellement différents (résolution Etablissement->Site, Phase 8) sans
  // dépendre du texte du label.
  id: string
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
    id: string
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

// citycode : filtre optionnel côté API BAN (paramètre réel du endpoint
// /search/, vérifié par appel réel — voir le rapport Phase 8) qui
// restreint la recherche à une commune donnée. Déterminant pour la
// résolution Etablissement->Site : passer le codeInsee déjà connu via
// SIRENE élimine les faux candidats d'autres communes qui, sans ce
// filtre, faussent le classement par score (voir searchSite ci-dessous,
// app/api/sit/acteurs/route.ts). Absent de la clé de coffre pour les
// appels historiques sans citycode (compatibilité), inclus dès qu'un
// citycode est fourni pour ne jamais mélanger deux résultats différents
// sous la même clé.
export async function searchAddress(query: string, limit = 5, citycode?: string): Promise<AddressResult[]> {
  const cacheKey = citycode ? `q:${query.trim().toLowerCase()}|citycode:${citycode}` : `q:${query.trim().toLowerCase()}`
  return withVault("ban", cacheKey, () => fetchAddressLive(query, limit, citycode))
}

// Résolution déterministe d'une adresse -> un Site "suffisamment identifié"
// (Phase 8, résolution Etablissement->Site). Règle écrite après audit réel
// (voir le rapport Phase 8, section "règle BAN") : ne jamais utiliser
// `score` comme critère de décision, ni prendre le premier résultat par
// défaut.
//
// Constats vérifiés par appels réels avant d'écrire cette fonction :
// - `score` est un score de pertinence texte générique, pas un indicateur
//   de justesse : une requête réelle ("12 rue de Vesle Reims") a renvoyé un
//   résultat de type "street" (sans numéro) à score 0.768 au-dessus d'un
//   résultat "housenumber" exact mais dans la mauvaise commune (score
//   0.646).
// - Sans filtre `citycode`, l'API ne renvoie quasiment jamais de résultat
//   type "housenumber" même pour une adresse réelle et connue avec numéro
//   ("1 Rue de Rivoli 75001 Paris" -> un seul résultat, type "street").
// - Avec le `citycode` déjà connu (SIRENE fournit codeInsee pour un
//   établissement), la même adresse avec numéro retrouve un résultat
//   "housenumber" fiable, unique, à score élevé (0.976) — corroboration
//   par une donnée déjà en notre possession, pas un nouveau seuil inventé.
// - Un numéro inexistant dans la commune filtrée retombe proprement sur un
//   résultat "street" (jamais fabriqué en "housenumber").
// - Une requête non résolvable renvoie bien 0 résultat (features: []).
//
// Règle : ne retenir que les candidats dont `type === "housenumber"` (le
// seul niveau de précision BAN qui identifie un numéro, pas seulement une
// rue ou une commune) puis compter les candidats DISTINCTS (par `id` BAN,
// pas par label) : 0 -> NOT_FOUND, 1 -> VALID, >=2 -> AMBIGUOUS. Le
// `citycode` doit être passé dès qu'il est connu (réduit drastiquement les
// faux AMBIGUOUS/NOT_FOUND liés à des homonymes d'autres communes) mais la
// règle de décision reste identique avec ou sans lui.
export type AddressResolution =
  | { status: "VALID"; candidate: AddressResult }
  | { status: "NOT_FOUND" }
  | { status: "AMBIGUOUS"; candidates: AddressResult[] }

export async function resolvePreciseAddress(query: string, citycode?: string): Promise<AddressResolution> {
  const results = await searchAddress(query, 5, citycode)
  const precise = results.filter((r) => r.type === "housenumber")

  const distinctById = new Map<string, AddressResult>()
  for (const candidate of precise) {
    if (!distinctById.has(candidate.id)) distinctById.set(candidate.id, candidate)
  }
  const distinct = [...distinctById.values()]

  if (distinct.length === 0) return { status: "NOT_FOUND" }
  if (distinct.length === 1) return { status: "VALID", candidate: distinct[0] }
  return { status: "AMBIGUOUS", candidates: distinct }
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

async function fetchAddressLive(query: string, limit: number, citycode?: string): Promise<AddressResult[]> {
  const url = new URL(BAN_SEARCH_URL)
  url.searchParams.set("q", query)
  url.searchParams.set("limit", String(limit))
  if (citycode) {
    url.searchParams.set("citycode", citycode)
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API Adresse a répondu ${res.status}`)
  }

  const data = (await res.json()) as BanResponse
  return data.features.map((f) => ({
    id: f.properties.id,
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
