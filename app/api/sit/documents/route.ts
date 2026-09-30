import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { indexDocument } from "@/lib/rag"

// Corpus du SIT (2026-09-30) : les textes réglementaires chargés en lot
// (domaine public) et les études ajoutées par les collaborateurs, visibles
// de tous et citées par Archiaccess AI dans toutes les conversations.
// Une étude porte son auteur et sa date ; elle se retire par son auteur ou
// par un administrateur. Les études ajoutées avant cette date n'ont pas
// d'auteur : seul un administrateur peut les retirer.

const TITRE_MAX = 300
const DISCIPLINE_MAX = 80
const TEXTE_MAX = 200_000

async function utilisateur() {
  const store = await cookies()
  return getSessionUser(store.get(SESSION_COOKIE_NAME)?.value)
}

export async function GET() {
  const user = await utilisateur()
  if (!user) return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })

  const prisma = await getPrisma()
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, title: true, sourceType: true, discipline: true, createdAt: true, auteurId: true, auteur: { select: { name: true } } },
  })
  return NextResponse.json({
    success: true,
    documents: documents.map((d) => {
      const etude = d.sourceType === "etude"
      return {
        id: d.id,
        titre: d.title,
        type: etude ? "etude" : "texte",
        discipline: d.discipline,
        auteur: d.auteur?.name ?? null,
        createdAt: d.createdAt.toISOString(),
        peutRetirer: etude && (user.isAdmin || (d.auteurId !== null && d.auteurId === user.id)),
      }
    }),
  })
}

export async function POST(request: Request) {
  const user = await utilisateur()
  if (!user) return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { title?: unknown; discipline?: unknown; content?: unknown }
  const titre = typeof body.title === "string" ? body.title.trim() : ""
  const texte = typeof body.content === "string" ? body.content.trim() : ""
  const discipline = typeof body.discipline === "string" ? body.discipline.trim() : ""
  if (!titre || !texte) {
    return NextResponse.json({ success: false, error: "Titre et texte de l'étude requis." }, { status: 400 })
  }
  if (titre.length > TITRE_MAX || discipline.length > DISCIPLINE_MAX || texte.length > TEXTE_MAX) {
    return NextResponse.json({ success: false, error: "Titre, discipline ou texte trop long." }, { status: 400 })
  }

  try {
    // Toujours une étude : les textes réglementaires ne s'ajoutent que
    // par le chargement en lot (/api/sit/documents/bulk).
    const documentId = await indexDocument({
      title: titre,
      sourceType: "etude",
      content: texte,
      auteurId: user.id,
      discipline: discipline || null,
    })
    return NextResponse.json({ success: true, documentId })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 500 },
    )
  }
}
