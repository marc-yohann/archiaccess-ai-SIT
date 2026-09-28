import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->Acteur — supprime uniquement le rattachement
// (ProjetActeur), jamais l'Acteur lui-même (Phase 2/8).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; acteurId: string }> }) {
  const { id: projetId, acteurId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  await prisma.projetActeur.deleteMany({ where: { projetId, acteurId } })

  return NextResponse.json({ success: true })
}
