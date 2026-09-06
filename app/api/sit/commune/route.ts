import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { searchCommune } from "@/lib/data-sources/ban"

// Résolution nom de commune -> code INSEE pour le mode de recherche
// "Secteur" (voir app/sit/page.tsx, searchSecteur()) — distinct de
// /api/sit/search qui résout une adresse précise ou une entreprise.
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
    const communes = await searchCommune(query)
    return NextResponse.json({ success: true, communes })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
