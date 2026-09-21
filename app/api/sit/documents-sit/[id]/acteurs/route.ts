import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement DocumentSit<->Acteur (Phase 2/8/11) — action explicite
// uniquement, upsert idempotent. Pas de champ rôle ici (contrairement à
// ProjetActeur) : aucun besoin réel identifié pour ce rattachement.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: documentSitId } = await params
  const { acteurId } = (await request.json()) as { acteurId?: string }
  if (!acteurId) {
    return NextResponse.json({ success: false, error: "Paramètre acteurId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [document, acteur] = await Promise.all([
    prisma.documentSit.findUnique({ where: { id: documentSitId }, select: { id: true } }),
    prisma.acteur.findUnique({ where: { id: acteurId }, select: { id: true } }),
  ])
  if (!document) return NextResponse.json({ success: false, error: "Document introuvable." }, { status: 404 })
  if (!acteur) return NextResponse.json({ success: false, error: "Acteur introuvable." }, { status: 404 })

  const lien = await prisma.documentSitActeur.upsert({
    where: { documentSitId_acteurId: { documentSitId, acteurId } },
    create: { documentSitId, acteurId },
    update: {},
    include: { acteur: true },
  })

  return NextResponse.json({ success: true, lien })
}
