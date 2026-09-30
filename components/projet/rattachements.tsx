// Données du SIT rattachées au projet (site, acteurs, marchés, documents).
// Depuis le lot « Fil, dossier et études » (2026-09-30), elles ne sont plus
// présentées en blocs au-dessus des étapes : elles font partie du dossier
// du projet (components/projet/dossier.tsx), filtre « Données du SIT », avec
// qui les a ajoutées et quand.

type AjoutePar = { ajoutePar?: { id: string; name: string } | null; createdAt?: string }

export interface SiteRattache extends AjoutePar {
  site: { id: string; label: string; city: string; postcode: string }
}
export interface ActeurRattache extends AjoutePar {
  role: string | null
  acteur: { id: string; siren: string; nom: string | null; nomCommercial: string | null }
}
export interface AvisRattache extends AjoutePar {
  avisMarche: { id: string; objet: string | null; natureAvis: string | null; acheteurNom: string | null; datePublication: string | null; urlAvis: string | null }
}
export interface LotRattache extends AjoutePar {
  lot: { id: string; numero: string; description: string | null; titulaireNom: string | null; avisMarche: AvisRattache["avisMarche"] }
}
export interface DocumentRattache {
  createdAt?: string
  documentSit: { id: string; titre: string; type: string | null; sourceUrl: string | null }
}

export interface Rattachements {
  sites: SiteRattache[]
  acteurs: ActeurRattache[]
  avisMarches: AvisRattache[]
  lots: LotRattache[]
  documentSitLinks: DocumentRattache[]
}

// Rattachements qu'on peut retirer (routes DELETE
// /api/sit/projets/[id]/sites|acteurs|avis-marches|lots/[id]).
export type TypeRetrait = "sites" | "acteurs" | "avis-marches" | "lots"

export function lienDonneesSite(label: string) {
  return `/sit/recherche?site=${encodeURIComponent(label)}`
}
