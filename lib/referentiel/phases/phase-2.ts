import type { Phase } from "../types"

export const phase2: Phase = {
  numero: 2,
  titre: "Programme et stratégie contractuelle",
  intro:
    "Le programme traduit le besoin en objectifs, exigences et contraintes ; le montage contractuel décide qui conçoit, qui réalise, qui pilote et qui porte les risques. Ces deux choix structurent toute la suite de l'opération. Ils appartiennent au maître d'ouvrage ; l'AMO les prépare, en expose les conséquences et les formalise.",
  etapes: [
    {
      code: "2.1",
      titre: "Élaboration du programme",
      objectif: "Un programme qui exprime des objectifs et des exigences mesurables, sans imposer de solution, et qui servira de référence à tous les contrats.",
      roles: [
        { acteur: "AMO", role: "Rédige ou fait rédiger le programme, organise sa validation par les utilisateurs." },
        { acteur: "MOA", role: "Définit et approuve le programme ; il en reste responsable." },
        { acteur: "EXPLOITANT", role: "Valide les exigences d'exploitation et de maintenance." },
      ],
      entrees: ["Note d'expression du besoin (1.1)", "Fiche site et études préalables (1.2, 1.3)", "Enveloppe prévisionnelle (1.4)"],
      livrables: ["Programme : objectifs, exigences fonctionnelles, techniques, environnementales, contraintes de site, de coût et de délai", "Tableau de vérification des exigences, réutilisé à chaque phase d'études"],
      outil: [
        "Trame de programme adaptée à la typologie",
        "Transformation automatique des exigences du programme en liste de contrôle pour la revue des études (phase 4)",
      ],
      humain: ["Arbitrages entre exigences contradictoires", "Validation avec les utilisateurs"],
      vigilance: [
        "Des exigences non mesurables ne pourront pas être vérifiées ni opposées au concepteur.",
        "Un programme évolutif doit avoir été annoncé comme tel dans la consultation de maîtrise d'œuvre.",
        "Toute modification ultérieure du programme a un coût contractuel.",
      ],
      variantes: [
        { quand: { montage: ["CONCEPTION_REALISATION", "MARCHE_GLOBAL", "MARCHE_PARTENARIAT"] }, texte: "Le programme est la seule pièce qui encadre le titulaire : exigences de performance et modalités de vérification encore plus précises." },
        { quand: { rehabilitation: true }, texte: "Programme et enveloppe peuvent se préciser pendant les études d'avant-projet, sous conditions." },
      ],
      textes: [
        "Code de la commande publique, art. L. 2421-1 à L. 2421-4 (programme et enveloppe financière prévisionnelle)",
      ],
      statut: "brouillon",
    },
    {
      code: "2.2",
      titre: "Choix du montage contractuel",
      objectif: "Retenir le montage qui répond le mieux aux objectifs du maître d'ouvrage, dans le respect des conditions légales de chaque formule.",
      roles: [
        { acteur: "AMO", role: "Compare les montages possibles (délais, maîtrise de la qualité, risques, coût, capacités du maître d'ouvrage) et vérifie les conditions de recours." },
        { acteur: "MOA", role: "Choisit le montage." },
      ],
      livrables: ["Note comparative des montages avec recommandation motivée"],
      outil: ["Grille comparative des montages pré-remplie selon le profil de l'opération", "Rappel des conditions légales de recours à chaque marché global"],
      humain: ["Analyse des capacités réelles du maître d'ouvrage à piloter chaque montage", "Recommandation"],
      vigilance: [
        "Les marchés globaux (conception-réalisation, marché global de performance) sont encadrés : conditions de recours à documenter.",
        "Sans maîtrise d'œuvre indépendante, le maître d'ouvrage doit se doter d'une assistance capable de contrôler le titulaire.",
      ],
      variantes: [
        { quand: { statutMoa: ["PRIVE"] }, texte: "Liberté contractuelle : l'enjeu est la répartition des risques et la qualité des contrats, pas la conformité à la commande publique." },
        { quand: { montage: ["MARCHE_PARTENARIAT"] }, texte: "Évaluation préalable du mode de réalisation et avis des organismes compétents à prévoir." },
      ],
      textes: [
        "Code de la commande publique, art. L. 2171-1 à L. 2171-8 (marchés globaux)",
        "Code de la commande publique, art. L. 1112-1 (marché de partenariat)",
      ],
      statut: "brouillon",
    },
    {
      code: "2.3",
      titre: "Organisation de la maîtrise d'ouvrage",
      objectif: "Que chaque décision de l'opération ait un décideur identifié, et que les rôles d'assistance soient clairs.",
      roles: [
        { acteur: "MOA", role: "Désigne son représentant, ses instances de décision, et choisit de recourir ou non à un AMO, un conducteur d'opération ou un mandataire." },
        { acteur: "AMO", role: "Propose l'organisation et la circulation des décisions ; rappelle les limites de chaque rôle." },
      ],
      livrables: ["Organigramme de la maîtrise d'ouvrage et circuit de décision (qui propose, qui valide, qui signe)"],
      outil: ["Organigramme type selon le statut du maître d'ouvrage", "Registre des décisions de l'opération, alimenté tout au long du projet"],
      humain: ["Clarification des délégations avec le maître d'ouvrage"],
      vigilance: [
        "Le maître d'ouvrage ne peut déléguer sa fonction d'intérêt général ; un mandataire agit en son nom mais sous son contrôle.",
        "Assistance, conduite d'opération et mandat sont trois rôles juridiquement distincts : ne pas les confondre dans les contrats.",
      ],
      variantes: [
        { quand: { statutMoa: ["ETAT_COLLECTIVITE", "BAILLEUR_SOCIAL"] }, texte: "Intégrer la commission d'appel d'offres et les instances délibérantes au circuit de décision." },
      ],
      textes: [
        "Code de la commande publique, art. L. 2411-1 (responsabilité du maître d'ouvrage)",
        "Code de la commande publique, art. L. 2422-1 à L. 2422-13 (organisation de la maîtrise d'ouvrage : AMO, conduite d'opération, mandat)",
      ],
      statut: "brouillon",
    },
    {
      code: "2.4",
      titre: "Analyse et répartition des risques",
      objectif: "Identifier les risques de l'opération et décider, pour chacun, qui le porte et comment il est traité.",
      roles: [
        { acteur: "AMO", role: "Établit le registre des risques et propose leur traitement et leur répartition contractuelle." },
        { acteur: "MOA", role: "Arrête la répartition des risques." },
      ],
      livrables: ["Registre des risques : description, probabilité, impact, porteur, traitement, provision"],
      outil: ["Registre pré-rempli des risques types selon la typologie et le site (issus de la fiche site et des études)", "Lien entre chaque risque et la clause contractuelle qui le traite"],
      humain: ["Cotation des risques", "Arbitrage sur la répartition"],
      vigilance: ["Un risque transféré à un titulaire qui ne peut pas le maîtriser se paie dans le prix ou revient en réclamation."],
      variantes: [
        { quand: { montage: ["MARCHE_PARTENARIAT", "CONCESSION"] }, texte: "La répartition des risques est au cœur du contrat : matrice détaillée indispensable." },
      ],
      textes: ["Code de la commande publique (clauses de réexamen et modification des contrats)"],
      statut: "brouillon",
    },
    {
      code: "2.5",
      titre: "Calendrier directeur et plan de financement",
      objectif: "Un calendrier réaliste de l'opération entière, cohérent avec son financement.",
      roles: [
        { acteur: "AMO", role: "Établit le calendrier directeur : procédures, études, autorisations, consultations, travaux, mise en service." },
        { acteur: "OPC", role: "Si déjà désigné, contribue à la cohérence des durées de travaux." },
        { acteur: "MOA", role: "Arrête les jalons et le plan de financement." },
      ],
      livrables: ["Calendrier directeur avec jalons de décision", "Plan de financement et échéancier des dépenses"],
      outil: ["Calendrier directeur type selon la typologie et le montage, avec durées de procédures", "Alerte sur les jalons de financement (dates limites de subventions)"],
      humain: ["Choix des hypothèses de durée", "Arbitrage des jalons avec le maître d'ouvrage"],
      vigilance: ["Les durées de procédures (autorisations, consultations, instances) sont les plus souvent sous-estimées."],
      variantes: [],
      textes: ["Code de la commande publique, art. L. 2421-1"],
      statut: "brouillon",
    },
  ],
}
