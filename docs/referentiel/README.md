# Référentiel Archiaccess — méthode AMO / OPC

Méthode de travail propre au cabinet Archiaccess pour conduire une mission
d'assistance à maîtrise d'ouvrage (AMO) ou d'ordonnancement, pilotage et
coordination (OPC), quel que soit l'ouvrage : bâtiment, logement social,
ouvrage d'art, infrastructure linéaire, ferroviaire, métro, réseaux.

Ce référentiel a deux usages :

1. **Aujourd'hui** : documentation de méthode, relue et validée par les
   seniors du cabinet. C'est aussi le support d'intégration des nouveaux
   collaborateurs.
2. **Demain** : squelette de l'« espace projet » de l'outil SIT — chaque
   étape décrite ici deviendra une étape du projet, avec ses listes de
   contrôle, ses échéances et ses documents pré-remplis.

## Principes non négociables

- **L'outil prépare, l'ingénieur analyse, le maître d'ouvrage décide.**
  Aucun livrable de l'outil n'est une décision. L'AMO conseille et propose ;
  le conducteur d'opération instruit des projets de décision que le maître
  d'ouvrage signe. Un AMO qui dirige ou contrôle lui-même les travaux
  s'expose à être requalifié en constructeur, avec la responsabilité
  décennale correspondante (CE, 21 février 2011, n° 330515 ; CE, 9 mars 2018,
  n° 406205). Nos process et notre outil ne doivent jamais brouiller cette
  frontière.
- **Tout est sourcé sur des textes publics** : Code de la commande publique
  (CCP), CCAG 2021, Code civil, Code du travail, Code de l'environnement,
  formulaires de la Direction des affaires juridiques (DAJ) de Bercy,
  imprimés Cerfa. Les numéros d'articles cités sont à revérifier sur
  Légifrance à chaque révision.
- **Rédaction originale.** Aucun passage d'ouvrage protégé (éditions du
  Moniteur, normes AFNOR…) n'est recopié ou paraphrasé ici. Ces ouvrages
  restent des lectures de référence pour les ingénieurs, pas des sources de
  ce référentiel. Plusieurs ouvrages récents interdisent explicitement la
  fouille de textes et l'entraînement d'IA (art. 4(3) de la directive
  (UE) 2019/790) : ils ne doivent jamais être indexés dans le corpus de
  l'outil.
- **Ce que l'outil ne fait jamais** est écrit noir sur blanc pour chaque
  étape : visites, qualification technique, arbitrages, relation humaine
  avec le maître d'ouvrage et les entreprises.

## Les trois axes de variation d'une opération

Une même étape ne se déroule pas de la même façon selon :

| Axe | Valeurs usuelles | Ce qui change |
|---|---|---|
| **Statut du maître d'ouvrage** | État et collectivités ; établissements publics industriels et commerciaux (RATP, Société des grands projets…) ; bailleurs sociaux (OPH, ESH, SEM) ; organismes privés soumis à la commande publique (entités SNCF, TELT…) ; maître d'ouvrage privé | règles de passation, commission d'appel d'offres, application ou non du livre IV de la 2e partie du CCP (ex-loi MOP), circuits de signature |
| **Montage contractuel** | maîtrise d'œuvre + marchés de travaux (allotis ou entreprise générale) ; conception-réalisation ; marché global de performance ; marché de partenariat ; concession ; marché privé (NF P 03-001) | qui conçoit, qui pilote, qui porte les risques, rôle de l'AMO (AMO, conducteur d'opération, assistant à personne publique) |
| **Typologie d'ouvrage** | bâtiment (ERP, logement, tertiaire, santé…) ; ouvrage d'art ; infrastructure linéaire (route, voirie, réseaux) ; ferroviaire / transport guidé ; industriel | autorisations, contrôles spécifiques, réception (commission de sécurité, épreuves de chargement, mise en service…) |

La première étape de tout projet (« fiche d'identité de l'opération ») fixe
ces trois axes ; l'outil en déduit les variantes applicables.

## Phases

| Phase | Contenu | Fichier | État |
|---|---|---|---|
| 1 | Opportunité et faisabilité | — | à rédiger |
| 2 | Programme et stratégie contractuelle | — | à rédiger |
| 3 | Désignation des intervenants | — | à rédiger |
| 4 | Suivi des études de conception | — | à rédiger |
| 5 | Autorisations | — | à rédiger |
| 6 | Consultation des entreprises | — | à rédiger |
| 7 | Préparation et pilotage du chantier | [phase-7-chantier.md](phase-7-chantier.md) | brouillon v0 |
| 8 | Réception et clôture | — | à rédiger |
| 9 | Exploitation et maintenance | — | à rédiger |

## Format d'une étape

Chaque étape suit le même gabarit, pensé pour être relu par un senior puis
transformé en données par l'outil :

- **Objectif** — ce que l'étape doit garantir, en une ou deux phrases.
- **Qui fait quoi** — rôle de chaque acteur (MOA, AMO / conducteur
  d'opération, MOE, OPC, entreprises, coordonnateur SPS, contrôleur
  technique). « **Décide** » n'est jamais attribué à Archiaccess.
- **Entrées** — documents et informations nécessaires.
- **Livrables Archiaccess** — ce que le cabinet remet (toujours sous forme
  d'avis, de proposition ou de tableau de suivi).
- **Ce que l'outil prépare** *(cible, non construit)* — pré-remplissage,
  listes de contrôle, alertes d'échéance.
- **Ce que l'ingénieur fait lui-même** — jamais automatisé.
- **Points de vigilance** — erreurs fréquentes, risques juridiques.
- **Variantes** — selon les trois axes ci-dessus.
- **Textes et formulaires publics** — références vérifiables.
- **Statut** — `brouillon` → `relu senior` → `validé` (avec nom et date).

## Statut de validation

Tout le contenu est à l'état **brouillon** tant qu'un senior du cabinet ne
l'a pas relu. Les variantes infrastructure / ferroviaire / ouvrage d'art
exigent une relecture par un profil ayant pratiqué ces ouvrages.
