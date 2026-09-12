// Runner Géorisques — itération exhaustive des communes françaises
// réelles (liste officielle geo.api.gouv.fr, vérifiée en direct : 34 969
// communes — voir CLAUDE.md et le rapport). Pas de fichier bulk trouvé
// pour risques/zonage sismique/radon, mais cardinalité bornée et légère :
// bulkable par itération complète plutôt qu'un fichier. Réutilise
// getRisksForCommune() (lib/data-sources/georisques.ts) tel quel — même
// connecteur déjà vérifié réel, aucune duplication d'appel HTTP.
//
// Rate limiting obligatoire (Phase 3, section F du brief — un vrai 503 a
// été provoqué pendant la validation, probablement par l'absence de
// throttling) : délai + jitter entre communes, backoff distinct pour une
// indisponibilité temporaire du fournisseur (503/429/timeout/réseau —
// on arrête le lot, le job entier passe en pause) vs une erreur
// permanente sur UNE commune (4xx isolé, donnée invalide — on continue).
//
// L'ordre de traitement suit le tri par code INSEE croissant — jamais un
// ordre de priorité métier/géographique. checkpoint.lastCodeInsee est le
// dernier code traité avec succès ou en échec isolé ; la reprise
// continue juste après, sans jamais retraiter ce qui précède.

import { getRisksForCommune, GeorisquesHttpError } from "@/lib/data-sources/georisques"
import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import { classifyError, isTransientOutage, rateLimitDelayMs, sleep } from "@/lib/ingestion/rate-limit"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

const COMMUNES_API_URL = "https://geo.api.gouv.fr/communes?fields=code,nom&format=json"

// Délai de base entre deux communes — configurable, jamais figé sans
// mesure (voir CLAUDE.md) ; 300ms par défaut = ~3,3 requêtes/s vers
// Géorisques (3 sous-appels/commune, donc ~10 requêtes/s HTTP réelles),
// volontairement prudent pour une API publique sans clé.
function getRateLimitDelayMs(): number {
  const raw = process.env.INGESTION_GEORISQUES_DELAY_MS
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 300
}

interface GeorisquesCheckpoint extends IngestionCheckpoint {
  lastCodeInsee: string | null
}

interface Commune {
  code: string
  nom: string
}

let communesCache: Commune[] | null = null

async function getCommunesSorted(): Promise<Commune[]> {
  if (communesCache) return communesCache
  const res = await fetch(COMMUNES_API_URL, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`API communes (geo.api.gouv.fr) a répondu ${res.status}`)
  const data = (await res.json()) as Commune[]
  communesCache = [...data].sort((a, b) => a.code.localeCompare(b.code))
  return communesCache
}

export class GeorisquesIngestionRunner implements IngestionRunner {
  source = "georisques"
  dataset = "risques-communes"
  partition = "national"

  async runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult> {
    const cp: GeorisquesCheckpoint = (checkpoint as GeorisquesCheckpoint) ?? { lastCodeInsee: null }
    const communes = await getCommunesSorted()

    const startIndex = cp.lastCodeInsee ? communes.findIndex((c) => c.code === cp.lastCodeInsee) + 1 : 0
    const batchSize = getBatchSize(200)
    const delayMs = getRateLimitDelayMs()

    const prisma = await getPrisma()
    let read = 0
    let inserted = 0
    let updated = 0
    let rejected = 0
    const errors: string[] = []
    let lastCodeInsee = cp.lastCodeInsee
    let index = startIndex

    while (index < communes.length && read < batchSize && Date.now() < deadlineMs) {
      const commune = communes[index]

      try {
        const risks = await getRisksForCommune(commune.code)
        const before = await prisma.risque.findUnique({ where: { codeInsee: commune.code }, select: { id: true } })
        await prisma.risque.upsert({
          where: { codeInsee: commune.code },
          create: {
            codeInsee: commune.code,
            commune: risks.commune || commune.nom,
            risks: risks.risks as object,
            seismicZone: risks.seismicZone,
            radonPotential: risks.radonPotential,
          },
          update: {
            commune: risks.commune || commune.nom,
            risks: risks.risks as object,
            seismicZone: risks.seismicZone,
            radonPotential: risks.radonPotential,
          },
        })
        if (before) updated += 1
        else inserted += 1
      } catch (error) {
        const status = error instanceof GeorisquesHttpError ? error.status : undefined
        const retryAfter = error instanceof GeorisquesHttpError ? error.retryAfter : null
        const classified = classifyError(error, status, retryAfter)

        if (isTransientOutage(classified.errorClass)) {
          // Indisponibilité temporaire du fournisseur (429/503/timeout/
          // réseau) — on arrête le lot ICI (sans avancer lastCodeInsee
          // au-delà de cette commune, pour la retraiter) et on remonte
          // l'erreur : le harnais (lib/ingestion/runner.ts) met le job en
          // FAILED avec backoff exponentiel, jamais un retry immédiat.
          throw new Error(`Fournisseur indisponible (${classified.errorClass}) sur ${commune.code} : ${classified.message}`)
        }

        // Erreur permanente sur CETTE commune (4xx isolé, donnée
        // invalide) — isolée, comptée en rejet, l'itération continue
        // (voir CLAUDE.md, section 7 du brief : "une erreur sur une
        // commune ne doit pas arrêter toute l'ingestion").
        rejected += 1
        errors.push(`${commune.code} (${commune.nom}) [${classified.errorClass}] : ${classified.message}`)
      }

      lastCodeInsee = commune.code
      read += 1
      index += 1

      if (index < communes.length && read < batchSize) {
        await sleep(rateLimitDelayMs(delayMs))
      }
    }

    const done = index >= communes.length
    const next: GeorisquesCheckpoint = { lastCodeInsee }
    return { read, inserted, updated, rejected, errors, checkpoint: next, done }
  }
}
