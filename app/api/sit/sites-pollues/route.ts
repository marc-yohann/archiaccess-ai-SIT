import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPollutedSitesForCommune } from "@/lib/data-sources/sites-pollues"

export async function GET(request: Request) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const codeInsee = new URL(request.url).searchParams.get("codeInsee")?.trim()
  if (!codeInsee) {
    return NextResponse.json({ success: false, error: "Paramètre codeInsee manquant." }, { status: 400 })
  }

  try {
    const result = await getPollutedSitesForCommune(codeInsee)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
