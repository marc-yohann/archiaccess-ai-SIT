// Runner Géorisques — itération exhaustive des communes françaises
// réelles (liste officielle geo.api.gouv.fr, vérifiée en direct : 34 969
// communes — voir CLAUDE.md et le rapport). Pas de fichier bulk trouvé
// pour risques/zonage sismique/radon, mais cardinalité bornée et légère :
// bulkable par itération complète plutôt qu'un fichier. Réutilise
// getRisksForCommune() (lib/data-sources/georisques.ts) tel quel — même
// connecteur déjà vérifié réel, aucune duplication d'appel HTTP.
//
// L'ordre de traitement suit le tri par code INSEE croissant — jamais un
// ordre de priorité métier/géographique. checkpoint.lastCodeInsee est le
// dernier code traité avec succès ou en échec isolé ; la reprise
// continue juste après, sans jamais retraiter ce qui précède.

import { getRisksForCommune } from "@/lib/data-sources/georisques"
import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

const COMMUNES_API_URL = "https://geo.api.gouv.fr/communes?fields=code,nom&format=json"

interface GeorisquesCheckpoint extends IngestionCheckpoint {
  lastCodeInsee: string | null
}

interface Commune {
  code: string
  nom: string
}

let communesCache: Commune[] | null = null

// Liste officielle mise en cache mémoire pour la durée du process
// (Lambda réutilise le contexte d'exécution entre invocations proches) —
// jamais persistée séparément, jamais devinée : refetchée à froid si le
// cache est vide.
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
      index += 1
      read += 1

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
        // Erreur isolée à cette commune (voir CLAUDE.md, section 7 du
        // brief : "une erreur sur une commune ne doit pas arrêter toute
        // l'ingestion") — comptée en rejet, l'itération continue.
        rejected += 1
        errors.push(`${commune.code} (${commune.nom}) : ${error instanceof Error ? error.message : "erreur inconnue"}`)
      }

      lastCodeInsee = commune.code
    }

    const done = index >= communes.length
    const next: GeorisquesCheckpoint = { lastCodeInsee }
    return { read, inserted, updated, rejected, errors, checkpoint: next, done }
  }
}
