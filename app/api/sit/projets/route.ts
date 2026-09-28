import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { lireProfil } from "@/lib/referentiel/profil"
import { filtreProjetsAccessibles } from "@/lib/projet-acces"

// Projet (Phase 10) — objet de travail interne (voir prisma/schema.prisma
// pour la définition exacte), jamais une donnée externe canonique.
//
// Espace collaboratif (2026-09-28) : chaque liste ne renvoie que les
// projets accessibles (lib/projet-acces.ts), séparés par espace —
// ?espace=personnel (défaut) : mes projets personnels ;
// ?espace=collaboratif : les projets d'équipe dont je suis membre (tous,
// archivés compris, pour un administrateur).
export async function GET(request: Request) {
  const store = await cookies()
  const user = await getSessionUser(store.get(SESSION_COOKIE_NAME)?.value)
  if (!user) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const espace = new URL(request.url).searchParams.get("espace") === "collaboratif" ? "COLLABORATIF" : "PERSONNEL"
  const prisma = await getPrisma()
  const projets = await prisma.projet.findMany({
    where: { AND: [filtreProjetsAccessibles(user), { espace }] },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { sites: true, acteurs: true, avisMarches: true, lots: true } },
      // Espace projet : statuts d'étape pour l'avancement affiché en liste.
      etapes: { select: { etapeCode: true, statut: true, echeance: true, note: true } },
      membres: {
        select: { role: true, user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
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

  const body = (await request.json()) as Record<string, unknown> & {
    nom?: string
    type?: string | null
    statut?: string | null
    description?: string | null
    dateDebut?: string | null
    dateFin?: string | null
    montant?: number | null
    espace?: string
  }

  const nom = body.nom?.trim()
  if (!nom) {
    return NextResponse.json({ success: false, error: "Le nom du projet est requis." }, { status: 400 })
  }

  // Un projet collaboratif n'est créé que par un administrateur ; ses
  // membres sont ensuite désignés via /api/sit/projets/[id]/membres.
  const collaboratif = body.espace === "collaboratif"
  if (collaboratif && !user.isAdmin) {
    return NextResponse.json({ success: false, error: "Seul un administrateur crée un projet collaboratif." }, { status: 403 })
  }

  // Profil de l'opération (espace projet) — facultatif, validé contre le
  // référentiel (lib/referentiel/libelles.ts).
  const profil = lireProfil(body)
  if ("error" in profil) {
    return NextResponse.json({ success: false, error: profil.error }, { status: 400 })
  }

  const prisma = await getPrisma()
  const projet = await prisma.projet.create({
    data: {
      ...profil.data,
      nom,
      type: body.type?.trim() || null,
      statut: body.statut?.trim() || null,
      description: body.description?.trim() || null,
      dateDebut: body.dateDebut ? new Date(body.dateDebut) : null,
      dateFin: body.dateFin ? new Date(body.dateFin) : null,
      montant: typeof body.montant === "number" ? body.montant : null,
      createdById: user.id,
      espace: collaboratif ? "COLLABORATIF" : "PERSONNEL",
    },
  })

  return NextResponse.json({ success: true, projet })
}
