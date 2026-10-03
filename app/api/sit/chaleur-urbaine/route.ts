import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getHeatNetworkEligibility } from "@/lib/data-sources/chaleur-urbaine"

export async function GET(request: Request) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const params = new URL(request.url).searchParams
  const lon = Number(params.get("lon"))
  const lat = Number(params.get("lat"))
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return NextResponse.json({ success: false, error: "Paramètres lon/lat manquants ou invalides." }, { status: 400 })
  }

  try {
    const eligibility = await getHeatNetworkEligibility(lon, lat)
    return NextResponse.json({ success: true, eligibility })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
