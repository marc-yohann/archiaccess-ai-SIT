import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getRisksForCommune } from "@/lib/data-sources/georisques"

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const codeInsee = new URL(request.url).searchParams.get("codeInsee")?.trim()
  if (!codeInsee) {
    return NextResponse.json({ success: false, error: "Paramètre codeInsee manquant." }, { status: 400 })
  }

  try {
    const risks = await getRisksForCommune(codeInsee)
    return NextResponse.json({ success: true, risks })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
