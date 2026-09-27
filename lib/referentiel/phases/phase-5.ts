import type { Phase } from "../types"

export const phase5: Phase = {
  numero: 5,
  titre: "Autorisations",
  intro:
    "Aucune opération ne démarre sans ses autorisations, et leurs délais d'instruction pèsent souvent plus lourd que les études elles-mêmes. Le maître d'ouvrage en est le demandeur ; la maîtrise d'œuvre constitue les dossiers techniques ; l'AMO cartographie les procédures dès l'amont, en surveille les délais et prépare le maître d'ouvrage aux risques de recours.",
  etapes: [
    {
      code: "5.1",
      titre: "Cartographie des autorisations",
      objectif: "Savoir, dès la faisabilité, quelles autorisations sont nécessaires, dans quel ordre et avec quels délais.",
      roles: [
        { acteur: "AMO", role: "Établit la cartographie des autorisations et l'intègre au calendrier directeur." },
        { acteur: "MOE", role: "Confirme les autorisations liées aux choix de conception." },
        { acteur: "MOA", role: "Valide et porte les demandes." },
      ],
      livrables: ["Tableau des autorisations : nature, service instructeur, pièces, délai, dépendances"],
      outil: [
        "Pré-identification depuis les données du site (document d'urbanisme, servitudes, périmètres protégés, zones à risques) et le profil de l'opération",
        "Calendrier des procédures intégré au calendrier directeur",
      ],
      humain: ["Échanges préalables avec les services instructeurs"],
      vigilance: ["Certaines autorisations en conditionnent d'autres : l'ordre compte autant que les délais."],
      variantes: [
        { quand: { typologie: ["INFRA_LINEAIRE", "FERROVIAIRE", "RESEAUX", "OUVRAGE_ART"] }, texte: "Procédures d'utilité publique, d'acquisition foncière et environnementales souvent prépondérantes." },
      ],
      textes: ["Code de l'urbanisme", "Code de l'environnement", "Code du patrimoine"],
      statut: "brouillon",
    },
    {
      code: "5.2",
      titre: "Autorisations d'urbanisme",
      objectif: "Obtenir des autorisations d'urbanisme complètes et sécurisées.",
      roles: [
        { acteur: "MOE", role: "Constitue le dossier." },
        { acteur: "AMO", role: "Vérifie la complétude, suit l'instruction et les demandes de pièces." },
        { acteur: "MOA", role: "Dépose et signe la demande." },
      ],
      livrables: ["Contrôle de complétude du dossier", "Suivi d'instruction"],
      outil: ["Pré-remplissage des formulaires (permis de construire Cerfa 13409, permis de démolir Cerfa 13405)", "Suivi des délais d'instruction et alertes"],
      humain: ["Relation avec le service instructeur"],
      vigilance: [
        "Un dossier incomplet suspend le délai d'instruction.",
        "L'affichage régulier sur le terrain fait courir le délai de recours des tiers : le faire constater.",
      ],
      variantes: [
        { quand: { typologie: ["BATIMENT_ERP"] }, texte: "Autorisation de construire, aménager ou modifier un établissement recevant du public, instruite avec les commissions de sécurité et d'accessibilité." },
      ],
      textes: ["Code de l'urbanisme, art. R. 424-15 et suivants (affichage)", "Code de l'urbanisme, art. R. 600-2 (délai de recours)", "Cerfa 13409, 13405"],
      statut: "brouillon",
    },
    {
      code: "5.3",
      titre: "Autorisations environnementales et patrimoniales",
      objectif: "Obtenir les autorisations environnementales et patrimoniales sans rupture du calendrier.",
      roles: [
        { acteur: "AMO", role: "Pilote la constitution des dossiers avec les bureaux d'études spécialisés, suit l'instruction et l'enquête publique éventuelle." },
        { acteur: "MOA", role: "Porte les demandes." },
        { acteur: "TIERS", role: "Services de l'État, autorité environnementale, service régional de l'archéologie." },
      ],
      livrables: ["Suivi des procédures environnementales et patrimoniales", "Intégration des prescriptions au programme et au dossier de consultation"],
      outil: ["Suivi des procédures et échéances", "Registre des prescriptions à reporter dans les marchés"],
      humain: ["Pilotage des bureaux d'études spécialisés", "Préparation de l'enquête publique"],
      vigilance: [
        "Une prescription d'archéologie préventive peut décaler le démarrage de plusieurs mois.",
        "Les prescriptions des autorisations doivent se retrouver dans les marchés de travaux.",
      ],
      variantes: [
        { quand: { typologie: ["INFRA_LINEAIRE", "FERROVIAIRE", "OUVRAGE_ART", "RESEAUX"] }, texte: "Autorisation environnementale, eau et milieux aquatiques, dérogation espèces protégées : les anticiper dès la faisabilité." },
      ],
      textes: [
        "Code de l'environnement, art. L. 181-1 et suivants (autorisation environnementale)",
        "Code de l'environnement, art. L. 214-1 et suivants (eau et milieux aquatiques)",
        "Code du patrimoine, art. L. 521-1 et suivants (archéologie préventive)",
      ],
      statut: "brouillon",
    },
    {
      code: "5.4",
      titre: "Recours et purge des autorisations",
      objectif: "Ne pas engager de dépenses irréversibles sur une autorisation exposée à un recours sans que le maître d'ouvrage l'ait décidé en connaissance de cause.",
      roles: [
        { acteur: "AMO", role: "Suit les délais de recours, informe le maître d'ouvrage du niveau de risque." },
        { acteur: "MOA", role: "Décide d'attendre la purge ou d'engager les travaux." },
      ],
      livrables: ["Note de situation des autorisations (délivrées, affichées, purgées, contestées)"],
      outil: ["Calcul des dates de purge à partir des dates d'affichage et de délivrance"],
      humain: ["Appréciation du risque de recours", "Recommandation"],
      vigilance: ["Commencer les travaux avant la purge est un choix du maître d'ouvrage, pas une évidence."],
      variantes: [],
      textes: ["Code de l'urbanisme, art. R. 600-2"],
      statut: "brouillon",
    },
  ],
}
