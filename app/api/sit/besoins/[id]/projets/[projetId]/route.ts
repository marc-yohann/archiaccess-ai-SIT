import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Détachement Besoin<->Projet — supprime uniquement le rattachement
// (BesoinProjet), jamais le Projet lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; projetId: string }> }) {
  const { id: besoinId, projetId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  await prisma.besoinProjet.deleteMany({ where: { besoinId, projetId } })

  return NextResponse.json({ success: true })
}
