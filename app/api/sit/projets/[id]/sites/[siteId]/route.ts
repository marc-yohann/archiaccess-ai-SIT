import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->Site — supprime uniquement le rattachement
// (ProjetSite), jamais le Site lui-même (donnée réelle partagée avec le
// reste du SIT, Phase 1).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; siteId: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: projetId, siteId } = await params
  const prisma = await getPrisma()
  // deleteMany plutôt que delete : un détachement déjà effectué (0 ligne
  // supprimée) n'est jamais une erreur, seulement un no-op idempotent.
  await prisma.projetSite.deleteMany({ where: { projetId, siteId } })

  return NextResponse.json({ success: true })
}
