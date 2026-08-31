// Client pour l'API Géorisques — sites et sols pollués (SSP/CASIAS,
// anciennement connus sous les noms BASOL/BASIAS — la terminologie a
// changé côté Géorisques, vérifié en direct avant d'écrire ce code, voir
// CLAUDE.md). Pas de clé requise. Recherche par code INSEE, combine les
// sites recensés (casias) et les instructions de sites en cours
// (instructions) — pertinent pour une étude AMO/OPC (pollution des sols,
// contraintes de dépollution avant construction).

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://georisques.gouv.fr/api/v1/ssp"
const PAGE_SIZE = 20

export interface PollutedSite {
  identifiantSsp: string
  nom: string
  adresse: string | null
  statut: string
  ficheRisque: string | null
  dateMaj: string | null
  category: "casias" | "instruction"
}

export interface PollutedSitesResult {
  totalCasias: number
  totalInstructions: number
  sites: PollutedSite[]
}

interface RawSite {
  identifiant_ssp: string
  nom_etablissement?: string
  nom?: string
  adresse: string | null
  statut: string
  fiche_risque: string | null
  date_maj: string | null
}

interface SspSection {
  results: number
  data: RawSite[]
}

interface SspResponse {
  casias: SspSection
  instructions: SspSection
}

export async function getPollutedSitesForCommune(codeInsee: string): Promise<PollutedSitesResult> {
  return withVault("sites-pollues", codeInsee, () => fetchPollutedSitesLive(codeInsee))
}

async function fetchPollutedSitesLive(codeInsee: string): Promise<PollutedSitesResult> {
  const url = new URL(BASE_URL)
  url.searchParams.set("code_insee", codeInsee)
  url.searchParams.set("page", "1")
  url.searchParams.set("page_size", String(PAGE_SIZE))

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API Géorisques (sites pollués) a répondu ${res.status}`)
  }

  const data = (await res.json()) as SspResponse
  const toSite = (r: RawSite, category: "casias" | "instruction"): PollutedSite => ({
    identifiantSsp: r.identifiant_ssp,
    nom: r.nom_etablissement ?? r.nom ?? "Site sans nom",
    adresse: r.adresse,
    statut: r.statut,
    ficheRisque: r.fiche_risque,
    dateMaj: r.date_maj,
    category,
  })

  return {
    totalCasias: data.casias.results,
    totalInstructions: data.instructions.results,
    sites: [
      ...data.casias.data.map((r) => toSite(r, "casias")),
      ...data.instructions.data.map((r) => toSite(r, "instruction")),
    ],
  }
}
