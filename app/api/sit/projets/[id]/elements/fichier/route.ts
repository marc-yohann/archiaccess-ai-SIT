import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"
import { trouverEtape } from "@/lib/referentiel"
import { putFichier } from "@/lib/storage"
import { FICHIER_MAX_OCTETS, SELECT_ELEMENT, serialiserElement } from "@/lib/projet-elements"

// Dépôt d'un fichier dans le dossier du projet (et le fil d'une étape) :
// stocké tel quel dans le bucket privé des documents, lu uniquement via
// ../[elementId]/fichier qui revérifie l'accès.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const garde = await exigerAccesProjet(id)
  if ("reponse" in garde) return garde.reponse

  const form = await request.formData().catch(() => null)
  const fichier = form?.get("fichier")
  if (!form || !(fichier instanceof File) || fichier.size === 0) {
    return NextResponse.json({ success: false, error: "Aucun fichier reçu." }, { status: 400 })
  }
  if (fichier.size > FICHIER_MAX_OCTETS) {
    return NextResponse.json({ success: false, error: "Fichier trop volumineux (4 Mo au maximum)." }, { status: 413 })
  }
  const etape = form.get("etapeCode")
  let etapeCode: string | null = null
  if (typeof etape === "string" && etape) {
    if (!trouverEtape(etape)) return NextResponse.json({ success: false, error: "Étape inconnue du référentiel." }, { status: 400 })
    etapeCode = etape
  }
  const commentaire = form.get("texte")
  const texte = typeof commentaire === "string" && commentaire.trim() ? commentaire.trim().slice(0, 5000) : null

  const nomFichier = fichier.name.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "fichier"
  const mimeType = fichier.type || "application/octet-stream"
  const storageKey = `projets/${id}/${randomUUID()}`
  await putFichier(storageKey, new Uint8Array(await fichier.arrayBuffer()), mimeType)

  const prisma = await getPrisma()
  const element = await prisma.projetElement.create({
    data: { projetId: id, etapeCode, type: "FICHIER", titre: nomFichier, texte, storageKey, nomFichier, mimeType, tailleOctets: fichier.size, auteurId: garde.user.id },
    select: SELECT_ELEMENT,
  })
  await prisma.projet.update({ where: { id }, data: { updatedAt: new Date() } })
  return NextResponse.json({ success: true, element: serialiserElement(element, garde.niveau, garde.user.id) })
}
