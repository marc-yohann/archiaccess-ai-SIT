import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement Projet<->Lot (Phase 9/10) — action explicite uniquement,
// même principe que avis-marches ci-dessus.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: projetId } = await params
  const { lotId } = (await request.json()) as { lotId?: string }
  if (!lotId) {
    return NextResponse.json({ success: false, error: "Paramètre lotId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [projet, lot] = await Promise.all([
    prisma.projet.findUnique({ where: { id: projetId }, select: { id: true } }),
    prisma.lot.findUnique({ where: { id: lotId }, select: { id: true } }),
  ])
  if (!projet) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  if (!lot) return NextResponse.json({ success: false, error: "Lot introuvable." }, { status: 404 })

  const lien = await prisma.projetLot.upsert({
    where: { projetId_lotId: { projetId, lotId } },
    create: { projetId, lotId },
    update: {},
    include: { lot: true },
  })

  return NextResponse.json({ success: true, lien })
}
