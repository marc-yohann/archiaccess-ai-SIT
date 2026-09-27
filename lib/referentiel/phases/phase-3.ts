import type { Phase } from "../types"

export const phase3: Phase = {
  numero: 3,
  titre: "Désignation des intervenants",
  intro:
    "Maîtrise d'œuvre, contrôleur technique, coordonnateur SPS, OPC, géotechnicien, géomètre : la qualité de l'opération dépend largement de ces choix et de la clarté de leurs missions. L'AMO définit les missions, prépare les consultations et vérifie qu'aucune tâche n'est oubliée ni confiée deux fois.",
  etapes: [
    {
      code: "3.1",
      titre: "Désignation de la maîtrise d'œuvre",
      objectif: "Choisir une équipe de maîtrise d'œuvre adaptée à l'ouvrage, avec une mission et une rémunération clairement définies.",
      roles: [
        { acteur: "AMO", role: "Définit le contenu de la mission, la procédure (concours, procédure avec négociation, procédure adaptée), rédige ou vérifie le dossier, analyse les candidatures et offres." },
        { acteur: "MOA", role: "Choisit la procédure, le lauréat ou l'attributaire ; négocie et signe." },
      ],
      entrees: ["Programme (2.1)", "Enveloppe financière prévisionnelle (1.4)", "Calendrier directeur (2.5)"],
      livrables: ["Dossier de consultation de maîtrise d'œuvre", "Rapport d'analyse", "Projet de marché"],
      outil: [
        "Composition de la mission (éléments de base et complémentaires) selon la typologie et le montage",
        "Repères de taux de rémunération issus des attributions publiées comparables",
      ],
      humain: ["Appréciation des références et de l'équipe", "Participation au jury ou à la négociation"],
      vigilance: [
        "Pour certains ouvrages de bâtiment au-delà des seuils européens, le concours est la règle, sauf exceptions prévues par les textes.",
        "La rémunération est provisoire jusqu'à l'engagement de la maîtrise d'œuvre sur un coût prévisionnel des travaux : le mécanisme doit être écrit dans le marché.",
        "Vérifier la cohérence entre les éléments de mission et ce que feront les autres intervenants (OPC, synthèse, études d'exécution).",
      ],
      variantes: [
        { quand: { montage: ["CONCEPTION_REALISATION", "MARCHE_GLOBAL", "MARCHE_PARTENARIAT"] }, texte: "Pas de marché de maîtrise d'œuvre séparé : la conception est dans le marché global. Désigner en revanche une assistance technique capable de contrôler le titulaire." },
        { quand: { typologie: ["INFRA_LINEAIRE", "OUVRAGE_ART", "FERROVIAIRE", "RESEAUX"] }, texte: "Éléments de mission propres aux infrastructures (études préliminaires, avant-projet, projet…) plutôt que la mission de base du bâtiment." },
        { quand: { statutMoa: ["PRIVE"] }, texte: "Contrat de maîtrise d'œuvre librement négocié ; recours à un architecte obligatoire au-delà des seuils du Code de l'urbanisme pour le permis de construire." },
      ],
      textes: [
        "Code de la commande publique, art. L. 2431-1 à L. 2432-2 et R. 2431-1 à R. 2432-7 (maîtrise d'œuvre privée)",
        "Arrêté du 22 mars 2019 (annexe 20 du Code de la commande publique) : éléments de mission",
        "CCAG Maîtrise d'œuvre (arrêté du 30 mars 2021)",
      ],
      statut: "brouillon",
    },
    {
      code: "3.2",
      titre: "Contrôle technique",
      objectif: "Désigner un contrôleur technique dès la conception, avec les missions adaptées aux risques de l'ouvrage.",
      roles: [
        { acteur: "AMO", role: "Détermine si le contrôle est obligatoire, propose les missions, prépare la consultation." },
        { acteur: "MOA", role: "Désigne le contrôleur technique." },
        { acteur: "CT", role: "Donne ses avis sur la solidité, la sécurité des personnes et les autres missions confiées." },
      ],
      livrables: ["Note de définition des missions de contrôle technique", "Dossier de consultation et analyse"],
      outil: ["Proposition des missions selon la typologie (établissement recevant du public, hauteur, sismicité, fondations)", "Suivi des avis du contrôleur tout au long du projet"],
      humain: ["Choix du périmètre des missions"],
      vigilance: [
        "Désigner le contrôleur avant les études d'avant-projet : un avis tardif coûte des reprises d'études.",
        "Les avis défavorables non levés doivent être suivis jusqu'à leur traitement.",
      ],
      variantes: [
        { quand: { typologie: ["BATIMENT_ERP"] }, texte: "Contrôle technique obligatoire pour les établissements recevant du public des catégories concernées ; mission relative à la sécurité incendie." },
      ],
      textes: ["Code de la construction et de l'habitation (contrôle technique)"],
      statut: "brouillon",
    },
    {
      code: "3.3",
      titre: "Coordination sécurité et protection de la santé",
      objectif: "Désigner le coordonnateur SPS dès la conception, avec l'autorité et les moyens de sa mission.",
      roles: [
        { acteur: "AMO", role: "Vérifie l'obligation, le niveau de l'opération, prépare la consultation et le contrat." },
        { acteur: "MOA", role: "Désigne le coordonnateur et lui donne autorité et moyens." },
        { acteur: "SPS", role: "Intervient dès la conception et pendant les travaux." },
      ],
      livrables: ["Dossier de consultation et analyse", "Rappel au maître d'ouvrage de ses propres obligations en matière de prévention"],
      outil: ["Détermination du niveau de coordination selon l'effectif et la durée prévisibles", "Échéancier des documents SPS attendus"],
      humain: ["Appréciation de l'expérience du coordonnateur sur ce type d'ouvrage"],
      vigilance: [
        "La coordination est obligatoire dès que plusieurs entreprises interviennent sur le chantier.",
        "La mission commence en conception : une désignation tardive prive le projet de ses apports.",
      ],
      variantes: [],
      textes: ["Code du travail, art. L. 4532-1 et suivants (coordination SPS)"],
      statut: "brouillon",
    },
    {
      code: "3.4",
      titre: "Ordonnancement, pilotage et coordination",
      objectif: "Décider qui assure l'OPC et avec quelle mission, en cohérence avec l'allotissement prévu.",
      roles: [
        { acteur: "AMO", role: "Propose de confier l'OPC à la maîtrise d'œuvre ou à un prestataire distinct ; définit la mission." },
        { acteur: "MOA", role: "Décide." },
        { acteur: "OPC", role: "Intervient idéalement dès la fin des études de projet pour préparer le calendrier des travaux." },
      ],
      livrables: ["Note de choix et définition de la mission OPC"],
      outil: ["Définition de mission type, modulée selon le nombre de lots et la complexité"],
      humain: ["Appréciation du besoin réel d'OPC selon l'opération"],
      vigilance: ["Sans OPC sur une opération en lots séparés, personne n'est chargé des interfaces entre entreprises."],
      variantes: [
        { quand: { montage: ["MOE_LOTS_SEPARES"] }, texte: "OPC fortement recommandé." },
        { quand: { montage: ["MOE_ENTREPRISE_GENERALE", "CONCEPTION_REALISATION", "MARCHE_GLOBAL"] }, texte: "L'ordonnancement est en principe assuré par le titulaire ; un OPC côté maître d'ouvrage peut rester utile pour contrôler son calendrier." },
      ],
      textes: ["Arrêté du 22 mars 2019 (annexe 20 du Code de la commande publique) : élément de mission OPC"],
      statut: "brouillon",
    },
    {
      code: "3.5",
      titre: "Autres prestataires et assurances de l'opération",
      objectif: "Qu'aucune compétence nécessaire ne manque et que l'opération soit correctement assurée.",
      roles: [
        { acteur: "AMO", role: "Liste les prestataires nécessaires (géotechnique, géomètre, diagnostics, synthèse, maquette numérique) et les assurances à souscrire." },
        { acteur: "MOA", role: "Désigne les prestataires et souscrit les assurances qui lui incombent." },
      ],
      livrables: ["Tableau des intervenants et de leurs missions (sans trou ni doublon)", "Note sur les assurances de l'opération"],
      outil: ["Matrice des missions par intervenant, détectant tâches non attribuées et doublons"],
      humain: ["Arbitrage des interfaces entre missions"],
      vigilance: ["Assurance dommages-ouvrage obligatoire dans de nombreux cas pour le maître d'ouvrage : vérifier la situation exacte avant l'ouverture du chantier."],
      variantes: [
        { quand: { typologie: ["OUVRAGE_ART", "INFRA_LINEAIRE", "FERROVIAIRE", "RESEAUX"] }, texte: "Régime d'assurance construction à vérifier spécifiquement pour les ouvrages de génie civil.", aPreciser: true },
      ],
      textes: ["Code des assurances, art. L. 241-1 et L. 242-1 (assurances de responsabilité et dommages-ouvrage)"],
      statut: "brouillon",
    },
  ],
}
