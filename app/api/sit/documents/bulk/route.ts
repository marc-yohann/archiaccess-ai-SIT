// Ingestion en masse du coffre RAG — authentifiée par jeton secret
// (Authorization: Bearer <token>, voir lib/secrets.ts::getIngestToken())
// plutôt que par session utilisateur. Contourne le besoin d'un bastion
// EC2/SSM pour peupler le coffre depuis l'extérieur du VPC (la Lambda a
// déjà accès à Postgres) — voir CLAUDE.md, blocage SSM inexpliqué au
// niveau du compte AWS constaté le 2026-09-01. Réservé aux opérations
// internes (scripts d'ingestion), jamais exposé côté UI.

import { NextResponse } from "next/server"
import { indexDocument } from "@/lib/rag"
import { getIngestToken } from "@/lib/secrets"

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  const expectedToken = await getIngestToken()
  if (!providedToken || providedToken !== expectedToken) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { documents } = (await request.json()) as {
    documents?: Array<{ title?: string; sourceType?: string; content?: string }>
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    return NextResponse.json({ success: false, error: "Paramètre documents manquant ou vide." }, { status: 400 })
  }

  const results: Array<{ title: string; documentId?: string; error?: string }> = []
  for (const doc of documents) {
    if (!doc.title?.trim() || !doc.content?.trim()) {
      results.push({ title: doc.title ?? "(sans titre)", error: "Titre et contenu requis." })
      continue
    }
    try {
      const documentId = await indexDocument({
        title: doc.title.trim(),
        sourceType: doc.sourceType?.trim() || "reglementation",
        content: doc.content,
      })
      results.push({ title: doc.title.trim(), documentId })
    } catch (error) {
      results.push({ title: doc.title.trim(), error: error instanceof Error ? error.message : "Erreur inconnue." })
    }
  }

  const failures = results.filter((r) => r.error)
  return NextResponse.json({ success: failures.length === 0, results })
}
