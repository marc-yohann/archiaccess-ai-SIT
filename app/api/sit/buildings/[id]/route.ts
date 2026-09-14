import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Fiche d'un bâtiment physique (RNB, Phase 5C) — même principe que
// /api/sit/sites/[id] : lecture brute des relations réelles, pas encore
// d'assemblage de vue dédiée (aucun consommateur UI connu aujourd'hui).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const prisma = await getPrisma()
  const batiment = await prisma.batimentPhysique.findUnique({
    where: { id },
    include: {
      parcelleLinks: { include: { parcelle: true } },
      siteLinks: { include: { site: true } },
    },
  })
  if (!batiment) {
    return NextResponse.json({ success: false, error: "Bâtiment introuvable." }, { status: 404 })
  }

  return NextResponse.json({ success: true, batiment })
}
