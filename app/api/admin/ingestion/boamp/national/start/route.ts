import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { startCampaign } from "@/lib/ingestion/boamp-campaign"

// Démarre (ou fait avancer) la campagne nationale BOAMP — voir
// lib/ingestion/boamp-campaign.ts pour la logique complète. Idempotent :
// appelée plusieurs fois de suite, elle (1) sème les IngestionJob PENDING
// manquants (jamais pour un département déjà COMPLETED), (2) fait
// avancer le preflight par lots bornés tant qu'il n'est pas complet, (3)
// une fois le preflight complet, un appel supplémentaire passe
// explicitement la campagne en RUNNING (jamais automatique) — c'est le
// seul moment où l'ingestion réelle démarre.
export async function POST(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  try {
    const result = await startCampaign()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Erreur inconnue." }, { status: 500 })
  }
}
