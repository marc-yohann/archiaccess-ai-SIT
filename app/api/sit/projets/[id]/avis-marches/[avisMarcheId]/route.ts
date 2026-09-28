import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->AvisMarche — supprime uniquement le rattachement
// (ProjetAvisMarche), jamais l'AvisMarche lui-même (Phase 9, BOAMP).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; avisMarcheId: string }> }) {
  const { id: projetId, avisMarcheId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  await prisma.projetAvisMarche.deleteMany({ where: { projetId, avisMarcheId } })

  return NextResponse.json({ success: true })
}
