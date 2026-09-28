import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Rattachement Projet<->AvisMarche (Phase 9/10) — action explicite
// uniquement. Aucune résolution automatique par référence antérieure,
// objet, acheteur ou localisation : ces signaux ont été étudiés et
// écartés comme non fiables (voir le rapport d'audit Phase 10).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projetId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const { avisMarcheId } = (await request.json()) as { avisMarcheId?: string }
  if (!avisMarcheId) {
    return NextResponse.json({ success: false, error: "Paramètre avisMarcheId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [projet, avisMarche] = await Promise.all([
    prisma.projet.findUnique({ where: { id: projetId }, select: { id: true } }),
    prisma.avisMarche.findUnique({ where: { id: avisMarcheId }, select: { id: true } }),
  ])
  if (!projet) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  if (!avisMarche) return NextResponse.json({ success: false, error: "Avis de marché introuvable." }, { status: 404 })

  const lien = await prisma.projetAvisMarche.upsert({
    where: { projetId_avisMarcheId: { projetId, avisMarcheId } },
    create: { projetId, avisMarcheId },
    update: {},
    include: { avisMarche: true },
  })

  return NextResponse.json({ success: true, lien })
}
