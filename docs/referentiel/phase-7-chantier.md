# Phase 7 — Préparation et pilotage du chantier

**Statut de la phase : brouillon v0 — à relire par un senior.**

Cœur de la mission OPC, et phase où l'AMO / conducteur d'opération protège
le plus directement les intérêts du maître d'ouvrage : délais, coûts,
contrat. Elle commence à la notification des marchés de travaux et se
termine quand l'ouvrage est prêt pour les opérations préalables à la
réception (phase 8).

Rappel des rôles pendant le chantier :

- **Maître d'ouvrage (MOA)** : décide, signe, paie.
- **Maîtrise d'œuvre (MOE)** : dirige l'exécution des marchés de travaux
  (élément de mission DET), émet les ordres de service, vise les études
  d'exécution, propose les décomptes.
- **OPC** : ordonnance les tâches des entreprises, pilote le calendrier,
  coordonne les interfaces. Peut être une mission de la MOE ou un marché
  séparé passé par le MOA. L'OPC propose et alerte ; il ne donne pas
  d'ordres aux entreprises en dehors des ordres de service de la MOE.
- **AMO / conducteur d'opération** : assiste le MOA, instruit ses
  décisions, vérifie que la MOE et les entreprises tiennent leurs
  engagements. Ne dirige pas les travaux.
- **Coordonnateur SPS**, **contrôleur technique** : missions propres,
  réglementaires ; Archiaccess ne s'y substitue jamais.

---

## 7.1 Prise en main des marchés et revue de contrat

**Objectif** — Savoir exactement qui s'est engagé à quoi, avant le premier
coup de pioche.

**Qui fait quoi**
- MOA : transmet les marchés signés et notifiés.
- AMO : établit l'organigramme contractuel, relève les clauses sensibles.
- OPC : relève les délais contractuels, jalons et pénalités de chaque lot.
- MOE : confirme les limites de prestations entre lots.

**Entrées** — marchés notifiés (acte d'engagement, CCAP, CCTP, pièces
financières), marché de MOE, marchés CT / SPS / OPC, planning de
consultation.

**Livrables Archiaccess**
- Organigramme contractuel (qui a un contrat avec qui).
- Fiche de synthèse par marché : montant, forme du prix, délais, pénalités,
  avance, retenue de garantie ou caution, révision des prix, sous-traitance
  déclarée.
- Liste des incohérences entre pièces et des « trous » entre lots, remise
  au MOA avec une proposition de traitement.

**Ce que l'outil prépare** *(cible)* — extraction des données clés de
chaque marché dans une fiche type ; tableau comparatif des délais et
pénalités par lot ; détection des écarts entre CCAP (délai, pénalités,
retenue) d'un lot à l'autre.

**Ce que l'ingénieur fait lui-même** — lecture critique des limites de
prestations ; appréciation des risques ; présentation au MOA.

**Points de vigilance**
- Ordre de priorité des pièces du marché : c'est lui qui tranche en cas de
  contradiction — le relever dès maintenant.
- Prestations « orphelines » à l'interface de deux lots (réservations,
  raccordements, reprises de support…).
- Dérogations au CCAG listées dans le CCAP : elles changent les règles
  par défaut.

**Variantes**
- Entreprise générale ou conception-réalisation : interface unique, mais
  l'AMO doit vérifier que le titulaire tient ses propres engagements de
  coordination.
- Marché privé : vérifier la référence ou non à la norme NF P 03-001.

**Textes et formulaires publics** — CCP, art. R. 2112-1 à R. 2112-6
(contenu du marché) ; CCAG Travaux 2021 (arrêté du 30 mars 2021, modifié) ;
formulaire NOTI5 (notification).

**Statut** — brouillon.

---

## 7.2 Période de préparation et vérifications avant démarrage

**Objectif** — Ne démarrer les travaux que lorsque les conditions
administratives, de sécurité et d'organisation sont réunies.

