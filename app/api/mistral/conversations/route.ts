import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Historique des conversations de l'utilisateur connecté, pour la barre
// latérale de /ai — jamais celles d'un autre employé (scopé par userId).
export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const prisma = await getPrisma()
  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  })

  return NextResponse.json({ success: true, conversations })
}
