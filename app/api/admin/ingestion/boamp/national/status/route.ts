import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { getPrisma } from "@/lib/prisma"
import { getOrCreateCampaign, preflightSummary } from "@/lib/ingestion/boamp-campaign"
import { BOAMP_DEPARTMENTS } from "@/lib/ingestion/boamp-departments"

// État complet et réel de la campagne — jamais une estimation. Les
// compteurs viennent de BoampNationalCampaign (recalculés à chaque tick
// depuis IngestionJob, jamais dérivés ici) ; avisMarches/lots totaux et
// stockage sont mesurés en direct à chaque appel.
export async function GET(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const prisma = await getPrisma()
  const campaign = await getOrCreateCampaign()
  const preflight = await preflightSummary()

  const jobs = await prisma.ingestionJob.findMany({
    where: { source: "boamp", dataset: "avis-marche", partition: { in: [...BOAMP_DEPARTMENTS] } },
    select: { partition: true, status: true, recordsRead: true, recordsInserted: true, recordsUpdated: true, recordsRejected: true, errorCount: true, lastError: true, updatedAt: true },
  })

  const totals = jobs.reduce(
    (acc, j) => ({
      recordsRead: acc.recordsRead + j.recordsRead,
      recordsInserted: acc.recordsInserted + j.recordsInserted,
      recordsUpdated: acc.recordsUpdated + j.recordsUpdated,
      recordsRejected: acc.recordsRejected + j.recordsRejected,
      errorCount: acc.errorCount + j.errorCount,
    }),
    { recordsRead: 0, recordsInserted: 0, recordsUpdated: 0, recordsRejected: 0, errorCount: 0 },
  )

  const [avisMarcheTotal, lotTotal, storageRows] = await Promise.all([
    prisma.avisMarche.count(),
    prisma.lot.count(),
    prisma.$queryRaw<{ bytes: bigint }[]>`SELECT pg_database_size(current_database()) AS bytes`,
  ])

  const usedGb = Number(storageRows[0]?.bytes ?? 0) / 1024 ** 3
  const allocatedGb = Number(process.env.RDS_ALLOCATED_STORAGE_GB ?? 20)

  const failedRequiresReview = jobs.filter((j) => j.status === "FAILED_REQUIRES_REVIEW")
  const lastUpdated = jobs.reduce<(typeof jobs)[number] | null>((latest, j) => (!latest || j.updatedAt > latest.updatedAt ? j : latest), null)

  return NextResponse.json({
    success: true,
    campaign,
    preflight: { totalDepartments: preflight.totalDepartments, checkedCount: preflight.checkedCount, okCount: preflight.okCount, failedCount: preflight.failedCount, complete: preflight.complete, failed: preflight.failed, zeroHits: preflight.zeroHits },
    totals,
    avisMarcheTotal,
    lotTotal,
    storage: { usedGb: Number(usedGb.toFixed(3)), allocatedGb, freeGb: Number((allocatedGb - usedGb).toFixed(3)) },
    failedRequiresReview: failedRequiresReview.map((j) => ({ department: j.partition, lastError: j.lastError })),
    lastDepartment: lastUpdated?.partition ?? null,
    lastError: lastUpdated?.lastError ?? null,
  })
}
