import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement Besoin<->DocumentSit (Phase 11B/12) — jamais Document/
// DocumentChunk (corpus réglementaire/RAG, hors périmètre). Action
// explicite uniquement, upsert idempotent : un besoin n'est jamais
// déduit automatiquement d'un DocumentSit.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: besoinId } = await params
  const { documentSitId } = (await request.json()) as { documentSitId?: string }
  if (!documentSitId) {
    return NextResponse.json({ success: false, error: "Paramètre documentSitId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [besoin, documentSit] = await Promise.all([
    prisma.besoin.findUnique({ where: { id: besoinId }, select: { id: true } }),
    prisma.documentSit.findUnique({ where: { id: documentSitId }, select: { id: true } }),
  ])
  if (!besoin) return NextResponse.json({ success: false, error: "Besoin introuvable." }, { status: 404 })
  if (!documentSit) return NextResponse.json({ success: false, error: "Document introuvable." }, { status: 404 })

  const lien = await prisma.besoinDocumentSit.upsert({
    where: { besoinId_documentSitId: { besoinId, documentSitId } },
    create: { besoinId, documentSitId },
    update: {},
    include: { documentSit: true },
  })

  return NextResponse.json({ success: true, lien })
}
