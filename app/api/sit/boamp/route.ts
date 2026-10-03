import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPublicMarketsForDepartment } from "@/lib/data-sources/boamp"

export async function GET(request: Request) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

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
