import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Besoin<->DocumentSit — supprime uniquement le rattachement
// (BesoinDocumentSit), jamais le DocumentSit lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; documentSitId: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: besoinId, documentSitId } = await params
  const prisma = await getPrisma()
  await prisma.besoinDocumentSit.deleteMany({ where: { besoinId, documentSitId } })

  return NextResponse.json({ success: true })
}
