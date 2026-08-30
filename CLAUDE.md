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

**Reste à nettoyer** : une deuxième instance bastion (lancée pour un
test bout-en-bout du pipeline RAG complet — embedding→pgvector→recherche
→réponse Mistral avec contexte) et son rôle IAM
`archiaccess-ai-sit-smoketest-bastion` sont restés provisionnés, les
identifiants AWS ayant expiré pendant l'attente de l'enregistrement SSM.
À terminer/supprimer dès la prochaine session avec des identifiants
valides (coût négligeable en attendant, instance spot t3.micro). Ce test
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
- `tsc --noEmit` et `next build` passent tous les deux, toutes les
  nouvelles routes apparaissent dans le build. **Pas encore appliqué ni
  déployé** au moment d'écrire ceci : migration à passer par le bastion
  EC2 + SSM (voir plus haut), puis build OpenNext + déploiement Lambda +
  synchronisation du bucket S3 des assets statiques (voir le point de
  vigilance juste au-dessus) + test de bout en bout réel (création du
  premier compte, connexion, chat). Credentials AWS expirées en cours de
  route, en attente de nouvelles pour continuer.
- **Reste à faire si jugé utile, pas demandé explicitement** : rôles plus
  fins que admin/non-admin, page dédiée "changer mon mot de passe" en
  dehors du flux forcé de première connexion, suppression définitive d'un
  compte (actuellement seulement désactivation).

Prochaines étapes :
1. Pour un vrai usage (pas juste des tests manuels) : mettre en place un
   redéploiement à chaque changement de code (actuellement manuel via
   CLI depuis cette session — pas de CI/CD), décider si l'app doit vivre
   sur `main` ou rester sur la branche de travail.
2. Au-delà des trois connecteurs initiaux, d'autres sources restent
   possibles selon les besoins concrets des études (SIRENE/INSEE,
   BODACC...) — à choisir avec l'utilisateur plutôt qu'anticipées.
3. La NAT instance n'a pas de haute disponibilité (contrairement au NAT
   Gateway managé) — point de défaillance unique assumé pour l'instant
   vu la sensibilité au coût ; à revoir si la fiabilité devient un
   problème concret (ex: une deuxième instance dans une autre AZ avec
   bascule manuelle/scriptée, toujours moins cher qu'un NAT Gateway).

L'utilisateur veut avancer **pas à pas** — ne pas se lancer dans plusieurs
chantiers en parallèle, mais il a aussi demandé de procéder "de manière
automatique" une fois le contexte compris : agis, ne redemande pas la
permission à chaque petite étape, mais documente et committe au fur et à
mesure pour rester traçable.
