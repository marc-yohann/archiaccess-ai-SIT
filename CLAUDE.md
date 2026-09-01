# Archiaccess AI — Système d'Information Technique Fédéré

Outil interne pour les collaborateurs back-office d'Archiaccess (bureau
d'études) réalisant des études techniques sur des marchés AMO/OPC :
analyses techniques, dossiers réglementaires, pilotage de groupements.
**Population distincte** des rôles AEA/AEE/AEI/AEO d'`archiaccess-pro`
(qui sont les comptes clients/plateforme) — ici ce sont les employés
internes d'Archiaccess elle-même.

Projet **volontairement séparé** d'`archiaccess-pro` : pas de couplage aux
données (Missions/Opérations de Pro), pas de partage d'infrastructure AWS.
**Ancien plan abandonné le 2026-08-30** (voir plus bas, décision
utilisateur explicite) : le mot de passe d'équipe AEO partagé devait
initialement servir de porte d'entrée ici — remplacé entièrement par des
comptes employés individuels. Plus aucune dépendance vers
`archiaccess-pro` (le secret `archiaccess-pro/aeo-password` n'est plus lu).

## Contraintes techniques & choix d'architecture

1. **LLM** : API Mistral AI, modèle cible Mistral Large 3 — choisi pour la
   conformité RGPD/souveraineté européenne sur des données d'ingénierie
   sensibles, et un coût maîtrisé. Aucune donnée soumise ne doit servir à
   l'entraînement de modèles tiers.
2. **Infrastructure** : AWS, architecture optimisée en coûts — privilégier
   le serverless ou des microservices isolés selon les besoins réels de
   chaque brique (traitement documentaire volumineux, recherche, etc.).
   Cloisonnement des accès employé/agent via IAM et clés sécurisées.
3. **Périmètre** : SI Technique collaborateur + Archiaccess AI. Structure
   modulaire pour les flux d'ingénierie bâtiment, le traitement
   documentaire, et l'orchestration des prompts/skills internes. Sources
   de données : plusieurs API data.gouv.fr et institutionnelles
   françaises (à sélectionner selon les besoins des études — foncier,
   financier, réglementaire).

## Où on en est

- Next.js 16 + Prisma 7 (adapter-pg) + Tailwind v4, mêmes versions
  qu'archiaccess-pro pour rester dans un stack connu.
- Auth par comptes employés individuels (`lib/session.ts`, `lib/password.ts`,
  `app/api/auth/*`, `app/api/admin/*`) — voir la section détaillée plus
  bas (2026-08-30). Remplace l'ancien mot de passe d'équipe partagé.
- Copilote conversationnel minimal (`app/api/mistral/chat/route.ts`,
  `lib/mistral.ts`) — appelle l'API Mistral, historique de conversation
  persisté (`Conversation`/`Message` dans `prisma/schema.prisma`).
- Deux écrans séparés (`/sit`, `/ai`) + accueil, protégés par `AuthGate` —
  voir contrainte UI plus haut.
- **Identité visuelle reprise d'archiaccess-pro** (effet "verre liquide",
  boutons "chromé métal", police Inter + Geist Mono auto-hébergées) :
  `app/globals.css`, `app/fonts/*.woff2`, `public/noise.png`,
  `postcss.config.mjs`. Appliquée aux quatre écrans (accueil, `/sit`,
  `/ai`, formulaire de connexion) via les classes `.liquid-glass*` /
  `.chrome-black` / `.chrome-white` / `.glass-scene`. Dépendances npm
  ajoutées : `tw-animate-css`, `shadcn`.
- `tsc --noEmit` et `next build` passent tous les deux.

**Réseau sortant testé et fonctionnel** (2026-08-27, depuis un
environnement Claude Code on the web) : Mistral et data.gouv.fr
répondent tous les deux, aucun 403 de proxy. La contrainte réseau
restrictive évoquée dans les versions précédentes de ce fichier ne
s'est pas vérifiée — à re-tester si un futur environnement se comporte
différemment, mais ne plus la supposer par défaut.

**Testé en conditions réelles avec deux clés API Mistral différentes** (la
seconde fournie spécifiquement pour écarter un souci de tier/quota
propre à la première) — même résultat dans les deux cas :
- `mistral-small-latest` et `mistral-medium-latest` répondent
  correctement (< 1s, HTTP 200).
- **`mistral-large-latest` (et `mistral-large-2512`) timeout
  systématiquement** — 0 octet reçu après 30-45s, alors que la requête
  est strictement identique à celle qui fonctionne pour les autres
  modèles, que le proxy sortant ne signale aucune erreur de relais, et
  que le problème persiste avec une clé API neuve. Ça pointe vers un
  souci côté infrastructure Mistral pour ce modèle précis (surcharge,
  incident sur `large`) plutôt qu'un problème de compte/quota/réseau/code.
  **`lib/mistral.ts` bascule temporairement sur `mistral-medium-latest`**
  (repli documenté en commentaire dans le fichier) pour que `/ai` reste
  utilisable — à rebasculer sur `mistral-large-latest` une fois
  confirmé que l'API répond de nouveau pour ce modèle (retester
  périodiquement, ou demander à l'utilisateur de vérifier le statut sur
  status.mistral.ai / la console Mistral).
