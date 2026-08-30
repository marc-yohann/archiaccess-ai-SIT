import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user) {
    // Signale à l'écran de connexion qu'aucun compte n'existe encore, pour
    // afficher le formulaire de création du tout premier admin (voir
    // /api/auth/bootstrap) plutôt qu'un formulaire de connexion inutile.
    const prisma = await getPrisma()
    const bootstrapNeeded = (await prisma.user.count()) === 0
    return NextResponse.json({ authenticated: false, bootstrapNeeded })
  }
  return NextResponse.json({
    authenticated: true,
    user: { email: user.email, name: user.name, isAdmin: user.isAdmin, mustChangePassword: user.mustChangePassword },
  })
}
