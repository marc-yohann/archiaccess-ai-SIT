import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { runCampaignTick } from "@/lib/ingestion/boamp-campaign"

// Un pas borné d'orchestration — voir lib/ingestion/boamp-campaign.ts.
// Destinée à être appelée périodiquement par un EventBridge Scheduler
// (même mécanisme déjà en place pour /api/admin/ingestion/run, voir son
// commentaire), jamais par un employé. Toujours sûre à rappeler : relit
// l'état réel (campagne + IngestionJob) avant d'agir, ne suppose jamais
// l'état laissé par le tick précédent.
export async function POST(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  try {
    const result = await runCampaignTick()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Erreur inconnue." }, { status: 500 })
  }
}
