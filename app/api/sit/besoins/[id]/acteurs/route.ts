import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement Besoin<->Acteur (Phase 2/8/12) — action explicite
// uniquement, upsert idempotent. Pas de champ rôle ici (contrairement à
// ProjetActeur) : aucun besoin réel identifié pour ce rattachement.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: besoinId } = await params
  const { acteurId } = (await request.json()) as { acteurId?: string }
  if (!acteurId) {
    return NextResponse.json({ success: false, error: "Paramètre acteurId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [besoin, acteur] = await Promise.all([
    prisma.besoin.findUnique({ where: { id: besoinId }, select: { id: true } }),
    prisma.acteur.findUnique({ where: { id: acteurId }, select: { id: true } }),
  ])
  if (!besoin) return NextResponse.json({ success: false, error: "Besoin introuvable." }, { status: 404 })
  if (!acteur) return NextResponse.json({ success: false, error: "Acteur introuvable." }, { status: 404 })

  const lien = await prisma.besoinActeur.upsert({
    where: { besoinId_acteurId: { besoinId, acteurId } },
    create: { besoinId, acteurId },
    update: {},
    include: { acteur: true },
  })

  return NextResponse.json({ success: true, lien })
}
