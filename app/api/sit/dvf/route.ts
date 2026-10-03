import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getMutationsForSection } from "@/lib/data-sources/dvf"

export async function GET(request: Request) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const params = new URL(request.url).searchParams
  const codeCommune = params.get("codeCommune")?.trim()
  const sectionPrefixe = params.get("sectionPrefixe")?.trim()
  if (!codeCommune || !sectionPrefixe) {
    return NextResponse.json(
      { success: false, error: "Paramètres codeCommune/sectionPrefixe manquants." },
      { status: 400 },
    )
  }

  try {
    const mutations = await getMutationsForSection(codeCommune, sectionPrefixe)
    return NextResponse.json({ success: true, mutations })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
