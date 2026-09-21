import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Lecture/modification d'un Besoin (Phase 12) et de ses rattachements
// réels — jamais une résolution automatique, voir les sous-routes
// (sites/projets/acteurs/avis-marches/lots/documents-sit) pour les
// rattachements explicites.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const prisma = await getPrisma()
  const besoin = await prisma.besoin.findUnique({
    where: { id },
    include: {
      sites: { include: { site: true } },
      projets: { include: { projet: true } },
      acteurs: { include: { acteur: true } },
      avisMarches: { include: { avisMarche: true } },
      lots: { include: { lot: true } },
      documentsSit: { include: { documentSit: true } },
    },
  })
  if (!besoin) {
    return NextResponse.json({ success: false, error: "Besoin introuvable." }, { status: 404 })
  }

  return NextResponse.json({ success: true, besoin })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json()) as {
    titre?: string
    description?: string | null
    statut?: string | null
    type?: string | null
    discipline?: string | null
    problematique?: string | null
    typeOuvrage?: string | null
    source?: string | null
    sourceId?: string | null
    sourceUrl?: string | null
  }

  const prisma = await getPrisma()
  const existing = await prisma.besoin.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ success: false, error: "Besoin introuvable." }, { status: 404 })
  }

  const data: {
    titre?: string
    description?: string | null
    statut?: string | null
    type?: string | null
    discipline?: string | null
    problematique?: string | null
    typeOuvrage?: string | null
    source?: string | null
    sourceId?: string | null
    sourceUrl?: string | null
  } = {}
  if (typeof body.titre === "string") {
    const titre = body.titre.trim()
    if (!titre) {
      return NextResponse.json({ success: false, error: "Le titre du besoin ne peut pas être vide." }, { status: 400 })
    }
    data.titre = titre
  }
  if ("description" in body) data.description = body.description?.trim() || null
  if ("statut" in body) data.statut = body.statut?.trim() || null
  if ("type" in body) data.type = body.type?.trim() || null
  if ("discipline" in body) data.discipline = body.discipline?.trim() || null
  if ("problematique" in body) data.problematique = body.problematique?.trim() || null
  if ("typeOuvrage" in body) data.typeOuvrage = body.typeOuvrage?.trim() || null
  if ("source" in body) data.source = body.source?.trim() || null
  if ("sourceId" in body) data.sourceId = body.sourceId?.trim() || null
  if ("sourceUrl" in body) data.sourceUrl = body.sourceUrl?.trim() || null

  const besoin = await prisma.besoin.update({ where: { id }, data })
  return NextResponse.json({ success: true, besoin })
}
