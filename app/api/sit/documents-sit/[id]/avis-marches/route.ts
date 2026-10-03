import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement DocumentSit<->AvisMarche (Phase 9/11) — action explicite
// uniquement, upsert idempotent.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: documentSitId } = await params
  const { avisMarcheId } = (await request.json()) as { avisMarcheId?: string }
  if (!avisMarcheId) {
    return NextResponse.json({ success: false, error: "Paramètre avisMarcheId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [document, avisMarche] = await Promise.all([
    prisma.documentSit.findUnique({ where: { id: documentSitId }, select: { id: true } }),
    prisma.avisMarche.findUnique({ where: { id: avisMarcheId }, select: { id: true } }),
  ])
  if (!document) return NextResponse.json({ success: false, error: "Document introuvable." }, { status: 404 })
  if (!avisMarche) return NextResponse.json({ success: false, error: "Avis de marché introuvable." }, { status: 404 })

  const lien = await prisma.documentSitAvisMarche.upsert({
    where: { documentSitId_avisMarcheId: { documentSitId, avisMarcheId } },
    create: { documentSitId, avisMarcheId },
    update: {},
    include: { avisMarche: true },
  })

  return NextResponse.json({ success: true, lien })
}
