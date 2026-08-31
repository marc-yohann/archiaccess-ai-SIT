// Client pour Hub'Eau — plateforme API officielle du Service Public
// Français des Données de l'Eau — API "niveaux_nappes" (stations de
// mesure piézométrique des eaux souterraines, ADES/BSS). Pas de clé
// requise. Recherche par code INSEE commune, comme Géorisques.
// Pertinent pour les études géotechniques/hydrogéologiques (rabattement
// de nappe, profondeur d'investigation, nature de l'aquifère). Validé
// par appel réel avant d'écrire ce code (voir CLAUDE.md).

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations"
const PAGE_SIZE = 10

export interface GroundwaterStation {
  codeBss: string
  altitudeStation: number | null
  profondeurInvestigation: number | null
  dateDebutMesure: string | null
  dateFinMesure: string | null // null = station encore suivie activement
  nbMesuresPiezo: number
  aquifere: string | null // masse d'eau souterraine (ex: "Craie de Champagne nord")
}

interface RawStation {
  code_bss: string
  altitude_station: string | null
  profondeur_investigation: number | null
  date_debut_mesure: string | null
  date_fin_mesure: string | null
  nb_mesures_piezo: number
  noms_masse_eau_edl: string[] | null
}

interface StationsResponse {
  count: number
  data: RawStation[]
}

export async function getGroundwaterStationsForCommune(codeInsee: string): Promise<GroundwaterStation[]> {
  return withVault("nappes", codeInsee, () => fetchGroundwaterStationsLive(codeInsee))
}

async function fetchGroundwaterStationsLive(codeInsee: string): Promise<GroundwaterStation[]> {
  const url = new URL(BASE_URL)
  url.searchParams.set("code_commune", codeInsee)
  url.searchParams.set("size", String(PAGE_SIZE))

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API Hub'Eau (niveaux_nappes) a répondu ${res.status}`)
  }

  const data = (await res.json()) as StationsResponse
  return data.data.map((s) => ({
    codeBss: s.code_bss,
    altitudeStation: s.altitude_station !== null ? Number(s.altitude_station) : null,
    profondeurInvestigation: s.profondeur_investigation,
    dateDebutMesure: s.date_debut_mesure,
    dateFinMesure: s.date_fin_mesure,
    nbMesuresPiezo: s.nb_mesures_piezo,
    aquifere: s.noms_masse_eau_edl?.[0] ?? null,
  }))
}
