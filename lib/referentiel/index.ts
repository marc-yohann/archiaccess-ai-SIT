import type { Condition, Etape, Item, Mission, Phase, ProfilOperation, Variante } from "./types"
import { phase1 } from "./phases/phase-1"
import { phase2 } from "./phases/phase-2"
import { phase3 } from "./phases/phase-3"
import { phase4 } from "./phases/phase-4"
import { phase5 } from "./phases/phase-5"
import { phase6 } from "./phases/phase-6"
import { phase7 } from "./phases/phase-7"
import { phase8 } from "./phases/phase-8"
import { phase9 } from "./phases/phase-9"

export * from "./types"

// Version du référentiel, reportée sur le PDF et dans l'espace projet.
export const REFERENTIEL_VERSION = "0.3"

export const PHASES: Phase[] = [phase1, phase2, phase3, phase4, phase5, phase6, phase7, phase8, phase9]

export function toutesLesEtapes(): Etape[] {
  return PHASES.flatMap((p) => p.etapes)
}

export function trouverEtape(code: string): Etape | undefined {
  return toutesLesEtapes().find((e) => e.code === code)
}

export function conditionRemplie(c: Condition, profil: ProfilOperation): boolean {
  if (c.statutMoa && !c.statutMoa.includes(profil.statutMoa)) return false
  if (c.montage && !c.montage.includes(profil.montage)) return false
  if (c.typologie && !c.typologie.includes(profil.typologie)) return false
  if (c.mission && !c.mission.includes(profil.mission)) return false
  if (c.rehabilitation !== undefined && c.rehabilitation !== profil.rehabilitation) return false
  return true
}

export function variantesApplicables(etape: Etape, profil: ProfilOperation): Variante[] {
  return etape.variantes.filter((v) => conditionRemplie(v.quand, profil))
}

export function texteItem(item: Item): string {
  return typeof item === "string" ? item : item.texte
}

export function missionsItem(item: Item): Mission[] | null {
  return typeof item === "string" ? null : item.missions
}

export function itemsApplicables(items: Item[], mission: Mission): string[] {
  return items.filter((i) => typeof i === "string" || i.missions.includes(mission)).map(texteItem)
}
