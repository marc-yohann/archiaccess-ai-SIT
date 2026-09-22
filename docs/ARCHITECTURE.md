# Archiaccess AI SIT — Documentation technique

Document de référence pour la finalisation et l'exploitation du Système
d'Information Technique fédéré. Complète `CLAUDE.md` (briefing d'entrée
pour un agent de codage) avec une vue orientée exploitation/industrialisation.
Rédigé lors de la mission de finalisation (audit complet, voir le rapport
final de cette mission pour le détail des vérifications réelles derrière
chaque affirmation ci-dessous). Aucune fonctionnalité n'est documentée
comme disponible si elle n'a pas été vérifiée réellement — voir la section
13 (Limites) pour ce qui reste non démontré.

## 1. Architecture

- **Application** : Next.js 16.3.3 (App Router), React 19, TypeScript 5.7,
  hébergée sur AWS Lambda (`archiaccess-ai-sit-app`, nodejs22.x, 1024 Mo,
  timeout 30s) via OpenNext, exposée par une Function URL
  (`AuthType: NONE`, `InvokeMode: RESPONSE_STREAM`) elle-même derrière
  CloudFront (distribution `E1A2P5LIOXBTN1`).
- **Base de données** : PostgreSQL 16 sur RDS (`archiaccess-ai-sit-db`,
  `db.t4g.micro`, mono-AZ, non publique), extensions PostGIS (données
  spatiales : Site/Parcelle/BatimentPhysique) et pgvector (corpus
  réglementaire indexé). Accès via `@prisma/adapter-pg` (driver `pg`),
  jamais l'ancien moteur binaire Prisma.
- **Ingestion en masse** : une seconde fonction Lambda
  (`archiaccess-ai-sit-ingestion`, mêmes runtime/mémoire/timeout que l'app,
  même VPC/subnets/SG) a été déployée pour isoler la charge d'ingestion
  nationale de l'application interactive — **voir Limites (13) : cette
  fonction n'a jamais été invoquée à ce jour** (0 log, 0 invocation
  CloudWatch), et partage encore le même rôle IAM que l'app (isolation
  réseau/calcul réelle, isolation de permissions non encore réalisée).
  L'ingestion réelle observée à ce jour (pilotes Phase 5-12) est passée
  par l'app Lambda via `/api/admin/ingestion/run`.
- **Stockage** : S3 (`archiaccess-ai-sit-documents-*` pour le corpus
  réglementaire Markdown, `archiaccess-ai-sit-static-*` pour les assets
  Next.js versionnés).
- **Secrets** : AWS Secrets Manager exclusivement en production
  (`archiaccess-ai-sit/database`, `/mistral`, `/ingest-token`), jamais de
  variable d'environnement.

## 2. Domaines métier

| Domaine | Modèle Prisma | Provenance | Phase |
|---|---|---|---|
| Localisation | `Site` | BAN (Géoplateforme) | 1 |
| Foncier | `Parcelle` | Cadastre (Apicarto + bulk Etalab) | 1, 4 |
| Bâtiment physique | `BatimentPhysique` | RNB (bulk uniquement) | 5C |
| Logement diagnostiqué | `Unite` (ex-Batiment) | DPE ADEME | 1, 7 |
| Entreprises | `Acteur`/`Etablissement` | SIRENE, BODACC | 2, 8 |
| Marchés publics | `AvisMarche`/`Lot` | BOAMP | 9 |
| Opérations internes | `Projet` | **Aucune** — saisie manuelle | 10 |
| Documents opérationnels | `DocumentSit` | Manuel, ou réf. BOAMP réelle | 11B |
| Besoins métier/technique | `Besoin` | **Aucune** — saisie manuelle | 12 |
| Corpus réglementaire (RAG) | `Document`/`DocumentChunk` | Indexation manuelle, pgvector | — |
| Risques nationaux | `Risque` | Géorisques (ingestion bulk) | — |

`Projet` et `Besoin` sont des objets **internes de travail** (jamais une
donnée externe canonique) : ils n'ont ni `source` ni `sourceId` propres
(sauf provenance manuelle pour `Besoin`/`DocumentSit`) et sont créés/reliés
uniquement par une action explicite d'un employé — jamais par résolution
automatique par similarité de texte, adresse ou montant.

## 3. Graphe de données