**Qui fait quoi**
- MOA : déclarations qui lui incombent, désignation des interlocuteurs.
- MOE : organise la période de préparation, collecte les documents des
  entreprises.
- OPC : bâtit le calendrier de préparation, suit la remise des documents.
- Entreprises : PPSPS, programme d'exécution, installations de chantier,
  déclarations qui leur incombent.
- Coordonnateur SPS : PGC-SPS, inspections communes.
- AMO : vérifie la complétude et alerte le MOA.

**Entrées** — marchés, PGC-SPS, autorisations d'urbanisme ou
environnementales, plan d'installation de chantier.

**Livrables Archiaccess** — liste de contrôle « démarrage » renseignée,
avec pour chaque point : responsable, date, pièce justificative ;
alertes au MOA sur les points bloquants.

**Ce que l'outil prépare** *(cible)*
- Liste de contrôle générée selon les trois axes de l'opération.
- Pré-remplissage des imprimés : déclaration d'ouverture de chantier
  (Cerfa 13407), avis d'ouverture de chantier (Cerfa 12276), déclarations
  DT-DICT (Cerfa 14434), demandes d'occupation de voirie et d'arrêté de
  circulation (Cerfa 14023 et 14024).
- Relances automatiques des pièces manquantes.

**Ce que l'ingénieur fait lui-même** — visite du site ; appréciation des
contraintes riveraines et d'accès ; validation que le chantier peut
démarrer, sous forme d'avis au MOA.

**Points de vigilance**
- Travaux à proximité des réseaux : DT par le responsable de projet, DICT
  par l'exécutant, récépissés reçus avant tout terrassement.
- Affichage de l'autorisation d'urbanisme et panneau de chantier.
- Assurances : attestations des entreprises (décennale, RC) et
  souscription de la dommages-ouvrage par le MOA lorsqu'elle est
  obligatoire.
- Ne pas laisser un ordre de service de démarrage partir avant la fin
  réelle de la préparation.

**Variantes**
- Infrastructure linéaire et voirie : arrêtés de circulation, phasage sous
  circulation, coordination avec les concessionnaires de réseaux.
- Ferroviaire : procédures d'accès aux emprises et de travaux sous
  exploitation propres au gestionnaire d'infrastructure — *à définir avec
  un senior ferroviaire.*
- Réhabilitation en site occupé : phasage avec les occupants, repérage
  amiante avant travaux.

**Textes et formulaires publics** — Code de l'environnement, art.
L. 554-1 à L. 554-5 et R. 554-1 à R. 554-38 (travaux à proximité des
réseaux) ; Code des assurances, art. L. 243-1-1 ; Cerfa 13407, 12276,
14434, 14435, 14023, 14024.

**Statut** — brouillon.

---

## 7.3 Sous-traitance

**Objectif** — Qu'aucun sous-traitant n'intervienne sans être accepté et
sans que ses conditions de paiement soient agréées.

**Qui fait quoi**
- Entreprise titulaire : présente chaque sous-traitant (déclaration DC4).
- MOE : donne son avis technique.
- AMO : vérifie la complétude du dossier et les montants.
- MOA : accepte le sous-traitant et agrée ses conditions de paiement.
- OPC : intègre le sous-traitant dans le calendrier et les réunions.

