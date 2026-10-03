import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getPrisma } from "@/lib/prisma"
import { verifyPassword } from "@/lib/password"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/session"

// Limitation des essais de mot de passe (audit du 2026-10-03) : au-delà de
// 5 échecs pour une même adresse, ou de 20 depuis une même adresse IP, en
// 15 minutes, la connexion est refusée jusqu'à la fin de la fenêtre. Les
// échecs sont comptés en base (table TentativeConnexion), partagée par
// toutes les instances de la fonction serveur.
const FENETRE_MS = 15 * 60 * 1000
const ECHECS_MAX_PAR_ADRESSE = 5
const ECHECS_MAX_PAR_IP = 20

// Empreinte factice (sel et clé de la bonne longueur) : quand l'adresse
// n'existe pas, le mot de passe est quand même vérifié contre elle, pour que
// le temps de réponse ne révèle pas quelles adresses ont un compte.
const EMPREINTE_FACTICE = `${"00".repeat(16)}:${"00".repeat(64)}`

function adresseIp(request: Request): string | null {
  // CloudFront ajoute l'adresse du visiteur en tête de x-forwarded-for.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return ip ? ip.slice(0, 64) : null
}

export async function POST(request: Request) {
  const { email, password } = (await request.json().catch(() => ({}))) as { email?: string; password?: string }
  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Email et mot de passe requis." }, { status: 400 })
  }
  const adresse = email.trim().toLowerCase().slice(0, 320)
  const ip = adresseIp(request)

  const prisma = await getPrisma()
  const depuis = new Date(Date.now() - FENETRE_MS)
  const [echecsAdresse, echecsIp] = await Promise.all([
    prisma.tentativeConnexion.count({ where: { email: adresse, createdAt: { gte: depuis } } }),
    ip ? prisma.tentativeConnexion.count({ where: { ip, createdAt: { gte: depuis } } }) : Promise.resolve(0),
  ])
  if (echecsAdresse >= ECHECS_MAX_PAR_ADRESSE || echecsIp >= ECHECS_MAX_PAR_IP) {
    return NextResponse.json(
      { success: false, error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
      { status: 429 },
    )
  }

  const user = await prisma.user.findUnique({ where: { email: adresse } })
  const motDePasseValide = await verifyPassword(password, user?.passwordHash ?? EMPREINTE_FACTICE)
  if (!user || !user.active || !motDePasseValide) {
    await prisma.tentativeConnexion.create({ data: { email: adresse, ip } })
    // Ménage des échecs anciens (au-delà de 24 heures).
    await prisma.tentativeConnexion
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => {})
    return NextResponse.json({ success: false, error: "Identifiants incorrects." }, { status: 401 })
  }

  await prisma.tentativeConnexion.deleteMany({ where: { email: adresse } })
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
