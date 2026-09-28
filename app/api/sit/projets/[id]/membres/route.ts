import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { exigerAccesProjet, exigerAdmin } from "@/lib/projet-acces"

// Espace collaboratif — membres d'un projet collaboratif. Tout membre voit
// l'équipe ; seul un administrateur donne un accès (et le retire, voir
// [userId]/route.ts). Un compte désactivé ne peut pas recevoir d'accès.

const ROLES = ["MEMBRE", "CHEF_DE_PROJET"] as const

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const garde = await exigerAccesProjet(id)
  if ("reponse" in garde) return garde.reponse

  const prisma = await getPrisma()
  const membres = await prisma.projetMembre.findMany({
    where: { projetId: id },
    orderBy: { createdAt: "asc" },
    select: { role: true, createdAt: true, user: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ success: true, membres })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await exigerAdmin()
  if ("reponse" in admin) return admin.reponse

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { userId?: unknown; role?: unknown }
  if (typeof body.userId !== "string" || !body.userId) {
    return NextResponse.json({ success: false, error: "Collaborateur manquant." }, { status: 400 })
  }
  const role = body.role === undefined ? "MEMBRE" : body.role
  if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ success: false, error: "Rôle invalide." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [projet, cible] = await Promise.all([
    prisma.projet.findUnique({ where: { id }, select: { espace: true } }),
    prisma.user.findUnique({ where: { id: body.userId }, select: { active: true } }),
  ])
  if (!projet || projet.espace !== "COLLABORATIF") {
    return NextResponse.json({ success: false, error: "Projet collaboratif introuvable." }, { status: 404 })
  }
  if (!cible || !cible.active) {
    return NextResponse.json({ success: false, error: "Compte introuvable ou désactivé." }, { status: 400 })
  }

  const membre = await prisma.projetMembre.upsert({
    where: { projetId_userId: { projetId: id, userId: body.userId } },
    create: { projetId: id, userId: body.userId, role: role as (typeof ROLES)[number], ajouteParId: admin.user.id },
    update: { role: role as (typeof ROLES)[number] },
    select: { role: true, createdAt: true, user: { select: { id: true, name: true } } },
  })
  return NextResponse.json({ success: true, membre })
}
