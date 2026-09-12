// Types partagés du moteur d'ingestion national — voir CLAUDE.md et
// l'audit "transformation en data platform" du 2026-09-12. Un
// IngestionRunner ne connaît que SA source ; toute la mécanique commune
// (reprise, heartbeat, isolation d'erreurs, budget de temps par
// invocation) vit dans lib/ingestion/runner.ts, jamais dupliquée par
// adapter.

// État de reprise propre à chaque runner (curseur, offset, dernier code
// INSEE traité...) — volontairement non typé ici : chaque adapter définit
// sa propre forme et la caste lui-même, pour ne pas imposer une structure
// commune à des sources qui n'ont rien en commun (fichier bulk vs
// itération d'API).
export type IngestionCheckpoint = Record<string, unknown>

export interface BatchResult {
  // Compteurs de CE lot uniquement — jamais cumulés ici, c'est le rôle de
  // l'appelant (lib/ingestion/runner.ts) de les additionner dans IngestionJob.
  read: number
  inserted: number
  updated: number
  rejected: number
  // Erreurs isolées (ex: une commune en échec) — ne font jamais échouer
  // tout le lot, seulement compter comme rejet.
  errors: string[]
  checkpoint: IngestionCheckpoint
  // true = la source est épuisée, le job peut passer à COMPLETED.
  done: boolean
}

export interface IngestionRunner {
  source: string // "sirene", "georisques"...
  dataset: string // "stock-etablissement", "risques-communes"...
  partition: string // unité de reprise — jamais une zone privilégiée
  datasetVersion?: string

  // Traite un lot borné à partir du checkpoint courant (null = tout
  // premier lot) et retourne avant deadlineMs (Date.now(), pas une durée)
  // — au runner de gérer lui-même ses micro-lots internes jusqu'à cette
  // échéance plutôt que de rouvrir un flux coûteux (ex: le staging SIRENE)
  // à chaque appel. Ne doit jamais lancer d'exception pour une erreur
  // isolable (une commune, une ligne) : ne throw que pour une panne
  // systémique (réseau/DB indisponible), que l'appelant traduit en FAILED
  // + retry avec backoff.
  runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult>
}

// Configurable, jamais figé sans mesure réelle (voir CLAUDE.md,
// contrainte mémoire). Chaque phase a son PROPRE nom de variable
// d'environnement (ne jamais partager "INGESTION_BATCH_SIZE" entre le
// téléchargement — en octets — et le traitement — en lignes/communes —
// deux unités totalement différentes ; les confondre a réellement fait
// dérailler la validation SIRENE : un octet-lot de téléchargement écrasé
// à quelques centaines d'octets, des milliers d'appels HTTP inutiles).
export function getBatchSize(defaultValue: number, envVarName = "INGESTION_BATCH_SIZE"): number {
  const raw = process.env[envVarName]
  if (!raw) return defaultValue
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}

// Budget de temps par invocation — sous le timeout Lambda réel (30s en
// production actuellement, voir CLAUDE.md) avec une marge de sécurité
// pour laisser le temps d'écrire le checkpoint final avant coupure.
export function getMaxBatchDurationMs(defaultValue = 20_000): number {
  const raw = process.env.INGESTION_MAX_DURATION_MS
  if (!raw) return defaultValue
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}
