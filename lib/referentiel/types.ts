// Référentiel de méthode Archiaccess (AMO / OPC) — types.
//
// Source unique : les mêmes données alimentent l'espace projet du SIT et le
// PDF de documentation (scripts/referentiel-pdf.mjs). Fichiers purs, sans
// aucune dépendance serveur : importables côté client (voir CLAUDE.md,
// piège "utilitaire pur dans un fichier serveur").
//
// Règle de rédaction (CLAUDE.md) : contenu propre à Archiaccess, sourcé
// uniquement sur des textes publics, jamais recopié d'un ouvrage du commerce.

// --- Les trois axes de variation d'une opération -------------------------

export type StatutMoa =
  | "ETAT_COLLECTIVITE" // État, collectivités, leurs établissements administratifs
  | "EPIC" // établissements publics industriels et commerciaux (RATP, SGP…)
  | "BAILLEUR_SOCIAL" // OPH, ESH, SEM de logement social
  | "PRIVE_REGLEMENTE" // organismes privés soumis à la commande publique (entités SNCF, TELT…)
  | "PRIVE" // maître d'ouvrage privé non soumis

export type Montage =
  | "MOE_LOTS_SEPARES"
  | "MOE_ENTREPRISE_GENERALE"
  | "CONCEPTION_REALISATION"
  | "MARCHE_GLOBAL"
  | "MARCHE_PARTENARIAT"
  | "CONCESSION"
  | "MARCHE_PRIVE"

export type Typologie =
  | "BATIMENT"
  | "BATIMENT_ERP"
  | "LOGEMENT"
  | "OUVRAGE_ART"
  | "INFRA_LINEAIRE" // routes, voirie, aménagements
  | "FERROVIAIRE" // ferroviaire, métro, transport guidé
  | "RESEAUX" // eau, assainissement, énergie, télécoms
  | "INDUSTRIEL"

// Rôle confié à Archiaccess sur l'opération.
export type Mission = "AMO" | "CONDUITE_OPERATION" | "OPC" | "AMO_OPC"

export type Acteur =
  | "MOA"
  | "AMO"
  | "MOE"
  | "OPC"
  | "ENTREPRISES"
  | "SPS"
  | "CT"
  | "EXPLOITANT"
  | "TIERS"

// --- Contenu ---------------------------------------------------------------

// Condition d'application d'une variante : chaque axe renseigné doit
// contenir la valeur du projet. Aucun axe renseigné = s'applique partout.
export interface Condition {
  statutMoa?: StatutMoa[]
  montage?: Montage[]
  typologie?: Typologie[]
  mission?: Mission[]
  rehabilitation?: boolean
}

export interface Variante {
  quand: Condition
  texte: string
  // Point que les auteurs ne peuvent pas trancher sans un senior du domaine.
  aPreciser?: boolean
}

// Élément de liste éventuellement propre à certaines missions.
export type Item = string | { texte: string; missions: Mission[] }

export type StatutValidation = "brouillon" | "relu_senior" | "valide"

export interface Etape {
  code: string // "7.4"
  titre: string
  objectif: string
  roles: { acteur: Acteur; role: string }[]
  entrees?: string[]
  livrables: Item[]
  // Ce que l'outil prépare — cible, pas nécessairement construit.
  outil: string[]
  // Ce que l'ingénieur fait lui-même, jamais automatisé.
  humain: string[]
  vigilance: string[]
  variantes: Variante[]
  textes: string[]
  statut: StatutValidation
}

export interface Phase {
  numero: number
  titre: string
  intro: string
  etapes: Etape[]
}

// Caractéristiques d'une opération, telles que saisies dans l'espace projet.
export interface ProfilOperation {
  statutMoa: StatutMoa
  montage: Montage
  typologie: Typologie
  mission: Mission
  rehabilitation: boolean
}
