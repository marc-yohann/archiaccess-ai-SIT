import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { getPrisma } from "@/lib/prisma"
import { getOrCreateCampaign } from "@/lib/ingestion/boamp-campaign"

// Reprend une campagne PAUSED (pause manuelle ou déclenchée par le
// garde-fou stockage) — repasse en RUNNING, le prochain tick reprend
// exactement là où il en était (checkpoints IngestionJob inchangés).
// Si la pause venait du garde-fou stockage, le tick suivant re-vérifie
// l'espace libre avant de reprendre : reprendre ici ne contourne pas le
// garde-fou, ne fait que retirer l'état PAUSED pour lui laisser une
// chance de re-checker.
export async function POST(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const prisma = await getPrisma()
  const campaign = await getOrCreateCampaign()
  if (campaign.status !== "PAUSED") {
    return NextResponse.json({ success: false, error: `La campagne n'est pas en pause (statut actuel : ${campaign.status}).` }, { status: 400 })
  }
  const updated = await prisma.boampNationalCampaign.update({
    where: { id: campaign.id },
    data: { status: "RUNNING", lastError: null },
  })
  return NextResponse.json({ success: true, campaign: updated })
}
