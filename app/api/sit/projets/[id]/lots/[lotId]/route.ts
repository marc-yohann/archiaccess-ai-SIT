import { NextResponse } from "next/server"
import { exigerAccesProjet, peutRetirerElement } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->Lot — supprime uniquement le rattachement
// (ProjetLot), jamais le Lot lui-même (Phase 9, BOAMP).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; lotId: string }> }) {
  const { id: projetId, lotId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  // Dossier du projet (2026-09-30) : chacun retire ce qu'il a ajouté ;
  // le chef de projet, l'administrateur et le propriétaire, tout.
  const lien = await prisma.projetLot.findFirst({ where: { projetId, lotId }, select: { ajouteParId: true } })
  if (lien && !peutRetirerElement(garde.niveau, garde.user.id, lien.ajouteParId)) {
    return NextResponse.json({ success: false, error: "Seuls celui qui l'a ajouté, le chef de projet et l'administrateur peuvent le retirer." }, { status: 403 })
  }
  await prisma.projetLot.deleteMany({ where: { projetId, lotId } })

  return NextResponse.json({ success: true })
}
