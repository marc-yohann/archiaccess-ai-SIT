import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"

// Couverture SIT — un pourcentage par source avec un dénominateur RÉEL et
// mesurable (voir CLAUDE.md, section L du brief Phase 3 : "ne fabrique
// pas un pourcentage marketing"). Chaque ratio répond à une question
// précise et vérifiable, jamais une estimation.
export interface SourceCoverage {
  source: string
  label: string
  numerator: number
  denominator: number | null // null = dénominateur pas encore connu (ex: manifeste pas encore préprocessé)
  unit: string // ce que numerator/denominator comptent réellement
  status: string
}

export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user?.isAdmin) {
    return NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 })
  }

  const prisma = await getPrisma()
  const coverage: SourceCoverage[] = []

  // SIRENE (StockEtablissement, StockUniteLegale) : chunks ingérés / chunks manifestés.
  for (const dataset of ["stock-etablissement", "stock-unite-legale"]) {
    const manifest = await prisma.datasetManifest.findFirst({ where: { source: "sirene", dataset }, orderBy: { createdAt: "desc" } })
    if (!manifest) {
      coverage.push({ source: `sirene/${dataset}`, label: `SIRENE — ${dataset}`, numerator: 0, denominator: null, unit: "chunks ingérés / chunks manifestés", status: "non démarré" })
      continue
    }
    const [ingested, total] = await Promise.all([
      prisma.datasetChunk.count({ where: { manifestId: manifest.id, status: "INGESTED" } }),
      prisma.datasetChunk.count({ where: { manifestId: manifest.id } }),
    ])
    coverage.push({
      source: `sirene/${dataset}`,
      label: `SIRENE — ${dataset} (${manifest.datasetVersion})`,
      numerator: ingested,
      denominator: manifest.status === "READY" ? total : null, // total pas définitif tant que le manifeste n'est pas READY
      unit: "chunks ingérés / chunks manifestés",
      status: manifest.status,
    })
  }

  // Géorisques : communes réellement enregistrées / communes officielles réelles.
  let totalCommunes: number | null = null
  try {
    const res = await fetch("https://geo.api.gouv.fr/communes?fields=code&format=json", { signal: AbortSignal.timeout(8000) })
    if (res.ok) totalCommunes = ((await res.json()) as unknown[]).length
  } catch {
    // Liste officielle indisponible pour ce calcul — dénominateur laissé
    // à null plutôt que supposé (34 969 constaté le 2026-09-12, mais
    // jamais réaffirmé comme fait sans nouvelle vérification).
  }
  const risqueCount = await prisma.risque.count()
  coverage.push({
    source: "georisques",
    label: "Géorisques",
    numerator: risqueCount,
    denominator: totalCommunes,
    unit: "communes enregistrées / communes officielles (geo.api.gouv.fr)",
    status: risqueCount > 0 ? "en cours" : "non démarré",
  })

  // BAN : départements terminés (déduits du checkpoint réel) / départements officiels réels.
  let totalDepartements: number | null = null
  try {
    const res = await fetch("https://geo.api.gouv.fr/departements?fields=code&format=json", { signal: AbortSignal.timeout(8000) })
    if (res.ok) totalDepartements = ((await res.json()) as unknown[]).length
  } catch {
    // idem — pas de valeur supposée.
  }
  const banJob = await prisma.ingestionJob.findUnique({ where: { source_dataset_partition: { source: "ban", dataset: "adresses", partition: "national" } } })
  const banCheckpoint = banJob?.checkpoint as { deptIndex?: number } | null
  const siteCount = await prisma.site.count()
  coverage.push({
    source: "ban",
    label: "BAN",
    numerator: banCheckpoint?.deptIndex ?? 0,
    denominator: totalDepartements,
    unit: "départements terminés / départements officiels (geo.api.gouv.fr)",
    status: banJob?.status ?? "non démarré",
  })
  coverage.push({
    source: "ban-sites",
    label: "BAN — Sites en base (indicatif, pas un ratio de couverture)",
    numerator: siteCount,
    denominator: null,
    unit: "nombre réel de Site en base (pas un pourcentage)",
    status: "info",
  })

  return NextResponse.json({ success: true, coverage })
}
