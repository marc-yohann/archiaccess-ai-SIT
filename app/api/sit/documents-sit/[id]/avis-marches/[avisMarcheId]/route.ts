import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement DocumentSit<->AvisMarche — supprime uniquement le
// rattachement (DocumentSitAvisMarche), jamais l'AvisMarche lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; avisMarcheId: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: documentSitId, avisMarcheId } = await params
  const prisma = await getPrisma()
  await prisma.documentSitAvisMarche.deleteMany({ where: { documentSitId, avisMarcheId } })

  return NextResponse.json({ success: true })
}
