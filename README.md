# Archiaccess AI — Système d'Information Technique Fédéré

Ce document est le point d'entrée pour toute personne qui ouvre ce dépôt
pour la première fois : humain ou agent de codage. Il explique **ce que
c'est**, **pourquoi ça existe**, **ce qui a été construit et dans quel
ordre**, et **où en est le projet aujourd'hui**. Pour les détails
techniques fins (pièges déjà rencontrés, conventions de code, procédure
de déploiement pas à pas), voir [`CLAUDE.md`](./CLAUDE.md) — ce
`README.md` donne le contexte et l'histoire, `CLAUDE.md` donne le
mode d'emploi.

L'historique complet des décisions (pourquoi telle API plutôt qu'une
autre, quel bug a été corrigé et comment, pourquoi tel choix
d'infrastructure) vit dans `git log` : les messages de commit de ce
projet sont volontairement rédigés comme un journal narratif détaillé,
pas comme des labels courts. Lire `git log` dans l'ordre est la
meilleure façon de comprendre comment le projet est arrivé là où il
est.

## Le concept

Archiaccess est un bureau d'études AMO/OPC (assistance à maîtrise
d'ouvrage / ordonnancement-pilotage-coordination) dans le BTP. Avant de
lancer une étude technique sur un site, ses collaborateurs back-office
doivent aujourd'hui aller chercher, à la main, sur une dizaine de portails
publics différents, des informations dispersées : la nature du foncier,
les risques naturels et technologiques, l'historique des marchés et des
procédures collectives des entreprises impliquées, le diagnostic
énergétique du bâti, les servitudes d'urbanisme, etc. C'est lent, source
d'oublis, et chaque nouvelle étude repart de zéro.

**Archiaccess AI** répond à ce problème avec deux outils qui partagent
la même base de données et le même corpus documentaire :

- **`/sit`** (Système d'Information Technique) — un tableau de bord de
  recherche fédérée : on tape une adresse, une entreprise ou un
  SIREN/SIRET, et l'outil interroge en parallèle une douzaine de sources
  publiques françaises pour tout ramener au même endroit, sous forme de
  tuiles de résultats organisées par thème (foncier, risques et sols,
  marché, énergie...).
- **`/ai`** ("Archiaccess AI", le nom produit du copilote — jamais
  "Mistral" ni aucun terme technique côté utilisateur) — un chat
  conversationnel qui s'appuie sur un corpus réglementaire indexé
  (RE2020, incendie ERP, accessibilité PMR, parasismique, acoustique,
  SPS, amiante, loi sur l'eau, marchés publics...) pour répondre aux
  questions des collaborateurs pendant la préparation d'une étude. Le
  panneau IA intégré à `/sit` va plus loin : il reçoit automatiquement
  un instantané des données du site en cours de consultation, pour que
  le collaborateur puisse discuter directement des résultats sans les
  retaper — y compris en cliquant sur une tuile de résultat pour
  demander "dis-m'en plus" (voir plus bas, dernière étape en date).

Population cible : les employés internes d'Archiaccess, avec des
comptes individuels créés par un administrateur (page `/admin`). C'est
un outil interne, pas une plateforme cliente — sans rapport ni couplage
avec `archiaccess-pro` (le projet séparé, avec ses propres rôles
clients AEA/AEE/AEI/AEO), qui ne partage ni base de données, ni
infrastructure AWS, ni secret avec ce dépôt-ci.

## Comment le projet a été construit, dans l'ordre

Ce résumé suit la vraie chronologie du dépôt (voir `git log
--oneline`, du plus ancien au plus récent, pour le détail commit par
commit).

**1. Squelette et choix fondateurs.** Auth par mot de passe d'équipe
initiale, copilote Mistral basique, puis séparation en deux écrans
distincts `/sit` et `/ai` dès qu'il est devenu clair que les deux
usages (recherche fédérée vs. conversation) n'avaient pas la même
forme. Choix de la région AWS Paris (eu-west-3) pour la conformité
RGPD, et de pgvector + S3 comme "second cerveau" du copilote plutôt
qu'une solution de mémoire agent tierce.

**2. Identité visuelle.** Reprise du système de design "verre
liquide/chromé" déjà utilisé par `archiaccess-pro` (polices Inter +
Geist Mono auto-hébergées), appliqué aux quatre écrans (accueil, SIT,
AI, connexion) — décision explicite de ne jamais introduire une
nouvelle palette ou une nouvelle police pour une fonctionnalité
ponctuelle.

**3. Les connecteurs de données, un par un, vérifiés en direct.**
Démarrage du hub `/sit` avec la recherche d'adresse (Base Adresse
Nationale), puis ajout progressif des connecteurs : cadastre/parcelles,
Géorisques, DVF (valeurs foncières), entreprises/SIRENE, urbanisme,
DPE, BODACC (procédures collectives), cavités souterraines, sites
pollués, servitudes, BOAMP (marchés publics), nappes phréatiques,
réseaux de chaleur urbaine — 14 connecteurs au total aujourd'hui.
Chaque connecteur a été vérifié par un appel réel à l'API avant d'être
codé (convention du projet — la documentation en ligne s'est révélée
plusieurs fois obsolète : DVF, BASOL/BASIAS renommé en SSP/CASIAS,
dataset ADEME renommé). Plusieurs pistes ont été creusées puis
explicitement abandonnées faute d'endpoint exploitable : BRGM/BSS
(géotechnique), INPN (écologie), ASN (nucléaire), index BT/TP
(économie de la construction), Mérimée (monuments historiques).

