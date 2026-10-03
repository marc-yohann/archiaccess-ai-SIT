import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement DocumentSit<->Acteur — supprime uniquement le rattachement
// (DocumentSitActeur), jamais l'Acteur lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; acteurId: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: documentSitId, acteurId } = await params
  const prisma = await getPrisma()
  await prisma.documentSitActeur.deleteMany({ where: { documentSitId, acteurId } })

  return NextResponse.json({ success: true })
}
