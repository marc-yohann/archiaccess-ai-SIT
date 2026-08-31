// Client pour le BODACC (Bulletin officiel des annonces civiles et
// commerciales, opendatasoft) — annonces légales des entreprises
// (créations, procédures collectives, dépôts de comptes...). Pas de clé
// requise. Recherche par SIREN (champ "registre") pour ne remonter que
// les annonces de l'entreprise concernée — voir CLAUDE.md, complète la
// tuile Entreprise (lib/data-sources/entreprises.ts) déjà en place.
// Validé par appel réel avant d'écrire ce code.

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://bodacc-datadila.opendatasoft.com/api/records/1.0/search/"

export interface BodaccAnnouncement {
  id: string
  datePublication: string
  famille: string // ex: "Procédures collectives", "Créations", "Dépôts des comptes"
  type: string // ex: "Avis initial"
  commercant: string
  tribunal: string | null
  ville: string | null
}

interface RawRecord {
  fields: {
    id: string
    dateparution: string
    familleavis_lib: string
    typeavis_lib: string
    commercant: string
    tribunal: string | null
    ville: string | null
  }
}

interface BodaccResponse {
  records: RawRecord[]
}

export async function getAnnouncementsForSiren(siren: string, limit = 10): Promise<BodaccAnnouncement[]> {
  return withVault("bodacc", siren, () => fetchAnnouncementsLive(siren, limit))
}

async function fetchAnnouncementsLive(siren: string, limit: number): Promise<BodaccAnnouncement[]> {
  const url = new URL(BASE_URL)
  url.searchParams.set("dataset", "annonces-commerciales")
  url.searchParams.set("q", `registre:${siren}`)
  url.searchParams.set("rows", String(limit))
  url.searchParams.set("sort", "-dateparution")

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API BODACC a répondu ${res.status}`)
  }

  const data = (await res.json()) as BodaccResponse
  return data.records.map((r) => ({
    id: r.fields.id,
    datePublication: r.fields.dateparution,
    famille: r.fields.familleavis_lib,
    type: r.fields.typeavis_lib,
    commercant: r.fields.commercant,
    tribunal: r.fields.tribunal ?? null,
    ville: r.fields.ville ?? null,
  }))
}
