import type { Condition, Etape, Item, Mission, Phase, ProfilOperation, Variante } from "./types"
import { phase6 } from "./phases/phase-6"
import { phase7 } from "./phases/phase-7"
import { phase8 } from "./phases/phase-8"

export * from "./types"

// Version du référentiel, reportée sur le PDF et dans l'espace projet.
export const REFERENTIEL_VERSION = "0.2"

// Phases pas encore rédigées : présentes pour que la structure complète
// soit visible (PDF, espace projet), sans étape.
function aRediger(numero: number, titre: string): Phase {
  return { numero, titre, intro: "", etapes: [] }
}

export const PHASES: Phase[] = [
  aRediger(1, "Opportunité et faisabilité"),
  aRediger(2, "Programme et stratégie contractuelle"),
  aRediger(3, "Désignation des intervenants"),
  aRediger(4, "Suivi des études de conception"),
  aRediger(5, "Autorisations"),
  phase6,
  phase7,
  phase8,
  aRediger(9, "Exploitation et maintenance"),
]

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
