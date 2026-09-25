import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { getPrisma } from "@/lib/prisma"
import { BOAMP_DEPARTMENTS } from "@/lib/ingestion/boamp-departments"

// Réarme manuellement les départements FAILED_REQUIRES_REVIEW — jamais
// automatique (voir runOneInvocation, lib/ingestion/job.ts) : c'est
// délibérément la seule porte de sortie de cet état, après qu'un humain
// (ou cette mission) ait examiné lastError. Remet retryCount à 0 mais
// CONSERVE le checkpoint existant (windowStart/windowEnd/offset) — la
// reprise continue là où elle s'était arrêtée, jamais un redémarrage
// complet du département (voir CLAUDE.md, "ne jamais recommencer
// inutilement toute une année si le checkpoint permet de reprendre").
export async function POST(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const { department } = (await request.json().catch(() => ({}))) as { department?: string }

  const prisma = await getPrisma()
  const where = department
    ? { source: "boamp", dataset: "avis-marche", partition: department, status: "FAILED_REQUIRES_REVIEW" as const }
    : { source: "boamp", dataset: "avis-marche", partition: { in: [...BOAMP_DEPARTMENTS] }, status: "FAILED_REQUIRES_REVIEW" as const }

  const targets = await prisma.ingestionJob.findMany({ where, select: { id: true, partition: true } })
  if (targets.length === 0) {
    return NextResponse.json({ success: true, retried: [], note: department ? `Aucun job FAILED_REQUIRES_REVIEW pour le département ${department}.` : "Aucun job FAILED_REQUIRES_REVIEW." })
  }

  await prisma.ingestionJob.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: "PENDING", retryCount: 0, errorCount: 0, lastError: null, nextRunAt: null },
  })

  return NextResponse.json({ success: true, retried: targets.map((t) => t.partition) })
}
