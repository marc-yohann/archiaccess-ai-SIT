import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement DocumentSit<->Site — supprime uniquement le rattachement
// (DocumentSitSite), jamais le Site lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; siteId: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: documentSitId, siteId } = await params
  const prisma = await getPrisma()
  // deleteMany plutôt que delete : un détachement déjà effectué (0 ligne
  // supprimée) n'est jamais une erreur, seulement un no-op idempotent.
  await prisma.documentSitSite.deleteMany({ where: { documentSitId, siteId } })

  return NextResponse.json({ success: true })
}
