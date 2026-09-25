import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { getPrisma } from "@/lib/prisma"
import { getOrCreateCampaign } from "@/lib/ingestion/boamp-campaign"

// Met la campagne en pause — le prochain tick ne démarre plus aucun
// nouveau département (voir runCampaignTick). N'interrompt PAS un
// IngestionJob déjà RUNNING (il finira son invocation en cours), mais
// aucune nouvelle invocation ne sera déclenchée pour lui tant que la
// campagne reste PAUSED.
export async function POST(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const prisma = await getPrisma()
  const campaign = await getOrCreateCampaign()
  const updated = await prisma.boampNationalCampaign.update({
    where: { id: campaign.id },
    data: { status: "PAUSED", lastError: "Pause manuelle demandée via /pause." },
  })
  return NextResponse.json({ success: true, campaign: updated })
}
