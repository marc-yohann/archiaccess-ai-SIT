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

**Testé en conditions réelles avec une vraie clé API Mistral** :
- `mistral-small-latest` et `mistral-medium-latest` répondent
  correctement (< 1s, HTTP 200).
- **`mistral-large-latest` (et `mistral-large-2512`) timeout
  systématiquement** — 0 octet reçu après 30-45s, alors que la requête
  est strictement identique à celle qui fonctionne pour les autres
  modèles, et que le proxy sortant ne signale aucune erreur de relais.
  Ça pointe vers un problème côté compte Mistral (accès au modèle
  `large` non provisionné, quota/tier insuffisant) plutôt qu'un souci
  réseau ou de code. **`lib/mistral.ts` appelle encore
  `mistral-large-latest`** — jusqu'à résolution, le chat en usage réel
  timeout. À vérifier avec l'utilisateur (tier de la clé API,
  éventuellement demander l'accès à `mistral-large` sur la console
  Mistral) avant de rebasculer `/ai` dessus, ou de choisir un modèle de
  repli (`mistral-medium-latest`) en attendant.
- AWS **pas encore testé** : les premiers identifiants (session
  temporaire via `aws configure export-credentials` depuis CloudShell)
  ont expiré avant d'avoir pu être utilisés (le conteneur a redémarré
  entre l'envoi des identifiants et leur usage). Le CLI `aws` est
  maintenant installé dans l'environnement de session. Prochaine étape :
  redemander l'export à l'utilisateur juste avant de provisionner, pour
  limiter le risque d'expiration.

Prochaines étapes :
1. Résoudre l'accès à `mistral-large-latest` (voir ci-dessus).
2. Provisionner les vraies ressources AWS (secrets, RDS Postgres +
   pgvector, bucket S3, rôle IAM), **région eu-west-3 (Paris)** —
   identifiants à redemander à l'utilisateur (temporaires, expirent
   vite).
3. Tester l'auth et le chat Mistral bout en bout avec ces ressources.
4. Construire le hub de données (études foncières/financières/
   réglementaires, API data.gouv.fr) — pas commencé du tout.
5. Brancher pgvector pour que le copilote s'appuie sur le contenu du SIT.

L'utilisateur veut avancer **pas à pas** — ne pas se lancer dans plusieurs
chantiers en parallèle, mais il a aussi demandé de procéder "de manière
automatique" une fois le contexte compris : agis, ne redemande pas la
permission à chaque petite étape, mais documente et committe au fur et à
mesure pour rester traçable.
