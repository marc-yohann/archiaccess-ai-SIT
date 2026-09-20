import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Projet (Phase 10) — objet de travail interne (voir prisma/schema.prisma
// pour la définition exacte), jamais une donnée externe canonique.
// Accessible à tout employé authentifié (pas de cloisonnement par
// utilisateur, même principe que Site/Acteur — createdBy ne sert qu'à la
// traçabilité, voir User.projetsCrees), contrairement à Conversation.
export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const prisma = await getPrisma()
  const projets = await prisma.projet.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { sites: true, acteurs: true, avisMarches: true, lots: true } },
    },
  })

  return NextResponse.json({ success: true, projets })
}

export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const body = (await request.json()) as {
    nom?: string
    type?: string | null
    statut?: string | null
    description?: string | null
    dateDebut?: string | null
    dateFin?: string | null
    montant?: number | null
  }

  const nom = body.nom?.trim()
  if (!nom) {
    return NextResponse.json({ success: false, error: "Le nom du projet est requis." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const projet = await prisma.projet.create({
    data: {
      nom,
      type: body.type?.trim() || null,
      statut: body.statut?.trim() || null,
      description: body.description?.trim() || null,
      dateDebut: body.dateDebut ? new Date(body.dateDebut) : null,
      dateFin: body.dateFin ? new Date(body.dateFin) : null,
      montant: typeof body.montant === "number" ? body.montant : null,
      createdById: user.id,
    },
  })

  return NextResponse.json({ success: true, projet })
}
