import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement Besoin<->AvisMarche (Phase 9/12) — action explicite
// uniquement, upsert idempotent.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: besoinId } = await params
  const { avisMarcheId } = (await request.json()) as { avisMarcheId?: string }
  if (!avisMarcheId) {
    return NextResponse.json({ success: false, error: "Paramètre avisMarcheId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [besoin, avisMarche] = await Promise.all([
    prisma.besoin.findUnique({ where: { id: besoinId }, select: { id: true } }),
    prisma.avisMarche.findUnique({ where: { id: avisMarcheId }, select: { id: true } }),
  ])
  if (!besoin) return NextResponse.json({ success: false, error: "Besoin introuvable." }, { status: 404 })
  if (!avisMarche) return NextResponse.json({ success: false, error: "Avis de marché introuvable." }, { status: 404 })

  const lien = await prisma.besoinAvisMarche.upsert({
    where: { besoinId_avisMarcheId: { besoinId, avisMarcheId } },
    create: { besoinId, avisMarcheId },
    update: {},
    include: { avisMarche: true },
  })

  return NextResponse.json({ success: true, lien })
}
