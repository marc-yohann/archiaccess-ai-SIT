import type { Phase } from "../types"

export const phase9: Phase = {
  numero: 9,
  titre: "Exploitation et maintenance",
  intro:
    "L'ouvrage livré doit être exploité, entretenu et évalué pendant toute sa durée de vie. L'AMO peut accompagner le maître d'ouvrage dans la prise en main de l'ouvrage, le choix et la mise en place des contrats d'exploitation, puis l'évaluation de son fonctionnement réel au regard des objectifs du programme.",
  etapes: [
    {
      code: "9.1",
      titre: "Mise en exploitation",
      objectif: "Une prise en main de l'ouvrage sans rupture : équipements réglés, exploitants formés, documentation disponible.",
      roles: [
        { acteur: "EXPLOITANT", role: "Prend en charge l'ouvrage, suit les formations." },
        { acteur: "ENTREPRISES", role: "Forment les exploitants et assurent les réglages de la première période." },
        { acteur: "AMO", role: "Organise la passation et suit la levée des dysfonctionnements de démarrage." },
        { acteur: "MOA", role: "Remet l'ouvrage à son gestionnaire." },
      ],
      livrables: ["Plan de mise en exploitation", "Suivi des dysfonctionnements de démarrage"],
      outil: ["Plan de mise en exploitation pré-rempli depuis les lots et équipements", "Registre des dysfonctionnements rattaché aux garanties (8.6)"],
      humain: ["Accompagnement des exploitants sur site"],
      vigilance: ["Distinguer défaut d'usage, défaut de réglage et désordre relevant d'une garantie."],
      variantes: [
        { quand: { typologie: ["BATIMENT", "BATIMENT_ERP", "LOGEMENT"] }, texte: "Mise au point des installations techniques pendant la première année de fonctionnement, saison par saison." },
      ],
      textes: ["Code civil, art. 1792-3 et 1792-6"],
      statut: "brouillon",
    },
    {
      code: "9.2",
      titre: "Contrats d'exploitation et de maintenance",
      objectif: "Choisir un mode d'exploitation et des contrats adaptés, avec des engagements mesurables.",
      roles: [
        { acteur: "AMO", role: "Compare les modes de gestion, rédige ou vérifie les cahiers des charges, analyse les offres." },
        { acteur: "MOA", role: "Choisit le mode de gestion et attribue les contrats." },
      ],
      livrables: ["Note comparative des modes de gestion", "Dossier de consultation et analyse des offres"],
      outil: ["Inventaire des équipements à maintenir depuis les dossiers des ouvrages exécutés", "Repères de prix issus des contrats comparables publiés"],
      humain: ["Définition des niveaux de service", "Recommandation"],
      vigilance: ["Des niveaux de service non mesurables ne peuvent pas être contrôlés ni pénalisés."],
      variantes: [
        { quand: { montage: ["MARCHE_GLOBAL", "MARCHE_PARTENARIAT", "CONCESSION"] }, texte: "L'exploitation-maintenance est déjà dans le contrat : l'enjeu devient le contrôle des engagements de performance." },
      ],
      textes: ["Code de la commande publique (marchés de services, concessions)"],
      statut: "brouillon",
    },
    {
      code: "9.3",
      titre: "Suivi des performances",
      objectif: "Vérifier que l'ouvrage atteint en fonctionnement réel les performances visées, notamment énergétiques.",
      roles: [
        { acteur: "EXPLOITANT", role: "Relève les consommations et indicateurs." },
        { acteur: "AMO", role: "Analyse les écarts aux objectifs et propose des actions correctives." },
        { acteur: "MOA", role: "Décide des actions." },
      ],
      livrables: ["Bilans de performance périodiques"],
      outil: ["Tableau de bord des indicateurs de performance", "Rappel des obligations réglementaires de réduction des consommations applicables au bâtiment"],
      humain: ["Analyse des causes d'écart"],
      vigilance: ["Les bâtiments tertiaires au-delà d'un seuil de surface sont soumis à des obligations de réduction de consommation d'énergie."],
      variantes: [
        { quand: { typologie: ["BATIMENT", "BATIMENT_ERP", "INDUSTRIEL"] }, texte: "Déclaration annuelle des consommations des bâtiments tertiaires assujettis." },
      ],
      textes: ["Code de la construction et de l'habitation, art. L. 174-1 (réduction des consommations d'énergie des bâtiments tertiaires)"],
      statut: "brouillon",
    },
    {
      code: "9.4",
      titre: "Évaluation de l'ouvrage en usage",
      objectif: "Mesurer, après une période de fonctionnement, si l'ouvrage répond au besoin initial, et en tirer des enseignements.",
      roles: [
        { acteur: "AMO", role: "Conduit l'évaluation auprès des utilisateurs et de l'exploitant." },
        { acteur: "MOA", role: "Reçoit l'évaluation et décide des suites." },
      ],
      livrables: ["Rapport d'évaluation en usage", "Enseignements reportés dans la mémoire du cabinet"],
      outil: ["Comparaison automatique entre objectifs du programme (2.1) et indicateurs mesurés", "Rattachement des enseignements aux opérations futures de même typologie"],
      humain: ["Entretiens avec les utilisateurs", "Analyse et recommandations"],
      vigilance: ["Anonymiser ce qui doit l'être avant réutilisation interne."],
      variantes: [],
      textes: [],
      statut: "brouillon",
    },
  ],
}
