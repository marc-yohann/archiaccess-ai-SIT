import type { Phase } from "../types"

export const phase6: Phase = {
  numero: 6,
  titre: "Consultation des entreprises",
  intro:
    "De la stratégie d'achat à la notification des marchés de travaux. La maîtrise d'œuvre prépare le dossier de consultation et analyse les offres au titre de sa mission d'assistance à la passation des contrats de travaux ; l'AMO sécurise la procédure pour le maître d'ouvrage, contrôle la cohérence du dossier avec le programme et l'enveloppe, et prépare les décisions. Le choix des attributaires appartient au maître d'ouvrage et, lorsqu'elle existe, à sa commission d'appel d'offres.",
  etapes: [
    {
      code: "6.1",
      titre: "Stratégie d'achat et allotissement",
      objectif: "Choisir un découpage en lots et une procédure adaptés à l'ouvrage, au marché local et au calendrier.",
      roles: [
        { acteur: "MOA", role: "Arrête la stratégie d'achat." },
        { acteur: "AMO", role: "Propose l'allotissement, la procédure et le calendrier de consultation ; en expose les risques." },
        { acteur: "MOE", role: "Donne son avis sur le découpage technique." },
        { acteur: "OPC", role: "Évalue l'impact de l'allotissement sur la coordination et les délais." },
      ],
      entrees: ["Programme et estimation du projet", "Calendrier de l'opération", "Contraintes de financement"],
      livrables: ["Note de stratégie d'achat : allotissement, procédure, critères envisagés, calendrier, risques"],
      outil: [
        "Panorama des consultations comparables publiées au BOAMP : nombre de lots, procédure, nombre d'offres reçues, montants attribués",
        "Calcul de la procédure applicable selon les seuils en vigueur",
        "Rétroplanning de consultation depuis la date de démarrage visée",
      ],
      humain: ["Lecture du marché local des entreprises", "Arbitrage entre allotissement fin et facilité de coordination"],
      vigilance: [
        "L'allotissement est la règle en marché public ; y déroger doit être justifié.",
        "Les seuils de procédure évoluent : toujours vérifier les montants en vigueur.",
        "Un calendrier de consultation trop court fait fuir les entreprises et gonfle les prix.",
      ],
      variantes: [
        { quand: { statutMoa: ["ETAT_COLLECTIVITE", "BAILLEUR_SOCIAL"] }, texte: "Au-delà des seuils européens, les candidatures et offres sont examinées par la commission d'appel d'offres : intégrer ses dates de séance au calendrier." },
        { quand: { statutMoa: ["PRIVE"] }, texte: "Consultation libre : l'AMO propose une procédure écrite et traçable, même sans obligation." },
        { quand: { montage: ["CONCEPTION_REALISATION", "MARCHE_GLOBAL"] }, texte: "Marché global : vérifier que les conditions légales de recours sont remplies et documentées." },
      ],
      textes: [
        "Code de la commande publique, art. L. 2113-10 et L. 2113-11 (allotissement)",
        "Code de la commande publique, art. L. 2124-1 et suivants (procédures formalisées)",
        "Avis relatif aux seuils de procédure en vigueur",
      ],
      statut: "brouillon",
    },
    {
      code: "6.2",
      titre: "Constitution du dossier de consultation",
      objectif: "Un dossier complet, cohérent entre ses pièces et fidèle au programme.",
      roles: [
        { acteur: "MOE", role: "Rédige les pièces techniques et financières (CCTP, plans, décompositions de prix)." },
        { acteur: "AMO", role: "Rédige ou vérifie les pièces administratives (règlement de consultation, CCAP) et contrôle la cohérence de l'ensemble." },
        { acteur: "SPS", role: "Fournit le plan général de coordination." },
        { acteur: "OPC", role: "Fournit le calendrier prévisionnel et les exigences de planification à imposer aux entreprises." },
        { acteur: "MOA", role: "Valide le dossier avant lancement." },
      ],
      livrables: ["Rapport de relecture croisée du dossier : incohérences, pièces manquantes, clauses à risque", "Pièces administratives"],
      outil: [
        "Liste de contrôle des pièces attendues selon la procédure et le montage",
        "Comparaison automatique entre pièces : délais, pénalités, montants, intitulés de lots",
        "Modèles de pièces administratives Archiaccess pré-remplis avec les données du projet",
      ],
      humain: ["Rédaction des clauses particulières", "Arbitrage des dérogations au CCAG"],
      vigilance: [
        "Lister explicitement les dérogations au CCAG dans le CCAP.",
        "Ordre de priorité des pièces cohérent avec leur contenu réel.",
        "Délai d'exécution et calendrier compatibles avec les jalons du maître d'ouvrage.",
      ],
      variantes: [
        { quand: { montage: ["CONCEPTION_REALISATION", "MARCHE_GLOBAL"] }, texte: "Le dossier repose sur le programme fonctionnel et non sur un projet : soigner les exigences de performance et les modalités de contrôle." },
      ],
      textes: ["Code de la commande publique, art. R. 2112-1 à R. 2112-6 (contenu du marché)", "CCAG Travaux 2021"],
      statut: "brouillon",
    },
    {
      code: "6.3",
      titre: "Publicité et déroulement de la consultation",
      objectif: "Une consultation régulière, accessible et traçable, où tous les candidats disposent de la même information.",
      roles: [
        { acteur: "MOA", role: "Publie l'avis et met le dossier à disposition sur son profil d'acheteur." },
        { acteur: "AMO", role: "Prépare l'avis, organise les réponses aux questions et les éventuelles modifications du dossier." },
        { acteur: "MOE", role: "Rédige les réponses techniques." },
      ],
      livrables: ["Projet d'avis de publicité", "Registre des questions et réponses diffusées à tous les candidats"],
      outil: ["Pré-remplissage de l'avis depuis les données du projet", "Registre des questions et réponses", "Alerte sur le délai minimal entre une modification du dossier et la date limite"],
      humain: ["Rédaction des réponses", "Décision de reporter la date limite si nécessaire"],
      vigilance: [
        "Une réponse donnée à un candidat doit l'être à tous.",
        "Toute modification substantielle du dossier impose de laisser un délai suffisant, voire de reporter la date limite.",
      ],
      variantes: [
        { quand: { statutMoa: ["PRIVE"] }, texte: "Pas d'obligation de publicité : consultation d'un panel d'entreprises, avec les mêmes règles d'égalité d'information par principe." },
      ],
      textes: ["Code de la commande publique, art. R. 2131-1 et suivants (publicité)", "Code de la commande publique, art. R. 2132-1 et suivants (documents de la consultation)"],
      statut: "brouillon",
    },
    {
      code: "6.4",
      titre: "Analyse des candidatures",
      objectif: "N'admettre que des candidats aptes, sur la base des seuls éléments demandés.",
      roles: [
        { acteur: "AMO", role: "Analyse la recevabilité et les capacités, prépare les demandes de compléments." },
        { acteur: "MOE", role: "Apprécie les capacités techniques et références." },
        { acteur: "MOA", role: "Décide de l'admission des candidatures, le cas échéant avec sa commission d'appel d'offres." },
      ],
      livrables: ["Rapport d'analyse des candidatures"],
      outil: [
        "Extraction des données des lettres de candidature et déclarations (formulaires DC1 et DC2)",
        "Vérifications d'existence et de situation des entreprises depuis les registres publics (répertoire des entreprises, annonces légales de procédures collectives)",
        "Tableau d'analyse pré-rempli",
      ],
      humain: ["Appréciation des références et des moyens", "Proposition de régularisation ou d'élimination"],
      vigilance: [
        "N'exiger que les documents prévus par la liste réglementaire et annoncés dans l'avis.",
        "Une procédure collective en cours ne vaut pas automatiquement exclusion : vérifier la situation exacte.",
      ],
      variantes: [],
      textes: [
        "Code de la commande publique, art. R. 2143-1 à R. 2143-4 (présentation des candidatures)",
        "Arrêté du 22 mars 2019 fixant la liste des renseignements et documents pouvant être demandés aux candidats",
        "Formulaires DAJ DC1, DC2",
      ],
      statut: "brouillon",
    },
    {
      code: "6.5",
      titre: "Analyse des offres",
      objectif: "Classer les offres selon les critères annoncés, et seulement eux, avec une notation traçable.",
      roles: [
        { acteur: "MOE", role: "Analyse technique et financière des offres." },
        { acteur: "AMO", role: "Contrôle la régularité de l'analyse, l'application des critères et la détection des offres anormalement basses." },
        { acteur: "OPC", role: "Analyse les délais et méthodes proposés au regard du calendrier." },
        { acteur: "MOA", role: "Choisit l'offre économiquement la plus avantageuse, le cas échéant avec sa commission d'appel d'offres." },
      ],
      livrables: ["Rapport d'analyse des offres vérifié", "Avis sur les offres anormalement basses et les variantes"],
      outil: [
        "Grille de notation reprenant exactement les critères et pondérations annoncés",
        "Comparaison ligne à ligne des décompositions de prix et écarts à l'estimation",
        "Repères de prix issus des attributions comparables publiées",
      ],
      humain: ["Lecture des mémoires techniques", "Justification écrite de chaque note", "Échanges avec les candidats en cas d'offre anormalement basse"],
      vigilance: [
        "Une offre anormalement basse ne peut être rejetée qu'après demande de justification.",
        "Chaque note doit pouvoir être expliquée à un candidat évincé ou à un juge.",
        "Une erreur matérielle dans une offre se traite selon les règles de la procédure, jamais par correction silencieuse.",
      ],
      variantes: [],
      textes: [
        "Code de la commande publique, art. L. 2152-5 et L. 2152-6 (offres anormalement basses)",
        "Code de la commande publique, art. R. 2152-6 et suivants (critères d'attribution)",
      ],
      statut: "brouillon",
    },
    {
      code: "6.6",
      titre: "Négociation et mise au point",
      objectif: "Améliorer les offres lorsque la procédure le permet, puis finaliser le marché sans en modifier les caractéristiques essentielles.",
      roles: [
        { acteur: "AMO", role: "Prépare la stratégie de négociation et les comptes rendus ; rédige la mise au point." },
        { acteur: "MOE", role: "Mène la partie technique des échanges." },
        { acteur: "MOA", role: "Conduit ou mandate la négociation ; valide la mise au point." },
      ],
      livrables: ["Plan et comptes rendus de négociation", "Projet de mise au point du marché"],
      outil: ["Suivi des points négociés par candidat", "Pré-remplissage de la mise au point"],
      humain: ["Conduite des échanges avec les candidats"],
      vigilance: [
        "Égalité de traitement entre candidats pendant la négociation.",
        "La mise au point ne peut modifier ni les caractéristiques essentielles de l'offre ni les critères de choix.",
      ],
      variantes: [
        { quand: { statutMoa: ["PRIVE"] }, texte: "Négociation libre, mais tracée : le compte rendu protège le maître d'ouvrage en cas de litige." },
      ],
      textes: ["Code de la commande publique (procédures adaptées et procédures avec négociation)"],
      statut: "brouillon",
    },
    {
      code: "6.7",
      titre: "Attribution, information des candidats et notification",
      objectif: "Attribuer régulièrement, informer les candidats évincés, respecter le délai de suspension, puis notifier.",
      roles: [
        { acteur: "AMO", role: "Prépare les courriers d'information, le rapport de présentation et le dossier de notification." },
        { acteur: "MOA", role: "Signe les marchés, informe les candidats, notifie." },
      ],
      livrables: ["Courriers d'information des candidats", "Rapport de présentation de la procédure", "Dossier de notification"],
      outil: [
        "Pré-remplissage des formulaires NOTI1, NOTI3, NOTI5 et de l'acte d'engagement ATTRI1",
        "Calcul de la date de fin du délai de suspension avant signature",
        "Contrôle de la publication des données essentielles du marché",
      ],
      humain: ["Réponse aux demandes de motifs des candidats évincés"],
      vigilance: [
        "En procédure formalisée, respecter le délai minimal entre l'information des évincés et la signature.",
        "Motiver le rejet : un candidat évincé peut demander les caractéristiques et avantages de l'offre retenue.",
      ],
      variantes: [],
      textes: [
        "Code de la commande publique, art. R. 2181-1 et suivants (information des candidats) et R. 2182-1 et suivants (délai de suspension, notification)",
        "Arrêté du 22 décembre 2022 relatif aux données essentielles des marchés publics",
        "Formulaires DAJ NOTI1, NOTI3, NOTI5, ATTRI1",
      ],
      statut: "brouillon",
    },
  ],
}
