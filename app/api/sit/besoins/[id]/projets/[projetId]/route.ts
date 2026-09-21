import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Besoin<->Projet — supprime uniquement le rattachement
// (BesoinProjet), jamais le Projet lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; projetId: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: besoinId, projetId } = await params
  const prisma = await getPrisma()
  await prisma.besoinProjet.deleteMany({ where: { besoinId, projetId } })

  return NextResponse.json({ success: true })
}
