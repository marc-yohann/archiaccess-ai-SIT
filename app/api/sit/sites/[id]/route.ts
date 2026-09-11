import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Lecture d'un SITE et de ses relations réelles (Parcelle/Bâtiment,
// Phase 1 — les autres relations du brief — Acteur/Projet/Document/
// Besoin — arriveront aux phases correspondantes). Base de la future
// fiche SITE (section 12 du brief) : pour l'instant une lecture brute,
// pas encore d'assemblage de vue dédiée.
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
    include: { parcelles: true, batiments: true, sources: true },
  })
  if (!site) {
    return NextResponse.json({ success: false, error: "Site introuvable." }, { status: 404 })
  }

  return NextResponse.json({ success: true, site })
}
