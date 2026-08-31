import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getAnnouncementsForSiren } from "@/lib/data-sources/bodacc"

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const siren = new URL(request.url).searchParams.get("siren")?.trim()
  if (!siren) {
    return NextResponse.json({ success: false, error: "Paramètre siren manquant." }, { status: 400 })
  }

  try {
    const announcements = await getAnnouncementsForSiren(siren)
    return NextResponse.json({ success: true, announcements })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
