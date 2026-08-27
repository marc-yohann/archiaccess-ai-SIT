import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { searchAddress } from "@/lib/data-sources/ban"

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const query = new URL(request.url).searchParams.get("q")?.trim()
  if (!query) {
    return NextResponse.json({ success: false, error: "Paramètre q manquant." }, { status: 400 })
  }

  try {
    const results = await searchAddress(query)
    return NextResponse.json({ success: true, results })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
