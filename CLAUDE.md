# Archiaccess AI — Système d'Information Technique Fédéré

Briefing pour un agent de codage qui n'a jamais vu ce dépôt. Écrit comme
référence à consulter, pas comme journal de session — pour l'historique
détaillé des décisions (pourquoi telle API plutôt que telle autre, quel
bug a été corrigé quand), voir `git log` : les messages de commit sont
volontairement narratifs et détaillés sur ce projet.

## Ce que c'est

Outil interne pour les collaborateurs back-office d'Archiaccess (bureau
d'études AMO/OPC) : un tableau de bord fédéré (`/sit`) qui agrège des
données publiques françaises par site/entreprise (foncier, risques,
marché, énergie...) pour préparer des études techniques, et un copilote
conversationnel (`/ai`, "Archiaccess AI") pour épauler l'analyse. Les
deux s'appuient sur la même base : `/ai` interroge un corpus
réglementaire indexé, `/sit` alimente son panneau IA avec les données
du site en cours de consultation.

**Population** : employés internes d'Archiaccess (comptes individuels,
créés par un admin). Distinct des rôles AEA/AEE/AEI/AEO d'`archiaccess-pro`
(comptes clients/plateforme, projet séparé) — **aucun couplage** avec
`archiaccess-pro` : pas de données partagées, pas d'infrastructure AWS
commune, pas de secret lu dans l'autre compte/projet. Une tentative
initiale de faire dépendre l'auth d'ici d'un secret partagé côté
`archiaccess-pro` a été abandonnée avant d'être mise en service — aucune
trace de ça dans le code actuel, ne pas la réintroduire.

## Stack technique

- **Next.js 16.3.3** (App Router), **React 19**, **TypeScript 5.7**.
- **Prisma 7** (`@prisma/adapter-pg`, driver `pg`) contre **PostgreSQL 16**
  avec l'extension **pgvector** (recherche par similarité pour le corpus
  réglementaire).
- **Tailwind v4** (`@tailwindcss/postcss`), polices Inter + Geist Mono
  auto-hébergées (`app/fonts/*.woff2`).
