// Client pour l'API Géorisques (risques naturels/technologiques, zonage
// sismique, radon) — pas de clé requise. Trois endpoints à l'échelle de
// la commune (code INSEE), pertinents pour une étude technique AMO/OPC :
// exposition aux risques (PPR), zone sismique (réglementation parasismique),
// potentiel radon (ventilation/santé). Validé par appels réels avant
// d'écrire ce code (voir CLAUDE.md).

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://georisques.gouv.fr/api/v1"

export interface Risk {
  code: string
  label: string
}

export interface CommuneRisks {
  codeInsee: string
  commune: string
  risks: Risk[]
  seismicZone: string | null
  radonPotential: string | null
}

interface GaspardResponse {
  data: Array<{
    code_insee: string
    libelle_commune: string
    risques_detail: Array<{ num_risque: string; libelle_risque_long: string }>
  }>
}

interface ZonageSismiqueResponse {
  data: Array<{ zone_sismicite: string }>
}

interface RadonResponse {
  data: Array<{ classe_potentiel: string }>
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`Géorisques a répondu ${res.status} (${url})`)
  }
  return res.json() as Promise<T>
}

export async function getRisksForCommune(codeInsee: string): Promise<CommuneRisks> {
  return withVault("georisques", codeInsee, () => fetchRisksLive(codeInsee))
}

async function fetchRisksLive(codeInsee: string): Promise<CommuneRisks> {
  const [gaspard, seismic, radon] = await Promise.all([
    fetchJson<GaspardResponse>(`${BASE_URL}/gaspar/risques?code_insee=${codeInsee}`),
    fetchJson<ZonageSismiqueResponse>(`${BASE_URL}/zonage_sismique?code_insee=${codeInsee}`),
    fetchJson<RadonResponse>(`${BASE_URL}/radon?code_insee=${codeInsee}`),
  ])

  const commune = gaspard.data[0]

  return {
    codeInsee,
    commune: commune?.libelle_commune ?? "",
    risks:
      commune?.risques_detail.map((r) => ({ code: r.num_risque, label: r.libelle_risque_long })) ?? [],
    seismicZone: seismic.data[0]?.zone_sismicite ?? null,
    radonPotential: radon.data[0]?.classe_potentiel ?? null,
  }
}
