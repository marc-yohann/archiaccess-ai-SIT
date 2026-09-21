import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Besoin (Phase 12) — une nécessité métier/technique explicitement
// identifiée (étude structure, mission OPC, diagnostic, travaux...),
// TOUJOURS créée par un employé (voir prisma/schema.prisma et le rapport
// d'audit Phase 12 : aucune source externe n'en fournit). type/
// discipline/problematique/typeOuvrage/statut restent du texte libre
// (aucune taxonomie stable réutilisable trouvée à l'audit) — pas de
// validation contre un enum ici, à la différence de DocumentSit.type.
export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const prisma = await getPrisma()
  const besoins = await prisma.besoin.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { sites: true, projets: true, acteurs: true, avisMarches: true, lots: true, documentsSit: true } },
    },
  })

  return NextResponse.json({ success: true, besoins })
}

export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

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

  const titre = body.titre?.trim()
  if (!titre) {
    return NextResponse.json({ success: false, error: "Le titre du besoin est requis." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const besoin = await prisma.besoin.create({
    data: {
      titre,
      description: body.description?.trim() || null,
      statut: body.statut?.trim() || null,
      type: body.type?.trim() || null,
      discipline: body.discipline?.trim() || null,
      problematique: body.problematique?.trim() || null,
      typeOuvrage: body.typeOuvrage?.trim() || null,
      // Provenance jamais inventée (même discipline que DocumentSit,
      // Phase 11) — toujours ce que l'appelant fournit explicitement.
      source: body.source?.trim() || null,
      sourceId: body.sourceId?.trim() || null,
      sourceUrl: body.sourceUrl?.trim() || null,
      retrievedAt: body.source ? new Date() : null,
    },
  })

  return NextResponse.json({ success: true, besoin })
}