```
SITE ↔ PARCELLE ↔ BÂTIMENT PHYSIQUE
SITE ↔ UNITÉ/DPE
SITE ↔ ACTEUR (via Etablissement, résolution BAN déterministe)
SITE ↔ PROJET ↔ AVIS MARCHÉ ↔ LOT
       ↔ DOCUMENT SIT
       ↔ BESOIN
ACTEUR ↔ PROJET / AVIS MARCHÉ (acheteur, titulaire) / LOT (titulaire) / DOCUMENT SIT / BESOIN
```

Toutes les relations Projet/AvisMarche/Lot/DocumentSit/Besoin sont des
tables de jointure N:N dédiées (`@@unique` sur la paire, index dans les
deux sens, `onDelete: Cascade`), jamais une FK simple — chaque phase a
démontré par l'audit qu'un objet réel peut être relié à plusieurs objets
du domaine voisin (ex. un Lot peut concerner plusieurs Besoins et
inversement).

**Navigation API** : chaque domaine expose une route
`GET /api/sit/<domaine>/[id]` qui retourne l'objet et **la totalité** de
ses relations directes (corrigé lors de la mission de finalisation pour
`Site`/`Acteur`/`Projet`, qui n'exposaient pas encore toutes leurs
relations réelles — voir le rapport final, Phase I). Il n'existe pas de
route de détail dédiée pour `AvisMarche`/`Lot` seuls : leur navigation
passe par les routes qui les rattachent (`Projet`/`DocumentSit`/`Besoin`).
La navigation transitive complète (ex. Site → Projet → AvisMarche) se
fait en chaînant ces appels, pas via un seul appel profondément imbriqué.

## 4. Sources externes et provenance

14 connecteurs (`lib/data-sources/*.ts`), tous sans clé API, chacun passant
par `lib/data-vault.ts::withVault(source, cacheKey, fetchLive)` : tente
toujours l'appel live d'abord, ne retombe sur `DataCacheEntry` (coffre
JSON permanent, jamais purgé) qu'en cas d'échec. BAN migré de
`api-adresse.data.gouv.fr` (déprécié) vers `data.geopf.fr/geocodage`
(Phase 8.5, contrat JSON vérifié identique par appels comparatifs réels).

Règle de provenance : tout enregistrement issu d'une source externe porte
`source`/`sourceId`/`sourceUrl`/`retrievedAt` quand la source les fournit ;
un champ resté vide signifie « aucune source réelle ne le fournit
actuellement », jamais une valeur devinée. Les statuts de résolution
(`PENDING`/`VALID`/`NOT_FOUND`/`AMBIGUOUS`, ex.
`EtablissementSiteResolutionStatus`, `UniteResolutionStatus`,
`ReferenceStatus`) ne convertissent jamais automatiquement un `AMBIGUOUS`
en `VALID` — vérifié dans le code (`app/api/sit/acteurs/route.ts`) : seule
une résolution `VALID` déterministe crée un rattachement, un statut déjà
`VALID` n'est jamais rétrogradé par une tentative ultérieure infructueuse.

## 5. Ingestion

Deux modes coexistent :
- **À la demande** (`lib/data-sources/*.ts`) : un employé recherche une
  adresse/entreprise, la donnée est récupérée en direct et mise en coffre.
- **En masse** (`lib/ingestion/*`, `IngestionJob`) : partitionnement par
  source/dataset/partition (ex. département), `checkpoint` JSON propre à
  chaque runner, reprise par relecture de `IngestionJob.checkpoint`,
  backoff via `nextRunAt`/`retryCount`. Gros fichiers bulk (SIRENE, RNB,
  Cadastre) découpés une seule fois en chunks indépendants
  (`DatasetManifest`/`DatasetChunk`) plutôt que redécompressés à chaque
  reprise.

**Idempotence vérifiée réellement** (mission de finalisation, Phase M) :
un job BOAMP relancé depuis zéro sur des données déjà ingérées ne crée
aucun doublon (0 insertion, mise à jour de toutes les lignes déjà
connues) ; une reprise réelle depuis un checkpoint avance bien au-delà du
point déjà traité (aucune perte, aucune régression du curseur) ; les
relations enfants (Lot) ne présentent aucun doublon après un rejeu.

## 6. Résolution et déduplication

Toute résolution spatiale/de référence suit le même principe : ne jamais
choisir arbitrairement un candidat en cas d'ambiguïté. `ST_Covers` (pas
`ST_Contains`) pour Unité→BâtimentPhysique afin de ne pas rejeter un point
exactement sur une frontière ; `SPATIAL_CONTAINS` (ingestion bulk, fiable)
distinct de `SPATIAL_NEARBY` (recherche à la demande, par emprise) pour
Site↔Parcelle ; toutes les résolutions Etablissement→Site passent par
`resolvePreciseAddress()` (BAN), jamais un simple score-seuil.

