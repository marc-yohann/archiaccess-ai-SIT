import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { exigerAdmin } from "@/lib/projet-acces"

// Espace collaboratif — changer le rôle d'un membre ou lui retirer l'accès
// (administrateur uniquement). Retirer un accès ne supprime rien de ce que
// le membre a fait sur le projet.

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const admin = await exigerAdmin()
  if ("reponse" in admin) return admin.reponse

  const { id, userId } = await params
  const body = (await request.json().catch(() => ({}))) as { role?: unknown }
  if (body.role !== "MEMBRE" && body.role !== "CHEF_DE_PROJET") {
    return NextResponse.json({ success: false, error: "Rôle invalide." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const { count } = await prisma.projetMembre.updateMany({ where: { projetId: id, userId }, data: { role: body.role } })
  if (count === 0) return NextResponse.json({ success: false, error: "Membre introuvable." }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const admin = await exigerAdmin()
  if ("reponse" in admin) return admin.reponse

  const { id, userId } = await params
  const prisma = await getPrisma()
  await prisma.projetMembre.deleteMany({ where: { projetId: id, userId } })
  return NextResponse.json({ success: true })
}
