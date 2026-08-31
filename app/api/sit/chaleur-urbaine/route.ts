import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getHeatNetworkEligibility } from "@/lib/data-sources/chaleur-urbaine"

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

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
