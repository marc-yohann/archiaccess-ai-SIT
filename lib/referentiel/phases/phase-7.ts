import type { Phase } from "../types"

export const phase7: Phase = {
  numero: 7,
  titre: "Préparation et pilotage du chantier",
  intro:
    "Cœur de la mission OPC, et phase où l'AMO ou le conducteur d'opération protège le plus directement les intérêts du maître d'ouvrage : délais, coûts, contrat. Elle commence à la notification des marchés de travaux et se termine quand l'ouvrage est prêt pour les opérations préalables à la réception. Pendant toute la phase, la maîtrise d'œuvre dirige l'exécution des marchés et émet les ordres de service ; l'OPC ordonnance, pilote et alerte sans donner d'ordres aux entreprises ; l'AMO assiste le maître d'ouvrage sans diriger les travaux ; le coordonnateur SPS et le contrôleur technique exercent des missions réglementaires auxquelles Archiaccess ne se substitue jamais.",
  etapes: [
    {
      code: "7.1",
      titre: "Prise en main des marchés et revue de contrat",
      objectif: "Savoir exactement qui s'est engagé à quoi, avant le démarrage des travaux.",
      roles: [
        { acteur: "MOA", role: "Transmet les marchés signés et notifiés." },
        { acteur: "AMO", role: "Établit l'organigramme contractuel et relève les clauses sensibles." },
        { acteur: "OPC", role: "Relève délais contractuels, jalons et pénalités de chaque lot." },
        { acteur: "MOE", role: "Confirme les limites de prestations entre lots." },
      ],
      entrees: [
        "Marchés de travaux notifiés (acte d'engagement, CCAP, CCTP, pièces financières)",
        "Marché de maîtrise d'œuvre, marchés de contrôle technique, SPS et OPC",
        "Calendrier issu de la consultation",
      ],
      livrables: [
        "Organigramme contractuel (qui a un contrat avec qui)",
        "Fiche de synthèse par marché : montant, forme du prix, délais, pénalités, avance, retenue de garantie ou caution, révision des prix, sous-traitance déclarée",
        "Liste des incohérences entre pièces et des prestations non attribuées entre lots, avec proposition de traitement au maître d'ouvrage",
      ],
      outil: [
        "Extraction des données clés de chaque marché dans une fiche type",
        "Tableau comparatif des délais et pénalités par lot",
        "Détection des écarts de CCAP d'un lot à l'autre (délais, pénalités, retenue)",
      ],
      humain: [
        "Lecture critique des limites de prestations",
        "Appréciation des risques contractuels",
        "Présentation de la synthèse au maître d'ouvrage",
      ],
      vigilance: [
        "L'ordre de priorité des pièces du marché tranche les contradictions : le relever dès maintenant.",
        "Prestations orphelines à l'interface de deux lots (réservations, raccordements, reprises de support).",
        "Les dérogations au CCAG listées dans le CCAP changent les règles par défaut.",
      ],
      variantes: [
        {
          quand: { montage: ["MOE_ENTREPRISE_GENERALE", "CONCEPTION_REALISATION", "MARCHE_GLOBAL"] },
          texte: "Interface unique côté travaux : vérifier que le titulaire assure réellement ses propres obligations de coordination entre ses sous-traitants.",
        },
        {
          quand: { montage: ["MARCHE_PRIVE"] },
          texte: "Vérifier si le marché se réfère à la norme de marché privé de travaux de bâtiment ; à défaut, seules les clauses du contrat et le Code civil s'appliquent.",
        },
      ],
      textes: [
        "Code de la commande publique, art. R. 2112-1 à R. 2112-6 (contenu du marché)",
        "CCAG Travaux (arrêté du 30 mars 2021, modifié)",
        "Formulaire DAJ NOTI5 (notification du marché)",
      ],
      statut: "brouillon",
    },
    {
      code: "7.2",
      titre: "Période de préparation et vérifications avant démarrage",
      objectif: "Ne démarrer les travaux que lorsque les conditions administratives, de sécurité et d'organisation sont réunies.",
      roles: [
        { acteur: "MOA", role: "Effectue les déclarations qui lui incombent et désigne ses interlocuteurs." },
        { acteur: "MOE", role: "Organise la période de préparation et collecte les documents des entreprises." },
        { acteur: "OPC", role: "Bâtit le calendrier de préparation et suit la remise des documents." },
        { acteur: "ENTREPRISES", role: "Remettent PPSPS, programme d'exécution, installations de chantier, déclarations qui leur incombent." },
        { acteur: "SPS", role: "Établit le plan général de coordination et conduit les inspections communes." },
        { acteur: "AMO", role: "Vérifie la complétude et alerte le maître d'ouvrage." },
      ],
      entrees: [
        "Marchés de travaux",
        "Plan général de coordination SPS",
        "Autorisations d'urbanisme ou environnementales",
        "Plan d'installation de chantier",
      ],
      livrables: [
        "Liste de contrôle « démarrage » renseignée : responsable, date, pièce justificative pour chaque point",
        "Alertes écrites au maître d'ouvrage sur les points bloquants",
      ],
      outil: [
        "Liste de contrôle générée selon le profil de l'opération",
        "Pré-remplissage de la déclaration d'ouverture de chantier (Cerfa 13407), de l'avis d'ouverture de chantier (Cerfa 12276), des déclarations DT-DICT (Cerfa 14434), des demandes d'occupation de voirie et d'arrêté de circulation (Cerfa 14023 et 14024)",
        "Relances automatiques des pièces manquantes",
      ],
      humain: [
        "Visite du site",
        "Appréciation des contraintes riveraines et d'accès",
        "Avis au maître d'ouvrage sur la possibilité de démarrer",
      ],
      vigilance: [
        "Travaux à proximité des réseaux : déclaration de projet par le responsable de projet, déclaration d'intention par l'exécutant, récépissés reçus avant tout terrassement.",
        "Affichage de l'autorisation d'urbanisme et panneau de chantier.",
        "Assurances : attestations décennale et responsabilité civile des entreprises ; dommages-ouvrage souscrite par le maître d'ouvrage lorsqu'elle est obligatoire.",
        "Aucun ordre de service de démarrage avant la fin réelle de la préparation.",
      ],
      variantes: [
        {
          quand: { typologie: ["INFRA_LINEAIRE", "RESEAUX"] },
          texte: "Arrêtés de circulation, phasage sous circulation, coordination avec les concessionnaires de réseaux.",
        },
        {
          quand: { typologie: ["FERROVIAIRE"] },
          texte: "Procédures d'accès aux emprises et de travaux sous exploitation propres au gestionnaire d'infrastructure.",
          aPreciser: true,
        },
        {
          quand: { rehabilitation: true },
          texte: "Phasage avec les occupants, repérage amiante avant travaux, maintien des accès et des services.",
        },
      ],
      textes: [
        "Code de l'environnement, art. L. 554-1 à L. 554-5 et R. 554-1 à R. 554-38 (travaux à proximité des réseaux)",
        "Code des assurances, art. L. 243-1-1",
        "Cerfa 13407, 12276, 14434, 14435, 14023, 14024",
      ],
      statut: "brouillon",
    },
    {
      code: "7.3",
      titre: "Sous-traitance",
      objectif: "Qu'aucun sous-traitant n'intervienne sans être accepté et sans que ses conditions de paiement soient agréées.",
      roles: [
        { acteur: "ENTREPRISES", role: "Le titulaire présente chaque sous-traitant (déclaration DC4)." },
        { acteur: "MOE", role: "Donne son avis technique." },
        { acteur: "AMO", role: "Vérifie la complétude du dossier et les montants." },
        { acteur: "MOA", role: "Accepte le sous-traitant et agrée ses conditions de paiement." },
        { acteur: "OPC", role: "Intègre le sous-traitant au calendrier et aux réunions." },
      ],
      livrables: [
        "Registre des sous-traitants : rang, montant, paiement direct, date d'acceptation",
        "Projet de décision d'acceptation soumis au maître d'ouvrage",
      ],
      outil: [
        "Registre tenu à jour",
        "Contrôle de cohérence des montants sous-traités cumulés par lot",
        "Alerte si une entreprise non déclarée apparaît dans un compte rendu de chantier",
      ],
      humain: ["Appréciation de la capacité du sous-traitant", "Échanges avec le titulaire en cas de refus"],
      vigilance: [
        "Paiement direct des sous-traitants de premier rang au-delà du seuil réglementaire en marché public.",
        "Obligations de vigilance du maître d'ouvrage contre le travail dissimulé.",
        "Sous-traitance de second rang : garantie de paiement ou délégation de paiement.",
      ],
      variantes: [
        {
          quand: { montage: ["MARCHE_PRIVE"] },
          texte: "La loi de 1975 s'applique, mais pas le régime de paiement direct propre au Code de la commande publique.",
        },
      ],
      textes: [
        "Loi n° 75-1334 du 31 décembre 1975 relative à la sous-traitance",
        "Code de la commande publique, art. L. 2193-1 à L. 2193-14 et R. 2193-1 à R. 2193-16",
        "Code du travail, art. L. 8222-1 et R. 8222-1",
        "Formulaire DAJ DC4",
      ],
      statut: "brouillon",
    },
    {
      code: "7.4",
      titre: "Calendrier détaillé d'exécution",
      objectif: "Disposer d'un calendrier partagé, contractualisé et tenu à jour, qui fait apparaître le chemin critique.",
      roles: [
        { acteur: "OPC", role: "Élabore le calendrier à partir des programmes des entreprises, identifie tâches critiques et interfaces, propose les arbitrages." },
        { acteur: "ENTREPRISES", role: "Fournissent durées, cadences et contraintes." },
        { acteur: "MOE", role: "Valide la cohérence technique ; le calendrier est notifié par ordre de service." },
        { acteur: "AMO", role: "Vérifie la compatibilité avec les jalons du maître d'ouvrage (mise en service, financements, déménagements) et alerte." },
        { acteur: "MOA", role: "Arbitre les jalons." },
      ],
      entrees: [
        "Délais contractuels relevés à l'étape 7.1",
        "Contraintes d'exploitation et de site",
        "Calendrier des études d'exécution",
      ],
      livrables: [
        { texte: "Calendrier détaillé, planning des études d'exécution, analyse du chemin critique, versions successives datées", missions: ["OPC", "AMO_OPC"] },
        { texte: "Avis sur le calendrier proposé et liste des risques de délai", missions: ["AMO", "CONDUITE_OPERATION"] },
      ],
      outil: [
        "Import du planning depuis le logiciel de planification utilisé",
        "Comparaison automatique entre versions : glissements, tâches critiques qui changent",
        "Alerte quand un jalon contractuel est menacé",
      ],
      humain: [
        "Construction logique du planning",
        "Négociation des cadences avec les entreprises",
        "Arbitrages proposés au maître d'ouvrage",
      ],
      vigilance: [
        "Un calendrier non notifié est inopposable en cas de litige sur les retards.",
        "Délais de visa des études d'exécution et délais de fabrication ou d'approvisionnement, souvent sous-estimés.",
        "Congés, intempéries, périodes de forte chaleur, périodes d'exploitation interdites.",
      ],
      variantes: [
        {
          quand: { typologie: ["FERROVIAIRE"] },
          texte: "Planification autour des fenêtres de travaux accordées par l'exploitant (nuits, week-ends, interruptions de circulation).",
          aPreciser: true,
        },
        {
          quand: { typologie: ["OUVRAGE_ART"] },
          texte: "Phases de bétonnage, décintrage, mise en tension, épreuves ; dépendances météorologiques.",
          aPreciser: true,
        },
        {
          quand: { montage: ["MOE_LOTS_SEPARES"] },
          texte: "L'OPC est indispensable : c'est lui qui tient les interfaces entre lots.",
        },
        {
          quand: { montage: ["MOE_ENTREPRISE_GENERALE", "CONCEPTION_REALISATION", "MARCHE_GLOBAL"] },
          texte: "Vérifier qui tient le rôle d'ordonnancement chez le titulaire et exiger le calendrier détaillé.",
        },
      ],
      textes: [
        "CCAG Travaux 2021 (période de préparation, calendrier détaillé d'exécution)",
        "Arrêté du 22 mars 2019 (annexe 20 du Code de la commande publique) : élément de mission OPC",
        "Formulaire DAJ EXE1-T (ordre de service)",
      ],
      statut: "brouillon",
    },
    {
      code: "7.5",
      titre: "Études d'exécution, visas et synthèse",
      objectif: "Qu'aucun ouvrage ne soit réalisé sur un plan non visé, et que les interfaces entre lots soient résolues avant exécution.",
      roles: [
        { acteur: "ENTREPRISES", role: "Produisent plans d'exécution et notes de calcul." },
        { acteur: "MOE", role: "Vise, ou réalise les études d'exécution selon sa mission." },
        { acteur: "CT", role: "Donne ses avis." },
        { acteur: "OPC", role: "Pilote le calendrier de production et de visa ; organise la synthèse si elle lui est confiée." },
        { acteur: "AMO", role: "Suit les retards de visa qui menacent le calendrier." },
      ],
      livrables: [
        "Tableau de suivi des documents : émis, visés, refusés, en retard",
        "Alertes sur les documents critiques pour le calendrier",
      ],
      outil: [
        "Registre des documents avec circuit de visa",
        "Relances",
        "Mise en évidence des documents dont le retard touche le chemin critique",
      ],
      humain: ["Analyse technique", "Arbitrage des conflits d'interface en réunion de synthèse"],
      vigilance: [
        "Un visa ne décharge pas l'entreprise de sa responsabilité.",
        "L'AMO ne vise jamais à la place de la maîtrise d'œuvre.",
      ],
      variantes: [
        {
          quand: { montage: ["CONCEPTION_REALISATION", "MARCHE_GLOBAL", "MARCHE_PARTENARIAT"] },
          texte: "Le titulaire produit et vise ses propres études ; l'AMO ou le conducteur d'opération vérifie leur conformité au programme.",
        },
      ],
      textes: ["Arrêté du 22 mars 2019 (annexe 20 du Code de la commande publique) : éléments de mission EXE et VISA"],
      statut: "brouillon",
    },
    {
      code: "7.6",
      titre: "Réunions de chantier et comptes rendus",
      objectif: "Une réunion utile, et un compte rendu qui fait foi : décisions, actions, responsables, échéances.",
      roles: [
        { acteur: "MOE", role: "Préside la réunion de chantier au titre de la direction de l'exécution." },
        { acteur: "OPC", role: "Anime la partie planning et coordination ; rédige le compte rendu si sa mission le prévoit." },
        { acteur: "AMO", role: "Assiste pour le compte du maître d'ouvrage et fait remonter les points à décider." },
        { acteur: "ENTREPRISES", role: "Participent et contestent par écrit dans le délai prévu." },
      ],
      livrables: [
        { texte: "Compte rendu de réunion", missions: ["OPC", "AMO_OPC"] },
        { texte: "Note de synthèse au maître d'ouvrage des points à décider", missions: ["AMO", "CONDUITE_OPERATION", "AMO_OPC"] },
      ],
      outil: [
        "Trame de compte rendu pré-remplie : participants, avancement par lot depuis le calendrier, actions ouvertes reprises automatiquement",
        "Tableau des actions avec relances",
        "Historique consultable par sujet",
      ],
      humain: ["Animation et tenue de la réunion", "Formulation des décisions"],
      vigilance: [
        "Une observation non contestée dans le délai prévu peut être opposée à l'entreprise : diffuser vite et à tous.",
        "Distinguer constat, demande et décision ; seule la maîtrise d'œuvre ou le maître d'ouvrage décide, selon le sujet.",
        "Une modification de prix ou de délai ne s'acte pas en réunion : elle passe par un ordre de service ou un avenant.",
      ],
      variantes: [
        {
          quand: { typologie: ["FERROVIAIRE", "OUVRAGE_ART", "INFRA_LINEAIRE", "INDUSTRIEL"] },
          texte: "Grands chantiers : réunions par secteur ou par corps d'état, réunion de synthèse, comité de pilotage mensuel du maître d'ouvrage.",
        },
      ],
      textes: [
        "CCAG Travaux 2021 (organisation du chantier, ordres de service)",
        "Code du travail, art. L. 4532-15 (collège interentreprises, pour les chantiers concernés)",
      ],
      statut: "brouillon",
    },
    {
      code: "7.7",
      titre: "Suivi d'avancement, retards et mesures correctives",
      objectif: "Détecter tôt les retards, en établir la cause et l'imputabilité, et proposer au maître d'ouvrage des mesures proportionnées.",
      roles: [
        { acteur: "OPC", role: "Mesure l'avancement, analyse les écarts, propose des mesures de rattrapage." },
        { acteur: "MOE", role: "Propose l'application des pénalités ; met en demeure l'entreprise défaillante sur décision du maître d'ouvrage." },
        { acteur: "AMO", role: "Instruit le dossier de retard : faits, imputabilité, options, risques." },
        { acteur: "MOA", role: "Décide des pénalités, mises en demeure et mesures coercitives." },
      ],
      livrables: [
        "Tableau de bord d'avancement",
        "Note d'analyse de retard",
        "Projets de courrier ou de décision soumis au maître d'ouvrage",
      ],
      outil: [
        "Courbe d'avancement prévu / réel",
        "Calcul indicatif des pénalités selon le CCAP, à vérifier par l'ingénieur",
        "Pré-remplissage des formulaires EXE13 (décompte des pénalités) et EXE14 (mise en demeure)",
        "Chronologie des faits reconstituée à partir des comptes rendus",
      ],
      humain: [
        "Analyse de l'imputabilité",
        "Appréciation de l'opportunité d'une mesure coercitive",
        "Échanges avec l'entreprise",
      ],
      vigilance: [
        "Un maître d'ouvrage qui tarde à exercer ses pouvoirs coercitifs face à une entreprise défaillante peut engager sa responsabilité : l'AMO doit l'alerter par écrit.",
        "Distinguer retard imputable à l'entreprise, à un autre lot, à la maîtrise d'œuvre ou au maître d'ouvrage, intempéries et causes extérieures.",
        "Tracer chaque alerte (date, destinataire) : c'est la preuve du devoir de conseil.",
      ],
      variantes: [
        {
          quand: { montage: ["MARCHE_PRIVE"] },
          texte: "Pénalités selon le contrat et la norme éventuellement visée, pas selon le CCAG public.",
        },
      ],
      textes: [
        "CCAG Travaux 2021 (pénalités, mesures coercitives, résiliation)",
        "Formulaires DAJ EXE13, EXE14, EXE15",
      ],
      statut: "brouillon",
    },
    {
      code: "7.8",
      titre: "Modifications, aléas et réclamations",
      objectif: "Qu'aucune modification ne soit exécutée sans base contractuelle, et que le maître d'ouvrage connaisse à tout moment le coût final probable.",
      roles: [
        { acteur: "MOE", role: "Chiffre ou vérifie les devis, propose l'ordre de service ou l'avenant." },
        { acteur: "OPC", role: "Évalue l'impact sur le calendrier." },
        { acteur: "AMO", role: "Vérifie le fondement juridique de la modification et l'impact sur l'enveloppe, présente le dossier au maître d'ouvrage." },
        { acteur: "MOA", role: "Décide et signe." },
      ],
      livrables: [
        "Registre des modifications : origine, montant, délai, statut",
        "Projection du coût final",
        "Rapport de présentation d'avenant",
      ],
      outil: [
        "Registre et projection du coût final",
        "Pré-remplissage des formulaires EXE1-T (ordre de service), EXE10 (avenant) et EXE11 (rapport de présentation)",
        "Alerte quand le cumul des modifications d'un marché approche les limites réglementaires",
      ],
      humain: [
        "Qualification juridique et technique de chaque modification",
        "Négociation",
        "Recommandation au maître d'ouvrage",
      ],
      vigilance: [
        "Des travaux exécutés sans ordre de service sont une source classique de réclamations en fin de chantier.",
        "Sujétions imprévues et circonstances imprévisibles relèvent de régimes distincts : les documenter dès leur apparition.",
        "Respecter et faire respecter les délais de réclamation du CCAG.",
      ],
      variantes: [
        {
          quand: { montage: ["CONCEPTION_REALISATION", "MARCHE_GLOBAL"] },
          texte: "Les modifications de programme demandées par le maître d'ouvrage restent à sa charge ; les aléas de conception sont en principe portés par le titulaire.",
        },
        {
          quand: { montage: ["MARCHE_PARTENARIAT", "CONCESSION"] },
          texte: "Régime de modification propre au contrat : se reporter à ses clauses.",
        },
      ],
      textes: [
        "Code de la commande publique, art. R. 2194-1 à R. 2194-10 (modification des marchés)",
        "CCAG Travaux 2021 (ordres de service, différends et réclamations)",
        "Formulaires DAJ EXE1-T, EXE10, EXE11",
      ],
      statut: "brouillon",
    },
    {
      code: "7.9",
      titre: "Suivi financier du chantier",
      objectif: "Payer juste et à temps, et garder la maîtrise de l'enveloppe.",
      roles: [
        { acteur: "ENTREPRISES", role: "Remettent leurs projets de décompte mensuels." },
        { acteur: "MOE", role: "Vérifie et propose les acomptes." },
        { acteur: "AMO", role: "Contrôle la cohérence avec l'avancement réel et l'enveloppe ; suit les délais de paiement." },
        { acteur: "MOA", role: "Paie." },
      ],
      livrables: [
        "Tableau de suivi financier par marché : engagé, payé, reste à payer, avance, retenues, révisions",
        "Alertes sur les délais de paiement",
      ],
      outil: [
        "Tableau de suivi alimenté par les décomptes",
        "Calcul indicatif de l'avance, de son remboursement et des intérêts moratoires en cas de retard",
        "Échéancier",
      ],
      humain: ["Contrôle de l'avancement réel sur site", "Validation des montants proposés au maître d'ouvrage"],
      vigilance: [
        "Tout dépassement du délai global de paiement d'un acheteur public génère des intérêts moratoires et une indemnité forfaitaire.",
        "Convention de compte prorata signée tôt, gestion suivie.",
        "Garanties : retenue de garantie ou garantie à première demande, caution, cessions de créances.",
      ],
      variantes: [
        {
          quand: { montage: ["MARCHE_PRIVE"] },
          texte: "Garantie de paiement due à l'entrepreneur au-delà du seuil réglementaire (Code civil, art. 1799-1).",
        },
      ],
      textes: [
        "Code de la commande publique, art. R. 2191-7 (avance), R. 2191-20 à R. 2191-22 (acomptes), R. 2191-32 à R. 2191-44 (garanties), R. 2192-31 à R. 2192-36 (intérêts moratoires)",
        "Loi n° 71-584 du 16 juillet 1971 (retenue de garantie)",
        "Code civil, art. 1799-1",
        "Formulaires DAJ NOTI6, NOTI7, NOTI8",
      ],
      statut: "brouillon",
    },
    {
      code: "7.10",
      titre: "Environnement, déchets et interfaces sécurité",
      objectif: "Que les obligations environnementales du chantier soient tenues et que les sujets de sécurité remontent au bon interlocuteur.",
      roles: [
        { acteur: "ENTREPRISES", role: "Gèrent et tracent leurs déchets." },
        { acteur: "SPS", role: "Assure la prévention et la coordination sécurité (mission réglementaire propre)." },
        { acteur: "OPC", role: "Intègre les contraintes de coactivité dans le calendrier." },
        { acteur: "AMO", role: "Vérifie les engagements environnementaux du marché ; fait remonter au maître d'ouvrage les alertes du coordonnateur SPS." },
      ],
      livrables: [
        "Suivi des engagements environnementaux : bordereaux de déchets, taux de valorisation lorsqu'ils sont prévus au marché",
        "Report des alertes SPS au maître d'ouvrage",
      ],
      outil: [
        "Registre des bordereaux de suivi des déchets dangereux (Cerfa 12571)",
        "Suivi des indicateurs environnementaux prévus au marché",
      ],
      humain: ["La sécurité reste au coordonnateur SPS et aux entreprises : l'AMO et l'OPC ne donnent aucune consigne de sécurité à leur place."],
      vigilance: ["Se substituer au coordonnateur SPS est un risque juridique direct."],
      variantes: [],
      textes: [
        "Code de l'environnement, art. D. 541-1, D. 541-2 et R. 541-8 (déchets)",
        "Code du travail (coordination SPS)",
        "Cerfa 12571",
      ],
      statut: "brouillon",
    },
    {
      code: "7.11",
      titre: "Préparation de la réception",
      objectif: "Arriver aux opérations préalables à la réception avec un ouvrage réellement terminé et des dossiers de fin de chantier en cours de constitution.",
      roles: [
        { acteur: "OPC", role: "Planifie essais, pré-réceptions par lot et opérations préalables à la réception." },
        { acteur: "MOE", role: "Organise les opérations préalables (élément de mission AOR)." },
        { acteur: "ENTREPRISES", role: "Réalisent essais et autocontrôles ; constituent les dossiers des ouvrages exécutés." },
        { acteur: "SPS", role: "Constitue le dossier d'intervention ultérieure sur l'ouvrage." },
        { acteur: "AMO", role: "Vérifie l'avancement des dossiers et prépare le maître d'ouvrage à la décision de réception." },
      ],
      livrables: [
        "Planning de fin de chantier",
        "Tableau de collecte des dossiers de fin de chantier : attendus, reçus, conformes",
      ],
      outil: [
        "Liste des documents attendus générée depuis les marchés et le profil de l'opération",
        "Relances",
      ],
      humain: ["Pré-visites", "Appréciation de l'état réel d'achèvement"],
      vigilance: [
        "Ne pas laisser programmer les opérations préalables à la réception sur un ouvrage manifestement inachevé.",
      ],
      variantes: [
        { quand: { typologie: ["BATIMENT_ERP"] }, texte: "Anticiper le passage de la commission de sécurité avant ouverture au public." },
        { quand: { typologie: ["OUVRAGE_ART"] }, texte: "Programmer les épreuves de l'ouvrage.", aPreciser: true },
        { quand: { typologie: ["RESEAUX", "INFRA_LINEAIRE"] }, texte: "Plans de récolement et essais des réseaux." },
        { quand: { typologie: ["FERROVIAIRE"] }, texte: "Procédures d'autorisation de mise en service propres au transport guidé.", aPreciser: true },
      ],
      textes: [
        "Arrêté du 22 mars 2019 (annexe 20 du Code de la commande publique) : élément de mission AOR",
        "Code du travail, art. R. 4532-95 à R. 4532-98 (dossier d'intervention ultérieure sur l'ouvrage)",
      ],
      statut: "brouillon",
    },
  ],
}