- **Mistral AI** — chat (`mistral-medium-latest` actuellement, voir
  "Pièges" plus bas pour pourquoi ce n'est pas `large`) et embeddings
  (`mistral-embed`, dimension 1024).
- **Hébergement AWS eu-west-3 (Paris)**, choisie pour la conformité
  RGPD/souveraineté : RDS Postgres privé (VPC), Lambda (Next.js via
  OpenNext), CloudFront + domaine personnalisé, S3 (documents +
  assets statiques), Secrets Manager. Détails dans "Architecture".
- Sources de données externes : une douzaine d'API publiques
  françaises sans clé (data.gouv.fr, IGN, Géorisques, ADEME, Hub'Eau,
  France Chaleur Urbaine...) — voir `lib/data-sources/`.
- Pas de CI/CD : build et déploiement manuels, décrits plus bas.

## Architecture

### Code

- `app/sit/page.tsx` — tableau de bord fédéré : recherche universelle
  (adresse, entreprise, SIREN/SIRET détecté par motif), tuiles de
  résultats par connecteur, panneau Archiaccess AI contextuel à droite.
  État en cours de refonte visuelle — voir "État actuel".
- `app/ai/page.tsx` — chat avec le copilote : sidebar de conversations
  (`GET/DELETE /api/mistral/conversations`), écran d'accueil avec
  suggestions.
- `app/admin/page.tsx` — gestion des comptes employés (création,
  désactivation), et **seul** endroit où un compte peut être créé
  (bootstrap du tout premier compte compris — voir "Pièges").
- `app/page.tsx` — accueil générique (liens vers `/sit` et `/ai`).
- `components/auth-gate.tsx` — garde d'authentification partagée par
  `/`, `/sit`, `/ai` (formulaire de connexion classique, changement de
  mot de passe forcé) ; expose `useUser()` pour accéder à l'utilisateur
  connecté sans re-fetch. `AuthGate` ne gère jamais la création de
  compte — c'est le rôle exclusif d'`/admin`.
- `proxy.ts` — middleware Next.js (renommé de `middleware.ts` en
  16.3.3) : réécrit `/` vers `/sit` ou `/ai` selon le sous-domaine visité
  (lit le header `x-app-host`, voir "Pièges" pour pourquoi pas `host`).
- `lib/data-sources/*.ts` — un fichier par connecteur (14 actuellement :
  `ban`, `cadastre`, `georisques`, `dvf`, `entreprises`, `urbanisme`,
  `dpe`, `bodacc`, `cavites`, `sites-pollues`, `servitudes`, `boamp`,
  `nappes`, `chaleur-urbaine`). Chaque connecteur suit le même patron :
  une fonction publique qui appelle `withVault(source, cacheKey,
  fetchLive)` (voir `lib/data-vault.ts`), une fonction privée
  `fetchXxxLive` qui fait l'appel réel. `lib/insee.ts` porte les
  utilitaires purs partagés avec le code client (voir "Pièges" —
  jamais mélanger avec du code serveur dans le même fichier).
- `lib/rag.ts` — `indexDocument()` (S3 + Postgres + embedding) et
  `searchSimilarChunks()` (distance cosinus `<=>` en SQL brut, pgvector
  n'est pas modélisable nativement par Prisma). `lib/chunking.ts`
  découpe le Markdown en paragraphes (~1500 caractères).
  `lib/embeddings.ts` appelle `mistral-embed`.
- `lib/mistral.ts` — client REST minimal (pas de SDK officiel).
- `lib/session.ts`, `lib/password.ts` — sessions cookie + hash `scrypt`
  (module `crypto` natif, pas de bcrypt/argon2 à bindings natifs :
  évite un risque de bundling Lambda).
- `lib/secrets.ts` — lecture AWS Secrets Manager au runtime (jamais de
  variable d'environnement en production).
- `lib/storage.ts` — upload/download S3.
- `app/api/sit/*/route.ts` — une route par connecteur, authentifiée par
  cookie de session (`SESSION_COOKIE_NAME` + `isValidSession()`).
  `app/api/sit/documents/bulk` et `.../search-test` sont l'exception :
  authentifiées par jeton `Authorization: Bearer` (secret
  `archiaccess-ai-sit/ingest-token`) plutôt que par session — voir
  "Pièges" pour pourquoi.
- `app/api/mistral/chat/route.ts` — accepte un `context` optionnel
  (message système injecté avant l'historique), c'est ce que `/sit`
  utilise pour donner au copilote les données du site en cours sans
  que l'employé les retape. Construit à partir d'un instantané explicite
  (`SitSnapshot`) plutôt que d'une lecture du state React, pour éviter
  de capturer des valeurs pas encore à jour après un `setState`.

### Modèles Prisma (`prisma/schema.prisma`)

- `User` / `Session` / `Conversation` / `Message` — comptes employés et
  historique de chat, scopés par `userId`.
- `Document` / `DocumentChunk` — corpus indexé pour le copilote
  (`DocumentChunk.embedding` est `Unsupported("vector(1024)")`,
  insertion/recherche via `$executeRaw`/`$queryRaw`).
- `DataCacheEntry` — "coffre" du SIT : `source` + `cacheKey` uniques,
  `payload` JSON, **jamais supprimé/purgé** (accumulation permanente,
  voulu explicitement par l'utilisateur comme mémoire à long terme, pas
  un cache à TTL). `withVault()` tente toujours l'appel live d'abord,
  ne retombe sur le cache qu'en cas d'échec.

### Infrastructure AWS (eu-west-3, VPC `vpc-0ba2ce5e1153a3746`)

- **RDS** `archiaccess-ai-sit-db` (PostgreSQL 16, db.t4g.micro, pgvector
  actif), privé, pas d'accès public. Security group
  `archiaccess-ai-sit-rds` autorise le CIDR du VPC + le security group
  Lambda (`archiaccess-ai-sit-lambda`).
- **Lambda** `archiaccess-ai-sit-app` (nodejs22.x, 1024 Mo, 30s timeout,
  dans le VPC via 2 sous-réseaux privés dédiés
  `172.31.48.0/20`/`172.31.64.0/20`) — bundle produit par
  `@opennextjs/aws`. Function URL en `RESPONSE_STREAM`.
- **NAT instance** (`t4g.nano`, remplace un NAT Gateway managé pour le
  coût — ~3 $/mois au lieu de ~33-40 $/mois) : MASQUERADE via
  `iptables-legacy` sur l'interface `ens5`, unité systemd pour
  persister au redémarrage. **Point de défaillance unique assumé**,
  pas de haute disponibilité contrairement à un NAT Gateway managé.
- **CloudFront** (distribution `E1A2P5LIOXBTN1`,
  `d25lgmry3zntt3.cloudfront.net`) — deux origines :
  - Lambda Function URL (pages dynamiques, `CachingDisabled`), via la
    origin request policy managée `Managed-AllViewerExceptHostHeader`
    (transmet cookies/headers sauf `Host` — nécessaire, une Function
    URL renvoie 403 si elle reçoit un `Host` autre que le sien).
  - Bucket S3 `archiaccess-ai-sit-static-638954279923` (assets
    statiques versionnés : `_next/*`, `BUILD_ID`, `noise.png`,
    `logo-*.png`), via Origin Access Control, `CachingOptimized`.
  - Une CloudFront Function (`archiaccess-ai-sit-preserve-host`,
    `viewer-request`) recopie le vrai `Host` du visiteur dans un
    header `x-app-host` avant que la origin request policy ne
    l'écrase — c'est ce que lit `proxy.ts`.
- **Domaines** : `sit.archiaccess.com` et `ai.archiaccess.com` (DNS chez
  Hostinger, CNAME vers CloudFront), certificat ACM unique (us-east-1,
  SAN) pour les deux.
- **S3** : `archiaccess-ai-sit-documents-638954279923` (documents
  indexés + bundles d'ops ponctuels), `archiaccess-ai-sit-static-*`
  (assets, ci-dessus).
- **Secrets Manager** : `archiaccess-ai-sit/database`,
  `archiaccess-ai-sit/mistral`, `archiaccess-ai-sit/ingest-token`.
- **IAM** : rôle `archiaccess-ai-sit-app` (exécution Lambda — accès aux
  3 secrets ci-dessus, lecture/écriture des 2 buckets S3,
  `AWSLambdaVPCAccessExecutionRole` pour les ENI en VPC).

## Secrets et configuration

Tous les secrets vivent dans **AWS Secrets Manager**, lus au runtime par
`lib/secrets.ts` (jamais de variable d'environnement en production —
seul `.env.example`/`DATABASE_URL` sert pour du dev local direct contre
une base locale, non utilisé en prod). Changer un secret ne nécessite
**pas** de redéploiement (lu à chaque cold start, avec un cache mémoire
par process) — mais changer le **code** qui lit un secret (nouvelle
route, nouveau connecteur) nécessite bien un redéploiement complet
(voir "Déploiement" ci-dessous).

- `archiaccess-ai-sit/database` — JSON `{username, password, host, port,
  dbname}`. Connexion **doit** inclure `?sslmode=require&
  uselibpqcompat=true` (voir "Pièges").
- `archiaccess-ai-sit/mistral` — chaîne brute (pas de JSON), clé API
  Mistral.
- `archiaccess-ai-sit/ingest-token` — jeton Bearer pour
  `/api/sit/documents/bulk` et `/search-test`.

### Déploiement (entièrement manuel — pas de CI/CD)

1. `npx prisma generate && npx next build` (ou `npm run build`) —
   valide `tsc`/le build avant tout.
2. `npx open-next build` — produit `.open-next/`.
3. Zipper `.open-next/server-functions/default` et
   `aws lambda update-function-code --function-name
   archiaccess-ai-sit-app --zip-file ...`.
4. **Étape à ne jamais oublier** :
   `aws s3 sync .open-next/assets/
   s3://archiaccess-ai-sit-static-638954279923/_assets/ --delete`
   (cache-control `immutable` sur les assets hashés, `no-cache` sur
   `BUILD_ID` à part) — sans ça, les nouveaux noms de fichiers hashés
   404 dans le navigateur et React n'hydrate jamais (page bloquée sur
   "Chargement…"). Ce bug s'est produit **deux fois** dans l'histoire
   de ce projet pour cette même raison — voir "Pièges".
5. Toute évolution de schéma Prisma nécessite `prisma migrate deploy`
   depuis l'intérieur du VPC (accès réseau direct à RDS) — voir
   "Pièges" pour comment (bastion EC2+SSM, actuellement cassé).

Identifiants AWS temporaires (CloudShell, courte durée de vie) fournis
par l'utilisateur à la demande — vérifier leur validité
(`aws sts get-caller-identity`) avant tout appel, en redemander dès
expiration.

## Conventions établies

- **Toujours vérifier une source de données externe par un appel réel
  avant d'écrire le connecteur** — endpoints non documentés ou ayant
  changé de nom plusieurs fois constatés en pratique (DVF, BASOL/BASIAS
  → SSP/CASIAS, dataset ADEME renommé...). Ne jamais supposer qu'une
  doc trouvée en ligne est à jour.
- **Ne jamais exposer d'implémentation technique à l'utilisateur final**
  (nom de connecteur brut, code INSEE, clé de cache, nom du fournisseur
  LLM ou du modèle, jargon type "RAG") — le copilote se présente
  uniquement comme "Archiaccess AI", jamais "Mistral" ; l'UI parle en
  langage métier ("Corpus réglementaire", jamais "coffre RAG").
- **Ne jamais ajouter de nouvelle source de données ou fonctionnalité
  de son propre chef** — l'utilisateur avance délibérément pas à pas et
  a explicitely demandé à être consulté avant tout ajout de connecteur
  ou de fonctionnalité non demandée. En revanche, une fois le contexte
  clair sur une tâche donnée, il attend une exécution autonome
  (« agis, ne redemande pas la permission à chaque petite étape ») —
  documenter et committer au fur et à mesure plutôt que tout faire puis
  livrer d'un bloc.
- **Migrations Prisma écrites à la main**, jamais générées par `prisma
  migrate diff` (pas de shadow database accessible depuis les
  environnements Claude Code — TCP brut vers une base de données n'est
  pas supporté par leur proxy réseau).
- **Commits** : messages en français, descriptifs et détaillés (pas de
  format conventional-commits strict), un commit par changement
  logique. Travail effectué sur la branche
  `claude/archiaccess-sit-build-kunkji` (`main` est très en retard,
  quasiment au premier squelette — ne pas s'y fier comme référence de
  l'état du projet). Pas de workflow de PR/review établi à ce jour.
- **CSS** : système de design "verre liquide" partagé avec
  `archiaccess-pro`, entièrement dans `app/globals.css`
  (`@layer components`) — classes `.liquid-glass` / `.liquid-glass-panel`
  / `.liquid-glass-soft` / `.liquid-glass-pill` / `.chrome-black` /
  `.chrome-white` / `.glass-scene` / `.custom-scrollbar`. **Ne jamais
  introduire une nouvelle palette de couleurs ou une nouvelle police**
  pour une fonctionnalité ou un écran — toujours réutiliser ce système
  existant, y compris quand une exploration visuelle (maquette,
  artefact) a été faite avec d'autres couleurs/polices à titre de
  référence structurelle uniquement.
- **Style produit** : jamais d'emoji dans l'UI (reste corporate/pro) ;
  jamais de promesse de fonctionnalité non implémentée (export
  Excel/CSV, logging de feedback structuré... ne sont pas construits,
  ne pas les faire promettre par le prompt système du copilote).

## État actuel

**Construit et fonctionnel, déployé en production** :
- Auth par comptes employés individuels (création/désactivation par
  admin uniquement, page `/admin` dédiée).
- Copilote `/ai` avec historique de conversation persisté par
  utilisateur.
- Tableau de bord `/sit` avec recherche universelle et 14 connecteurs
  de données publiques françaises, chacun passant par le "coffre"
  (`DataCacheEntry`, accumulation permanente).
- Corpus réglementaire indexé (pgvector) : 20 documents du domaine
  public (RE2020, incendie ERP, accessibilité PMR/ERP, parasismique,
  acoustique, SPS, amiante, loi sur l'eau, radioprotection, PEMD,
  garanties de construction, CCAG-Travaux, marchés publics...) —
  volontairement limité au domaine public, les Eurocodes/DTU/normes EN
  sont protégés AFNOR/CEN et non indexables légalement.
- Domaines personnalisés `sit.archiaccess.com` / `ai.archiaccess.com`
  opérationnels via CloudFront.

**En cours, pas encore dans le code réel** :
- Refonte visuelle du tableau de bord `/sit` (panneau d'accueil avant
  recherche). Une première version (bandeau d'activité défilant +
  colonnes "Sources fédérées"/"Corpus réglementaire") a été committée
  sur la branche de travail mais **pas déployée**, et est déjà
  dépassée par une exploration plus poussée faite via des artefacts
  Claude (hors dépôt) qui n'a pas encore été portée dans le code :
  contenu du bandeau repensé (signaux "à connaître" — nouveaux marchés
  BOAMP, alertes BODACC, nouveautés du corpus — plutôt qu'un journal
  d'activité interne), 5 portes d'entrée de recherche (point précis,
  secteur, carte, discipline, lot) au lieu d'une seule barre, taxonomie
  des ~40 disciplines techniques Archiaccess reliée au corpus/aux
  sources. **Avant de continuer ce chantier, relire les derniers
  échanges avec l'utilisateur** (pas dans ce fichier, dans la
  conversation) pour savoir exactement où en est la décision — ce
  fichier ne reflète que le code, pas les allers-retours de design en
  cours.
- Renommage "coffre RAG" → "Corpus réglementaire" dans l'UI, décidé
  mais pas encore appliqué dans `app/sit/page.tsx` (ligne contenant
  encore `Corpus réglementaire (coffre RAG)`).

**Explicitement pas fait** :
- Pas de CI/CD (build/déploiement 100 % manuels).
- Pas de rôles plus fins qu'admin/non-admin.
- Pas de suppression définitive de compte (désactivation seulement).
- Pas de page dédiée "changer mon mot de passe" hors du flux forcé de
  première connexion.
- Pas de connecteur pour : BRGM/BSS (géotechnique — pas d'endpoint REST
  fonctionnel trouvé), INPN (écologie/biodiversité — proxy sortant de
  cet environnement le rejette), ASN (nucléaire — aucun jeu de données
  géolocalisé disponible), index BT/TP (économie de la construction —
  aucune source exploitable trouvée), Mérimée (monuments historiques —
  nouvelle API sans documentation découvrable).
- Pas de génération de fichiers Excel/CSV par le copilote, pas de
  logging structuré du feedback utilisateur (mentionnés dans un
  document de consignes fourni par l'utilisateur mais jamais promis
  dans le prompt système, faute d'être construits).

## Pièges déjà rencontrés

- **Oublier la synchronisation S3 des assets statiques après un
  déploiement** → page bloquée indéfiniment sur "Chargement…" dans un
  vrai navigateur (le HTML sert bien, mais le bundle JS hashé 404,
  React n'hydrate jamais). Invisible si on ne teste qu'avec `curl` sur
  les routes API. **S'est produit deux fois.** Toujours faire l'étape 4
  du déploiement ci-dessus, et vérifier qu'une URL de bundle hashé
  répond bien 200 avant de considérer un déploiement terminé.
- **Tout nouveau fichier statique ajouté à `public/`** (logo, image...)
  a besoin soit de correspondre à un pattern de cache behavior
  CloudFront existant (`_next/*`), soit d'un nouveau cache behavior
  dédié — sinon 404 silencieux dans le navigateur, invisible côté
  serveur.
- **`next/image` casse en silence sur ce déploiement** : l'optimisation
  à la volée (`/_next/image?...`) exige une Lambda séparée
  (`image-optimization-function`) jamais déployée ici. Réglé une fois
  pour toutes via `images: { unoptimized: true }` dans
  `next.config.mjs` — ne pas retirer ce réglage sans déployer aussi
  cette Lambda supplémentaire.
- **Connexion RDS avec le driver `pg`** : `sslmode=require` seul échoue
  ("self-signed certificate in certificate chain"), il faut
  `uselibpqcompat=true` en plus (voir `lib/secrets.ts`). Un message
  d'erreur Prisma trompeur ("User was denied access") peut en réalité
  être un problème SSL, pas un problème de mot de passe.
- **Un utilitaire pur (pas de dépendance serveur) placé dans le même
  fichier qu'un connecteur `withVault`/Prisma casse le build** dès
  qu'il est importé côté client (`Module not found: 'tls'`/
  `'util/types'`) — TOUT le module (y compris ses imports serveur) se
  retrouve entraîné dans le bundle navigateur. Toujours extraire ce
  genre d'utilitaire dans un fichier neutre sans dépendance serveur
  (voir `lib/insee.ts`).
- **Le blocage réseau environnemental est structurel, pas applicatif** :
  les environnements Claude Code on the web ne supportent pas le TCP
  brut vers une base de données (documenté dans
  `/root/.ccr/README.md`) — inutile de retenter une connexion directe
  à RDS depuis un futur environnement identique. Contournement établi :
  soit un bastion EC2 + SSM (`aws ssm send-command`, tout en HTTPS),
  soit — préférable pour tout ce qui ne nécessite pas de DDL SQL — une
  route HTTPS authentifiée par jeton secret sur la Lambda déjà
  déployée (elle, a un accès réseau direct au VPC). Voir
  `/api/sit/documents/bulk` comme modèle.
- **Le bastion EC2 + SSM est actuellement cassé sur ce compte AWS** :
  toute nouvelle instance EC2 ne s'enregistre jamais auprès de SSM
  (`ssm:UpdateInstanceInformation` n'apparaît jamais en CloudTrail),
  vérifié indépendant du rôle IAM, de la région et du réseau/VPC (testé
  cross-région, avec le rôle IAM d'une instance qui fonctionne déjà).
  Cause racine non identifiable sans accès AWS Support (plan payant
  requis, pas disponible). **Toute opération nécessitant vraiment ce
  bastion (ex: `prisma migrate deploy`, DDL SQL) est donc bloquée** tant
  que ce n'est pas résolu côté AWS — ne pas reperdre de temps à
  retenter le pattern bastion sans un changement côté compte AWS.
- **CloudFront + Function URL Lambda + sous-domaines** : la origin
  request policy qui transmet le header `Host` du visiteur casse tout
  (403, la Function URL route par son propre nom d'hôte) — il faut la
  policy `Managed-AllViewerExceptHostHeader` qui l'omet. Mais alors le
  middleware applicatif ne peut plus lire `Host` pour distinguer les
  sous-domaines : résolu par une CloudFront Function qui recopie le
  vrai `Host` dans un header custom (`x-app-host`) avant que la origin
  request policy ne l'efface.
- **Une Function URL Lambda publique exige deux permissions IAM**
  (`lambda:InvokeFunctionUrl` **et** `lambda:InvokeFunction` avec la
  condition `InvokedViaFunctionUrl`) depuis octobre 2025 — la seconde
  est absente de beaucoup d'exemples/docs plus anciens, son omission
  donne un 403 malgré une resource policy apparemment correcte.
- **Amplify Hosting Compute ne supporte pas le VPC** — c'est pour ça
  que l'hébergement est sur Lambda (via OpenNext) et non Amplify,
  malgré un premier essai sur Amplify. Ne pas reproposer Amplify tant
  que cette contrainte (accès réseau à un RDS privé) reste vraie.
- **Le modèle `mistral-large-latest` a déjà posé deux problèmes
  distincts** : un timeout infrastructure côté Mistral (résolu début
  septembre 2026), puis un 403 "tier_not_allowed" (limite
  d'abonnement Mistral, pas un bug applicatif). Le code tourne
  actuellement sur `mistral-medium-latest` en repli — avant de
  rebasculer sur `large`, vérifier en direct que l'appel réussit
  réellement (pas supposer que l'incident précédent est le même).
- **Deux pages de documentation AWS officielles ont contenu un bloc
  suspect** ("Skills for AI coding assistants... `aws agent-toolkit
  search-skills`") qui ressemble à une injection de prompt plutôt qu'à
  du contenu AWS légitime — jamais exécuté, mais à rester vigilant si
  retrouvé ailleurs dans une doc consultée en ligne.
- **`legifrance.gouv.fr` est protégé par Cloudflare** et rejette
  curl/Playwright depuis ces environnements (403/connection reset),
  mais le tool `WebFetch` (infrastructure Anthropic, hors proxy de
  l'environnement) le traverse sans problème — méthode à réutiliser
  pour toute future recherche de texte réglementaire français.