## 7. Migrations

19 migrations Prisma, toutes **écrites à la main** (pas de `prisma migrate
diff`, aucune shadow database accessible depuis cet environnement),
**additives uniquement** — aucune n'a jamais supprimé de colonne/table en
production. Rejouées intégralement avec succès sur base locale fraîche à
chaque phase (dernière vérification : mission de finalisation, 19/19 OK).
Déploiement production : `/api/admin/run-migration` (route admin,
checksum SHA-256 vérifié identique au fichier `.sql` source avant chaque
ajout).

## 8. API

Convention uniforme pour les domaines Projet/DocumentSit/Besoin :
`GET/POST /api/sit/<domaine>`, `GET/PATCH /api/sit/<domaine>/[id]`, et une
paire `POST` (rattacher, `upsert` idempotent)/`DELETE` (détacher,
`deleteMany` idempotent) par relation N:N. Toutes les routes `/api/sit/*`
exigent une session valide (cookie, `isValidSession()`/`getSessionUser()`).
Toutes les routes `/api/admin/*` exigent en plus `isAdmin: true`, sauf
`/api/admin/ingestion/run` et `/api/admin/ingestion/preprocess` qui, comme
`/api/sit/documents/bulk` et `/api/sit/documents/search-test`, sont
authentifiées par un jeton Bearer (`archiaccess-ai-sit/ingest-token`) —
choix délibéré pour permettre leur invocation depuis un script externe au
navigateur, jamais utilisées comme méthode d'authentification normale
d'un employé.

## 9. AWS

Vérifié réellement (mission de finalisation, avec identifiants AWS
temporaires fournis par l'utilisateur) :
- Quota Lambda concurrent executions : **1000** (dossier AWS clos le
  2026-09-20 — vérifié via `service-quotas` ET `lambda get-account-settings`,
  cohérents), **pas** le défaut de 10 initialement redouté.
- Aucune concurrence réservée configurée sur `archiaccess-ai-sit-app` ni
  `archiaccess-ai-sit-ingestion` — les deux partagent le pool non réservé.
- RDS `archiaccess-ai-sit-db` : quasi inactif au moment de l'audit
  (CPU ~5-6%, ~17,5 Go libres sur 20 Go) — aucune donnée sur son
  comportement sous charge d'ingestion nationale réelle.
- CloudFront : 2 origines (Lambda Function URL + S3 assets), TLS forcé,
  domaines personnalisés opérationnels, **aucun WAF attaché**.
- Sécurité réseau : RDS accessible uniquement depuis le VPC + le SG
  Lambda, jamais publiquement.

## 10. Reprise et robustesse

Voir section 5 — vérifié réellement, pas seulement en théorie, lors de
cette mission (worker interrompu simulé, rejeu intégral, reprise réelle,
rejeu de la reprise).

## 11. Limites connues (état réel, pas une liste de vœux)

- **Isolation app/ingestion incomplète** : Lambda séparée déployée mais
  jamais invoquée, même rôle IAM que l'app.
- **Aucun benchmark d'ingestion à l'échelle** (1/2/3 workers) n'a été
  exécuté contre la RDS de production — le quota Lambda est débloqué mais
  le comportement réel de la RDS (`db.t4g.micro`) sous charge nationale
  reste non démontré.
- **Recherche universelle partielle** : `/api/sit/search` n'interroge
  réellement que BAN (adresses) et SIRENE (entreprises). Les catégories
  Projet/Document/Référence/Besoin de la barre de recherche ne pilotent
  que l'affichage (label/placeholder), pas de requête backend dédiée —
  déjà documenté explicitement dans le code (`app/sit/page.tsx`).
- **RNB (BatimentPhysique)** : aucun connecteur à la demande, uniquement
  un pipeline bulk par département (téléchargement ~96 Mo/département) —
  non re-testé en direct lors de cette mission (validé lors des phases
  5B-5H antérieures).
- **Pas de WAF** devant CloudFront.
- **Pas de couverture nationale** sur aucune source à ce jour — tous les
  pilotes réels se sont limités à un département ou un échantillon.

## 12. Procédures

Voir `CLAUDE.md`, section « Déploiement » (build/zip/upload Lambda + sync
S3 assets — étape systématiquement oubliée deux fois par le passé,
provoquant un écran de chargement infini) et section « Pièges » pour
l'historique des incidents réels et leurs résolutions (SSL RDS,
bastion SSM cassé, CloudFront/Function URL/Host header...).
