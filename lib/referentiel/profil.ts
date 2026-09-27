// Validation du profil d'une opération (champs texte de Projet) contre le
// référentiel. Pur, utilisable côté client comme côté serveur.

import { MISSIONS, MONTAGES, STATUTS_MOA, TYPOLOGIES } from "./libelles"
import type { Mission, Montage, ProfilOperation, StatutMoa, Typologie } from "./types"

export const ETAPE_STATUTS = ["A_FAIRE", "EN_COURS", "FAIT", "SANS_OBJET"] as const
export type EtapeStatut = (typeof ETAPE_STATUTS)[number]

export const ETAPE_STATUTS_LIBELLES: Record<EtapeStatut, string> = {
  A_FAIRE: "À faire",
  EN_COURS: "En cours",
  FAIT: "Fait",
  SANS_OBJET: "Sans objet",
}

const estCle = <T extends string>(table: Record<T, string>, v: unknown): v is T => typeof v === "string" && v in table

export interface ProfilPartiel {
  statutMoa: StatutMoa | null
  montage: Montage | null
  typologie: Typologie | null
  mission: Mission | null
  rehabilitation: boolean
}

// Profil complet ou null : les variantes ne sont calculées que si les
// quatre axes sont renseignés — jamais sur un profil deviné.
export function profilComplet(p: {
  statutMoa: string | null
  montage: string | null
  typologie: string | null
  mission: string | null
  rehabilitation: boolean
}): ProfilOperation | null {
  if (!estCle(STATUTS_MOA, p.statutMoa) || !estCle(MONTAGES, p.montage) || !estCle(TYPOLOGIES, p.typologie) || !estCle(MISSIONS, p.mission)) {
    return null
  }
  return { statutMoa: p.statutMoa, montage: p.montage, typologie: p.typologie, mission: p.mission, rehabilitation: p.rehabilitation }
}

// Extrait et valide les champs de profil présents dans un corps de
// requête. Renvoie une erreur lisible si une valeur n'appartient pas au
// référentiel ; les champs absents ne sont pas renvoyés.
export function lireProfil(body: Record<string, unknown>): { data: Partial<ProfilPartiel> } | { error: string } {
  const data: Partial<ProfilPartiel> = {}
  const champs: [keyof Omit<ProfilPartiel, "rehabilitation">, Record<string, string>, string][] = [
    ["statutMoa", STATUTS_MOA, "statut du maître d'ouvrage"],
    ["montage", MONTAGES, "montage contractuel"],
    ["typologie", TYPOLOGIES, "typologie d'ouvrage"],
    ["mission", MISSIONS, "mission"],
  ]
  for (const [cle, table, libelle] of champs) {
    if (!(cle in body)) continue
    const v = body[cle]
    if (v === null || v === "") {
      data[cle] = null
    } else if (typeof v === "string" && v in table) {
      ;(data as Record<string, string>)[cle] = v
    } else {
      return { error: `Valeur inconnue pour le champ « ${libelle} ».` }
    }
  }
  if ("rehabilitation" in body) data.rehabilitation = body.rehabilitation === true
  return { data }
}
