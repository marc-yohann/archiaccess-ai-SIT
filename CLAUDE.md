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

Dépôt tout juste créé, vide. Rien n'est encore construit. L'utilisateur
veut avancer **pas à pas** — ne pas se lancer dans plusieurs chantiers en
parallèle, attendre ses instructions à chaque étape plutôt que d'anticiper.

## Contrainte réseau probable

Ce projet appellera l'API Mistral et plusieurs API gouvernementales
françaises (data.gouv.fr et sources institutionnelles). Si les requêtes
sortantes échouent avec un 403 du proxy, c'est une politique réseau
d'environnement trop restrictive — voir `/root/.ccr/README.md` pour le
diagnostic, ne jamais contourner, en parler à l'utilisateur.
