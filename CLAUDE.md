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

Premier squelette construit et poussé sur `main` :
- Next.js 16 + Prisma 7 (adapter-pg) + Tailwind, mêmes versions
  qu'archiaccess-pro pour rester dans un stack connu.
- Auth par mot de passe d'équipe partagé (`lib/session.ts`,
  `app/api/auth/*`) — lit `archiaccess-pro/aeo-password` dans AWS Secrets
  Manager (voir `lib/secrets.ts`). C'est la SEULE dépendance volontaire
  vers archiaccess-pro : le rôle IAM de ce projet doit avoir un accès en
  lecture seule à ce secret précis, rien d'autre côté Pro (pas de base de
  données partagée, pas d'accès à ses autres secrets).
- Copilote conversationnel minimal (`app/api/mistral/chat/route.ts`,
  `lib/mistral.ts`) — appelle l'API Mistral (`mistral-large-latest`),
  historique de conversation persisté (`Conversation`/`Message` dans
  `prisma/schema.prisma`).
- `tsc --noEmit` et `next build` passent tous les deux.

**Non testé** : aucun appel réseau réel n'a pu être fait depuis
l'environnement où ce squelette a été écrit (politique réseau restrictive,
voir plus bas) — ni Mistral, ni AWS Secrets Manager, ni Postgres. Tout ce
qui précède compile mais n'a jamais tourné en conditions réelles.

Prochaines étapes à faire depuis un environnement à accès réseau ouvert :
1. Provisionner les vraies ressources AWS (secrets, base Postgres, rôle
   IAM), **région eu-west-3 (Paris)** — cohérent avec le choix Mistral pour
   la souveraineté des données. Aucun accès AWS valide n'existe encore,
   demander à l'utilisateur.
2. Tester l'auth et le chat Mistral en conditions réelles.
3. Construire le hub de données (études foncières/financières/
   réglementaires, API data.gouv.fr) — pas commencé du tout.
4. "Second cerveau" (mémoire/connaissance accumulée pour le copilote) :
   extension **pgvector** sur la même base Postgres (pas de service séparé)
   + **S3** pour les documents. PAS agentmemory (outil pensé pour donner de
   la mémoire à un agent codeur sur une machine locale — serveur local,
   stockage sur le poste — inadapté à un backend de production partagé par
   toute une équipe, et de toute façon impossible à héberger localement ici
   faute de stockage/machine dédiée).

L'utilisateur veut avancer **pas à pas** — ne pas se lancer dans plusieurs
chantiers en parallèle, mais il a aussi demandé de procéder "de manière
automatique" une fois le contexte compris : agis, ne redemande pas la
permission à chaque petite étape, mais documente et committe au fur et à
mesure pour rester traçable.

## Contrainte réseau probable

Ce projet appellera l'API Mistral et plusieurs API gouvernementales
françaises (data.gouv.fr et sources institutionnelles). Si les requêtes
sortantes échouent avec un 403 du proxy, c'est une politique réseau
d'environnement trop restrictive — voir `/root/.ccr/README.md` pour le
diagnostic, ne jamais contourner, en parler à l'utilisateur.
