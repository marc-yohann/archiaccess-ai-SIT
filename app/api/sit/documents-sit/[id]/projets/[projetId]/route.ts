import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Détachement DocumentSit<->Projet — supprime uniquement le rattachement
// (DocumentSitProjet), jamais le Projet lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; projetId: string }> }) {
  const { id: documentSitId, projetId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  await prisma.documentSitProjet.deleteMany({ where: { documentSitId, projetId } })

  return NextResponse.json({ success: true })
}
