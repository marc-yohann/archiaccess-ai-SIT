import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { serializeDocumentSit } from "@/lib/documents-sit"

// Lecture d'un SITE et de la TOTALITÉ de ses relations directes réelles.
// Complété lors de la mission de finalisation (audit Phase I — graphe et
// navigation) : les relations Acteur/Projet/DocumentSit/Besoin/
// BatimentPhysique existaient déjà dans prisma/schema.prisma depuis
// leurs phases respectives (2/5C/10/11B/12) mais n'étaient jamais
// incluses ici — un vrai manque fonctionnel démontré (le graphe
// documenté "SITE ↔ ACTEUR ↔ PROJET ↔ ... ↔ BESOIN" n'était pas
// traversable depuis cette route), pas une préférence architecturale.
// Correction additive uniquement : aucune nouvelle relation Prisma,
// aucune migration, uniquement l'exposition de relations déjà réelles.
//
// Depuis Phase 4.5 : un Site peut réellement avoir plusieurs Parcelles
// (voir SiteParcelle, prisma/schema.prisma, et le rapport de
// consolidation) — parcelleLinks expose CHAQUE relation avec sa
// provenance (relationMethod/ambiguous/distanceMeters), jamais une seule
// Parcelle choisie arbitrairement. Contrat existant préservé : "site"
// reste la même forme globale, seul l'ancien tableau "parcelles" devient
// "parcelleLinks".
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const prisma = await getPrisma()
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      parcelleLinks: { include: { parcelle: true } },
      unites: true,
      sources: true,
      batimentPhysiqueLinks: { include: { batiment: true } },
      etablissements: { include: { acteur: true } },
      projetLinks: { include: { projet: true } },
      documentSitLinks: { include: { documentSit: true } },
      besoinLinks: { include: { besoin: true } },
    },
  })
  if (!site) {
    return NextResponse.json({ success: false, error: "Site introuvable." }, { status: 404 })
  }

  // documentSit.tailleOctets est un BigInt (voir lib/documents-sit.ts) —
  // non sérialisable tel quel par NextResponse.json().
  const serialized = {
    ...site,
    documentSitLinks: site.documentSitLinks.map((link) => ({ ...link, documentSit: serializeDocumentSit(link.documentSit) })),
  }

  return NextResponse.json({ success: true, site: serialized })
}
