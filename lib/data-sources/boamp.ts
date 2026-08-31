// Client pour le BOAMP (Bulletin officiel des annonces des marchés
// publics, opendatasoft — même plateforme que le BODACC, voir
// lib/data-sources/bodacc.ts). Pas de clé requise. Recherche par
// département (dérivé du code INSEE de l'adresse sélectionnée) : donne
// une vue "marché" des appels d'offres publics récents dans la zone —
// utile pour une étude AMO/OPC (repérer des opportunités, ou situer un
// projet dans le contexte de la commande publique locale). Validé par
// appel réel avant d'écrire ce code (voir CLAUDE.md).

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://boamp-datadila.opendatasoft.com/api/records/1.0/search/"

export interface PublicMarket {
  id: string
  acheteur: string
  objet: string
  datePublication: string
  famille: string
  urlAvis: string | null
}

interface RawRecord {
  recordid: string
  fields: {
    nomacheteur: string
    objet: string
    dateparution: string
    famille_libelle: string
    url_avis: string | null
  }
}

interface BoampResponse {
  records: RawRecord[]
}

export async function getPublicMarketsForDepartment(codeDepartement: string, limit = 10): Promise<PublicMarket[]> {
  return withVault("boamp", codeDepartement, () => fetchPublicMarketsLive(codeDepartement, limit))
}

async function fetchPublicMarketsLive(codeDepartement: string, limit: number): Promise<PublicMarket[]> {
  const url = new URL(BASE_URL)
  url.searchParams.set("dataset", "boamp")
  url.searchParams.set("q", `code_departement:${codeDepartement}`)
  url.searchParams.set("rows", String(limit))
  url.searchParams.set("sort", "-dateparution")

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API BOAMP a répondu ${res.status}`)
  }

  const data = (await res.json()) as BoampResponse
  return data.records.map((r) => ({
    id: r.recordid,
    acheteur: r.fields.nomacheteur,
    objet: r.fields.objet,
    datePublication: r.fields.dateparution,
    famille: r.fields.famille_libelle,
    urlAvis: r.fields.url_avis,
  }))
}

// departmentCodeFromCityCode() a été déplacée dans lib/insee.ts (aucune
// dépendance serveur) pour rester importable depuis un composant client
// (app/sit/page.tsx) sans embarquer withVault/Prisma dans le bundle
// navigateur — voir CLAUDE.md.
