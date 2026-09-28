import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->Site — supprime uniquement le rattachement
// (ProjetSite), jamais le Site lui-même (donnée réelle partagée avec le
// reste du SIT, Phase 1).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; siteId: string }> }) {
  const { id: projetId, siteId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  // deleteMany plutôt que delete : un détachement déjà effectué (0 ligne
  // supprimée) n'est jamais une erreur, seulement un no-op idempotent.
  await prisma.projetSite.deleteMany({ where: { projetId, siteId } })

  return NextResponse.json({ success: true })
}
