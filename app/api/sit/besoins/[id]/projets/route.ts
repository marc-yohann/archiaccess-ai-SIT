import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement Besoin<->Projet (Phase 10/12) — action explicite
// uniquement, upsert idempotent.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: besoinId } = await params
  const { projetId } = (await request.json()) as { projetId?: string }
  if (!projetId) {
    return NextResponse.json({ success: false, error: "Paramètre projetId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [besoin, projet] = await Promise.all([
    prisma.besoin.findUnique({ where: { id: besoinId }, select: { id: true } }),
    prisma.projet.findUnique({ where: { id: projetId }, select: { id: true } }),
  ])
  if (!besoin) return NextResponse.json({ success: false, error: "Besoin introuvable." }, { status: 404 })
  if (!projet) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })

  const lien = await prisma.besoinProjet.upsert({
    where: { besoinId_projetId: { besoinId, projetId } },
    create: { besoinId, projetId },
    update: {},
    include: { projet: true },
  })

  return NextResponse.json({ success: true, lien })
}
