import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Projet<->Lot — supprime uniquement le rattachement
// (ProjetLot), jamais le Lot lui-même (Phase 9, BOAMP).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; lotId: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: projetId, lotId } = await params
  const prisma = await getPrisma()
  await prisma.projetLot.deleteMany({ where: { projetId, lotId } })

  return NextResponse.json({ success: true })
}
