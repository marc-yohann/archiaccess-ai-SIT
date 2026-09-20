import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { ActeurType } from "@/lib/generated/prisma/client"

// Rattachement Projet<->Acteur, avec rôle optionnel (Phase 10). role
// réutilise ActeurType (déjà en place, Phase 2) — propre à CETTE relation,
// jamais copié depuis Acteur.type (un même Acteur peut jouer des rôles
// différents selon le projet, voir prisma/schema.prisma::ProjetActeur).
const VALID_ROLES = new Set<string>(Object.values(ActeurType))

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id: projetId } = await params
  const { acteurId, role } = (await request.json()) as { acteurId?: string; role?: string | null }
  if (!acteurId) {
    return NextResponse.json({ success: false, error: "Paramètre acteurId manquant." }, { status: 400 })
  }
  if (role && !VALID_ROLES.has(role)) {
    return NextResponse.json({ success: false, error: `Rôle inconnu. Valeurs possibles : ${[...VALID_ROLES].join(", ")}.` }, { status: 400 })
  }

  const prisma = await getPrisma()
  const [projet, acteur] = await Promise.all([
    prisma.projet.findUnique({ where: { id: projetId }, select: { id: true } }),
    prisma.acteur.findUnique({ where: { id: acteurId }, select: { id: true } }),
  ])
  if (!projet) return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  if (!acteur) return NextResponse.json({ success: false, error: "Acteur introuvable." }, { status: 404 })

  const lien = await prisma.projetActeur.upsert({
    where: { projetId_acteurId: { projetId, acteurId } },
    create: { projetId, acteurId, role: (role as ActeurType | null) ?? null },
    // Un rattachement répété avec un rôle différent met à jour le rôle —
    // reste une action explicite de l'utilisateur, jamais une déduction.
    update: { role: (role as ActeurType | null) ?? null },
    include: { acteur: true },
  })

  return NextResponse.json({ success: true, lien })
}
