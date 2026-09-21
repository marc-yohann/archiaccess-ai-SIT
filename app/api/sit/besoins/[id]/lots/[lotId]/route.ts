import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Détachement Besoin<->Lot — supprime uniquement le rattachement
// (BesoinLot), jamais le Lot lui-même.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; lotId: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: besoinId, lotId } = await params
  const prisma = await getPrisma()
  await prisma.besoinLot.deleteMany({ where: { besoinId, lotId } })

  return NextResponse.json({ success: true })
}
