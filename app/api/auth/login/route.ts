import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/session"

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as { email?: string; password?: string }
  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Email et mot de passe requis." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ success: false, error: "Identifiants incorrects." }, { status: 401 })
  }

  const { token, expiresAt } = await createSession(user.id)
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })

  return NextResponse.json({ success: true, mustChangePassword: user.mustChangePassword })
}
