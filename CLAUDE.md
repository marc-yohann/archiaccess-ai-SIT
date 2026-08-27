# Archiaccess AI — Système d'Information Technique Fédéré

Outil interne pour les collaborateurs back-office d'Archiaccess (bureau
d'études) réalisant des études techniques sur des marchés AMO/OPC :
analyses techniques, dossiers réglementaires, pilotage de groupements.
**Population distincte** des rôles AEA/AEE/AEI/AEO d'`archiaccess-pro`
(qui sont les comptes clients/plateforme) — ici ce sont les employés
internes d'Archiaccess elle-même.

Projet **volontairement séparé** d'`archiaccess-pro` : pas de couplage aux
données (Missions/Opérations de Pro), pas de partage d'infrastructure AWS.
Seul point de réutilisation prévu : le mot de passe d'équipe AEO existant
sert aussi de porte d'entrée ici (mot de passe partagé, pas un compte
individuel — trivial à réutiliser sans coupler les deux applications).

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
- Auth par mot de passe d'équipe partagé (`lib/session.ts`,
  `app/api/auth/*`) — lit `archiaccess-pro/aeo-password` dans AWS Secrets
  Manager (voir `lib/secrets.ts`). C'est la SEULE dépendance volontaire
  vers archiaccess-pro : le rôle IAM de ce projet doit avoir un accès en
  lecture seule à ce secret précis, rien d'autre côté Pro (pas de base de
  données partagée, pas d'accès à ses autres secrets).
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
qu'il a la même politique réseau. Options pour lancer les migrations
malgré tout, à trancher avec l'utilisateur :
1. Un bastion/instance EC2 dans le VPC, piloté via `aws ssm send-command`
   (API HTTPS, donc compatible avec le proxy de cet environnement) —
   installe psql sur l'instance et exécute le DDL (extension vector +
   tables `Document`/`DocumentChunk`/`Session`/`Conversation`/`Message`)
   sans avoir besoin du toolchain Node/Prisma complet sur le bastion.
   Coût marginal (instance à durée de vie courte), complexité de mise en
   place la plus haute des trois options.
2. L'utilisateur lance `npx prisma migrate dev` lui-même depuis un poste
   qui a un accès réseau normal (son AWS CloudShell actuel peut
   probablement atteindre le RDS si celui-ci est temporairement rendu
   public, ou depuis sa machine locale une fois le repo cloné).
3. Attendre que l'architecture de déploiement de l'app soit tranchée
   (Lambda/ECS dans le même VPC) — le compute applicatif lui-même aura
   un accès réseau normal au RDS, donc les migrations pourront tourner
   depuis là (ex: une migration au démarrage, ou un job one-shot) sans
   ce problème.

Prochaines étapes :
1. Clarifier avec l'utilisateur où/si `archiaccess-pro/aeo-password`
   existe, puis ajouter la permission `secretsmanager:GetSecretValue`
   correspondante à la politique du rôle `archiaccess-ai-sit-app`.
2. Décider avec l'utilisateur laquelle des 3 options ci-dessus pour
   lancer les migrations Prisma (crée l'extension vector + les tables),
   puis tester indexation + recherche pgvector pour de vrai.
3. Résoudre l'accès à `mistral-large-latest` (voir ci-dessus).
4. Tester l'auth, le chat Mistral (avec contexte SIT), la recherche
   d'adresse et l'ingestion de documents bout en bout avec ces
   ressources.
5. Continuer le hub de données : cadastre/parcelles (GPU/apicarto),
   Géorisques (risques réglementaires), DVF (valeurs foncières) — à
   brancher sur l'adresse sélectionnée dans `/sit`.

L'utilisateur veut avancer **pas à pas** — ne pas se lancer dans plusieurs
chantiers en parallèle, mais il a aussi demandé de procéder "de manière
automatique" une fois le contexte compris : agis, ne redemande pas la
permission à chaque petite étape, mais documente et committe au fur et à
mesure pour rester traçable.
