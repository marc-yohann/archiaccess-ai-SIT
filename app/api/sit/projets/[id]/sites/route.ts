import { NextResponse } from "next/server"
import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Rattachement Projet<->Site — action explicite uniquement (Phase 10, voir
// prisma/schema.prisma::ProjetSite). Un Projet peut concerner plusieurs
// sites, jamais résolu automatiquement. upsert plutôt que create : un
// second rattachement identique (même projetId+siteId) est un no-op
// idempotent, jamais un doublon (contrainte @@unique déjà en base).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projetId } = await params
  const garde = await exigerAccesProjet(projetId)
  if ("reponse" in garde) return garde.reponse
  const { siteId } = (await request.json()) as { siteId?: string }
  if (!siteId) {
    return NextResponse.json({ success: false, error: "Paramètre siteId manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [projet, site] = await Promise.all([
    prisma.projet.findUnique({ where: { id: projetId }, select: { id: true } }),
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true } }),
  ])
  if (!projet) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  if (!site) return NextResponse.json({ success: false, error: "Site introuvable." }, { status: 404 })

  const lien = await prisma.projetSite.upsert({
    where: { projetId_siteId: { projetId, siteId } },
    create: { projetId, siteId, ajouteParId: garde.user.id },
    update: {},
    include: { site: true },
  })

  return NextResponse.json({ success: true, lien })
}
