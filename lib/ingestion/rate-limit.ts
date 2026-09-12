// Rate limiting + classification d'erreur pour les runners qui itèrent
// une API publique à haute cardinalité (Géorisques : 34 969 communes ×
// 3 appels) — voir CLAUDE.md, section F du brief Phase 3 : le test réel
// a provoqué un vrai 503 sur geo.api.gouv.fr (probablement dû au volume
// de tests), preuve que l'absence de throttling explicite est un risque
// réel, pas théorique.

export type ErrorClass = "rate_limited" | "unavailable" | "timeout" | "network" | "permanent_client_error" | "invalid_record" | "unknown"

export interface ClassifiedError {
  errorClass: ErrorClass
  retryAfterMs: number | null
  message: string
}

// Classe une erreur réelle (jamais une supposition) : un statut HTTP
// explicite prime, sinon on retombe sur le type d'exception JS.
export function classifyError(error: unknown, status?: number, retryAfterHeader?: string | null): ClassifiedError {
  const retryAfterMs = retryAfterHeader ? parseRetryAfter(retryAfterHeader) : null
  const message = error instanceof Error ? error.message : String(error)

  if (status === 429) return { errorClass: "rate_limited", retryAfterMs, message }
  if (status === 503 || status === 502 || status === 504) return { errorClass: "unavailable", retryAfterMs, message }
  if (status !== undefined && status >= 400 && status < 500) return { errorClass: "permanent_client_error", retryAfterMs: null, message }
  if (error instanceof Error && error.name === "TimeoutError") return { errorClass: "timeout", retryAfterMs: null, message }
  if (error instanceof Error && error.name === "AbortError") return { errorClass: "timeout", retryAfterMs: null, message }
  if (error instanceof TypeError) return { errorClass: "network", retryAfterMs: null, message } // fetch échoue avec TypeError sur panne réseau DNS/connexion
  return { errorClass: "unknown", retryAfterMs: null, message }
}

function parseRetryAfter(header: string): number | null {
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return seconds * 1000
  const date = new Date(header)
  if (!Number.isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now())
  return null
}

// Une erreur "permanente" sur UN enregistrement (4xx hors 429, donnée
// invalide) doit être isolée : log + rejet + continuer. Une
// indisponibilité TEMPORAIRE du fournisseur (429/503/timeout/réseau) doit
// interrompre l'itération et mettre le job en pause (backoff), jamais
// marteler l'API à la ligne suivante.
export function isTransientOutage(c: ErrorClass): boolean {
  return c === "rate_limited" || c === "unavailable" || c === "timeout" || c === "network"
}

// Délai entre deux appels successifs à une même API publique — jamais
// zéro pour une itération à haute cardinalité. Jitter pour éviter que
// plusieurs invocations synchronisées ne cognent au même instant.
export function rateLimitDelayMs(baseMs: number, jitterRatio = 0.3): number {
  const jitter = baseMs * jitterRatio * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(baseMs + jitter))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