- **Ressources AWS provisionnées en eu-west-3** (2026-08-27, avec des
  identifiants temporaires CloudShell — utilisés immédiatement à
  réception pour éviter une nouvelle expiration) :
  - Secret `archiaccess-ai-sit/mistral` — clé API Mistral (chaîne brute,
    pas de JSON — c'est le format attendu par `getMistralApiKey()` dans
    `lib/secrets.ts`).
  - Secret `archiaccess-ai-sit/database` — identifiants RDS, avec
    `host` **encore en placeholder** (`PENDING-endpoint-not-yet-available`) :
    l'instance RDS n'était pas encore disponible au moment de la
    création du secret (provisioning ~5-10 min). **À faire dès que
    possible** : relire l'endpoint réel (`aws rds describe-db-instances
    --db-instance-identifier archiaccess-ai-sit-db --region eu-west-3`)
    et mettre à jour le secret avec `aws secretsmanager put-secret-value`.
  - RDS PostgreSQL 16 (`archiaccess-ai-sit-db`, db.t4g.micro, 20 Go gp3,
    chiffré, non publiquement accessible, dans le VPC par défaut
    `vpc-0ba2ce5e1153a3746`) — lancé en asynchrone, continue de se
    provisionner indépendamment de l'expiration des identifiants
    temporaires. **pgvector pas encore activé** (`CREATE EXTENSION
    vector;` à lancer une fois connecté, PG16 le supporte nativement sur
    RDS).
  - Security group `archiaccess-ai-sit-rds` (nom fixé au provisioning,
    ID à relire via `aws ec2 describe-security-groups`) : port 5432
    ouvert uniquement au CIDR du VPC (`172.31.0.0/16`), pas d'accès
    public. **À revoir une fois l'archi de déploiement de l'app tranchée**
    (Lambda/ECS dans le même VPC → OK tel quel ; autre solution hors
    VPC → il faudra un chemin d'accès différent, pas juste ouvrir en
    public).
  - Bucket S3 `archiaccess-ai-sit-documents-638954279923` — accès public
    bloqué, chiffrement SSE-S3 par défaut.
  - Rôle IAM `archiaccess-ai-sit-app` (assumable par `lambda.amazonaws.com`
    pour l'instant — à ajuster si l'archi de déploiement change) avec une
    politique inline limitée à : lecture des secrets
    `archiaccess-ai-sit/*`, lecture/écriture du bucket S3 ci-dessus, et
    les permissions CloudWatch Logs de base. **Ne contient PAS encore
    l'accès en lecture à `archiaccess-pro/aeo-password`** — voir
    blocage ci-dessous.
  - Utilisé les identifiants **root** du compte AWS (fournis tels quels
    par l'utilisateur via CloudShell) pour ce provisioning initial. À ne
    pas garder comme pratique courante — une fois l'IAM de base en place,
    privilégier un utilisateur/rôle IAM dédié avec des permissions
    limitées pour les opérations futures plutôt que le compte root.

**Blocage à lever avec l'utilisateur** : le secret
`archiaccess-pro/aeo-password` **n'existe pas** dans les régions
vérifiées (`eu-west-3`, `eu-west-1`, `us-east-1` — cette dernière ne
contient que des secrets Stripe côté Pro). Soit il n'a pas encore été
créé côté `archiaccess-pro`, soit il est dans une région non testée, soit
son nom réel diffère de celui documenté ici. Tant que ce point n'est pas
clarifié, `getAeoSharedPassword()` dans `lib/secrets.ts` échouera en
conditions réelles — l'authentification par mot de passe d'équipe reste
non testable de bout en bout.

**Hub `/sit` démarré** — premier connecteur data.gouv.fr branché et testé
en conditions réelles : `lib/data-sources/ban.ts` (API Adresse / Base
Adresse Nationale, geocoding, pas de clé requise), exposé via
`app/api/sit/search-address/route.ts` (même pattern d'auth par cookie de
session que `/api/mistral/chat`), UI de recherche dans `app/sit/page.tsx`
(recherche → liste de résultats → détail avec coordonnées/code
INSEE/score). Choisi comme point d'entrée parce que cadastre, Géorisques
et DVF (prochains connecteurs) ont tous besoin d'une adresse géocodée ou
d'un code commune en entrée. Pas encore de persistance (pas de modèle
Prisma) : la BDD n'est pas encore accessible (voir ci-dessus, host
placeholder), donc rien à sauvegarder pour l'instant — recherche
uniquement, pas d'historique. La route `/api/sit/search-address` n'a pas
pu être testée bout en bout (elle passe par `isValidSession()` →
Postgres, indisponible), mais le connecteur BAN lui-même a été validé
par appels directs à l'API réelle avant d'écrire le code.

**"Second cerveau" (pgvector + S3) câblé, pas encore testé** — schéma,
connecteurs et route branchés en une fois puisque tout dépend de la même
ressource (RDS) qui n'est pas encore disponible, pour éviter d'y revenir
morceau par morceau :
- `prisma/schema.prisma` : extension `postgresqlExtensions` +
  `extensions = [vector]`, modèles `Document`/`DocumentChunk`.
  `DocumentChunk.embedding` est `Unsupported("vector(1024)")` — Prisma ne
  modélise pas le type vector nativement, donc insertion/recherche
  passent par `$executeRaw`/`$queryRaw` (voir `lib/rag.ts`). Dimension
  1024 **vérifiée par un appel réel** à `mistral-embed` (pas supposée) —
  ce modèle répond correctement (HTTP 200), contrairement à
  `mistral-large-latest`.
- `lib/embeddings.ts` — client `mistral-embed`.
- `lib/chunking.ts` — découpage Markdown en paragraphes (~1500 caractères).
- `lib/storage.ts` — upload/download S3 (bucket créé au provisioning).
- `lib/rag.ts` — `indexDocument()` (S3 + Postgres + embeddings) et
  `searchSimilarChunks()` (distance cosinus `<=>`).
- `app/api/sit/documents/route.ts` + panneau "Ajouter une étude" dans
  `/sit` — ingestion manuelle d'une étude Markdown.
- `/api/mistral/chat` interroge `searchSimilarChunks()` avant chaque
  réponse et injecte les extraits pertinents en contexte système ; un
  échec de la recherche (base indisponible, rien d'indexé) est absorbé
  silencieusement, la conversation continue sans ce contexte plutôt que
  d'échouer.
- **Rien de tout ça n'a pu tourner contre une vraie base** — `npx prisma
  generate` valide la syntaxe du schéma, `tsc`/`next build` valident le
  code, mais aucune requête pgvector réelle n'a été exécutée (RDS pas
  encore accessible). À tester dès que possible : `CREATE EXTENSION
  vector` doit se faire automatiquement au premier `prisma migrate dev`
  grâce à `postgresqlExtensions`, mais ce n'est vérifié nulle part
  encore.

**RDS disponible, secret `database` à jour, mais migrations toujours pas
lancées — blocage réseau, pas AWS** (2026-08-27) : une fois l'instance
RDS prête (endpoint `archiaccess-ai-sit-db.cnucuimmuzrc.eu-west-3.rds.amazonaws.com`,
secret `archiaccess-ai-sit/database` mis à jour avec ce vrai host), tentative
de connexion directe depuis cet environnement Claude Code pour lancer
`prisma migrate dev` — échec en TCP. Cause identifiée : **cet
environnement route les requêtes HTTPS via un proxy applicatif, mais le
TCP brut (bases de données) n'est pas supporté du tout** — documenté
explicitement dans `/root/.ccr/README.md` ("raw-TCP databases... report,
do not work around"), ce n'est pas une histoire de security group ou
d'accès public. Test fait : RDS basculé temporairement en
`--publicly-accessible` + security group ouvert à l'IP sortante de cet
environnement (avec l'accord explicite de l'utilisateur) — toujours
injoignable en TCP, confirmant que c'est le réseau de l'environnement
qui bloque, pas AWS. **Annulé immédiatement après ce constat** : RDS
repassé en `--no-publicly-accessible`, règle de security group
temporaire retirée (seul le CIDR du VPC reste autorisé en entrée).

**Cette limite (pas de TCP brut vers bases de données) est structurelle
à cet environnement, pas à AWS ni au code** — inutile de refaire cette
tentative depuis un futur environnement Claude Code on the web tant
qu'il a la même politique réseau.

**Migrations Prisma appliquées avec succès via bastion EC2 + SSM**
(2026-08-27) — option 1 retenue et exécutée : instance EC2 temporaire
(t3.micro, spot) dans le VPC, rôle IAM dédié (SSM + lecture du secret
`archiaccess-ai-sit/database` + lecture/écriture du préfixe `ops/` du
bucket S3), pilotée via `aws ssm send-command` (API HTTPS, compatible
avec le proxy de cet environnement — aucune connexion TCP directe
nécessaire depuis ici). Bundle (`prisma/`, `prisma.config.ts`,
`package.json` minimal) uploadé sur S3, `nodejs22` installé sur le
bastion (le `nodejs` par défaut d'Amazon Linux 2023 est en v18,
insuffisant — Prisma 7 exige Node 20.19+/22.12+/24+), `npx prisma
migrate deploy` exécuté avec succès. **Vérifié en direct via `psql`** :
extension `vector 0.8.1` active, les 6 tables (`Session`,
`Conversation`, `Message`, `Document`, `DocumentChunk`,
`_prisma_migrations`) existent. Toutes les ressources temporaires de
cette étape (instance, rôle IAM `archiaccess-ai-sit-migration-bastion`,
fichier S3 `ops/migration-bundle.tar.gz`) ont été nettoyées après usage.

Script bastion prêt à être réutilisé pour d'autres opérations
ponctuelles nécessitant un accès réseau au VPC (le motif : upload d'un
petit bundle sur S3, instance EC2 spot avec rôle IAM scoping minimal,
`aws ssm send-command`, cleanup systématique après usage) — pas besoin
de repartir de zéro à chaque fois.

**Nettoyé** : le bastion de smoketest RAG mentionné ci-dessus (et son
rôle IAM `archiaccess-ai-sit-smoketest-bastion`) ne sont plus
provisionnés — vérifié le 2026-08-31 via `aws ec2 describe-instances`/
`aws iam list-roles` (seuls `archiaccess-ai-sit-app` et
`archiaccess-ai-sit-nat-instance` restent, tous deux légitimes). Ce test
bout-en-bout du RAG complet lui-même reste à refaire si jugé utile — pas
bloquant, la brique pgvector a déjà été validée au niveau SQL (`psql`)
et le connecteur Mistral testé séparément.

**Hub `/sit` — cadastre/parcelles branché et testé en conditions
réelles** : `lib/data-sources/cadastre.ts` (API Carto de l'IGN, pas de
clé requise). Point important découvert en testant contre l'API réelle :
interroger le point exact d'une adresse géocodée renvoie souvent aucune
parcelle (le géocodage BAN place le point sur la voirie, côté rue, pas
sur le bâtiment) — on interroge donc une petite emprise (bbox ~20m)
autour du point plutôt que le point exact. Exposé via
`app/api/sit/parcels/route.ts`, affiché automatiquement dans `/sit` dès
qu'une adresse est sélectionnée (section, numéro, contenance, identifiant
IDU).

**Hub `/sit` — Géorisques branché et testé en conditions réelles** :
`lib/data-sources/georisques.ts`, trois endpoints à l'échelle de la
commune (code INSEE, pas besoin de parcelle) : risques naturels/
technologiques (PPR), zonage sismique (réglementation parasismique),
potentiel radon (ventilation/santé) — combinés en un seul appel
`getRisksForCommune()`. Exposé via `app/api/sit/risks/route.ts`,
affiché automatiquement dans `/sit` sous le cadastre.

**Hub `/sit` — DVF (valeurs foncières) branché et testé en conditions
réelles** : `lib/data-sources/dvf.ts`. **Aucune API DVF publique
documentée et stable n'existe** — l'ancienne `api.cquest.org/dvf` est
hors service (502 constaté), `app.dvf.etalab.gouv.fr` (le site officiel)
n'expose pas d'API REST classique dans sa doc publique. Trouvé en
inspectant le JS du site officiel (`js/data.js`, `js/index.js`) :
l'endpoint interne qu'il utilise réellement,
`app.dvf.etalab.gouv.fr/api/mutations3/{codeCommune}/{sectionPrefixe}`,
avec `sectionPrefixe` = com_abs + section (ex: `000AP`) — format
retrouvé en lisant `idSectionToCode()` dans leur code source. C'est
l'API qui alimente le site officiel, donc fiable dans les faits, mais
non documentée/non versionnée : à surveiller si elle change sans préavis.
`lib/data-sources/cadastre.ts` expose maintenant `sectionPrefixe` sur
chaque `Parcel` (dérivé de `idu`, vérifié cohérent avec le format DVF).
Dédoublonnage par `id_mutation` côté client (l'API renvoie une ligne par
lot/dépendance d'une même vente). Exposé via `app/api/sit/dvf/route.ts`,
affiché sous Géorisques dans `/sit` (section de la première parcelle
trouvée).

**Les trois connecteurs de données prévus initialement (cadastre,
Géorisques, DVF) sont posés.** `/sit` enchaîne maintenant : recherche
d'adresse → parcelle cadastrale → risques réglementaires → historique
des ventes DVF sur la même section, plus l'ingestion de documents
Markdown indexés (pgvector) pour le copilote.

**App déployée en production réelle sur AWS Lambda (dans le VPC) — testée
bout en bout avec succès** (2026-08-28). Décision d'architecture revue en
cours de route : Amplify Hosting (choix initial) a été abandonné après
découverte qu'Amplify Hosting Compute **ne peut pas être rattaché à un
VPC**, donc aucun accès réseau possible au RDS privé — confirmé par la
doc AWS et par un essai de déploiement manuel réel (voir historique de
cette session). Repassé sur Lambda, qui supporte le VPC nativement.

Infrastructure réseau ajoutée pour ça :
- 2 nouveaux sous-réseaux privés (`172.31.48.0/20` eu-west-3a,
  `172.31.64.0/20` eu-west-3b) dans le VPC existant, dédiés au Lambda.
- NAT Gateway (`archiaccess-ai-sit-nat`) dans un sous-réseau public
  existant + Elastic IP — nécessaire car un Lambda en VPC perd l'accès
  internet par défaut (pour Mistral, data.gouv.fr...), coût récurrent
  réel (~33-40 $/mois), validé explicitement avec l'utilisateur avant
  provisioning vu la sensibilité au coût du projet.
- Table de routage privée dédiée (`archiaccess-ai-sit-private`) : route
  par défaut vers le NAT Gateway, associée aux 2 sous-réseaux Lambda.
- Security group `archiaccess-ai-sit-lambda` : le security group RDS
  autorise maintenant le trafic entrant depuis ce security group
  (règle SG-à-SG plutôt que CIDR).
- Rôle `archiaccess-ai-sit-app` : trust policy repassée sur
  `lambda.amazonaws.com` (était `amplify.amazonaws.com`), policy
  managée `AWSLambdaVPCAccessExecutionRole` attachée en plus (requise
  pour qu'un Lambda en VPC puisse créer ses ENI).

Build et déploiement :
- Next.js monté à **16.3.3** (requis par OpenNext, qui exige `>=16.3.3`
  — 16.2.6 était juste en dessous).
- `@opennextjs/aws` (OpenNext) transforme le build Next.js en bundle
  Lambda — `open-next.config.ts` minimal (wrapper streaming, pas de
  CloudFront/S3 pour l'instant, Function URL suffit pour un outil
  interne à faible trafic). Bundle zippé : ~8 Mo, largement sous la
  limite d'upload direct (50 Mo).
- **Le déploiement manuel (zip direct) ne fonctionne PAS pour du
  Next.js sur Amplify Hosting** (confirmé par la doc AWS : "manual
  deployments of Next.js apps are not currently supported") — c'est ce
  qui a motivé l'abandon d'Amplify plutôt qu'un simple contournement.
  Sur Lambda en revanche, le zip généré par OpenNext se déploie
  directement via `aws lambda create-function`/`update-function-code`,
  sans dépendance à un dépôt Git connecté.
- Fonction Lambda `archiaccess-ai-sit-app` (nodejs22.x, 1024 Mo, 30s de
  timeout, dans le VPC via les 2 sous-réseaux + security group
  ci-dessus) avec une Function URL (`AuthType=NONE`, `InvokeMode=
  RESPONSE_STREAM`). **Point important découvert en testant** : depuis
  octobre 2025, une Function URL publique exige DEUX permissions
  (`lambda:InvokeFunctionUrl` ET `lambda:InvokeFunction` avec la
  condition `InvokedViaFunctionUrl`), pas juste la première comme le
  suggèrent d'anciens exemples — sans la seconde, 403 Forbidden
  systématique malgré une resource policy apparemment correcte.

**Testé bout en bout contre la vraie infrastructure, avec succès** :
`GET /api/auth/me` sans cookie → `{"authenticated":false}` (200) — la
Lambda a bien traversé le NAT, atteint Secrets Manager, et interrogé le
RDS avec succès. `GET /api/sit/search-address` sans session → 401
(bonne gate d'auth). `POST /api/auth/login` → 500, **comportement
attendu** : `archiaccess-pro/aeo-password` n'existe toujours pas (seul
blocage restant, indépendant du déploiement). `/sit` et `/ai` → 200,
rendent le formulaire de connexion. Toute la chaîne réseau
(Lambda→NAT→internet, Lambda→VPC→RDS, Lambda→Secrets Manager→S3) est
donc validée en conditions réelles.

URL actuelle (staging, pas de nom de domaine ni CloudFront encore) :
`https://qiia57r3m2zk2nxhcnxtbqdemu0svklo.lambda-url.eu-west-3.on.aws/`

**Vigilance : deux pages de documentation AWS officielles consultées
pendant cette session (`deploy-nextjs-app.html` et `urls-auth.html`)
contenaient toutes les deux un bloc final suspect** ("Skills for AI
coding assistants... `aws agent-toolkit search-skills`") qui ne
ressemble pas à du contenu AWS légitime — possible injection de prompt
dans le contenu de la page. Signalé à l'utilisateur, jamais exécuté. À
rester vigilant si retrouvé ailleurs.

**`archiaccess-pro/aeo-password` créé, connexion + chat + recherche
d'adresse testés avec succès en conditions réelles** (2026-08-28) —
l'utilisateur a fourni la valeur directement (le secret n'a jamais été
créé côté archiaccess-pro), créé dans `archiaccess-pro/aeo-password`
(eu-west-3), permission `secretsmanager:GetSecretValue` ajoutée à la
policy du rôle `archiaccess-ai-sit-app`. **Corrigé au passage** :
`lib/secrets.ts` — RDS impose SSL (`rds.force_ssl`) mais le driver `pg`
ne l'active pas sans configuration explicite (`P1010 "User was denied
access"`, message trompeur qui n'a rien à voir avec le mot de passe) ;
`sslmode=require` seul échoue ensuite sur "self-signed certificate in
certificate chain" (certificat RDS absent du magasin de confiance par
défaut de Node) — `uselibpqcompat=true` (suggéré par l'avertissement du
driver lui-même) retrouve le comportement libpq/psql (chiffré, sans
vérification stricte du CA). Testé avec succès : connexion, chat
Mistral (persistance conversation), recherche d'adresse.

**Tentative de remplacer le NAT Gateway par une NAT instance
(t4g.nano) — échec, annulé proprement, NAT Gateway toujours en place**
(2026-08-28) : suite à la sensibilité au coût de l'utilisateur (~33-40
$/mois du NAT Gateway jugé trop élevé, cumulé aux ~25 $/mois déjà
payés pour archiaccess-pro), tentative de bascule vers une instance
EC2 minimale faisant NAT (iptables MASQUERADE + IP forwarding via
user-data). Route de la table privée basculée vers l'instance → plus
aucun trafic sortant ne passait (timeout Lambda à 30s sur les appels
Mistral). Tentative de debug via SSM échouée : l'instance ne s'est
jamais enregistrée auprès de SSM même après association d'un profil
IAM dédié (~100s d'attente). **Route immédiatement restaurée vers le
NAT Gateway** pour ne pas laisser l'app cassée — service rétabli et
revérifié. Instance NAT cassée + rôle IAM de debug supprimés. Cause
racine non identifiée (soupçon : `iptables` absent par défaut sur
Amazon Linux 2023, ou `set -e` du script user-data ayant avorté
silencieusement au premier échec) — à reprendre avec un script plus
robuste (logs explicites, pas de `set -e` sur les étapes non
critiques) et idéalement une paire de clés SSH ou un accès EC2 Instance
Connect pour déboguer en direct plutôt que de dépendre de
l'enregistrement SSM. **Le NAT Gateway reste donc en place pour
l'instant** — coût à assumer le temps de retenter proprement, ou
explorer une autre option (voir la discussion sur RDS public /
Aurora Data API évoquée plus tôt, jamais retenue).

**NAT instance en place avec succès — NAT Gateway supprimé, coût
récurrent réduit d'environ 33-40 $/mois à ~3 $/mois** (2026-08-28,
deuxième tentative) : cause racine du premier échec identifiée —
**le paquet s'appelle `iptables-legacy` sur Amazon Linux 2023, pas
`iptables`** (`dnf install -y iptables` ne trouve rien, échoue
silencieusement ; `dnf list available 'iptables*'` l'a révélé). Cette
fois : rôle IAM SSM attaché **dès le lancement** de l'instance (pas
après coup) → enregistrement SSM en ~10s au lieu de ne jamais
s'enregistrer. Diagnostic complet via SSM AVANT de toucher au trafic de
prod : `iptables-legacy` installé, règle MASQUERADE sur l'interface
`ens5` (pas `eth0`), `net.ipv4.ip_forward=1`, unité systemd pour
persistance au redémarrage. Route de la table privée basculée vers
l'instance (`t4g.nano`) seulement après validation, testée
immédiatement (chat Mistral + recherche d'adresse → 200 tous les deux),
**puis** NAT Gateway supprimé et son Elastic IP libérée. Plus aucune
dépendance au NAT Gateway managé.

**`mistral-large-latest` de nouveau disponible, rebasculé en production**
(2026-08-29) : l'incident côté infrastructure Mistral qui le faisait
timeout (voir plus haut) s'est résolu — retesté en direct (HTTP 200,
~1s), `lib/mistral.ts` repointé dessus, Lambda redéployée. C'est de
nouveau le modèle cible du projet (RGPD/souveraineté) qui tourne, plus
`medium` en repli.

**CloudFront + domaine personnalisé mis en place** (2026-08-29) :
l'utilisateur a choisi deux sous-domaines distincts sur son domaine
existant `archiaccess.com` (hébergé chez Hostinger) — `sit.archiaccess.com`
pour le SIT, `ai.archiaccess.com` pour le copilote — plutôt qu'un seul
sous-domaine partagé. Un seul certificat ACM (us-east-1, requis pour
CloudFront) couvre les deux domaines via subject-alternative-names,
validé par DNS (deux enregistrements CNAME `_xxx.sit`/`_xxx.ai` ajoutés
côté Hostinger, propagation + validation ACM en quelques minutes).
Distribution CloudFront (`E1A2P5LIOXBTN1`,
`d25lgmry3zntt3.cloudfront.net`) créée avec la Function URL Lambda comme
origine HTTPS, cache désactivé (managed policy `CachingDisabled` — app
dynamique/authentifiée, jamais de cache). Enregistrements finaux côté
Hostinger : `sit` et `ai` en CNAME vers `d25lgmry3zntt3.cloudfront.net`.

**Bug découvert et corrigé au premier test** : la origin request policy
managée `AllViewer` (utilisée au départ pour transmettre cookies/headers)
transmet aussi le header `Host` du visiteur tel quel — or les Function
URL Lambda font leur routage interne par nom d'hôte, donc recevoir
`sit.archiaccess.com` au lieu de leur propre nom de domaine cassait tout
(403 `AccessDeniedException` systématique). Remplacé par la policy
managée `Managed-AllViewerExceptHostHeader`
(`b689b0a8-53d0-40ab-baf2-68738e2966ac`), conçue précisément pour ce cas
(origines Lambda Function URL/API Gateway) : transmet cookies/headers/
query-strings sauf `Host`.

**Testé bout en bout avec succès sur les deux domaines finaux** :
`https://sit.archiaccess.com` et `https://ai.archiaccess.com` répondent
(200), `/api/auth/me` fonctionne sur les deux, connexion complète testée
via `sit.archiaccess.com` (cookie de session délivré). Le domaine
personnalisé est donc pleinement opérationnel.

**Titre/favicon distincts par écran, puis bug de routing par sous-domaine
découvert et corrigé** (2026-08-30) : logos fournis par l'utilisateur
téléchargés et redimensionnés (512×512) en favicons dédiés —
`app/sit/icon.png` (logo "Archiaccess executive") et `app/ai/icon.png`
(logo "Archiaccess AI"), via la convention Next.js de favicon par segment
de route. `app/sit/layout.tsx` et `app/ai/layout.tsx` ajoutés (Server
Components) pour fournir un titre par route (`/sit/page.tsx` et
`/ai/page.tsx` sont `"use client"`, donc ne peuvent pas exporter
`metadata` eux-mêmes).

Après déploiement, `/sit` et `/ai` (les chemins) avaient bien le bon
titre/favicon, mais **la racine `https://sit.archiaccess.com/` continuait
à afficher "Archiaccess AI"** — bug signalé par l'utilisateur. Cause
réelle, après investigation : ce n'était pas un problème de cache, mais
de routing. `sit.archiaccess.com/` et `ai.archiaccess.com/` pointent tous
les deux vers la MÊME Lambda, et la racine `/` a toujours été la page
d'accueil générique (`app/page.tsx`, liens vers `/sit` et `/ai`) — rien
ne faisait correspondre un sous-domaine à sa page dédiée. Corrigé avec un
middleware Next.js (`proxy.ts` — Next.js 16.3.3 a renommé la convention
`middleware.ts` → `proxy.ts`, codemod officiel utilisé) qui réécrit `/`
vers `/sit` ou `/ai` selon le sous-domaine visité.

**Complication additionnelle** : le middleware lit le header `Host` pour
décider du sous-domaine, mais CloudFront (policy `Managed-
AllViewerExceptHostHeader`, voir plus haut) **supprime volontairement**
le vrai `Host` du visiteur avant de transmettre à l'origine (nécessaire
pour que la Function URL Lambda ne renvoie pas 403). Résultat : le
middleware ne voyait jamais `sit.` ni `ai.`, seulement le nom de domaine
de la Lambda elle-même. Résolu avec une **CloudFront Function**
(`archiaccess-ai-sit-preserve-host`, JS, événement `viewer-request`,
associée à la distribution `E1A2P5LIOXBTN1`) qui recopie le `Host`
d'origine du visiteur dans un header custom `x-app-host` avant que la
origin request policy ne l'écrase — c'est ce header que `proxy.ts` lit
maintenant (avec repli sur `host` si absent). Coût négligeable (1M
d'exécutions gratuites/mois sur CloudFront Functions).

**Testé bout en bout avec succès** : `https://sit.archiaccess.com/` →
titre "Archiaccess SIT" + favicon dédié ; `https://ai.archiaccess.com/` →
titre "Archiaccess AI" + favicon dédié ; les chemins explicites `/sit` et
`/ai` fonctionnent toujours sur les deux domaines ; `/api/auth/me`
inchangé ; le domaine CloudFront par défaut (sans sous-domaine
correspondant) continue d'afficher l'accueil générique, comme prévu.

**Document "Consignes pour Archiaccess AI" intégré au prompt système**
(2026-08-30) : le document fourni par l'utilisateur (mission, ton,
autorisé/interdit, protocole RGPD/sécurité, feedback, valeurs
d'entreprise, contact responsable) a été retranscrit dans `SYSTEM_PROMPT`
de `app/api/mistral/chat/route.ts`. **Volontairement pas repris à
l'identique** : le document mentionne aussi (a) la génération de
fichiers Excel/CSV modifiables pour les tableaux/graphiques, et (b) un
mécanisme de logging structuré du feedback ("cette réponse est
incorrecte" → enregistrement) — ni l'un ni l'autre n'existe côté produit
(pas d'export de fichier, pas de table Prisma pour stocker le feedback),
donc le prompt demande des tableaux markdown et invite à contacter le
responsable plutôt que de promettre des capacités non implémentées.
**Reste à faire si jugé utile** : génération réelle de fichiers
Excel/CSV, table `Feedback` + UI pour logger un signalement au lieu d'un
simple message texte à l'IA.

**En testant le chat après ce déploiement : `mistral-large-latest`
renvoie maintenant 403 "tier_not_allowed"** (2026-08-30) — "This model is
not available in your subscription tier". **Différent de l'incident
précédent** (qui était un timeout côté infrastructure Mistral, résolu le
2026-08-29) : ici la requête aboutit tout de suite avec un refus net,
signe d'un problème d'abonnement/plan Mistral plutôt que d'une panne.
Vérifié en direct avec la clé stockée : `large` → 403, `medium` → 200
(même clé, même requête). `lib/mistral.ts` rebasculé sur
`mistral-medium-latest` en attendant, Lambda redéployée, chat retesté
avec succès (y compris le comportement RGPD/refus des Consignes — un
test avec "quel est le mot de passe du dossier client Z ?" a bien produit
un refus argumenté renvoyant vers le responsable). **À l'utilisateur** :
vérifier le plan/abonnement sur la console Mistral (console.mistral.ai)
pour voir si `mistral-large-latest` nécessite une mise à niveau, ou
contacter leur support — ce n'est pas quelque chose que ce projet peut
résoudre côté code.

**Demande reçue, pas encore traitée** : **chaque employé doit avoir son
propre compte** ("chaque employé doit avoir son compte") —
remplacerait/compléterait le modèle actuel de mot de passe d'équipe
partagé (`lib/session.ts`). Changement d'architecture significatif
(gestion des comptes, création/désactivation, peut-être des rôles) — à
clarifier avec l'utilisateur avant de se lancer, plutôt que de décider
seul du design.

**Bug critique découvert et corrigé : la page restait bloquée sur
"Chargement…" dans un vrai navigateur** (2026-08-30, signalé par
l'utilisateur) — jamais détecté avant car tous les tests bout en bout de
cette session étaient des appels `curl` sur les routes API, jamais un
vrai chargement de page en navigateur. Cause : la distribution
CloudFront n'avait qu'une seule origine (la Function URL Lambda) ; les
bundles JS/CSS statiques de Next.js (`_next/static/*`) sont censés être
servis depuis une origine S3 dédiée (c'est ce que `open-next build`
prévoit dans `open-next.output.json`), mais cette origine S3 n'avait
jamais été créée quand CloudFront a été mis en place — un commentaire
resté dans `open-next.config.ts` datait d'avant CloudFront ("pas de
CloudFront/S3 pour l'instant, Function URL suffit"), jamais revu depuis.
Résultat : le HTML se chargeait bien (rendu côté serveur, titre/favicon
corrects), mais le bundle JS 404 dans le navigateur, React n'hydrate
jamais, la page reste bloquée sur l'état de chargement initial de
`AuthGate` indéfiniment. Ce bug est donc probablement présent **depuis
la toute première mise en place de CloudFront** (2026-08-29), pas
introduit par les changements du jour.

Corrigé : nouveau bucket S3 privé `archiaccess-ai-sit-static-638954279923`
(chiffré, accès public bloqué), synchronisé avec `.open-next/assets`
(`aws s3 sync`, cache-control `immutable` sur les assets versionnés,
`no-cache` sur `BUILD_ID`). Ajouté comme deuxième origine de la
distribution CloudFront (`E1A2P5LIOXBTN1`) via une Origin Access Control
(OAC) — accès restreint à cette distribution précise via la bucket
policy, pas de bucket public. Trois nouveaux cache behaviors
(`_next/*`, `BUILD_ID`, `noise.png`) routés vers cette origine S3 avec
la policy managée `CachingOptimized` (au lieu de `CachingDisabled` sur
le comportement par défaut Lambda — ces fichiers sont immuables/versionnés,
donc cache long légitime, contrairement aux pages dynamiques/authentifiées).
Les routes `/sit/icon.png` et `/ai/icon.png` (générées dynamiquement par
Next.js, pas des fichiers statiques) continuent de passer par le
comportement par défaut vers Lambda, sans changement. **Testé bout en
bout avec succès** : tous les bundles JS/CSS/fonts/images référencés par
la page rendent 200 avec le bon `content-type`, sur les deux domaines.
**Point de vigilance pour la suite** : à chaque nouveau déploiement, il
faudra désormais synchroniser `.open-next/assets` vers ce bucket S3 EN
PLUS de déployer le zip Lambda — sinon ce même bug (page qui ne
s'hydrate jamais) reviendra dès que les noms de fichiers hashés changent
entre deux builds.

**Comptes employés individuels + refonte visuelle du chat — codé, PAS
ENCORE déployé** (2026-08-30, suite à retour utilisateur avec capture
d'écran d'une interface de chat de référence et demande explicite : logo
partout, chat façon "IA du marché", comptes individuels). Deux décisions
tranchées avec l'utilisateur via question directe : comptes créés par
l'admin lui-même (pas d'auto-inscription/invitation email), et le mot de
passe d'équipe AEO partagé est **remplacé entièrement** (pas gardé en
complément) — ce qui annule le point d'intégration avec `archiaccess-pro`
documenté en tête de ce fichier (`getAeoSharedPassword()` supprimé de
`lib/secrets.ts`, plus aucune lecture du secret `archiaccess-pro/aeo-password`).

- `prisma/schema.prisma` : nouveau modèle `User` (email unique, hash de
  mot de passe, `isAdmin`, `active`, `mustChangePassword`). `Session` et
  `Conversation` référencent maintenant `userId` au lieu de `sessionId` —
  l'historique de conversation devient donc par utilisateur (persiste
  entre reconnexions) plutôt que par session éphémère.
- `lib/password.ts` : hachage par `scrypt` (module `crypto` natif de
  Node, pas de dépendance bcrypt/argon2 à bindings natifs — évite un
  risque connu de ce projet avec le bundling Lambda). Génère aussi des
  mots de passe temporaires lisibles (sans caractères ambigus 0/O/1/l).
- Auth : `POST /api/auth/login` prend maintenant `{ email, password }`.
  `POST /api/auth/bootstrap` crée le tout premier compte (admin) — actif
  uniquement tant que la table `User` est vide, se ferme de lui-même
  ensuite. `POST /api/auth/change-password` gère le changement de mot de
  passe obligatoire après un mot de passe temporaire.
- Admin : `GET/POST /api/admin/users` + `PATCH /api/admin/users/[id]`
  (réservés aux comptes `isAdmin`) — créer un compte génère un mot de
  passe temporaire renvoyé **une seule fois** dans la réponse (jamais
  stocké en clair), à transmettre à l'employé. Désactiver plutôt que
  supprimer (traçabilité). Page `/admin` pour l'utiliser sans passer par
  l'API directement.
- `components/auth-gate.tsx` : refonte complète — logo + nom d'app
  configurables par écran (prop `logoSrc`/`appName`, voir `/logo-ai.png`
  et `/logo-sit.png` dans `public/`, copiés depuis les logos déjà
  téléchargés pour les favicons), écran de connexion email+mot de passe,
  écran de changement de mot de passe forcé, écran de création du premier
  compte (affiché automatiquement quand `/api/auth/me` signale
  `bootstrapNeeded`). Expose `useUser()` (contexte React) pour que les
  pages filles accèdent à l'utilisateur connecté sans re-fetch.
- `app/ai/page.tsx` refait dans l'esprit de la référence fournie par
  l'utilisateur (capture d'écran d'une IA du marché) : barre latérale
  avec logo, bouton "Nouvelle conversation", historique des conversations
  (`GET /api/mistral/conversations`, `GET`/`DELETE
  /api/mistral/conversations/[id]`), nom de l'utilisateur + déconnexion.
  Écran d'accueil du chat (aucune conversation active) avec logo, message
  de bienvenue personnalisé, suggestions de prompts orientées AMO/OPC.
  `app/api/mistral/chat/route.ts` : la conversation est maintenant scopée
  par `userId` (un employé ne peut plus continuer/lire la conversation
  d'un autre en devinant un id — ce n'était pas vérifié avant), titre
  auto-généré depuis le premier message.
- `app/page.tsx` et `app/sit/page.tsx` : logo ajouté en en-tête, lien
  "Administration" affiché sur l'accueil si `isAdmin`.
- Migration Prisma écrite à la main
  (`prisma/migrations/20260830200000_user_accounts/`) plutôt que générée
  par `prisma migrate diff --from-migrations` : cette commande a besoin
  d'une shadow database (connexion TCP réelle) pour rejouer l'historique,
  indisponible depuis cet environnement (voir plus haut, limite
  structurelle). Écrite à la main à partir du schéma déjà appliqué
  (vérifié via `psql` lors de la migration initiale) : crée `User`,
  ajoute `userId` à `Session`/`Conversation`, **purge les données de test
  existantes** (`TRUNCATE ... CASCADE`) plutôt que de les migrer — aucune
  n'a de `userId` valide vers lequel les rattacher, et ce ne sont que des
  échanges de test de cette session, pas de vraies données employé.
- **Déployé et testé bout en bout avec succès** (2026-08-30, avec de
  nouvelles credentials AWS). Migration appliquée via bastion EC2 + SSM :
  **échec partiel à la première tentative**, instructif — `ALTER TABLE
  "Conversation" DROP COLUMN "sessionId"` supprime automatiquement
  l'index qui portait dessus (comportement Postgres), donc le `DROP
  INDEX "Conversation_sessionId_idx"` explicite qui suivait dans le
  script a échoué ("l'index n'existe pas"). Prisma ne rollback pas
  forcément tout le script en cas d'erreur à mi-chemin (le `User` table
  et les colonnes déjà ajoutées étaient bien présentes) : complété à la
  main via `psql` (les deux statements restants) puis `prisma migrate
  resolve --applied` pour lever le blocage. **Fichier de migration
  corrigé dans le dépôt** (le `DROP INDEX` explicite retiré, avec un
  commentaire expliquant pourquoi) pour qu'un déploiement futur sur une
  base fraîche n'ait pas le même problème. Bastion de migration nettoyé
  après usage (instance, rôle IAM, règle de security group temporaire).
- Build OpenNext + déploiement Lambda + synchronisation du bucket S3 des
  assets statiques (voir le point de vigilance plus haut) — **découvert
  au passage** : les deux logos (`public/logo-ai.png`,
  `public/logo-sit.png`) sont eux aussi des fichiers statiques servis
  par Next.js à la racine, donc soumis au même problème que `noise.png`
  (voir plus haut) — deux nouveaux cache behaviors CloudFront ajoutés
  (`logo-ai.png`, `logo-sit.png` → origine S3, `CachingOptimized`) en
  plus de la synchronisation S3. **À ne pas oublier pour tout futur
  fichier statique ajouté à `public/`** : soit il correspond déjà à un
  pattern existant (`_next/*`), soit il faut un nouveau cache behavior
  dédié, sinon 404 silencieux dans le navigateur.
- Testé bout en bout contre la vraie infrastructure : création d'un
  compte de test via `/api/auth/bootstrap` (confirmé qu'il se ferme bien
  une fois un compte créé), connexion, chat avec persistance de
  l'historique (`/api/mistral/conversations`), tout en HTTP 200. Compte
  de test supprimé directement en base ensuite (pas d'API de suppression
  définitive, seulement désactivation — voir plus bas) pour que le
  **vrai** premier compte (celui de l'utilisateur) puisse encore passer
  par l'écran de bootstrap, qui ne fonctionne qu'une seule fois tant
  qu'aucun compte n'existe.
- **Prêt pour l'utilisateur** : `bootstrapNeeded: true` confirmé en
  direct sur `sit.archiaccess.com` et `ai.archiaccess.com` — le premier
  écran affiché sera la création du compte administrateur.
- **Reste à faire si jugé utile, pas demandé explicitement** : rôles plus
  fins que admin/non-admin, page dédiée "changer mon mot de passe" en
  dehors du flux forcé de première connexion, suppression définitive d'un
  compte (actuellement seulement désactivation).

**Corrigé, pas encore déployé : la création de compte (bootstrap compris)
ne doit apparaître QUE sur `/admin`, jamais sur `/`, `/sit` ou `/ai`**
(2026-08-30, retour utilisateur immédiat après le déploiement ci-dessus) —
"la création de compte ne doit pas se faire sur ai.archiaccess.com, mais
moi qui crée les comptes". Le comportement précédent (AuthGate affichait
automatiquement l'écran de création du premier compte dès que la table
`User` était vide, sur les trois écrans partagés) exposait un formulaire
de création de compte à quiconque visitait le chat avant que l'admin ait
eu le temps de créer son propre compte — pas le modèle voulu : c'est
l'utilisateur (admin) qui doit être seul à initier la création de
comptes, via une page dédiée qu'il visite délibérément.

Corrigé : `components/auth-gate.tsx` — `AuthGate` (utilisé par `/`,
`/sit`, `/ai`) ne vérifie plus `bootstrapNeeded` du tout, affiche
toujours un formulaire de connexion classique même si aucun compte
n'existe encore (`BootstrapForm` exporté mais plus jamais monté depuis
ce composant). `app/admin/page.tsx` fait maintenant sa propre vérification
de `bootstrapNeeded` avant même de passer par `AuthGate` (qui suppose un
compte existant pour se connecter) : si aucun compte n'existe, affiche
directement `BootstrapForm` ; sinon, flux normal (connexion puis
vérification `isAdmin`). `/admin` reste donc le seul endroit de
création de compte, premier compris — mais accessible sur les deux
sous-domaines (même Lambda), pas restreint à un seul pour l'instant.
`tsc --noEmit` et `next build` passent. **Déployé et vérifié** (nouvelles
credentials) : `bootstrapNeeded` n'apparaît plus que dans le chunk
compilé de `/admin`, plus nulle part ailleurs — confirmé en inspectant le
bundle `.open-next` déployé. `sit.archiaccess.com` et `ai.archiaccess.com`
affichent bien un formulaire de connexion classique à la racine.

**Bug découvert juste après par l'utilisateur (capture d'écran) : logo
cassé (icône d'image manquante) sur l'écran de connexion** — cause :
`next/image` génère par défaut une URL d'optimisation à la volée
(`/_next/image?url=...`), qui doit être servie par une Lambda séparée
(`image-optimization-function` côté OpenNext) — jamais déployée, seule la
Lambda principale l'est (voir `open-next.output.json`, comportement
`_next/image*` → origine `imageOptimizer`, sans équivalent côté
CloudFront). Ces requêtes tombaient donc sur la Lambda principale, qui ne
sait pas y répondre — échec silencieux, pas d'erreur visible en dehors de
l'icône cassée. Corrigé avec `images: { unoptimized: true }` dans
`next.config.mjs` : plutôt que de déployer et maintenir une Lambda de
plus pour quelques logos fixes qui n'ont besoin d'aucun redimensionnement
dynamique, `next/image` sert désormais l'URL brute (`/logo-ai.png` etc.)
directement. Testé : les deux logos répondent 200 en `image/png` sur les
deux domaines.

**Premier compte admin créé par l'utilisateur avec succès** (2026-08-30,
via `/admin`, bootstrap fermé et vérifié comme prévu). Suite à ça,
plusieurs retours rapides traités et déployés dans la foulée :

- **Logo recadré/trop petit sur les écrans de connexion** : les classes
  `rounded-2xl`/`rounded-xl`/`rounded-lg` appliquées au conteneur
  `next/image` rognaient les coins du logo au lieu de le laisser
  s'afficher tel quel. Retiré partout, tailles augmentées sur les écrans
  où le logo est mis en avant (connexion, bootstrap, changement de mot
  de passe, écran d'accueil du chat). Texte de l'écran de connexion
  repris deux fois selon retours successifs, version finale : "Plateforme
  interne Archiaccess — accès réservé à l'équipe Archiaccess."
- **Chat `/ai` : lien "Administration" absent** — je ne l'avais ajouté
  que sur la page d'accueil (`app/page.tsx`), aucun moyen d'atteindre
  `/admin` depuis l'écran de chat lui-même. Ajouté dans la sidebar du
  chat (visible seulement si `isAdmin`).
- **Chat `/ai` : mise en page cassée (collée à gauche)** — le conteneur
  principal n'avait pas `justify-center`, donc le panneau (`max-w-5xl`)
  restait plaqué au bord gauche sur un écran large au lieu d'être
  centré. Corrigé, puis l'utilisateur a demandé mieux : un vrai plein
  écran façon ChatGPT/Claude (sidebar collée au bord, pas de carte
  flottante avec marges), en gardant le même CSS (`liquid-glass-panel`,
  `chrome-black`, etc.) sur la sidebar et les bulles — seul le
  conteneur extérieur a changé (`h-screen w-full`, plus de
  `rounded-3xl`/`max-w-6xl`/marge). Le fil de conversation et la barre
  de saisie gardent `max-w-3xl` centré pour rester lisibles sur un très
  grand écran, comme ChatGPT/Claude le font aussi. Sidebar responsive :
  visible en permanence à partir de la largeur tablette, repliée en
  tiroir sur mobile (bouton hamburger + overlay).
- **Le copilote révélait le modèle/fournisseur sous-jacent** : à "Tu es
  quel modèle d'IA ?", il répondait "Je suis un grand modèle de langage
  développé par Mistral AI." — trop d'information technique exposée à
  l'employé. Ajout d'une section "Identité" au prompt système
  (`app/api/mistral/chat/route.ts`) : le copilote se présente uniquement
  comme "Archiaccess AI", sans jamais citer de fournisseur ni de nom de
  modèle technique, même sur demande directe. Testé et confirmé par
  l'utilisateur : "Je suis Archiaccess AI, l'assistant interne
  d'Archiaccess."

**SIT redéfini et refait en tableau de bord — connecteurs Urbanisme, DPE,
BODACC ajoutés** (2026-08-31, pas encore déployé). Discussion avec
l'utilisateur sur le rôle du SIT avant de coder quoi que ce soit (comme
demandé) : "un système d'information là où il y a de la big data pour
réaliser des études... un peu comme les traders... la capacité à
rechercher les infos et Archiaccess AI pour épauler" — plus un
formulaire séquentiel centré sur l'adresse, mais un vrai tableau de bord
dense, recherche universelle (pas seulement une adresse), panneau IA
intégré qui combine résumé automatique ET chat libre (les deux, pas l'un
ou l'autre).

- `app/sit/page.tsx` réécrit : recherche universelle (`/api/sit/search`,
  nouveau, remplace `search-address/`) — détecte un SIREN/SIRET par motif
  (9 ou 14 chiffres) pour chercher une entreprise directement, sinon
  tente adresse ET entreprise en parallèle (`Promise.allSettled`, l'une
  peut échouer sans faire échouer l'autre). Résultats affichés en grille
  de tuiles simultanées (adresse, cadastre, urbanisme, risques, DVF, DPE,
  entreprises) plutôt que scrollés section par section. Layout plein
  écran comme `/ai` (voir plus haut), panneau Archiaccess AI permanent à
  droite (sous le contenu sur petit écran).
- `lib/data-sources/entreprises.ts` (nouveau) : API Recherche
  d'entreprises (data.gouv.fr/DINUM, données SIRENE/RNE, sans clé) —
  recherche par nom ou SIREN/SIRET, validé par appel réel (retourne même
  la fiche réelle d'Archiaccess, SIREN 909816696).
- `lib/data-sources/urbanisme.ts` (nouveau) : zonage PLU/POS d'une
  parcelle via l'API GPU de l'IGN, même stratégie bbox que le cadastre
  (voir plus haut) pour ne pas rater la zone si le géocodage tombe
  légèrement à côté.
- `lib/data-sources/dpe.ts` (nouveau) : diagnostics de performance
  énergétique du bâti existant, API ADEME. Recherche par bbox
  géographique plutôt que code postal seul — un code postal peut couvrir
  des dizaines de milliers de DPE (110 000+ rien que sur Reims), une
  bbox resserrée autour de l'adresse ramène ceux du bâtiment concerné et
  de ses voisins immédiats.
- `lib/data-sources/bodacc.ts` (nouveau) : annonces légales par SIREN
  (procédures collectives, dépôts de comptes...), chargées automatiquement
  pour chaque entreprise trouvée et affichées dans la tuile Entreprise
  plutôt qu'une tuile séparée.
- **Chaque source vérifiée par appel réel avant d'écrire le code** (comme
  toujours sur ce projet) : le nom exact du dataset ADEME a dû être
  retrouvé (le premier essayé, `dpe-v2-logements-existants`, n'existe
  plus — le bon est `meg-83tjwtg8dyz4vv7h1dqe`), la syntaxe `qs`/`select`
  et le support `bbox` de l'API data-fair d'ADEME vérifiés en direct, le
  filtre BODACC par SIREN (`registre:XXXXXXXXX`) vérifié avec un vrai
  SIREN ayant un historique d'annonces.
- **Mérimée (monuments historiques) pas retenu pour l'instant** :
  l'ancienne API data.culture.gouv.fr a changé de plateforme, je n'ai pas
  trouvé de remplaçant national qui marche (seulement un miroir
  départemental Isère, insuffisant) — à reprendre si jugé prioritaire.
- `app/api/mistral/chat/route.ts` : accepte maintenant un champ `context`
  optionnel (message système injecté avant l'historique) — c'est ce que
  le panneau IA du SIT utilise pour que le copilote réponde avec les
  données actuellement chargées sans que l'employé ait à tout recopier.
  Absent depuis `/ai`, comportement inchangé là-bas.
- **Point technique retenu** : la construction du contexte envoyé à l'IA
  est passée d'une lecture du state React (risque de valeurs pas encore
  à jour juste après un `setState`, `setState` étant asynchrone) à un
  instantané explicite (`SitSnapshot`) construit à partir des données
  fraîchement récupérées à chaque étape — plus robuste, à réutiliser si
  d'autres panneaux IA contextuels sont ajoutés ailleurs.
- `tsc --noEmit` et `next build` passent, toutes les nouvelles routes
  apparaissent dans le build. **Pas encore déployé** au moment d'écrire
  ceci — build OpenNext prêt, en attente de nouvelles credentials AWS.
- **Prochaine étape explicite de l'utilisateur** : avant d'ajouter
  d'autres sources ("le coffre de data"), il veut qu'on fasse une
  recherche commune pour lister toutes les API/bases de données
  candidates, PUIS que je me contente d'exécuter ce qui aura été
  sélectionné — ne pas proposer/ajouter de nouvelles sources de ma
  propre initiative avant ce point de passage.

**SIT + comptes employés déployés, "coffre" (second brain) conçu et câblé
sur les 8 connecteurs existants** (2026-08-31) : le tableau de bord SIT
(urbanisme/DPE/BODACC compris) et le modèle de comptes employés
individuels ci-dessus ont été construits, buildés (`tsc`/`next build`
verts) puis déployés avec succès. Ensuite, discussion "Passons au coffre
du SIT tu propose quoi comme architecture afin que ce soit léger" : j'ai
proposé un cache à TTL, l'utilisateur a corrigé explicitement — **"si le
coffre se rempli au fur et à mesure et le but c'est que ça reste et ne
supprime pas, ça fait office de second brain"**. Conception retenue en
conséquence, dans `lib/data-vault.ts` :
- Table `DataCacheEntry` (`prisma/schema.prisma`, `source` + `cacheKey`
  uniques, `payload` JSON, `fetchedAt`) — **jamais de suppression/purge**,
  accumulation permanente de tout ce qui a été interrogé un jour.
- `withVault(source, cacheKey, fetchLive)` : tente TOUJOURS l'appel live
  en premier (fraîcheur de la donnée) ; en cas d'échec, retombe sur la
  dernière valeur en cache si elle existe (sinon relance l'erreur
  d'origine) ; en cas de succès, upsert best-effort dans `DataCacheEntry`
  (un échec d'écriture du cache n'empêche jamais de répondre).
- Les 8 connecteurs existants (`ban`, `cadastre`, `georisques`, `dvf`,
  `entreprises`, `urbanisme`, `dpe`, `bodacc`) ont chacun été refactorés
  selon le même schéma : la fonction publique appelle `withVault(...)`,
  l'implémentation d'origine devient une fonction privée `fetchXxxLive`.
- Migration écrite à la main (`prisma/migrations/20260831130000_data_cache_entry/`,
  même raison que d'habitude : pas de shadow DB accessible depuis cet
  environnement), appliquée via le bastion EC2 + SSM habituel (voir
  plus haut) — capacité spot indisponible sur le premier sous-réseau
  tenté (`eu-west-3a`), relancé avec succès sur `eu-west-3b`. Bastion
  nettoyé après usage. **Déployé.**

**Recherche commune sur les nouvelles sources ("je veux de tout") —
quatre connecteurs supplémentaires ajoutés au coffre, quatre écartés
pour des raisons d'architecture ou d'absence d'API** (2026-08-31, pas
encore déployé). Suite de "Ok maintenant il faut l'alimenter" : la
liste de candidats proposée à partir des sections **Données** et **API**
de data.gouv.fr a été validée en bloc par l'utilisateur ("En réalité
sans te mentir je veux de tout"). Chaque source vérifiée par appel réel
avant d'écrire du code, comme toujours :

Ajoutés (suivent exactement le pattern `withVault` ci-dessus — connecteur
`lib/data-sources/*.ts`, route `app/api/sit/*/route.ts`, tuile dans
`app/sit/page.tsx`, extension de `formatContext()`/`SitSnapshot`) :
- `lib/data-sources/cavites.ts` — cavités souterraines (carrières, caves,
  ouvrages civils) par commune, `georisques.gouv.fr/api/v1/cavites`.
  Complète le connecteur risques existant : point de vigilance
  géotechnique direct pour une étude AMO/OPC.
- `lib/data-sources/sites-pollues.ts` — sites et sols pollués. **BASOL/
  BASIAS ont été renommés SSP/CASIAS côté Géorisques** (les anciens noms
  d'endpoint `/basol`/`/basias` renvoient 404, le bon est `/api/v1/ssp`)
  — terminologie vérifiée en direct avant d'écrire le code. Combine les
  sites recensés (`casias`) et les instructions en cours
  (`instructions`).
- `lib/data-sources/servitudes.ts` — servitudes d'utilité publique
  (périmètres monuments historiques, réseaux, captages...) via l'API GPU
  de l'IGN, endpoint `assiette-sup-s`. Point notable : contrairement à
  `zone-urba` (urbanisme, a besoin d'une bbox), cet endpoint accepte un
  `Point` directement — vérifié en direct.
- `lib/data-sources/boamp.ts` — marchés publics (BOAMP), même plateforme
  opendatasoft que le BODACC déjà intégré. Recherche par département
  (dérivé du code INSEE de l'adresse via `departmentCodeFromCityCode()`)
  plutôt que par SIREN — vue "marché" locale plutôt que liée à une
  entreprise précise.
- **Piège de bundling découvert en construisant celui-ci** :
  `departmentCodeFromCityCode()` est une fonction pure (pas d'accès
  réseau/DB), mais la définir dans `lib/data-sources/boamp.ts` et
  l'importer depuis le composant client `app/sit/page.tsx` faisait
  échouer `next build` (`Module not found: 'tls'`/`'util/types'`) —
  parce que TOUT le module `boamp.ts` (y compris son import de
  `withVault`/Prisma/`pg`, du code serveur uniquement) se retrouvait
  entraîné dans le bundle navigateur dès qu'une seule valeur (pas un
  type) en était importée côté client. Corrigé en extrayant la fonction
  dans un nouveau fichier neutre `lib/insee.ts`, sans aucune dépendance
  serveur — **à retenir pour tout futur utilitaire partagé entre un
  connecteur serveur et une page client** : le séparer dès qu'il n'a pas
  besoin de `withVault`/Prisma, plutôt que de le laisser dans le fichier
  du connecteur.

Écartés (pas de simple connecteur REST — architecture différente ou
API introuvable, à ne pas construire à l'identique du pattern existant
sans en reparler) :
- **INSEE données carroyées** : uniquement des fichiers statiques
  (shapefile, flux WMS, PDF de documentation) — pas d'API de requête par
  point/commune. Intégrer cette donnée demanderait un pipeline d'import
  ETL (téléchargement + parsing shapefile en base), pas un simple appel
  live comme les autres connecteurs.
- **RPLS (logement social)** : mêmes indices qu'INSEE carroyées — les
  jeux de données data.gouv.fr trouvés sont distribués par commune sous
  forme de fichiers statiques, pas une API interrogeable.
- **transport.data.gouv.fr** : l'API existe et répond
  (`/api/datasets?type=public-transit`), mais c'est un catalogue de flux
  GTFS statiques téléchargeables par réseau de transport, pas une API de
  requête "arrêts à proximité d'un point" comme les autres connecteurs —
  intégrer ça correctement demanderait de télécharger et parser des
  fichiers GTFS, un chantier à part entière plutôt qu'un connecteur de
  plus.
- **Mérimée (monuments historiques)** : confirmé que l'ancienne
  plateforme (`data.culture.gouv.fr`) a bien migré vers
  `culture.data.gouv.fr`/`api.pop.culture.gouv.fr` ("POPv2 API"), mais
  cette nouvelle API ne publie aucune documentation découvrable — une
  dizaine de chemins REST plausibles testés en direct (`/search/merimee`,
  `/notices`, `/collection/merimee`...), tous 404. Toujours pas de point
  d'entrée fonctionnel trouvé — inchangé depuis la première tentative.

`tsc --noEmit` et `next build` passent (les 4 nouvelles routes
apparaissent dans le build). **Déployé et testé bout en bout avec
succès** (2026-08-31, avec de nouvelles credentials AWS) : build
OpenNext, zip Lambda, synchronisation du bucket S3 des assets statiques
— pas de nouveau fichier `public/` cette fois, donc pas de nouveau cache
behavior CloudFront nécessaire. Vérifié en direct : les 4 nouvelles
routes (`/api/sit/cavites`, `/api/sit/sites-pollues`,
`/api/sit/servitudes`, `/api/sit/boamp`) répondent 401 sans session
(gate d'auth active, ni 404 ni 500), `/sit` et `/ai` répondent 200 sur
les deux sous-domaines, un asset statique versionné du dernier build
répond 200 (confirme que le sync S3 a bien pris).

**Demande utilisateur : couvrir aussi les disciplines techniques
d'Archiaccess (structures, géotechnique, thermique, MEP/fluides,
acoustique, TP/VRD, environnement, management de projet, disciplines de
niche — liste complète fournie par l'utilisateur)** (2026-08-31). Point
clarifié avant de coder (comme demandé) : la plupart de ces disciplines
(Eurocodes 2/3/4/5, dimensionnement CVC, acoustique de salle, méthodes
BIM/OPC, scénographie, salles blanches, travaux hyperbares...) ne sont
pas des jeux de données interrogeables par site — ce sont des
savoir-faire d'ingénierie et des textes normatifs, sans équivalent
data.gouv.fr. Question posée à l'utilisateur : connecteurs SIT (données
publiques par site) et/ou corpus normatif pour le RAG existant (pgvector)
d'Archiaccess AI ? **Réponse : les deux, en deux chantiers séparés** — le
second (corpus normatif Eurocodes/DTU/RE2020 indexé dans le coffre RAG
pour l'expertise du copilote) reste à faire, pas commencé.

Premier chantier (connecteurs SIT) démarré, recherche par appel réel
comme toujours :
- **Hub'Eau / niveaux_nappes** (`lib/data-sources/nappes.ts`, nouveau) —
  plateforme API officielle du Service Public Français des Données de
  l'Eau (`hubeau.eaufrance.fr`), stations de mesure piézométrique
  (ADES/BSS) par code commune. Pertinent pour géotechnique/hydrogéologie
  (rabattement de nappe, profondeur d'investigation, aquifère). Validé
  en direct (7 stations trouvées sur Reims, tous les champs confirmés).
- **France Chaleur Urbaine** (`lib/data-sources/chaleur-urbaine.ts`,
  nouveau) — éligibilité d'un point à un réseau de chaleur urbain
  existant ou en projet (`france-chaleur-urbaine.beta.gouv.fr/api/v1/
  eligibility`), endpoint non documenté publiquement, retrouvé par essais
  successifs sur le site officiel puis validé en direct. Pertinent pour
  "Réseaux de chaleur et énergies renouvelables".
- Exposés via `app/api/sit/nappes/route.ts` et
  `app/api/sit/chaleur-urbaine/route.ts`, wirés dans les tuiles du
  tableau de bord et `formatContext()`/`SitSnapshot`, même pattern
  `withVault` que les 12 connecteurs existants.
- **Autres candidats de cette liste testés mais pas encore aboutis** :
  BRGM/BSS (géotechnique, sondages/forages) — dataset trouvé sur
  data.gouv.fr mais aucun endpoint REST fonctionnel retrouvé (webservices
  historiques en 404, tentative WFS bloquée par le proxy de cet
  environnement) ; INPN (écologie/biodiversité, zonages réglementaires) —
  `api.inpn.mnhn.fr` systématiquement rejeté par le proxy sortant de cet
  environnement (502 "policy denial or upstream failure", à re-tester
  depuis un autre environnement) ; **ASN (nucléaire)** — seuls un flux
  RSS et un lexique trouvés sur data.gouv.fr côté ASN, aucun jeu de
  données géolocalisé (installations, zonage) interrogeable — cohérent
  avec le fait que cette discipline est très nichée pour Archiaccess ;
  **index BT/TP et ICC (économie de la construction)** — recherchés à la
  fois sur data.gouv.fr (aucun résultat pertinent) et sur la nouvelle
  plateforme de diffusion INSEE Melodi (`api.insee.fr/melodi`,
  accessible sans clé mais dont le paramètre de recherche `q` du
  catalogue ne semble pas filtrer réellement — mêmes résultats
  génériques quelle que soit la requête, dataset ID exact non
  retrouvé). Aucun des deux n'a abouti dans cette itération — à
  reprendre si jugé prioritaire (l'économie de la construction est une
  discipline coeur pour l'AMO/OPC, contrairement au nucléaire).
- `tsc --noEmit` et `next build` passent (les 2 nouvelles routes
  apparaissent dans le build). **Déployé et testé bout en bout avec
  succès** (2026-08-31, avec de nouvelles credentials AWS) : build
  OpenNext, zip Lambda, synchronisation S3 des assets statiques. Vérifié
  en direct : `/api/sit/nappes` et `/api/sit/chaleur-urbaine` répondent
  401 sans session, `/sit` et `/ai` répondent 200 sur les deux
  sous-domaines.

**Chantier RAG normatif (deuxième chantier convenu, "les deux, en deux
chantiers séparés") — 15 textes réglementaires du domaine public sourcés
et rédigés, indexation bloquée par un problème d'infrastructure AWS
inexpliqué** (2026-09-01). Suite à "Fais en sorte qu'il y est des
données pour toutes ses disciplines" (liste complète des ~40 disciplines
techniques d'Archiaccess) : point bloquant soulevé avant de coder — la
plupart des Eurocodes/DTU/normes EN sont des documents AFNOR/CEN
payants, pas indexables légalement. Question posée à l'utilisateur,
réponse : **indexer uniquement le domaine public** (RE2020, réglementation
incendie/accessibilité/acoustique, décrets parasismiques, guides publics),
le reste s'appuie sur les connaissances générales du modèle Mistral.

- **15 documents sourcés via WebSearch/WebFetch depuis Légifrance et le
  Code du travail/environnement/construction** (texte intégral article
  par article, pas des résumés) : acoustique des bâtiments (arrêté 30
  juin 1999), zonage parasismique/Eurocode 8 (arrêté 22 octobre 2010),
  RE2020 (décret 2021-1004), aération des logements (arrêté 24 mars
  1982), travaux hyperbares (décret 2011-45), nomenclature ICPE
  (R511-9), coordination SPS (R4532-1 à R4532-98), amiante/désamiantage
  (R4412-94 à R4412-148), nomenclature loi sur l'eau/IOTA (R214-1),
  radioprotection/radon (R1333), diagnostic PEMD/réemploi (décret
  2021-821), mission de maîtrise d'œuvre/AMO (R2431-1 à R2431-37,
  ex-loi MOP), sécurité incendie ERP + désenfumage (arrêté 25 juin
  1980), assainissement collectif (arrêté 21 juillet 2015), obligation
  de solarisation des toitures/loi APER (L171-4 CCH).
- **Découverte technique importante** : `legifrance.gouv.fr` est
  protégé par Cloudflare (challenge JS) et rejette systématiquement
  curl/Playwright depuis cet environnement (403/connection reset) —
  mais **le tool WebFetch (infrastructure Anthropic, pas le proxy de cet
  environnement) le traverse sans problème** et extrait le texte intégral
  des articles. À réutiliser pour toute future recherche de texte
  réglementaire français plutôt que de retenter curl/scraping direct.
- Script d'ingestion écrit en JS simple (pas de TS/Prisma, pour tourner
  directement sur un bastion) répliquant `lib/rag.ts::indexDocument()` :
  upload S3 + insertion `Document`/`DocumentChunk` + embeddings
  `mistral-embed`, même schéma que le hub RAG existant.
- **Bloqué à l'étape d'exécution** : le bastion EC2 (rôle IAM
  `archiaccess-ai-sit-rag-ingest-bastion`, permissions Secrets Manager
  database+mistral + S3 documents/ créées) ne s'enregistre jamais auprès
  de SSM, contrairement à tous les bastions précédents de ce projet
  (migrations, DataCacheEntry) qui avaient fonctionné en quelques
  secondes avec un pattern identique. **Quatre tentatives, toutes
  échouées** : sous-réseau privé eu-west-3a puis eu-west-3b (via NAT
  instance), rôle avec redémarrage explicite de `amazon-ssm-agent` en
  user-data, et sous-réseau public avec IP publique directe (contourne
  entièrement le NAT) — aucune n'a produit le moindre appel
  `ssm:UpdateInstanceInformation` en CloudTrail pour ces instances,
  alors que la NAT instance existante (`i-0aa0ec7fe41022b6e`) continue
  d'apparaître "Online" et d'appeler cette API toutes les 2-3 minutes
  sans interruption pendant les mêmes tests — donc SSM fonctionne
  normalement dans le compte/la région, le blocage est spécifique à
  l'enregistrement de **nouvelles** instances. Vérifié et écarté comme
  causes : security groups (RDS autorise déjà tout le CIDR VPC), NACL
  (allow-all par défaut), options de métadonnées IMDS (identiques à la
  NAT instance qui fonctionne), permissions boundary IAM (aucune),
  policy `AmazonSSMManagedInstanceCore` bien attachée. Cause racine
  **non identifiée** — à re-creuser dans une prochaine session
  (vérifier la console Systems Manager directement : Quick Setup,
  Fleet Manager, quota de "managed instances", ou un changement récent
  de configuration du compte non visible via l'API depuis ici).
- **Nettoyé** : les 3 instances EC2 de test créées pour ce diagnostic
  ont toutes été terminées. Le rôle IAM
  `archiaccess-ai-sit-rag-ingest-bastion` et son instance profile sont
  laissés en place (permissions correctes, prêts à réutiliser) plutôt
  que recréés à chaque tentative future.
- Les 15 documents sources restent disponibles dans le scratchpad de
  cette session (`rag-docs/*.md` + `ingest-bundle/` avec le script et le
  bundle S3 déjà uploadé sur `s3://archiaccess-ai-sit-documents-.../ops/
  ingest-bundle.tar.gz`) — rien à resourcer, juste à relancer
  l'ingestion une fois le blocage SSM levé.

Prochaines étapes :
1. Pour un vrai usage (pas juste des tests manuels) : mettre en place un
   redéploiement à chaque changement de code (actuellement manuel via
   CLI depuis cette session — pas de CI/CD), décider si l'app doit vivre
   sur `main` ou rester sur la branche de travail.
2. La NAT instance n'a pas de haute disponibilité (contrairement au NAT
   Gateway managé) — point de défaillance unique assumé pour l'instant
   vu la sensibilité au coût ; à revoir si la fiabilité devient un
   problème concret (ex: une deuxième instance dans une autre AZ avec
   bascule manuelle/scriptée, toujours moins cher qu'un NAT Gateway).

L'utilisateur veut avancer **pas à pas** — ne pas se lancer dans plusieurs
chantiers en parallèle, mais il a aussi demandé de procéder "de manière
automatique" une fois le contexte compris : agis, ne redemande pas la
permission à chaque petite étape, mais documente et committe au fur et à
mesure pour rester traçable.
