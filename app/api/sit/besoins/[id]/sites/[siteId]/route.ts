import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Besoin<->Site — supprime uniquement le rattachement
// (BesoinSite), jamais le Site lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; siteId: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id: besoinId, siteId } = await params
  const prisma = await getPrisma()
  // deleteMany plutôt que delete : un détachement déjà effectué (0 ligne
  // supprimée) n'est jamais une erreur, seulement un no-op idempotent.
  await prisma.besoinSite.deleteMany({ where: { besoinId, siteId } })

  return NextResponse.json({ success: true })
}
