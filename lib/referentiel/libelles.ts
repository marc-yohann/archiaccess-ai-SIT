import type { Acteur, Mission, Montage, StatutMoa, StatutValidation, Typologie } from "./types"

export const STATUTS_MOA: Record<StatutMoa, string> = {
  ETAT_COLLECTIVITE: "État, collectivité ou établissement public administratif",
  EPIC: "Établissement public industriel et commercial",
  BAILLEUR_SOCIAL: "Bailleur social (OPH, ESH, SEM)",
  PRIVE_REGLEMENTE: "Organisme privé soumis à la commande publique",
  PRIVE: "Maître d'ouvrage privé",
}

export const MONTAGES: Record<Montage, string> = {
  MOE_LOTS_SEPARES: "Maîtrise d'œuvre + marchés de travaux en lots séparés",
  MOE_ENTREPRISE_GENERALE: "Maîtrise d'œuvre + entreprise générale",
  CONCEPTION_REALISATION: "Conception-réalisation",
  MARCHE_GLOBAL: "Marché global (de performance ou sectoriel)",
  MARCHE_PARTENARIAT: "Marché de partenariat",
  CONCESSION: "Concession",
  MARCHE_PRIVE: "Marché privé de travaux",
}

export const TYPOLOGIES: Record<Typologie, string> = {
  BATIMENT: "Bâtiment (tertiaire, équipement)",
  BATIMENT_ERP: "Établissement recevant du public",
  LOGEMENT: "Logement",
  OUVRAGE_ART: "Ouvrage d'art",
  INFRA_LINEAIRE: "Infrastructure linéaire (route, voirie, aménagement)",
  FERROVIAIRE: "Ferroviaire, métro, transport guidé",
  RESEAUX: "Réseaux (eau, assainissement, énergie, télécoms)",
  INDUSTRIEL: "Industriel",
}

export const MISSIONS: Record<Mission, string> = {
  AMO: "Assistance à maîtrise d'ouvrage",
  CONDUITE_OPERATION: "Conduite d'opération",
  OPC: "Ordonnancement, pilotage, coordination",
  AMO_OPC: "AMO et OPC",
}

export const ACTEURS: Record<Acteur, string> = {
  MOA: "Maître d'ouvrage",
  AMO: "AMO / conducteur d'opération",
  MOE: "Maîtrise d'œuvre",
  OPC: "OPC",
  ENTREPRISES: "Entreprises",
  SPS: "Coordonnateur SPS",
  CT: "Contrôleur technique",
  EXPLOITANT: "Exploitant / gestionnaire",
  TIERS: "Tiers (services, concessionnaires)",
}

export const STATUTS_VALIDATION: Record<StatutValidation, string> = {
  brouillon: "Brouillon",
  relu_senior: "Relu par un senior",
  valide: "Validé",
}
