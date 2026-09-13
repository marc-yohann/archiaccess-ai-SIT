import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getDepartementsSorted } from "@/lib/ingestion/departements"

// DRY RUN / estimation (Phase 4, section 17 du brief) — jamais un coût
// AWS inventé (pas d'infrastructure réelle disponible pour le mesurer,
// voir CLAUDE.md). Donne uniquement : nombre de fichiers/partitions
// réels, taille totale RÉELLEMENT mesurée (HEAD sur chaque fichier
// officiel), et une extrapolation de lignes/durée SEULEMENT si une
// référence réelle déjà ingérée existe pour ce dataset — jamais un débit
// supposé.
const BAN_BASE_URL = "https://adresse.data.gouv.fr/data/ban/adresses/latest/csv"
const CADASTRE_BASE_URL = "https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements"

async function headSize(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const cl = res.headers.get("content-length")
    return cl ? Number(cl) : null
  } catch {
    return null
  }
}

// Concurrence limitée — jamais 101 requêtes HTTP simultanées vers une
// même API publique (voir CLAUDE.md, section 17 : "limiter les appels
// API inutiles").
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index
      index += 1
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user?.isAdmin) {
    return NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 })
  }

  const source = new URL(request.url).searchParams.get("source")
  if (source !== "ban" && source !== "cadastre") {
    return NextResponse.json({ success: false, error: "source doit être 'ban' ou 'cadastre'." }, { status: 400 })
  }

  const departements = await getDepartementsSorted()
  const urlFor = (dept: string) =>
    source === "ban" ? `${BAN_BASE_URL}/adresses-${dept}.csv.gz` : `${CADASTRE_BASE_URL}/${dept}/cadastre-${dept}-parcelles.json.gz`

  const sizes = await mapWithConcurrency(departements, 8, (dept) => headSize(urlFor(dept)))
  const knownSizes = sizes.filter((s): s is number => s !== null)
  const totalBytes = knownSizes.reduce((a, b) => a + b, 0)
  const filesReachable = knownSizes.length

  // Extrapolation lignes/durée — SEULEMENT si un manifeste/job réel déjà
  // complété existe pour cette source, jamais un débit supposé.
  const prisma = await getPrisma()
  const dataset = source === "ban" ? "adresses" : "parcelles"
  let estimatedRows: number | null = null
  let estimatedDurationSeconds: number | null = null
  let measuredFrom: string | null = null

  // Débit réel mesuré (lignes/seconde) sur un job d'ingestion RÉELLEMENT
  // exécuté pour cette source, quel que soit son statut (RUNNING ou
  // COMPLETED) — un job en cours donne déjà un débit mesuré valide. Ce
  // débit est celui de CET ENVIRONNEMENT (diagnostic local, pas la Lambda
  // AWS réelle jamais déployée pour ce chantier — voir CLAUDE.md) : jamais
  // présenté comme un débit AWS, toujours étiqueté comme tel dans
  // measuredThroughputNote pour ne pas laisser croire à une mesure de
  // production.
  let rowsPerSecondMeasured: number | null = null
  const throughputPartition = source === "ban" ? "national" : "ingest"
  const throughputJob = await prisma.ingestionJob.findFirst({
    where: { source, dataset: { startsWith: dataset }, partition: throughputPartition, startedAt: { not: null }, recordsRead: { gt: 0 } },
    orderBy: { lastHeartbeatAt: "desc" },
  })
  if (throughputJob?.startedAt) {
    const elapsedSeconds = ((throughputJob.lastHeartbeatAt ?? new Date()).getTime() - throughputJob.startedAt.getTime()) / 1000
    if (elapsedSeconds > 0) rowsPerSecondMeasured = throughputJob.recordsRead / elapsedSeconds
  }

  if (source === "cadastre") {
    const completedManifest = await prisma.datasetManifest.findFirst({
      where: { source: "cadastre", dataset: { startsWith: "parcelles/" }, status: "READY", totalRows: { not: null } },
      orderBy: { createdAt: "desc" },
    })
    if (completedManifest?.totalRows) {
      const rowsPerByte = completedManifest.totalRows / Number(completedManifest.originalSizeBytes)
      estimatedRows = Math.round(rowsPerByte * totalBytes)
      measuredFrom = `manifeste réel ${completedManifest.dataset} (${completedManifest.totalRows} lignes / ${completedManifest.originalSizeBytes} octets mesurés)`
    }
  } else {
    const completedJob = await prisma.ingestionJob.findFirst({
      where: { source: "ban", dataset: "adresses", partition: "national", startedAt: { not: null } },
    })
    if (completedJob?.startedAt && completedJob.recordsRead > 0) {
      const elapsedSeconds = ((completedJob.lastHeartbeatAt ?? new Date()).getTime() - completedJob.startedAt.getTime()) / 1000
      if (elapsedSeconds > 0) {
        measuredFrom = `débit réel mesuré sur le job BAN en cours (${completedJob.recordsRead} lignes en ${Math.round(elapsedSeconds)}s)`
      }
    }
  }

  if (estimatedRows !== null && rowsPerSecondMeasured && rowsPerSecondMeasured > 0) {
    estimatedDurationSeconds = Math.round(estimatedRows / rowsPerSecondMeasured)
  }

  return NextResponse.json({
    success: true,
    source,
    dataset,
    filesTotal: departements.length,
    filesReachable,
    filesUnreachable: departements.length - filesReachable,
    totalBytesMeasured: totalBytes,
    estimatedRows,
    estimatedDurationSeconds,
    measuredFrom,
    measuredThroughputNote:
      rowsPerSecondMeasured !== null
        ? `Débit réel mesuré dans cet environnement de diagnostic (${rowsPerSecondMeasured.toFixed(2)} lignes/s) — PAS une mesure de la Lambda AWS de production, jamais déployée pour ce chantier (voir CLAUDE.md). La durée réelle en production pourra différer.`
        : "Aucun débit mesurable : aucun job d'ingestion réel n'a encore tourné pour cette source dans cet environnement.",
    note:
      estimatedRows === null
        ? "Aucune extrapolation de lignes possible : aucun manifeste réel complété pour cette source encore (voir measuredFrom une fois une première partition ingérée)."
        : undefined,
  })
}
