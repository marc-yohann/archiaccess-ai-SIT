import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"

// Observabilité du moteur d'ingestion (voir CLAUDE.md, section
// "administration data" de l'audit du 2026-09-12) : répond à "SIRENE
// national est-il réellement chargé ?", "combien de lignes traitées ?",
// "quelle partition est bloquée ?"... Réservé aux admins (session), pas
// le jeton bearer d'ingestion (lecture humaine, pas machine-à-machine).
export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user?.isAdmin) {
    return NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 })
  }

  const prisma = await getPrisma()
  const jobs = await prisma.ingestionJob.findMany({
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ success: true, jobs })
}
