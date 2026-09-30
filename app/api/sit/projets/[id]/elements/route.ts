import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"
import { trouverEtape } from "@/lib/referentiel"
import { SELECT_ELEMENT, TEXTE_MAX, TITRE_MAX, serialiserElement } from "@/lib/projet-elements"

// Dossier du projet et fil des étapes (2026-09-30, maquette validée « Fil,
// dossier et études ») : notes, liens et réponses d'Archiaccess AI jointes.
// Les fichiers passent par ./fichier. Accès : lib/projet-acces.ts.

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const garde = await exigerAccesProjet(id)
  if ("reponse" in garde) return garde.reponse
  const etape = new URL(request.url).searchParams.get("etape")
  const prisma = await getPrisma()
  const elements = await prisma.projetElement.findMany({
    where: { projetId: id, ...(etape ? { etapeCode: etape } : {}) },
    orderBy: { createdAt: etape ? "asc" : "desc" },
    select: SELECT_ELEMENT,
  })
  return NextResponse.json({ success: true, elements: elements.map((e) => serialiserElement(e, garde.niveau, garde.user.id)) })
}

const texteOuNull = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const garde = await exigerAccesProjet(id)
  if ("reponse" in garde) return garde.reponse
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const type = body.type
  if (type !== "NOTE" && type !== "LIEN" && type !== "REPONSE_IA") {
    return NextResponse.json({ success: false, error: "Type d'élément invalide." }, { status: 400 })
  }
  let etapeCode: string | null = null
  if (body.etapeCode) {
    if (typeof body.etapeCode !== "string" || !trouverEtape(body.etapeCode)) {
      return NextResponse.json({ success: false, error: "Étape inconnue du référentiel." }, { status: 400 })
    }
    etapeCode = body.etapeCode
  }
  const titre = texteOuNull(body.titre, TITRE_MAX)
  const texte = texteOuNull(body.texte, TEXTE_MAX)
  const message = texteOuNull(body.message, 2000)

  let url: string | null = null
  if (type === "NOTE" && !texte) {
    return NextResponse.json({ success: false, error: "La note est vide." }, { status: 400 })
  }
  if (type === "REPONSE_IA" && (!texte || !titre)) {
    return NextResponse.json({ success: false, error: "Titre et réponse requis." }, { status: 400 })
  }
  if (type === "LIEN") {
    try {
      const u = new URL(typeof body.url === "string" ? body.url.trim() : "")
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error()
      url = u.toString()
    } catch {
      return NextResponse.json({ success: false, error: "Adresse du lien invalide (elle doit commencer par https://)." }, { status: 400 })
    }
  }

  const prisma = await getPrisma()
  const element = await prisma.projetElement.create({
    data: { projetId: id, etapeCode, type, titre: type === "LIEN" ? titre ?? url : titre, texte, message, url, auteurId: garde.user.id },
    select: SELECT_ELEMENT,
  })
  await prisma.projet.update({ where: { id }, data: { updatedAt: new Date() } })
  return NextResponse.json({ success: true, element: serialiserElement(element, garde.niveau, garde.user.id) })
}
