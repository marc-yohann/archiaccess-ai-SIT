import { NextResponse } from "next/server"
import { exigerAccesProjet, peutRetirerElement } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"
import { deleteDocument } from "@/lib/storage"

// Retrait d'un élément du dossier : celui qui l'a joint, ou le
// propriétaire du projet personnel, le chef de projet, l'administrateur.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; elementId: string }> }) {
  const { id, elementId } = await params
  const garde = await exigerAccesProjet(id)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  const element = await prisma.projetElement.findFirst({ where: { id: elementId, projetId: id }, select: { auteurId: true, storageKey: true } })
  if (!element) return NextResponse.json({ success: false, error: "Élément introuvable." }, { status: 404 })
  if (!peutRetirerElement(garde.niveau, garde.user.id, element.auteurId)) {
    return NextResponse.json({ success: false, error: "Seul celui qui l'a joint, le chef de projet ou l'administrateur peut le retirer." }, { status: 403 })
  }
  await prisma.projetElement.delete({ where: { id: elementId } })
  // Le fichier stocké suit l'élément ; un échec ici laisse seulement un
  // objet orphelin dans le bucket privé, jamais un élément fantôme.
  if (element.storageKey) await deleteDocument(element.storageKey).catch(() => {})
  return NextResponse.json({ success: true })
}
