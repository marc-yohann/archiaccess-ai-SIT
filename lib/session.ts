// Authentification par compte employé individuel (voir CLAUDE.md, décision
// utilisateur du 2026-08-30 — remplace le mot de passe d'équipe partagé).
// Une session valide = un utilisateur actif s'est authentifié ; la
// révocation se fait en supprimant la ligne Session.

import { randomBytes } from "node:crypto"
import { getPrisma } from "@/lib/prisma"

export const SESSION_COOKIE_NAME = "aisit_session"
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

export interface SessionUser {
  id: string
  email: string
  name: string
  isAdmin: boolean
  mustChangePassword: boolean
}

function generateToken(): string {
  return randomBytes(32).toString("base64url")
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const prisma = await getPrisma()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await prisma.session.create({ data: { id: token, userId, expiresAt } })
  return { token, expiresAt }
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  const prisma = await getPrisma()
  const session = await prisma.session.findUnique({ where: { id: token }, include: { user: true } })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {})
    return null
  }
  if (!session.user.active) return null
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isAdmin: session.user.isAdmin,
    mustChangePassword: session.user.mustChangePassword,
  }
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  return (await getSessionUser(token)) !== null
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return
  const prisma = await getPrisma()
  await prisma.session.deleteMany({ where: { id: token } })
}
