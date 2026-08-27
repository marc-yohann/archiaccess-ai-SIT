// Client pour les Demandes de Valeurs Foncières (DVF, transactions
// immobilières) — endpoint interne de l'app officielle Etalab
// (app.dvf.etalab.gouv.fr), pas de clé requise. Aucune API DVF publique
// documentée et stable n'existe à ce jour (l'ancienne api.cquest.org est
// hors service, testé avant d'écrire ce code — voir CLAUDE.md) ; celle-ci
// est celle qui alimente réellement le site officiel data.gouv.fr/DVF.
//
// Nécessite un code commune + un "préfixe section" (com_abs + section,
// ex: "000AP") — voir lib/data-sources/cadastre.ts pour comment on
// l'obtient à partir d'une parcelle.

const BASE_URL = "https://app.dvf.etalab.gouv.fr/api/mutations3"

export interface Mutation {
  idMutation: string
  date: string
  nature: string
  valeurFonciere: number | null
  adresse: string
  typeLocal: string | null
  surfaceReelleBati: number | null
  surfaceTerrain: number | null
  idParcelle: string
}

interface RawMutation {
  id_mutation: string
  date_mutation: string
  nature_mutation: string
  valeur_fonciere: string
  adresse_numero: string
  adresse_nom_voie: string
  code_postal: string
  nom_commune: string
  type_local: string
  surface_reelle_bati: string
  surface_terrain: string
  id_parcelle: string
}

function parseNumeric(value: string): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseText(value: string): string | null {
  return value === "None" ? null : value
}

export async function getMutationsForSection(codeCommune: string, sectionPrefixe: string): Promise<Mutation[]> {
  const res = await fetch(`${BASE_URL}/${codeCommune}/${sectionPrefixe}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    throw new Error(`API DVF a répondu ${res.status}`)
  }

  const data = (await res.json()) as { mutations: RawMutation[] }

  // Une mutation peut apparaître plusieurs fois dans la réponse (une ligne
  // par lot/dépendance du même bien) — on déduplique par id_mutation pour
  // ne pas afficher la même vente plusieurs fois.
  const seen = new Set<string>()
  const mutations: Mutation[] = []
  for (const m of data.mutations) {
    if (seen.has(m.id_mutation)) continue
    seen.add(m.id_mutation)
    mutations.push({
      idMutation: m.id_mutation,
      date: m.date_mutation,
      nature: m.nature_mutation,
      valeurFonciere: parseNumeric(m.valeur_fonciere),
      adresse: [parseText(m.adresse_numero), m.adresse_nom_voie, m.code_postal, m.nom_commune]
        .filter(Boolean)
        .join(" "),
      typeLocal: parseText(m.type_local),
      surfaceReelleBati: parseNumeric(m.surface_reelle_bati),
      surfaceTerrain: parseNumeric(m.surface_terrain),
      idParcelle: m.id_parcelle,
    })
  }

  return mutations.sort((a, b) => b.date.localeCompare(a.date))
}
