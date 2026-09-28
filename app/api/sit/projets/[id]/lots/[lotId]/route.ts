import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->Lot — supprime uniquement le rattachement
// (ProjetLot), jamais le Lot lui-même (Phase 9, BOAMP).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; lotId: string }> }) {
  const { id: projetId, lotId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  await prisma.projetLot.deleteMany({ where: { projetId, lotId } })

  return NextResponse.json({ success: true })
}
