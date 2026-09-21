import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Rattachement DocumentSit<->Site — action explicite uniquement (Phase
// 11, même principe que ProjetSite en Phase 10). upsert plutôt que
// create : un second rattachement identique est un no-op idempotent,
// jamais un doublon (contrainte @@unique déjà en base).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: documentSitId } = await params
  const { siteId } = (await request.json()) as { siteId?: string }
  if (!siteId) {
    return NextResponse.json({ success: false, error: "Paramètre siteId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [document, site] = await Promise.all([
    prisma.documentSit.findUnique({ where: { id: documentSitId }, select: { id: true } }),
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
  ])
  if (!document) return NextResponse.json({ success: false, error: "Document introuvable." }, { status: 404 })
  if (!site) return NextResponse.json({ success: false, error: "Site introuvable." }, { status: 404 })

  const lien = await prisma.documentSitSite.upsert({
    where: { documentSitId_siteId: { documentSitId, siteId } },
    create: { documentSitId, siteId },
    update: {},
    include: { site: true },
  })

  return NextResponse.json({ success: true, lien })
}
