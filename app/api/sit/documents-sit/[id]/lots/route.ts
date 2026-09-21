import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement DocumentSit<->Lot (Phase 9/11) — action explicite
// uniquement, upsert idempotent.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: documentSitId } = await params
  const { lotId } = (await request.json()) as { lotId?: string }
  if (!lotId) {
    return NextResponse.json({ success: false, error: "Paramètre lotId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [document, lot] = await Promise.all([
    prisma.documentSit.findUnique({ where: { id: documentSitId }, select: { id: true } }),
    prisma.lot.findUnique({ where: { id: lotId }, select: { id: true } }),
  ])
  if (!document) return NextResponse.json({ success: false, error: "Document introuvable." }, { status: 404 })
  if (!lot) return NextResponse.json({ success: false, error: "Lot introuvable." }, { status: 404 })

  const lien = await prisma.documentSitLot.upsert({
    where: { documentSitId_lotId: { documentSitId, lotId } },
    create: { documentSitId, lotId },
    update: {},
    include: { lot: true },
  })

  return NextResponse.json({ success: true, lien })
}
