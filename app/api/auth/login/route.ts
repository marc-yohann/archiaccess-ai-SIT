import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getAeoSharedPassword } from "@/lib/secrets"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/session"

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string }
  if (!password) {
    return NextResponse.json({ success: false, error: "Mot de passe requis." }, { status: 400 })
  }

  const expected = await getAeoSharedPassword()
  if (password !== expected) {
    return NextResponse.json({ success: false, error: "Mot de passe incorrect." }, { status: 401 })
  }

  const { token, expiresAt } = await createSession()
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })

  return NextResponse.json({ success: true })
}
