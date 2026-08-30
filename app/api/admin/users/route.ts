import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { hashPassword, generateTempPassword } from "@/lib/password"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"

async function requireAdmin() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user?.isAdmin) return null
  return user
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 })
  }

  const prisma = await getPrisma()
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      active: true,
      mustChangePassword: true,
      createdAt: true,
    },
  })
  return NextResponse.json({ success: true, users })
}

// Le mot de passe temporaire n'est renvoyé qu'une seule fois dans cette
// réponse (jamais stocké en clair) — à l'admin de le transmettre à
// l'employé, qui devra le changer à sa première connexion.
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 })
  }

  const { email, name, isAdmin } = (await request.json()) as {
    email?: string
    name?: string
    isAdmin?: boolean
  }
  if (!email || !name) {
    return NextResponse.json({ success: false, error: "Email et nom requis." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const normalizedEmail = email.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ success: false, error: "Un compte existe déjà avec cet email." }, { status: 409 })
  }

  const tempPassword = generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name.trim(),
      passwordHash,
      isAdmin: Boolean(isAdmin),
      active: true,
      mustChangePassword: true,
    },
  })

  return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name }, tempPassword })
}
