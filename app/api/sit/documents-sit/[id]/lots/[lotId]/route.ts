import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement DocumentSit<->Lot — supprime uniquement le rattachement
// (DocumentSitLot), jamais le Lot lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; lotId: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: documentSitId, lotId } = await params
  const prisma = await getPrisma()
  await prisma.documentSitLot.deleteMany({ where: { documentSitId, lotId } })

  return NextResponse.json({ success: true })
}
