import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Besoin<->Acteur — supprime uniquement le rattachement
// (BesoinActeur), jamais l'Acteur lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; acteurId: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: besoinId, acteurId } = await params
  const prisma = await getPrisma()
  await prisma.besoinActeur.deleteMany({ where: { besoinId, acteurId } })

  return NextResponse.json({ success: true })
}
