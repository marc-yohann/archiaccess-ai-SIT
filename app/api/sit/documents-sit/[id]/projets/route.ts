import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { exigerAccesProjet } from "@/lib/projet-acces"

// Rattachement DocumentSit<->Projet (Phase 10/11) — action explicite
// uniquement, upsert idempotent.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await exigerSession()
  if ("reponse" in session) return session.reponse

  const { id: documentSitId } = await params
  const { projetId } = (await request.json()) as { projetId?: string }
  if (!projetId) {
    return NextResponse.json({ success: false, error: "Paramètre projetId manquant." }, { status: 400 })
  }
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse

  const prisma = await getPrisma()
  const [document, projet] = await Promise.all([
    prisma.documentSit.findUnique({ where: { id: documentSitId }, select: { id: true } }),
    prisma.projet.findUnique({ where: { id: projetId }, select: { id: true } }),
  ])
  if (!document) return NextResponse.json({ success: false, error: "Document introuvable." }, { status: 404 })
  if (!projet) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })

  const lien = await prisma.documentSitProjet.upsert({
    where: { documentSitId_projetId: { documentSitId, projetId } },
    create: { documentSitId, projetId },
    update: {},
    include: { projet: true },
  })

  return NextResponse.json({ success: true, lien })
}
