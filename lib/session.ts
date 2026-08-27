// Authentification par mot de passe d'équipe partagé (le même que l'AEO
// d'archiaccess-pro, voir lib/secrets.ts) — pas de comptes individuels
// pour ce premier chantier. Une session valide = le mot de passe a été
// vérifié une fois ; la révocation se fait en supprimant la ligne Session,
// comme dans archiaccess-pro/lib/session.ts.

import { randomBytes } from "node:crypto"
import { getPrisma } from "@/lib/prisma"

export const SESSION_COOKIE_NAME = "aisit_session"
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

function generateToken(): string {
  return randomBytes(32).toString("base64url")
}

export async function createSession(): Promise<{ token: string; expiresAt: Date }> {
  const prisma = await getPrisma()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await prisma.session.create({ data: { id: token, expiresAt } })
  return { token, expiresAt }
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const prisma = await getPrisma()
  const session = await prisma.session.findUnique({ where: { id: token } })
  if (!session) return false
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {})
    return false
  }
  return true
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return
  const prisma = await getPrisma()
  await prisma.session.deleteMany({ where: { id: token } })
}
