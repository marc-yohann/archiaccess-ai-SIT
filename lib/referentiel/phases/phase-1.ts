import type { Phase } from "../types"

export const phase1: Phase = {
  numero: 1,
  titre: "Opportunité et faisabilité",
  intro:
    "Avant tout programme, le maître d'ouvrage doit s'assurer que l'opération répond à un besoin réel, qu'elle est réalisable sur le site envisagé et qu'elle est finançable. C'est la phase où l'AMO apporte le plus de valeur à moindre coût : une contrainte de site découverte ici coûte une étude ; découverte en chantier, elle coûte un avenant et des mois. L'outil y mobilise toutes les données publiques déjà agrégées par le SIT.",
  etapes: [
    {
      code: "1.1",
      titre: "Expression du besoin et opportunité",
      objectif: "Formuler le besoin du maître d'ouvrage en termes d'objectifs et d'usages, avant toute solution technique.",
      roles: [
        { acteur: "MOA", role: "Exprime ses objectifs, ses contraintes politiques, budgétaires et de calendrier ; désigne les utilisateurs à consulter." },
        { acteur: "AMO", role: "Anime le recueil du besoin, le formalise, distingue besoins, souhaits et solutions présupposées." },
        { acteur: "EXPLOITANT", role: "Exprime les contraintes d'exploitation et de maintenance dès l'amont." },
      ],
      entrees: ["Orientations du maître d'ouvrage", "Données d'usage existantes (effectifs, fréquentation, trafic)", "Retours d'expérience d'ouvrages comparables"],
      livrables: ["Note d'expression du besoin validée par le maître d'ouvrage", "Liste des parties prenantes et utilisateurs consultés"],
      outil: [
        "Trame d'entretien de recueil du besoin selon la typologie d'ouvrage",
        "Recherche d'opérations comparables dans les marchés publics publiés (objets, montants, acheteurs)",
      ],
      humain: ["Entretiens avec le maître d'ouvrage et les utilisateurs", "Reformulation et hiérarchisation des besoins"],
      vigilance: [
        "Ne pas confondre le besoin (« accueillir 300 élèves ») et une solution (« construire un bâtiment de 3 étages »).",
        "L'acheteur public doit définir ses besoins avec précision avant toute consultation.",
        "Consulter l'exploitant dès maintenant : ses contraintes pèsent sur tout le cycle de vie.",
      ],
      variantes: [
        { quand: { typologie: ["INFRA_LINEAIRE", "FERROVIAIRE"] }, texte: "Besoin exprimé en termes de desserte, de capacité et de niveau de service ; études de trafic ou de fréquentation à prévoir." },
        { quand: { rehabilitation: true }, texte: "Comparer explicitement réhabilitation et construction neuve, y compris en coût global et en impact carbone." },
      ],
      textes: [
        "Code de la commande publique, art. L. 2111-1 (définition préalable des besoins)",
        "Code de la commande publique, art. R. 2111-1 et R. 2111-2 (consultations et études préalables des opérateurs économiques)",
      ],
      statut: "brouillon",
    },
    {
      code: "1.2",
      titre: "Analyse du site et de ses contraintes",
      objectif: "Connaître, avant d'engager des études coûteuses, tout ce que les données publiques disent du site.",
      roles: [
        { acteur: "AMO", role: "Constitue la fiche site, identifie les contraintes rédhibitoires et les études complémentaires nécessaires." },
        { acteur: "MOA", role: "Fournit les données foncières et les études existantes." },
        { acteur: "TIERS", role: "Services de l'État, collectivités et concessionnaires consultés sur leurs contraintes." },
      ],
      entrees: ["Localisation et emprise envisagées", "Études et relevés existants"],
      livrables: ["Fiche site : foncier, urbanisme, servitudes, risques, pollution, réseaux, géologie connue, desserte", "Liste des contraintes rédhibitoires et des études à lancer"],
      outil: [
        "Fiche site pré-remplie depuis les connecteurs du SIT : cadastre, document d'urbanisme, servitudes d'utilité publique, risques naturels et technologiques, cavités, sites et sols pollués, nappes, mutations foncières, réseau de chaleur",
        "Mise en évidence des contraintes à fort impact (zone inondable, pollution connue, servitude, cavité)",
      ],
      humain: ["Visite du site", "Interprétation des données : une absence de donnée n'est pas une absence de risque", "Échanges avec les services instructeurs"],
      vigilance: [
        "Les bases publiques sont incomplètes : elles orientent les études, elles ne les remplacent pas.",
        "Vérifier la date et la source de chaque donnée affichée.",
        "Une servitude ou un périmètre de protection peut conditionner tout le calendrier.",
      ],
      variantes: [
        { quand: { typologie: ["INFRA_LINEAIRE", "FERROVIAIRE", "RESEAUX"] }, texte: "Analyse le long d'un fuseau, pas d'une parcelle : traversées de réseaux, franchissements, emprises à acquérir." },
        { quand: { rehabilitation: true }, texte: "Diagnostics de l'existant : structure, amiante, plomb, état des réseaux intérieurs." },
      ],
      textes: [
        "Code de l'urbanisme (documents d'urbanisme, servitudes d'utilité publique)",
        "Code de l'environnement, art. L. 125-5 (information sur les risques)",
      ],
      statut: "brouillon",
    },
    {
      code: "1.3",
      titre: "Études préalables et faisabilité technique",
      objectif: "Lever les incertitudes techniques majeures avant de figer le programme.",
      roles: [
        { acteur: "AMO", role: "Définit et fait passer les études préalables nécessaires, en analyse les résultats pour le maître d'ouvrage." },
        { acteur: "MOA", role: "Commande les études." },
        { acteur: "TIERS", role: "Géotechnicien, géomètre, diagnostiqueurs, bureaux d'études spécialisés." },
      ],
      livrables: ["Cahiers des charges des études préalables", "Synthèse de faisabilité : scénarios possibles, contraintes, incertitudes restantes"],
      outil: ["Liste des études préalables types selon la typologie et le site", "Suivi des études commandées (délai, coût, rendu)"],
      humain: ["Choix des études réellement utiles", "Analyse critique des rendus"],
      vigilance: [
        "Une étude géotechnique préalable insuffisante est l'une des premières causes de dérive en chantier.",
        "Relevé topographique et repérage des réseaux existants avant toute esquisse.",
      ],
      variantes: [
        { quand: { typologie: ["OUVRAGE_ART"] }, texte: "Études hydrauliques et géotechniques spécifiques ; inspection de l'ouvrage existant en cas de reconstruction.", aPreciser: true },
        { quand: { typologie: ["FERROVIAIRE"] }, texte: "Études d'insertion dans le système existant et d'exploitation pendant les travaux.", aPreciser: true },
      ],
      textes: ["Code de la commande publique, art. R. 2111-1 et R. 2111-2", "Code de l'environnement, art. R. 554-1 et suivants (réseaux existants)"],
      statut: "brouillon",
    },
    {
      code: "1.4",
      titre: "Enveloppe financière prévisionnelle",
      objectif: "Estimer le coût complet de l'opération, pas seulement celui des travaux, et le confronter au financement.",
      roles: [
        { acteur: "AMO", role: "Établit l'estimation par postes et le plan de financement prévisionnel." },
        { acteur: "MOA", role: "Arrête l'enveloppe financière prévisionnelle et assure le financement." },
      ],
      livrables: ["Estimation par postes : foncier, travaux, honoraires et études, assurances, aléas, révisions, frais annexes", "Plan de financement prévisionnel et calendrier des dépenses"],
      outil: [
        "Modèle d'enveloppe par postes, adapté à la typologie",
        "Ratios de coûts issus des opérations clôturées du cabinet (étape 8.7), jamais inventés",
        "Montants d'attributions comparables publiés",
      ],
      humain: ["Choix des hypothèses et des provisions pour aléas", "Explication au maître d'ouvrage des marges d'incertitude"],
      vigilance: [
        "Une enveloppe sans provision pour aléas et révisions de prix sera dépassée.",
        "Raisonner en coût global (investissement, exploitation, maintenance) autant que possible.",
        "L'enveloppe arrêtée devient la référence de tout le suivi financier.",
      ],
      variantes: [
        { quand: { montage: ["MARCHE_PARTENARIAT", "CONCESSION"] }, texte: "Comparer les scénarios de financement : l'évaluation préalable du mode de réalisation est un exercice à part entière." },
        { quand: { statutMoa: ["BAILLEUR_SOCIAL"] }, texte: "Équilibre d'opération à vérifier avec les financements du logement social." },
      ],
      textes: ["Code de la commande publique, art. L. 2421-1 (attributions du maître d'ouvrage)"],
      statut: "brouillon",
    },
    {
      code: "1.5",
      titre: "Évaluation environnementale et procédures préalables",
      objectif: "Identifier très tôt les procédures environnementales qui conditionnent le calendrier.",
      roles: [
        { acteur: "AMO", role: "Identifie les procédures applicables et leur durée ; propose leur intégration au calendrier directeur." },
        { acteur: "MOA", role: "Porte les procédures en tant que responsable du projet." },
        { acteur: "TIERS", role: "Autorité environnementale et services de l'État." },
      ],
      livrables: ["Note des procédures environnementales applicables, avec délais", "Cahier des charges de l'étude d'impact si nécessaire"],
      outil: ["Pré-identification des rubriques potentiellement concernées selon la typologie, la taille et le site", "Calendrier type des procédures"],
      humain: ["Qualification juridique précise, avec les services de l'État si doute"],
      vigilance: [
        "Évaluation systématique ou au cas par cas selon la nature et la taille du projet : ne jamais présumer d'une dispense.",
        "Les inventaires faune-flore dépendent des saisons : un retard de lancement peut coûter une année.",
      ],
      variantes: [
        { quand: { typologie: ["INFRA_LINEAIRE", "FERROVIAIRE", "OUVRAGE_ART", "RESEAUX"] }, texte: "Projets linéaires et ouvrages en site naturel : procédures souvent lourdes (étude d'impact, eau et milieux aquatiques, espèces protégées)." },
      ],
      textes: ["Code de l'environnement, art. L. 122-1 et R. 122-2 (évaluation environnementale)", "Code de l'environnement, art. L. 214-1 et suivants (eau et milieux aquatiques)"],
      statut: "brouillon",
    },
    {
      code: "1.6",
      titre: "Décision de lancement",
      objectif: "Permettre au maître d'ouvrage de décider en connaissance de cause de lancer, adapter ou abandonner l'opération.",
      roles: [
        { acteur: "AMO", role: "Rédige le dossier de décision : besoin, scénarios, faisabilité, coût, risques, calendrier." },
        { acteur: "MOA", role: "Décide ; pour une collectivité, par délibération de son assemblée." },
      ],
      livrables: ["Dossier de décision avec recommandation motivée"],
      outil: ["Dossier pré-assemblé depuis les étapes 1.1 à 1.5", "Registre initial des risques de l'opération"],
      humain: ["Recommandation et présentation au maître d'ouvrage ou à son assemblée"],
      vigilance: ["Abandonner ou différer à ce stade est une issue légitime : l'AMO la présente sans biais."],
      variantes: [
        { quand: { statutMoa: ["ETAT_COLLECTIVITE"] }, texte: "Prévoir le calendrier des instances délibérantes dans le planning." },
      ],
      textes: ["Code de la commande publique, art. L. 2421-1"],
      statut: "brouillon",
    },
  ],
}
