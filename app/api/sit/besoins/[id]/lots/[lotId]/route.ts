import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Besoin<->Lot — supprime uniquement le rattachement
// (BesoinLot), jamais le Lot lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; lotId: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: besoinId, lotId } = await params
  const prisma = await getPrisma()
  await prisma.besoinLot.deleteMany({ where: { besoinId, lotId } })

  return NextResponse.json({ success: true })
}
