import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { SESSION_COOKIE_NAME, getSessionUser, type SessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import type { Prisma, ProjetRole } from "@/lib/generated/prisma/client"

// Espace collaboratif (2026-09-28) — règle d'accès unique à un Projet,
// appliquée par toutes les routes qui lisent ou modifient un projet ou
// ses rattachements :
// - PERSONNEL : son seul créateur. L'administrateur ne le voit pas
//   (décision utilisateur : l'espace personnel est vraiment personnel).
// - COLLABORATIF : les membres désignés par un administrateur, tant que
//   le projet n'est pas archivé ; les administrateurs, toujours.
// Un projet inaccessible répond « introuvable » (404) plutôt que
// « interdit » : son existence même n'a pas à être révélée.

export type NiveauAcces = "proprietaire" | "administrateur" | "chef_de_projet" | "membre"

export function filtreProjetsAccessibles(user: SessionUser): Prisma.ProjetWhereInput {
  return {
    OR: [
      { espace: "PERSONNEL", createdById: user.id },
      user.isAdmin
        ? { espace: "COLLABORATIF" }
        : { espace: "COLLABORATIF", archivedAt: null, membres: { some: { userId: user.id } } },
    ],
  }
}

export async function niveauAcces(user: SessionUser, projetId: string): Promise<NiveauAcces | null> {
  const prisma = await getPrisma()
  const projet = await prisma.projet.findUnique({
    where: { id: projetId },
    select: {
      espace: true,
      createdById: true,
      archivedAt: true,
      membres: { where: { userId: user.id }, select: { role: true } },
    },
  })
  if (!projet) return null
  if (projet.espace === "PERSONNEL") return projet.createdById === user.id ? "proprietaire" : null
  if (user.isAdmin) return "administrateur"
  if (projet.archivedAt) return null
  const role: ProjetRole | undefined = projet.membres[0]?.role
  if (!role) return null
  return role === "CHEF_DE_PROJET" ? "chef_de_projet" : "membre"
}

// Modifier le profil ou le nom : le propriétaire d'un projet personnel ;
// l'administrateur ou le chef de projet d'un projet collaboratif.
export function peutModifierProfil(niveau: NiveauAcces): boolean {
  return niveau !== "membre"
}

type Garde = { user: SessionUser; niveau: NiveauAcces } | { reponse: NextResponse }

// Session + accès au projet en un appel, pour les routes /api/sit/projets/[id]/….
export async function exigerAccesProjet(projetId: string): Promise<Garde> {
  const store = await cookies()
  const user = await getSessionUser(store.get(SESSION_COOKIE_NAME)?.value)
  if (!user) return { reponse: NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 }) }
  const niveau = await niveauAcces(user, projetId)
  if (!niveau) return { reponse: NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 }) }
  return { user, niveau }
}

// Session d'administrateur, pour la gestion des projets collaboratifs.
export async function exigerAdmin(): Promise<{ user: SessionUser } | { reponse: NextResponse }> {
  const store = await cookies()
  const user = await getSessionUser(store.get(SESSION_COOKIE_NAME)?.value)
  if (!user) return { reponse: NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 }) }
  if (!user.isAdmin) return { reponse: NextResponse.json({ success: false, error: "Réservé aux administrateurs." }, { status: 403 }) }
  return { user }
}
