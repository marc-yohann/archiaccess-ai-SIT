import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getAnnouncementsForSiren } from "@/lib/data-sources/bodacc"

export async function GET(request: Request) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

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
