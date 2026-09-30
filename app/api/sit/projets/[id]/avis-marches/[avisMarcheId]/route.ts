import { NextResponse } from "next/server"
import { exigerAccesProjet, peutRetirerElement } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->AvisMarche — supprime uniquement le rattachement
// (ProjetAvisMarche), jamais l'AvisMarche lui-même (Phase 9, BOAMP).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; avisMarcheId: string }> }) {
  const { id: projetId, avisMarcheId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  // Dossier du projet (2026-09-30) : chacun retire ce qu'il a ajouté ;
  // le chef de projet, l'administrateur et le propriétaire, tout.
  const lien = await prisma.projetAvisMarche.findFirst({ where: { projetId, avisMarcheId }, select: { ajouteParId: true } })
  if (lien && !peutRetirerElement(garde.niveau, garde.user.id, lien.ajouteParId)) {
    return NextResponse.json({ success: false, error: "Seuls celui qui l'a ajouté, le chef de projet et l'administrateur peuvent le retirer." }, { status: 403 })
  }
  await prisma.projetAvisMarche.deleteMany({ where: { projetId, avisMarcheId } })

  return NextResponse.json({ success: true })
}
