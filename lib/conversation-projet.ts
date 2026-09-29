import type { SessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { filtreProjetsAccessibles } from "@/lib/projet-acces"
import { trouverEtape } from "@/lib/referentiel"
import { contexteProjet } from "@/lib/referentiel/contexte-ia"
import type { EtapeStatut } from "@/lib/referentiel/profil"

// Projet d'une conversation d'Archiaccess AI (jonction au SIT, 2026-09-29).
// Serveur uniquement. L'accès passe par la règle unique de
// lib/projet-acces.ts et il est revérifié à chaque question : un
// collaborateur retiré d'un projet d'équipe garde ses conversations, mais
// Archiaccess AI n'en reçoit plus le contexte.

export async function projetDeConversation(user: SessionUser, projetId: string) {
  const prisma = await getPrisma()
  return prisma.projet.findFirst({
    where: { AND: [{ id: projetId }, filtreProjetsAccessibles(user)] },
    select: {
      id: true,
      nom: true,
      description: true,
      statutMoa: true,
      montage: true,
      typologie: true,
      mission: true,
      rehabilitation: true,
      espace: true,
      etapes: { select: { etapeCode: true, statut: true, echeance: true, note: true } },
    },
  })
}

export type ProjetDeConversation = NonNullable<Awaited<ReturnType<typeof projetDeConversation>>>

// Code d'étape reconnu par le référentiel, sinon rien.
export function etapeValide(code: string | null | undefined): string | null {
  return code && trouverEtape(code) ? code : null
}

// Même contexte que celui que construit le panneau de l'espace projet
// (lib/referentiel/contexte-ia.ts), reconstruit ici à partir de la base :
// Archiaccess AI a le projet en tête où qu'on reprenne la conversation.
export function contexteDeConversation(projet: ProjetDeConversation, etapeCode: string | null): string {
  const etape = etapeCode ? trouverEtape(etapeCode) ?? null : null
  return contexteProjet(
    {
      ...projet,
      etapes: projet.etapes.map((e) => ({
        etapeCode: e.etapeCode,
        statut: e.statut as EtapeStatut,
        echeance: e.echeance ? e.echeance.toISOString() : null,
        note: e.note,
      })),
    },
    etape,
  )
}

// Identifiants des projets accessibles, pour filtrer les rattachements
// affichés dans la liste des conversations.
export async function idsProjetsAccessibles(user: SessionUser): Promise<Set<string>> {
  const prisma = await getPrisma()
  const projets = await prisma.projet.findMany({ where: filtreProjetsAccessibles(user), select: { id: true } })
  return new Set(projets.map((p) => p.id))
}
