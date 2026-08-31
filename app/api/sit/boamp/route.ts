import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPublicMarketsForDepartment } from "@/lib/data-sources/boamp"

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const codeDepartement = new URL(request.url).searchParams.get("codeDepartement")?.trim()
  if (!codeDepartement) {
    return NextResponse.json({ success: false, error: "Paramètre codeDepartement manquant." }, { status: 400 })
  }

  try {
    const markets = await getPublicMarketsForDepartment(codeDepartement)
    return NextResponse.json({ success: true, markets })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
