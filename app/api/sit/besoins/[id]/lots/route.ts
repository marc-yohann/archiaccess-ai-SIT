import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement Besoin<->Lot (Phase 9/12) — cardinalité N:N confirmée à
// l'audit : un lot peut contenir plusieurs besoins, un besoin peut
// concerner plusieurs lots. Action explicite uniquement, upsert
// idempotent.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: besoinId } = await params
  const { lotId } = (await request.json()) as { lotId?: string }
  if (!lotId) {
    return NextResponse.json({ success: false, error: "Paramètre lotId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [besoin, lot] = await Promise.all([
    prisma.besoin.findUnique({ where: { id: besoinId }, select: { id: true } }),
    prisma.lot.findUnique({ where: { id: lotId }, select: { id: true } }),
  ])
  if (!besoin) return NextResponse.json({ success: false, error: "Besoin introuvable." }, { status: 404 })
  if (!lot) return NextResponse.json({ success: false, error: "Lot introuvable." }, { status: 404 })

  const lien = await prisma.besoinLot.upsert({
    where: { besoinId_lotId: { besoinId, lotId } },
    create: { besoinId, lotId },
    update: {},
    include: { lot: true },
  })

  return NextResponse.json({ success: true, lien })
}
