import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement Besoin<->Site — action explicite uniquement, même pattern
// que ProjetSite/DocumentSitSite (Phase 10/11). upsert : un second
// rattachement identique est un no-op idempotent, jamais un doublon.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: besoinId } = await params
  const { siteId } = (await request.json()) as { siteId?: string }
  if (!siteId) {
    return NextResponse.json({ success: false, error: "Paramètre siteId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [besoin, site] = await Promise.all([
    prisma.besoin.findUnique({ where: { id: besoinId }, select: { id: true } }),
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
  ])
  if (!besoin) return NextResponse.json({ success: false, error: "Besoin introuvable." }, { status: 404 })
  if (!site) return NextResponse.json({ success: false, error: "Site introuvable." }, { status: 404 })

  const lien = await prisma.besoinSite.upsert({
    where: { besoinId_siteId: { besoinId, siteId } },
    create: { besoinId, siteId },
    update: {},
    include: { site: true },
  })

  return NextResponse.json({ success: true, lien })
}
