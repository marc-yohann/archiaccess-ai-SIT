import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { deleteDocument } from "@/lib/storage"

// Retirer une étude du corpus du SIT : son auteur ou un administrateur.
// Les textes réglementaires ne se retirent pas d'ici. Les passages
// indexés (DocumentChunk) partent avec le document (cascade).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const store = await cookies()
  const user = await getSessionUser(store.get(SESSION_COOKIE_NAME)?.value)
  if (!user) return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })

  const prisma = await getPrisma()
  const document = await prisma.document.findUnique({ where: { id }, select: { sourceType: true, auteurId: true, s3Key: true } })
  if (!document || document.sourceType !== "etude") {
    return NextResponse.json({ success: false, error: "Étude introuvable." }, { status: 404 })
  }
  if (!user.isAdmin && !(document.auteurId !== null && document.auteurId === user.id)) {
    return NextResponse.json({ success: false, error: "Seuls son auteur et l'administrateur retirent une étude." }, { status: 403 })
  }

  await prisma.document.delete({ where: { id } })
  await deleteDocument(document.s3Key).catch(() => {})
  return NextResponse.json({ success: true })
}
