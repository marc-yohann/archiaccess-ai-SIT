import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { getPrisma } from "@/lib/prisma"

// Corrige un cas réel rencontré Vague 1 (extension nationale BOAMP,
// 2026-09-24) : un job marqué COMPLETED à tort suite à un bug de requête
// (voir lib/data-sources/boamp.ts, normalizeDepartmentForBoampQuery) doit
// pouvoir repartir de zéro une fois le bug corrigé — runOneInvocation
// court-circuite tout job déjà COMPLETED (lib/ingestion/runner.ts), donc
// aucun autre moyen de le refaire tourner.
//
// Portée strictement limitée : supprime UNIQUEMENT la ligne IngestionJob
// (métadonnées de progression/checkpoint), jamais les données déjà
// ingérées (AvisMarche/Lot/...) — le prochain run recrée le job vierge
// (getOrCreateJob) et ré-ingère depuis le début ; grâce à l'upsert sur
// (source, sourceId), aucune ligne de donnée n'est dupliquée, seulement
// éventuellement ré-écrite avec les mêmes valeurs ou complétée.
export async function POST(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const { source, dataset, partition } = (await request.json().catch(() => ({}))) as {
    source?: string
    dataset?: string
    partition?: string
  }
  if (!source || !dataset || !partition) {
    return NextResponse.json({ success: false, error: "Paramètres 'source', 'dataset' et 'partition' requis." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const deleted = await prisma.ingestionJob.deleteMany({ where: { source, dataset, partition } })
  console.log(`[ingestion-reset] source=${source} dataset=${dataset} partition=${partition} deletedCount=${deleted.count} at=${new Date().toISOString()}`)
  return NextResponse.json({ success: true, deletedCount: deleted.count })
}
