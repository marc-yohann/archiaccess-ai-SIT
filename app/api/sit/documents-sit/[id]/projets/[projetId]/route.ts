import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement DocumentSit<->Projet — supprime uniquement le rattachement
// (DocumentSitProjet), jamais le Projet lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; projetId: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: documentSitId, projetId } = await params
  const prisma = await getPrisma()
  await prisma.documentSitProjet.deleteMany({ where: { documentSitId, projetId } })

  return NextResponse.json({ success: true })
}
