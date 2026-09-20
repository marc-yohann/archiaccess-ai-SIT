import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->AvisMarche — supprime uniquement le rattachement
// (ProjetAvisMarche), jamais l'AvisMarche lui-même (Phase 9, BOAMP).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; avisMarcheId: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: projetId, avisMarcheId } = await params
  const prisma = await getPrisma()
  await prisma.projetAvisMarche.deleteMany({ where: { projetId, avisMarcheId } })

  return NextResponse.json({ success: true })
}
