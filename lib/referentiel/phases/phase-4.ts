import type { Phase } from "../types"

export const phase4: Phase = {
  numero: 4,
  titre: "Suivi des études de conception",
  intro:
    "Pendant les études, la maîtrise d'œuvre conçoit ; l'AMO vérifie, pour le maître d'ouvrage, que chaque rendu respecte le programme, l'enveloppe et le calendrier, et prépare les décisions d'acceptation. C'est la dernière période où une modification coûte peu : chaque écart détecté ici évite un avenant en chantier.",
  etapes: [
    {
      code: "4.1",
      titre: "Études d'esquisse ou études préliminaires",
      objectif: "Vérifier que les premières propositions répondent au programme et tiennent dans l'enveloppe.",
      roles: [
        { acteur: "MOE", role: "Propose une ou plusieurs solutions d'ensemble et vérifie leur faisabilité." },
        { acteur: "AMO", role: "Analyse le rendu au regard du programme et de l'enveloppe, rédige un avis." },
        { acteur: "MOA", role: "Choisit la solution à développer." },
      ],
      livrables: ["Avis d'analyse du rendu : conformité au programme exigence par exigence, écarts, points à trancher"],
      outil: ["Liste de contrôle issue du tableau des exigences du programme (2.1)", "Suivi des remarques émises et de leur prise en compte au rendu suivant"],
      humain: ["Lecture critique des plans et notices", "Présentation des choix au maître d'ouvrage"],
      vigilance: ["Une exigence du programme abandonnée sans décision explicite du maître d'ouvrage est un défaut de conseil."],
      variantes: [
        { quand: { typologie: ["INFRA_LINEAIRE", "FERROVIAIRE", "RESEAUX", "OUVRAGE_ART"] }, texte: "Études préliminaires : comparaison de tracés ou de variantes d'ouvrage, avec leurs impacts." },
      ],
      textes: ["Arrêté du 22 mars 2019 (annexe 20 du Code de la commande publique) : éléments de mission ESQ et EP"],
      statut: "brouillon",
    },
    {
      code: "4.2",
      titre: "Études d'avant-projet",
      objectif: "Figer les grands choix techniques et obtenir l'engagement de la maîtrise d'œuvre sur un coût prévisionnel des travaux.",
      roles: [
        { acteur: "MOE", role: "Précise la conception, estime le coût, s'engage sur un coût prévisionnel selon son marché." },
        { acteur: "CT", role: "Émet ses premiers avis." },
        { acteur: "AMO", role: "Vérifie conformité au programme, cohérence de l'estimation, prise en compte des avis du contrôleur ; prépare la décision d'acceptation." },
        { acteur: "MOA", role: "Accepte l'avant-projet, avec ou sans réserves." },
      ],
      livrables: ["Avis sur l'avant-projet", "Analyse de l'estimation (écarts à l'enveloppe par poste)", "Projet de décision d'acceptation"],
      outil: ["Comparaison automatique de l'estimation avec l'enveloppe et les ratios du cabinet", "Suivi des avis du contrôleur technique"],
      humain: ["Revue de conception", "Négociation des économies nécessaires"],
      vigilance: [
        "L'engagement sur le coût prévisionnel fixe la rémunération définitive de la maîtrise d'œuvre : le vérifier avec soin.",
        "Les modifications de programme demandées à ce stade donnent lieu à avenant au marché de maîtrise d'œuvre.",
      ],
      variantes: [
        { quand: { typologie: ["BATIMENT", "BATIMENT_ERP", "LOGEMENT"] }, texte: "Avant-projet sommaire puis définitif ; le dossier de permis de construire s'appuie sur l'avant-projet." },
        { quand: { typologie: ["INFRA_LINEAIRE", "FERROVIAIRE", "RESEAUX", "OUVRAGE_ART"] }, texte: "Avant-projet unique ; dossiers d'enquête publique et d'autorisations souvent fondés sur ce niveau d'études." },
      ],
      textes: [
        "Code de la commande publique, art. L. 2432-2 (modifications du programme et rémunération de la maîtrise d'œuvre)",
        "Arrêté du 22 mars 2019 (annexe 20 du Code de la commande publique) : éléments de mission APS, APD, AVP",
      ],
      statut: "brouillon",
    },
    {
      code: "4.3",
      titre: "Études de projet",
      objectif: "Un projet complet, conforme, estimé, prêt à être mis en consultation.",
      roles: [
        { acteur: "MOE", role: "Établit le projet : plans, spécifications, estimation détaillée, calendrier prévisionnel." },
        { acteur: "SPS", role: "Intègre les principes de prévention et prépare le plan général de coordination." },
        { acteur: "OPC", role: "Si désigné, prépare l'ordonnancement des travaux." },
        { acteur: "AMO", role: "Vérifie conformité et cohérence, suit la levée des avis du contrôleur, prépare l'acceptation." },
        { acteur: "MOA", role: "Accepte le projet." },
      ],
      livrables: ["Avis sur le projet et sur la tenue de l'engagement de coût", "Projet de décision d'acceptation"],
      outil: ["Comparaison projet / avant-projet : ce qui a changé et son effet sur le coût", "État des avis du contrôleur non levés"],
      humain: ["Revue de conception finale", "Vérification des limites de prestations entre futurs lots"],
      vigilance: [
        "Un dépassement de l'engagement de coût au stade projet doit être traité avant la consultation, pas après.",
        "Les limites de prestations entre lots se décident ici : c'est la source principale des litiges d'interface en chantier.",
      ],
      variantes: [
        { quand: { montage: ["CONCEPTION_REALISATION", "MARCHE_GLOBAL"] }, texte: "Les études sont réalisées par le titulaire après attribution : l'AMO en contrôle la conformité au programme et aux engagements de l'offre." },
      ],
      textes: ["Arrêté du 22 mars 2019 (annexe 20 du Code de la commande publique) : élément de mission PRO"],
      statut: "brouillon",
    },
    {
      code: "4.4",
      titre: "Maîtrise des coûts et du calendrier des études",
      objectif: "Tenir l'enveloppe et le calendrier à chaque rendu, et alerter tôt.",
      roles: [
        { acteur: "AMO", role: "Tient le tableau de bord coûts et délais des études ; alerte le maître d'ouvrage." },
        { acteur: "MOE", role: "Justifie les écarts et propose des mesures." },
        { acteur: "MOA", role: "Arbitre." },
      ],
      livrables: ["Tableau de bord coûts / délais des études", "Notes d'alerte"],
      outil: ["Suivi automatique des rendus attendus et de leurs délais contractuels", "Évolution de l'estimation d'un rendu à l'autre"],
      humain: ["Analyse des causes d'écart", "Proposition d'économies ou de réaffectation"],
      vigilance: ["Les pénalités de retard de la maîtrise d'œuvre se décomptent sur les délais de rendu contractuels : les tracer."],
      variantes: [],
      textes: ["CCAG Maîtrise d'œuvre (délais, pénalités, réception des prestations)"],
      statut: "brouillon",
    },
  ],
}
