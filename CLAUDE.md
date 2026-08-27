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

Prochaines étapes :
1. Clarifier avec l'utilisateur où/si `archiaccess-pro/aeo-password`
   existe, puis ajouter la permission `secretsmanager:GetSecretValue`
   correspondante à la politique du rôle `archiaccess-ai-sit-app`.
2. Une fois l'instance RDS disponible, mettre à jour le secret
   `archiaccess-ai-sit/database` avec le vrai endpoint, activer
   `pgvector`, lancer les migrations Prisma.
3. Résoudre l'accès à `mistral-large-latest` (voir ci-dessus).
4. Tester l'auth et le chat Mistral bout en bout avec ces ressources.
5. Construire le hub de données (études foncières/financières/
   réglementaires, API data.gouv.fr) — pas commencé du tout.
6. Brancher pgvector pour que le copilote s'appuie sur le contenu du SIT.

L'utilisateur veut avancer **pas à pas** — ne pas se lancer dans plusieurs
chantiers en parallèle, mais il a aussi demandé de procéder "de manière
automatique" une fois le contexte compris : agis, ne redemande pas la
permission à chaque petite étape, mais documente et committe au fur et à
mesure pour rester traçable.
