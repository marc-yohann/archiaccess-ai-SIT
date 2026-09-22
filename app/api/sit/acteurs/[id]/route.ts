import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { serializeDocumentSit } from "@/lib/documents-sit"

// Lecture d'un ACTEUR et de la totalité de ses relations directes
// réelles. Ajoutée lors de la mission de finalisation (audit Phase I —
// graphe et navigation) : aucune route de détail n'existait pour Acteur
// avant cette phase — seule la persistance (POST, Phase 2/8) existait,
// alors que le graphe documenté prévoit explicitement la navigation
// inverse "Acteur → établissements → sites → projets → marchés → lots →
// documents → besoins". Toutes les relations exposées ici existent déjà
// dans prisma/schema.prisma depuis leurs phases respectives (2, 8, 9, 10,
// 11B, 12) — correction additive uniquement, aucune nouvelle relation,
// aucune migration.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const prisma = await getPrisma()
  const acteur = await prisma.acteur.findUnique({
    where: { id },
    include: {
      etablissements: { include: { site: true } },
      sources: true,
      avisMarcheCommeAcheteur: true,
      avisMarcheCommeTitulaire: true,
      lotsCommeTitulaire: { include: { avisMarche: true } },
      projetLinks: { include: { projet: true } },
      documentSitLinks: { include: { documentSit: true } },
      besoinLinks: { include: { besoin: true } },
    },
  })
  if (!acteur) {
    return NextResponse.json({ success: false, error: "Acteur introuvable." }, { status: 404 })
  }

  // documentSit.tailleOctets est un BigInt — non sérialisable tel quel.
  const serialized = {
    ...acteur,
    documentSitLinks: acteur.documentSitLinks.map((link) => ({ ...link, documentSit: serializeDocumentSit(link.documentSit) })),
  }

  return NextResponse.json({ success: true, acteur: serialized })
}
