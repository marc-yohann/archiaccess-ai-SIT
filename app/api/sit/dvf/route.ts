import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getMutationsForSection } from "@/lib/data-sources/dvf"

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

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