**Livrables Archiaccess** — registre des sous-traitants (rang, montant,
paiement direct oui/non, date d'acceptation) ; projet de décision
d'acceptation soumis au MOA.

**Ce que l'outil prépare** *(cible)* — registre tenu à jour ; contrôle de
cohérence (montants cumulés sous-traités par lot) ; alerte si une entreprise
non déclarée apparaît dans un compte rendu de chantier.

**Ce que l'ingénieur fait lui-même** — appréciation de la capacité du
sous-traitant ; échanges avec le titulaire en cas de refus.

**Points de vigilance**
- Paiement direct des sous-traitants de premier rang au-delà du seuil
  réglementaire en marché public.
- Obligations de vigilance du MOA contre le travail dissimulé.
- Sous-traitance de rang 2 : garantie de paiement ou délégation de
  paiement.

**Variantes** — Marché privé : loi de 1975 applicable, mais pas le régime
du paiement direct propre au CCP.

**Textes et formulaires publics** — Loi n° 75-1334 du 31 décembre 1975 ;
CCP, art. L. 2193-1 à L. 2193-14 et R. 2193-1 à R. 2193-16 ; Code du
travail, art. L. 8222-1 et R. 8222-1 ; formulaire DC4.

**Statut** — brouillon.

---

## 7.4 Calendrier détaillé d'exécution

**Objectif** — Disposer d'un calendrier partagé, contractualisé et tenu à
jour, qui fait apparaître le chemin critique.

**Qui fait quoi**
- OPC : élabore le calendrier détaillé à partir des programmes des
  entreprises ; identifie tâches critiques et interfaces ; propose les
  arbitrages.
- Entreprises : fournissent leurs durées, cadences, contraintes.
- MOE : valide la cohérence technique ; le calendrier est notifié par
  ordre de service.
- AMO : vérifie la compatibilité avec les jalons du MOA (mise en service,
  financements, déménagements) et alerte.
- MOA : arbitre les jalons.

**Entrées** — délais contractuels (7.1), calendrier de consultation,
contraintes d'exploitation ou de site, calendrier des études d'exécution.

**Livrables Archiaccess**
- En mission OPC : calendrier détaillé, planning des études d'exécution,
  analyse du chemin critique, versions successives datées.
- En mission AMO : avis sur le calendrier proposé, liste des risques
  délais.

**Ce que l'outil prépare** *(cible)* — import du planning (format
d'échange du logiciel de planification utilisé) ; comparaison automatique
entre versions (glissements, tâches critiques qui changent) ; alertes
quand un jalon contractuel est menacé.

**Ce que l'ingénieur fait lui-même** — construction logique du planning,
négociation des cadences avec les entreprises, arbitrages proposés au MOA.

**Points de vigilance**
- Un calendrier non notifié ne sert à rien en cas de litige sur les
  retards.
- Intégrer les délais de visa des études d'exécution et de
  fabrication / approvisionnement, souvent sous-estimés.
- Congés, intempéries, périodes interdites (fortes chaleurs, hiver pour
  certains travaux, périodes d'exploitation).

**Variantes**
- Ferroviaire / transport en exploitation : planification autour des
  fenêtres de travaux (interceptions, nuits, week-ends) — *à préciser.*
- Ouvrage d'art : phases de coulage, décintrage, épreuves, dépendances
  météo.
- Lots séparés : l'OPC est indispensable ; entreprise générale : vérifier
  qui tient ce rôle.

**Textes et formulaires publics** — CCAG Travaux 2021 (préparation,
calendrier détaillé d'exécution) ; arrêté du 22 mars 2019 (annexe 20 du
CCP) pour l'élément de mission OPC confié à la MOE ; formulaire EXE1-T
(ordre de service).

**Statut** — brouillon.

---

## 7.5 Études d'exécution, visas et synthèse

**Objectif** — Qu'aucun ouvrage ne soit réalisé sur un plan non visé, et
que les interfaces entre lots soient résolues avant exécution.

**Qui fait quoi**
- Entreprises : produisent les plans d'exécution et notes de calcul.
- MOE : vise (ou réalise les études d'exécution selon sa mission).
- Contrôleur technique : donne ses avis.
- OPC : pilote le calendrier de production et de visa ; organise la
  synthèse si elle lui est confiée.
- AMO : suit les retards de visa qui menacent le calendrier.

**Livrables Archiaccess** — tableau de suivi des documents (émis, visés,
refusés, en retard) ; alertes sur les documents critiques pour le
calendrier.

**Ce que l'outil prépare** *(cible)* — registre des documents avec
circuit de visa ; relances ; mise en évidence des documents dont le retard
touche le chemin critique.

**Ce que l'ingénieur fait lui-même** — analyse technique ; arbitrage des
conflits d'interface en réunion de synthèse.

**Points de vigilance** — Un visa n'est pas une approbation qui décharge
l'entreprise de sa responsabilité ; ne jamais laisser l'AMO « viser » à la
place de la MOE.

**Variantes** — Conception-réalisation : le titulaire produit et vise ;
l'AMO / conducteur d'opération vérifie la conformité au programme.

**Textes et formulaires publics** — Arrêté du 22 mars 2019 (annexe 20 du
CCP) : éléments de mission EXE et VISA.

**Statut** — brouillon.

---

## 7.6 Réunions de chantier et comptes rendus

**Objectif** — Une réunion hebdomadaire utile, et un compte rendu qui
fait foi : décisions, actions, responsables, échéances.

**Qui fait quoi**
- MOE : préside la réunion de chantier (direction de l'exécution).
- OPC : anime la partie planning et coordination ; peut rédiger le
  compte rendu selon sa mission.
- AMO : assiste pour le compte du MOA, fait remonter les points à décider.
- Entreprises : présentes, contestent par écrit dans le délai prévu.

**Livrables Archiaccess** — compte rendu (en mission OPC) ; note de
synthèse au MOA des points à décider (en mission AMO).

**Ce que l'outil prépare** *(cible)* — trame de compte rendu pré-remplie
(participants, avancement par lot depuis le calendrier, actions ouvertes
reprises automatiquement) ; tableau des actions avec relances ; historique
consultable par sujet.

**Ce que l'ingénieur fait lui-même** — animation, prise de parole,
tenue de la réunion, formulation des décisions.

**Points de vigilance**
- Une observation non contestée dans le délai prévu peut être opposée à
  l'entreprise : diffuser vite et à tous.
- Distinguer clairement constat, demande et décision (seule la MOE ou le
  MOA décide, selon le sujet).
- Ne pas acter en réunion une modification de prix ou de délai : elle
  passe par un ordre de service ou un avenant.

**Variantes** — Grands projets : réunions par secteur ou par corps d'état,
réunion de synthèse, comité de pilotage MOA mensuel.

**Textes et formulaires publics** — CCAG Travaux 2021 (organisation du
chantier, ordres de service) ; Code du travail, art. L. 4532-15 (CISSCT,
pour les chantiers concernés).

**Statut** — brouillon.

---

## 7.7 Suivi d'avancement, retards et mesures correctives

**Objectif** — Détecter tôt les retards, en identifier la cause et
l'imputabilité, et proposer au MOA des mesures proportionnées.

**Qui fait quoi**
- OPC : mesure l'avancement, analyse les écarts, propose des mesures de
  rattrapage.
- MOE : met en demeure l'entreprise défaillante si nécessaire (sur
  décision du MOA), propose l'application des pénalités.
- AMO : instruit le dossier de retard pour le MOA (faits, imputabilité,
  options, risques).
- MOA : décide des pénalités, mises en demeure, mesures coercitives.

**Livrables Archiaccess** — tableau de bord d'avancement ; note
d'analyse de retard ; projets de courrier ou de décision soumis au MOA.

**Ce que l'outil prépare** *(cible)* — courbe d'avancement prévu / réel ;
calcul indicatif des pénalités selon le CCAP (à vérifier par l'ingénieur) ;
pré-remplissage des formulaires EXE13 (décompte des pénalités) et EXE14
(mise en demeure) ; chronologie des faits reconstituée à partir des
comptes rendus.

**Ce que l'ingénieur fait lui-même** — analyse de l'imputabilité ;
appréciation de l'opportunité d'une mesure coercitive ; échanges avec
l'entreprise.

**Points de vigilance**
- Un MOA qui tarde à exercer ses pouvoirs coercitifs face à une entreprise
  défaillante peut engager sa responsabilité : l'AMO doit alerter par écrit.
- Pénalités : distinguer retard imputable à l'entreprise, retard imputable
  à un autre lot, à la MOE ou au MOA, intempéries et causes extérieures.
- Tracer chaque alerte (date, destinataire) : c'est la preuve du devoir de
  conseil.

**Variantes** — Marché privé : pénalités selon le contrat et la norme de
référence, pas selon le CCAG public.

**Textes et formulaires publics** — CCAG Travaux 2021 (pénalités,
mesures coercitives, résiliation) ; formulaires EXE13, EXE14, EXE15.

**Statut** — brouillon.

---

## 7.8 Modifications, aléas et réclamations

**Objectif** — Qu'aucune modification ne soit exécutée sans base
contractuelle, et que le MOA connaisse à tout moment le coût final
probable de l'opération.

**Qui fait quoi**
- MOE : chiffre ou vérifie les devis, propose l'ordre de service ou
  l'avenant.
- OPC : évalue l'impact sur le calendrier.
- AMO : vérifie le fondement juridique de la modification (cas de
  modification autorisés), l'impact sur l'enveloppe, et présente le
  dossier au MOA.
- MOA : décide et signe.

**Livrables Archiaccess** — registre des modifications (origine, montant,
délai, statut) ; projection du coût final ; rapport de présentation
d'avenant.

**Ce que l'outil prépare** *(cible)* — registre et projection du coût
final ; pré-remplissage des formulaires EXE1-T (ordre de service), EXE10
(avenant) et EXE11 (rapport de présentation) ; alerte quand le cumul des
modifications d'un marché approche les limites réglementaires.

**Ce que l'ingénieur fait lui-même** — qualification juridique et
technique de chaque modification ; négociation ; recommandation au MOA.

**Points de vigilance**
- Travaux réalisés sans ordre de service : source classique de
  réclamations en fin de chantier.
- Sujétions imprévues et circonstances imprévisibles : régimes distincts,
  à documenter dès leur apparition.
- Mémoire en réclamation : respecter et faire respecter les délais du
  CCAG.

**Variantes**
- Conception-réalisation / marché global : les modifications de programme
  demandées par le MOA restent à sa charge ; les aléas de conception sont
  en principe portés par le titulaire.
- Marchés de partenariat / concession : régime propre au contrat.

**Textes et formulaires publics** — CCP, art. R. 2194-1 à R. 2194-10
(modification des marchés) ; CCAG Travaux 2021 (ordres de service,
différends et réclamations) ; formulaires EXE1-T, EXE10, EXE11.

**Statut** — brouillon.

---

## 7.9 Suivi financier du chantier

**Objectif** — Payer juste et à temps : ni trop tôt, ni en retard
(intérêts moratoires), et garder la maîtrise de l'enveloppe.

**Qui fait quoi**
- Entreprises : projets de décompte mensuels.
- MOE : vérifie et propose les acomptes.
- AMO : contrôle la cohérence avec l'avancement réel et l'enveloppe ;
  suit les délais de paiement.
- MOA : paie.

**Livrables Archiaccess** — tableau de suivi financier par marché
(engagé, payé, reste à payer, avance, retenues, révisions) ; alerte sur
les délais de paiement.

**Ce que l'outil prépare** *(cible)* — tableau de suivi alimenté par les
décomptes ; calcul indicatif de l'avance, du remboursement de l'avance et
des intérêts moratoires en cas de retard de paiement ; échéancier.

**Ce que l'ingénieur fait lui-même** — contrôle de l'avancement réel sur
site ; validation des montants proposés au MOA.

**Points de vigilance**
- Délai global de paiement du MOA public : tout retard génère des intérêts
  moratoires et une indemnité forfaitaire.
- Compte prorata : convention signée tôt, gestion suivie.
- Garanties : retenue de garantie ou garantie à première demande / caution
  personnelle et solidaire, cessions de créances.
- Marché privé : garantie de paiement due à l'entrepreneur au-delà du
  seuil réglementaire.

**Textes et formulaires publics** — CCP, art. R. 2191-7 (avance),
R. 2191-20 à R. 2191-22 (acomptes), R. 2191-32 à R. 2191-44 (garanties),
R. 2192-31 à R. 2192-36 (intérêts moratoires) ; loi n° 71-584 du 16 juillet
1971 (retenue de garantie) ; Code civil, art. 1799-1 (garantie de paiement,
marchés privés) ; formulaires NOTI6, NOTI7, NOTI8.

**Statut** — brouillon.

---

## 7.10 Environnement, déchets et interfaces sécurité

**Objectif** — Que les obligations environnementales du chantier soient
tenues et que les sujets de sécurité remontent au bon interlocuteur.

**Qui fait quoi**
- Entreprises : gestion et traçabilité des déchets.
- Coordonnateur SPS : prévention et coordination sécurité (mission
  réglementaire propre).
- OPC : intègre les contraintes de coactivité dans le calendrier.
- AMO : vérifie les engagements environnementaux du marché, fait remonter
  au MOA les alertes du coordonnateur SPS.

**Livrables Archiaccess** — suivi des engagements environnementaux
(bordereaux de déchets, taux de valorisation si prévus au marché) ;
report des alertes SPS au MOA.

**Ce que l'outil prépare** *(cible)* — registre des bordereaux de suivi
des déchets dangereux (Cerfa 12571) ; suivi des indicateurs prévus au
marché.

**Ce que l'ingénieur fait lui-même** — tout ce qui relève de la sécurité
reste au coordonnateur SPS et aux entreprises ; l'AMO / OPC ne donne
aucune consigne de sécurité à leur place.

**Points de vigilance** — Ne pas se substituer au coordonnateur SPS :
risque juridique direct.

**Textes et formulaires publics** — Code de l'environnement, art. D. 541-1,
D. 541-2 et R. 541-8 (déchets) ; Code du travail (coordination SPS,
CISSCT) ; Cerfa 12571.

**Statut** — brouillon.

---

## 7.11 Préparation de la réception

**Objectif** — Arriver aux opérations préalables à la réception avec un
ouvrage réellement terminé et des dossiers de fin de chantier en cours de
constitution.

**Qui fait quoi**
- OPC : planifie les essais, les pré-réceptions par lot et les opérations
  préalables à la réception.
- MOE : organise les opérations préalables (élément de mission AOR).
- Entreprises : essais, autocontrôles, dossiers des ouvrages exécutés.
- Coordonnateur SPS : dossier d'intervention ultérieure sur l'ouvrage.
- AMO : vérifie l'état d'avancement des dossiers et prépare le MOA à la
  décision de réception.

**Livrables Archiaccess** — planning de fin de chantier ; tableau de
collecte des dossiers de fin de chantier (attendus / reçus / conformes).

**Ce que l'outil prépare** *(cible)* — liste des documents attendus
générée depuis les marchés et la typologie ; relances ; bascule vers la
phase 8.

**Ce que l'ingénieur fait lui-même** — pré-visites ; appréciation de
l'état réel d'achèvement.

**Points de vigilance** — Ne pas laisser programmer les opérations
préalables à la réception sur un ouvrage manifestement inachevé : cela
dégrade la qualité de la réception.

**Variantes** — Bâtiment ERP : anticiper la commission de sécurité ;
ouvrage d'art : épreuves de chargement ; réseaux : plans de récolement ;
ferroviaire : procédures de mise en service propres — *à préciser avec un
senior de chaque domaine.*

**Textes et formulaires publics** — Arrêté du 22 mars 2019 (annexe 20
du CCP) : élément de mission AOR ; Code du travail, art. R. 4532-95 à
R. 4532-98 (DIUO).

**Statut** — brouillon.
