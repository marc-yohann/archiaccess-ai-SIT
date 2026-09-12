// Client pour l'API Recherche d'entreprises (data.gouv.fr / DINUM) —
// données SIRENE/RNE publiques, pas de clé requise. Complète la recherche
// d'adresse : le SIT ne doit pas se limiter aux données foncières, une
// recherche peut aussi porter sur une entreprise (nom, SIREN, SIRET) —
// voir CLAUDE.md. Validé par appel réel avant d'écrire ce code.

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://recherche-entreprises.api.gouv.fr/search"

// Coordonnées/commune/code postal du siège — présents dans la réponse
// brute de l'API (vérifié par appel réel, audit Phase 2 du 2026-09-11)
// mais jusqu'ici jamais repris dans Company : pure perte d'info, pas un
// manque de source. Regroupés à part plutôt qu'aplatis dans Company pour
// que leur origine commune (le siège, pas l'entreprise en général) reste
// explicite (voir Etablissement, prisma/schema.prisma, qui structure ces
// mêmes champs).
export interface CompanySiege {
  siret: string | null
  adresse: string | null
  codePostal: string | null
  codeInsee: string | null // "commune" côté API — code INSEE, pas le nom
  communeLibelle: string | null
  latitude: number | null
  longitude: number | null
  actif: boolean | null
}

export interface Company {
  siren: string
  siret: string | null
  nom: string
  nomCommercial: string | null
  sigle: string | null
  activitePrincipale: string | null
  categorieEntreprise: string | null
  dateCreation: string | null
  etatAdministratif: "actif" | "cessé" | null
  adresse: string | null
  dirigeants: string[]
  siege: CompanySiege
}

interface RawResult {
  siren: string
  nom_complet: string
  nom_raison_sociale: string | null
  sigle: string | null
  activite_principale: string | null
  categorie_entreprise: string | null
  date_creation: string | null
  etat_administratif: string | null
  siege: {
    siret: string | null
    adresse: string | null
    code_postal: string | null
    commune: string | null
    libelle_commune: string | null
    latitude: string | null
    longitude: string | null
    nom_commercial: string | null
    etat_administratif: string | null
  }
  dirigeants?: Array<{ nom?: string; prenoms?: string; denomination?: string; type_dirigeant?: string }>
}

interface SearchResponse {
  results: RawResult[]
}

function dirigeantLabel(d: NonNullable<RawResult["dirigeants"]>[number]): string | null {
  if (d.denomination) return d.denomination
  const name = [d.prenoms, d.nom].filter(Boolean).join(" ").trim()
  return name || null
}

export async function searchCompanies(query: string, limit = 5): Promise<Company[]> {
  return withVault("entreprises", `q:${query.trim().toLowerCase()}`, () => fetchCompaniesLive(query, limit))
}

async function fetchCompaniesLive(query: string, limit: number): Promise<Company[]> {
  const url = new URL(BASE_URL)
  url.searchParams.set("q", query)
  url.searchParams.set("per_page", String(limit))

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API Recherche d'entreprises a répondu ${res.status}`)
  }

  const data = (await res.json()) as SearchResponse
  return data.results.map((r) => ({
    siren: r.siren,
    siret: r.siege?.siret ?? null,
    nom: r.nom_raison_sociale ?? r.nom_complet,
    nomCommercial: r.siege?.nom_commercial ?? null,
    sigle: r.sigle,
    activitePrincipale: r.activite_principale,
    categorieEntreprise: r.categorie_entreprise,
    dateCreation: r.date_creation,
    etatAdministratif: r.etat_administratif === "A" ? "actif" : r.etat_administratif === "C" ? "cessé" : null,
    adresse: r.siege?.adresse ?? null,
    dirigeants: (r.dirigeants ?? []).map(dirigeantLabel).filter((v): v is string => v !== null),
    siege: {
      siret: r.siege?.siret ?? null,
      adresse: r.siege?.adresse ?? null,
      codePostal: r.siege?.code_postal ?? null,
      codeInsee: r.siege?.commune ?? null,
      communeLibelle: r.siege?.libelle_commune ?? null,
      latitude: r.siege?.latitude ? Number(r.siege.latitude) : null,
      longitude: r.siege?.longitude ? Number(r.siege.longitude) : null,
      actif: r.siege?.etat_administratif ? r.siege.etat_administratif === "A" : null,
    },
  }))
}

// SIREN (9 chiffres) ou SIRET (14 chiffres) — pour détecter qu'une
// recherche universelle porte sur un identifiant d'entreprise plutôt
// qu'une adresse ou un texte libre.
export function looksLikeSirenOrSiret(query: string): boolean {
  const digitsOnly = query.replace(/\s/g, "")
  return /^\d{9}(\d{5})?$/.test(digitsOnly)
}
