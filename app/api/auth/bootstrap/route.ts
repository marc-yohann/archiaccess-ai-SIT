import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/password"

// Crée le tout premier compte (admin) — accessible sans authentification,
// mais seulement tant qu'aucun utilisateur n'existe encore. Sans ça,
// personne ne pourrait créer le premier admin puisque la création de
// compte passe normalement par /api/admin/users (réservé aux admins).
// Se ferme de lui-même dès qu'un utilisateur existe.
export async function POST(request: Request) {
  const prisma = await getPrisma()
  const existingCount = await prisma.user.count()
  if (existingCount > 0) {
    return NextResponse.json(
      { success: false, error: "Un compte existe déjà, le bootstrap est fermé." },
      { status: 403 }
    )
  }

  const { email, name, password } = (await request.json()) as {
    email?: string
    name?: string
    password?: string
  }
  if (!email || !name || !password) {
    return NextResponse.json({ success: false, error: "Email, nom et mot de passe requis." }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json(
      { success: false, error: "Le mot de passe doit faire au moins 8 caractères." },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(password)
  await prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      name: name.trim(),
      passwordHash,
      isAdmin: true,
      active: true,
      mustChangePassword: false,
    },
  })

  return NextResponse.json({ success: true })
}
