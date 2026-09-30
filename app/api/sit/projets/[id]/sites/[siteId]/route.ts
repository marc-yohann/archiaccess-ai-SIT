import { NextResponse } from "next/server"
import { exigerAccesProjet, peutRetirerElement } from "@/lib/projet-acces"
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
  // Dossier du projet (2026-09-30) : chacun retire ce qu'il a ajouté ;
  // le chef de projet, l'administrateur et le propriétaire, tout.
  const lien = await prisma.projetSite.findFirst({ where: { projetId, siteId }, select: { ajouteParId: true } })
  if (lien && !peutRetirerElement(garde.niveau, garde.user.id, lien.ajouteParId)) {
    return NextResponse.json({ success: false, error: "Seuls celui qui l'a ajouté, le chef de projet et l'administrateur peuvent le retirer." }, { status: 403 })
  }
  await prisma.projetSite.deleteMany({ where: { projetId, siteId } })

  return NextResponse.json({ success: true })
}