**4. Mise en production sur AWS.** Montée à Next.js 16.3.3 (requise
par OpenNext), déploiement Lambda via OpenNext, résolution de plusieurs
pièges d'infrastructure looking coûteux en temps (connexion RDS SSL,
NAT instance à la place d'un NAT Gateway managé pour diviser le coût
par dix, CloudFront + domaines personnalisés `sit.archiaccess.com` /
`ai.archiaccess.com`, routing par sous-domaine cassé puis corrigé via
une CloudFront Function qui préserve le vrai `Host`). Bascule entre
`mistral-large-latest` et `mistral-medium-latest` selon la
disponibilité réelle du modèle constatée en direct (voir "Pièges" dans
`CLAUDE.md`).

**5. Comptes individuels et corpus réglementaire.** Remplacement du mot
de passe d'équipe partagé par des comptes employés individuels
(création/désactivation exclusivement via `/admin`), refonte du chat en
plein écran façon ChatGPT/Claude. Indexation du corpus réglementaire
(pgvector) : 20 documents du domaine public, volontairement limité à ce
qui est légalement indexable (les Eurocodes/DTU/normes EN, protégés
AFNOR/CEN, en sont exclus).

**6. Portage du design d'un artéfact Claude vers le vrai code.** Une
exploration visuelle poussée du tableau de bord `/sit` (24 versions
itérées dans un artéfact Claude, hors dépôt) a ensuite été portée dans
le vrai code : bandeau d'activité, barre de recherche à 5 onglets
(Point précis / Secteur / Carte / Discipline / Lot), panneau
Archiaccess AI contextuel redimensionnable et repliable, chips de
reprise d'étude récente. Plusieurs écarts oubliés lors du premier
portage ont été comblés ensuite (panneau Carte, questions suggérées).

**7. Bugs réels de production, trouvés et corrigés en navigateur réel.**
Une série de bugs visuels invisibles en simple lecture de code, tous
diagnostiqués par mesure réelle en navigateur (Playwright/Chromium)
plutôt que par supposition :
- Barre de recherche, bandeau d'activité et barre de statut visuellement
  écrasés en production — cause racine : `overflow: hidden` combiné à
  `isolation: isolate` sur `.liquid-glass`, qui faisait calculer une
  hauteur de conteneur à 0px malgré un contenu réel.
- Contour de France du mini-plan schématique qui ne ressemblait pas à
  la France (SVG arbitraire remplacé par un vrai contour hexagonal).

