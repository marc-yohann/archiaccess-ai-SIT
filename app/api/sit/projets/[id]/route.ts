import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { serializeDocumentSit } from "@/lib/documents-sit"

// Lecture/modification d'un Projet (Phase 10) et de ses rattachements
// réels — jamais une résolution automatique, voir POST des sous-routes
// (sites/acteurs/avis-marches/lots) pour les rattachements explicites.
//
// documentSitLinks/besoinLinks ajoutés lors de la mission de finalisation
// (audit Phase I — graphe et navigation) : ces relations existent dans
// prisma/schema.prisma depuis les Phases 11B/12 (postérieures à cette
// route) mais n'y avaient jamais été branchées — un vrai manque
// fonctionnel démontré, pas une préférence. Correction additive
// uniquement, aucune migration.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const prisma = await getPrisma()
  const projet = await prisma.projet.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      sites: { include: { site: true } },
      acteurs: { include: { acteur: true } },
      avisMarches: { include: { avisMarche: true } },
      lots: { include: { lot: { include: { avisMarche: true } } } },
      documentSitLinks: { include: { documentSit: true } },
      besoinLinks: { include: { besoin: true } },
    },
  })
  if (!projet) {
    return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  }

  // documentSit.tailleOctets est un BigInt — non sérialisable tel quel.
  const serialized = {
    ...projet,
    documentSitLinks: projet.documentSitLinks.map((link) => ({ ...link, documentSit: serializeDocumentSit(link.documentSit) })),
  }

  return NextResponse.json({ success: true, projet: serialized })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json()) as {
    nom?: string
    type?: string | null
    statut?: string | null
    description?: string | null
    dateDebut?: string | null
    dateFin?: string | null
    montant?: number | null
  }

  const prisma = await getPrisma()
  const existing = await prisma.projet.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  }

  const data: {
    nom?: string
    type?: string | null
    statut?: string | null
    description?: string | null
    dateDebut?: Date | null
    dateFin?: Date | null
    montant?: number | null
  } = {}
  if (typeof body.nom === "string") {
    const nom = body.nom.trim()
    if (!nom) {
      return NextResponse.json({ success: false, error: "Le nom du projet ne peut pas être vide." }, { status: 400 })
    }
    data.nom = nom
  }
  if ("type" in body) data.type = body.type?.trim() || null
  if ("statut" in body) data.statut = body.statut?.trim() || null
  if ("description" in body) data.description = body.description?.trim() || null
  if ("dateDebut" in body) data.dateDebut = body.dateDebut ? new Date(body.dateDebut) : null
  if ("dateFin" in body) data.dateFin = body.dateFin ? new Date(body.dateFin) : null
  if ("montant" in body) data.montant = typeof body.montant === "number" ? body.montant : null

  const projet = await prisma.projet.update({ where: { id }, data })
  return NextResponse.json({ success: true, projet })
}
