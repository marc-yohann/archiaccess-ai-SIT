import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Besoin<->AvisMarche — supprime uniquement le rattachement
// (BesoinAvisMarche), jamais l'AvisMarche lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; avisMarcheId: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: besoinId, avisMarcheId } = await params
  const prisma = await getPrisma()
  await prisma.besoinAvisMarche.deleteMany({ where: { besoinId, avisMarcheId } })

  return NextResponse.json({ success: true })
}