**8. Taxonomie des disciplines et modes de recherche Secteur/Lot.**
L'onglet "Discipline" a été aligné sur une référence visuelle fournie
par l'utilisateur, puis sa taxonomie complètement remplacée par la
liste réelle des ~40 (in fine 67, sur 11 catégories) disciplines
techniques Archiaccess (structure, géotechnique, fluides/CVC,
thermique, acoustique, VRD, sécurité incendie/accessibilité, économie
de la construction, environnement, diagnostic/pathologie, spécialités
de niche) — une seconde liste (métiers d'entreprise générale, gros
œuvre/second œuvre) a été délibérément exclue, Archiaccess étant
AMO/OPC et non entreprise générale. Les deux derniers modes de
recherche honnêtement laissés "à venir" ont ensuite été conçus et
construits : **Secteur** (recherche à l'échelle d'une commune —
risques, cavités, sites pollués, nappes, marchés publics ; le DVF en
est explicitement exclu et annoncé comme tel, faute de pouvoir
l'interroger à l'échelle d'une commune entière en une requête) et
**Lot** (recherche multi-adresses, jusqu'à 10 en parallèle, pour une
étude portant sur plusieurs sites à la fois).

**9. Rendre les résultats vraiment utilisables.** Dernière étape en
date : les tuiles de résultat (Point précis, Secteur, Lot) sont
devenues cliquables — cliquer sur une tuile envoie directement une
question au copilote sur cette donnée précise, sans retaper. En
parallèle, deux vrais bugs de responsive ont été trouvés par mesure
réelle sur viewport téléphone (390px) et corrigés : le bouton
"Rechercher" qui débordait de sa carte (défaut `min-width: auto` d'un
enfant flex empêchant le champ de recherche de rétrécir), et les
boutons du panneau Archiaccess AI qui débordaient du viewport une fois
des tuiles affichées (absence de `flex-wrap` sur la ligne d'en-tête).

## État actuel

**Construit et fonctionnel, déployé en production :**
- Auth par comptes employés individuels (création/désactivation
  admin-only).
- Copilote `/ai` avec historique de conversation persisté par
  utilisateur.
- Tableau de bord `/sit` : recherche universelle + 5 modes de recherche
  (Point précis, Secteur, Carte, Discipline, Lot), 14 connecteurs de
  données publiques françaises passant tous par le "coffre"
  (`DataCacheEntry`, accumulation permanente, jamais purgée).
- Corpus réglementaire indexé (pgvector), 20 documents du domaine
  public.
- Domaines personnalisés `sit.archiaccess.com` / `ai.archiaccess.com`
  opérationnels via CloudFront.
- Résultats de recherche cliquables vers le copilote (Point précis,
  Secteur, Lot).

**En cours / pas encore vérifié en production :**
- Le dernier lot de correctifs responsive et de clic-vers-IA (commit
  le plus récent) est développé et testé en local mais pas encore
  déployé.
- Un signalement utilisateur de non-réponse du copilote en production
  est en cours d'investigation — rien d'anormal trouvé côté code à ce
  stade, à confirmer en conditions réelles.
- Refonte visuelle plus poussée du panneau d'accueil `/sit` (bandeau de
  signaux "à connaître" plutôt qu'un journal d'activité interne)
  explorée dans des artéfacts Claude mais pas encore portée dans le
  code — voir la section "État actuel" de `CLAUDE.md` et les derniers
  échanges de conversation pour l'état précis de cette décision.

**Explicitement pas fait, par choix ou faute de source exploitable :**
- Pas de CI/CD (build et déploiement 100 % manuels, procédure détaillée
  dans `CLAUDE.md`).
- Pas de rôles plus fins qu'admin/non-admin, pas de suppression
  définitive de compte.
- Pas de connecteur géotechnique (BRGM/BSS), écologie (INPN), nucléaire
  (ASN), économie de la construction (index BT/TP) ou monuments
  historiques (Mérimée) — aucun endpoint exploitable trouvé à ce jour.
- Pas de génération de fichiers Excel/CSV par le copilote, pas de
  logging structuré du feedback utilisateur.

## Pour aller plus loin

- [`CLAUDE.md`](./CLAUDE.md) — stack technique précise, architecture du
  code fichier par fichier, schéma Prisma, détail de l'infrastructure
  AWS, conventions de développement, procédure de déploiement complète,
  et surtout la section "Pièges déjà rencontrés" : tout ce qui a déjà
  fait perdre du temps une fois, pour ne pas le reperdre une seconde
  fois.
- `git log` — l'historique narratif complet, commit par commit.
