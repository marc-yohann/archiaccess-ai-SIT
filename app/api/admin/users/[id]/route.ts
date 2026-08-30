import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"

async function requireAdmin() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user?.isAdmin) return null
  return user
}

// Active/désactive un compte (ou change son statut admin) — pas de
// suppression : désactiver garde l'historique (conversations, audit)
// plutôt que de le perdre, cohérent avec l'esprit RGPD du projet
// (traçabilité) sans pour autant garder un accès actif inutilement.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 })
  }

  const { id } = await params
  const { active, isAdmin } = (await request.json()) as { active?: boolean; isAdmin?: boolean }

  if (id === admin.id && (active === false || isAdmin === false)) {
    return NextResponse.json(
      { success: false, error: "Vous ne pouvez pas désactiver votre propre compte admin." },
      { status: 400 }
    )
  }

  const prisma = await getPrisma()
  const data: { active?: boolean; isAdmin?: boolean } = {}
  if (typeof active === "boolean") data.active = active
  if (typeof isAdmin === "boolean") data.isAdmin = isAdmin

  const user = await prisma.user.update({ where: { id }, data })
  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name, active: user.active, isAdmin: user.isAdmin },
  })
}
