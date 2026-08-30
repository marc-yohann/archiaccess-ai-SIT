import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/password"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"

// Utilisé à la fois pour le changement obligatoire après un mot de passe
// temporaire (voir mustChangePassword) et pour un changement volontaire.
export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const sessionUser = await getSessionUser(token)
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { currentPassword, newPassword } = (await request.json()) as {
    currentPassword?: string
    newPassword?: string
  }
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, error: "Mot de passe actuel et nouveau requis." }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { success: false, error: "Le nouveau mot de passe doit faire au moins 8 caractères." },
      { status: 400 }
    )
  }

  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } })
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ success: false, error: "Mot de passe actuel incorrect." }, { status: 401 })
  }

  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  })

  return NextResponse.json({ success: true })
}
