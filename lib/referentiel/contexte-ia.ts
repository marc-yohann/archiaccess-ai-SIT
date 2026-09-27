// Contexte texte transmis à Archiaccess AI depuis le tableau de bord et
// l'espace projet (champ `context` de /api/mistral/chat). Pur, sans
// dépendance serveur. On y met ce que l'ingénieur a sous les yeux, jamais
// d'information interne à la maintenance de la méthode (statut de
// validation, points « à préciser »).

import { itemsApplicables, texteItem, variantesApplicables } from "./index"
import { ACTEURS, MISSIONS, MONTAGES, STATUTS_MOA, TYPOLOGIES } from "./libelles"
import { avancementPhases, estTraitee, indexEtats, phaseCourante, pourcentage, prochaineEtape, type EtatEtapeProjet } from "./avancement"
import { ETAPE_STATUTS_LIBELLES, profilComplet } from "./profil"
import type { Etape } from "./types"

export interface ProjetPourContexte {
  nom: string
  description: string | null
  statutMoa: string | null
  montage: string | null
  typologie: string | null
  mission: string | null
  rehabilitation: boolean
  etapes: EtatEtapeProjet[]
}

const libelle = (table: Record<string, string>, v: string | null) => (v && v in table ? table[v] : "non renseigné")
const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" })

function enteteProjet(p: ProjetPourContexte): string[] {
  const etats = indexEtats(p.etapes)
  const suivante = prochaineEtape(etats)
  return [
    `Projet : ${p.nom}${p.description ? ` — ${p.description}` : ""}`,
    `Maître d'ouvrage : ${libelle(STATUTS_MOA, p.statutMoa)} ; ouvrage : ${libelle(TYPOLOGIES, p.typologie)}${p.rehabilitation ? " (réhabilitation ou site occupé)" : ""} ; montage : ${libelle(MONTAGES, p.montage)} ; mission Archiaccess : ${libelle(MISSIONS, p.mission)}`,
    `Avancement : ${pourcentage(etats)} % des étapes traitées, phase en cours « ${phaseCourante(etats).titre} »${suivante ? `, prochaine étape ${suivante.code} ${suivante.titre}` : ""}`,
  ]
}

export function contexteProjet(p: ProjetPourContexte, etape: Etape | null): string {
  const lignes = [
    "Méthode Archiaccess : l'outil prépare, l'ingénieur analyse, le maître d'ouvrage décide. Ne jamais présenter une proposition comme une décision.",
    ...enteteProjet(p),
  ]
  const etats = indexEtats(p.etapes)
  const enCours = p.etapes.filter((e) => e.statut === "EN_COURS").map((e) => e.etapeCode)
  if (enCours.length) lignes.push(`Étapes en cours : ${enCours.join(", ")}`)

  if (etape) {
    const etat = etats.get(etape.code)
    const profil = profilComplet(p)
    lignes.push(
      "",
      `Étape ouverte : ${etape.code} ${etape.titre} (${ETAPE_STATUTS_LIBELLES[etat?.statut ?? "A_FAIRE"]}${etat?.echeance ? `, échéance ${date(etat.echeance)}` : ""})`,
      `Objectif : ${etape.objectif}`,
      `Rôles : ${etape.roles.map((r) => `${ACTEURS[r.acteur]} — ${r.role}`).join(" ; ")}`,
      `Livrables Archiaccess : ${(profil ? itemsApplicables(etape.livrables, profil.mission) : etape.livrables.map(texteItem)).join(" ; ")}`,
      `Actions de l'ingénieur : ${etape.humain.join(" ; ")}`,
      `Points de vigilance : ${etape.vigilance.join(" ; ")}`,
    )
    const variantes = profil ? variantesApplicables(etape, profil) : []
    if (variantes.length) lignes.push(`Particularités de cette opération : ${variantes.map((v) => v.texte).join(" ; ")}`)
    if (etape.textes.length) lignes.push(`Textes de référence : ${etape.textes.join(" ; ")}`)
    if (etat?.note) lignes.push(`Notes de l'ingénieur : ${etat.note}`)
  }
  return lignes.join("\n")
}

export function contexteTableauDeBord(projets: ProjetPourContexte[]): string {
  if (!projets.length) return "Aucun projet n'est encore suivi dans l'espace projet."
  const lignes = ["Opérations suivies par le cabinet dans l'espace projet :"]
  for (const p of projets) {
    lignes.push("", ...enteteProjet(p))
    const echeances = p.etapes
      .filter((e) => e.echeance && !estTraitee(e.statut))
      .sort((a, b) => (a.echeance! < b.echeance! ? -1 : 1))
      .map((e) => `${e.etapeCode} le ${date(e.echeance!)}`)
    if (echeances.length) lignes.push(`Échéances : ${echeances.join(", ")}`)
    const phases = avancementPhases(indexEtats(p.etapes)).filter((a) => a.complete).length
    lignes.push(`Phases terminées : ${phases} sur 9`)
  }
  return lignes.join("\n")
}
