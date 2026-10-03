// Authentification par compte employé individuel (voir CLAUDE.md, décision
// utilisateur du 2026-08-30 — remplace le mot de passe d'équipe partagé).
// Une session valide = un utilisateur actif s'est authentifié ; la
// révocation se fait en supprimant la ligne Session.

import { createHash, randomBytes } from "node:crypto"
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

// Le cookie porte le jeton ; la base n'en garde qu'une empreinte (audit du
// 2026-10-03) : une copie de la table Session ne permet pas d'ouvrir une
// session. Les sessions créées avant ce changement (jeton en clair)
// deviennent invalides : chacun se reconnecte une fois.
function empreinte(token: string): string {
  return createHash("sha256").update(token).digest("base64url")
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const prisma = await getPrisma()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  // Ménage : les sessions expirées ne sont sinon supprimées qu'au moment
  // où quelqu'un les présente.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {})
  await prisma.session.create({ data: { id: empreinte(token), userId, expiresAt } })
  return { token, expiresAt }
}

// Un compte qui doit encore changer son mot de passe temporaire n'a accès
// qu'aux routes qui le permettent (/api/auth/me, change-password, logout),
// qui passent `{ motDePasseTemporaireAccepte: true }` : la règle n'est plus
// seulement imposée par l'interface (audit du 2026-10-03).
export async function getSessionUser(
  token: string | undefined,
  options: { motDePasseTemporaireAccepte?: boolean } = {},
): Promise<SessionUser | null> {
  if (!token) return null
  const prisma = await getPrisma()
  const id = empreinte(token)
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => {})
    return null
  }
  if (!session.user.active) return null
  if (session.user.mustChangePassword && !options.motDePasseTemporaireAccepte) return null
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
  await prisma.session.deleteMany({ where: { id: empreinte(token) } })
}
