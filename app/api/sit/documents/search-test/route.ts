// Diagnostic de recherche par similarité (pgvector) — authentifié par le
// même jeton secret que /api/sit/documents/bulk (voir lib/secrets.ts::
// getIngestToken()). Permet de vérifier la pertinence du coffre RAG sans
// passer par une session de chat authentifiée. Outil interne uniquement,
// jamais exposé côté UI.

import { NextResponse } from "next/server"
import { searchSimilarChunks } from "@/lib/rag"
import { getIngestToken } from "@/lib/secrets"

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const expectedToken = await getIngestToken()
  if (!providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { query, limit } = (await request.json()) as { query?: string; limit?: number }
  if (!query?.trim()) {
    return NextResponse.json({ success: false, error: "Paramètre query manquant." }, { status: 400 })
  }

  try {
    const chunks = await searchSimilarChunks(query.trim(), limit ?? 5)
    return NextResponse.json({ success: true, chunks })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 500 },
    )
  }
}
