// Calculs d'avancement d'un projet sur le référentiel, partagés par le
// tableau de bord, la liste des projets et l'espace projet. Pur, sans
// dépendance serveur. Une étape sans ligne ProjetEtape est « à faire ».

import { PHASES, toutesLesEtapes } from "./index"
import type { Etape, Phase } from "./types"
import type { EtapeStatut } from "./profil"

export interface EtatEtapeProjet {
  etapeCode: string
  statut: EtapeStatut
  echeance: string | null
  note?: string | null
}

export const estTraitee = (s: EtapeStatut | undefined) => s === "FAIT" || s === "SANS_OBJET"

export function indexEtats(etats: EtatEtapeProjet[]): Map<string, EtatEtapeProjet> {
  return new Map(etats.map((e) => [e.etapeCode, e]))
}

export interface AvancementPhase {
  phase: Phase
  total: number
  traitees: number
  complete: boolean
}

export function avancementPhases(etats: Map<string, EtatEtapeProjet>): AvancementPhase[] {
  return PHASES.map((phase) => {
    const traitees = phase.etapes.filter((e) => estTraitee(etats.get(e.code)?.statut)).length
    return { phase, total: phase.etapes.length, traitees, complete: traitees === phase.etapes.length }
  })
}

// Étape sur laquelle porter l'attention : la première en cours dans l'ordre
// de la méthode, sinon la première non traitée ; null si tout est traité.
export function prochaineEtape(etats: Map<string, EtatEtapeProjet>): Etape | null {
  const etapes = toutesLesEtapes()
  return etapes.find((e) => etats.get(e.code)?.statut === "EN_COURS") ?? etapes.find((e) => !estTraitee(etats.get(e.code)?.statut)) ?? null
}

export function phaseDe(code: string): Phase | undefined {
  return PHASES.find((p) => p.etapes.some((e) => e.code === code))
}

export function phaseCourante(etats: Map<string, EtatEtapeProjet>): Phase {
  const e = prochaineEtape(etats)
  return (e && phaseDe(e.code)) ?? PHASES[PHASES.length - 1]
}

export function pourcentage(etats: Map<string, EtatEtapeProjet>): number {
  const total = toutesLesEtapes().length
  const traitees = toutesLesEtapes().filter((e) => estTraitee(etats.get(e.code)?.statut)).length
  return total ? Math.round((traitees / total) * 100) : 0
}

// Échéance au format date seule, comparée au jour courant (local).
export function joursRestants(echeance: string, maintenant = new Date()): number {
  const d = new Date(echeance)
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const b = Date.UTC(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  return Math.round((a - b) / 86_400_000)
}

export function dateCourte(echeance: string): { jour: string; mois: string } {
  const d = new Date(echeance)
  return {
    jour: String(d.getUTCDate()),
    mois: d.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase(),
  }
}
