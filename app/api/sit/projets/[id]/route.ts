import { NextResponse } from "next/server"
import { exigerAccesProjet, personnesDuProjet, peutModifierProfil } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"
import { serializeDocumentSit } from "@/lib/documents-sit"
import { lireProfil } from "@/lib/referentiel/profil"

// Lecture/modification d'un Projet (Phase 10) et de ses rattachements
// réels — jamais une résolution automatique, voir POST des sous-routes
// (sites/acteurs/avis-marches/lots) pour les rattachements explicites.
//
// documentSitLinks/besoinLinks ajoutés lors de la mission de finalisation
// (audit Phase I — graphe et navigation) : ces relations existent dans
// prisma/schema.prisma depuis les Phases 11B/12 (postérieures à cette
// route) mais n'y avaient jamais été branchées — un vrai manque
// fonctionnel démontré, pas une préférence. Correction additive
// uniquement, aucune migration.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const garde = await exigerAccesProjet(id)
  if ("reponse" in garde) return garde.reponse
  const { user, niveau } = garde
  const prisma = await getPrisma()
  const projet = await prisma.projet.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      sites: { include: { site: true, ajoutePar: { select: { id: true, name: true } } } },
      acteurs: { include: { acteur: true, ajoutePar: { select: { id: true, name: true } } } },
      avisMarches: { include: { avisMarche: true, ajoutePar: { select: { id: true, name: true } } } },
      lots: { include: { lot: { include: { avisMarche: true } }, ajoutePar: { select: { id: true, name: true } } } },
      documentSitLinks: { include: { documentSit: true } },
      besoinLinks: { include: { besoin: true } },
      etapes: { include: { updatedBy: { select: { id: true, name: true } }, responsable: { select: { id: true, name: true } } } },
      membres: {
        select: { role: true, createdAt: true, user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!projet) {
    return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  }

  // documentSit.tailleOctets est un BigInt — non sérialisable tel quel.
  const serialized = {
    ...projet,
    documentSitLinks: projet.documentSitLinks.map((link) => ({ ...link, documentSit: serializeDocumentSit(link.documentSit) })),
  }

  // acces : ce que l'interface peut proposer à cet utilisateur (le
  // serveur revérifie à chaque modification).
  const acces = { niveau, modifierProfil: peutModifierProfil(niveau), administrer: user.isAdmin && projet.espace === "COLLABORATIF" }
  // personnes : responsables d'étape possibles.
  const personnes = await personnesDuProjet(id)
  return NextResponse.json({ success: true, projet: serialized, acces, personnes, moi: user.id })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const garde = await exigerAccesProjet(id)
  if ("reponse" in garde) return garde.reponse
  const { user, niveau } = garde

  const body = (await request.json()) as Record<string, unknown> & {
    nom?: string
    type?: string | null
    statut?: string | null
    description?: string | null
    dateDebut?: string | null
    dateFin?: string | null
    montant?: number | null
    archive?: boolean
  }

  const prisma = await getPrisma()
  const existing = await prisma.projet.findUnique({ where: { id }, select: { espace: true } })
  if (!existing) {
    return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  }

  // Archiver / désarchiver : un administrateur, sur un projet
  // collaboratif uniquement.
  const archivage = typeof body.archive === "boolean"
  if (archivage && !(user.isAdmin && existing.espace === "COLLABORATIF")) {
    return NextResponse.json({ success: false, error: "Seul un administrateur archive un projet collaboratif." }, { status: 403 })
  }
  const modifieProfil = Object.keys(body).some((k) => k !== "archive")
  if (modifieProfil && !peutModifierProfil(niveau)) {
    return NextResponse.json({ success: false, error: "Seuls le chef de projet et l'administrateur modifient le profil du projet." }, { status: 403 })
  }

  const profil = lireProfil(body)
  if ("error" in profil) {
    return NextResponse.json({ success: false, error: profil.error }, { status: 400 })
  }

  const data: {
    nom?: string
    type?: string | null
    statut?: string | null
    description?: string | null
    dateDebut?: Date | null
    dateFin?: Date | null
    montant?: number | null
    archivedAt?: Date | null
  } & typeof profil.data = { ...profil.data }
  if (typeof body.nom === "string") {
    const nom = body.nom.trim()
    if (!nom) {
      return NextResponse.json({ success: false, error: "Le nom du projet ne peut pas être vide." }, { status: 400 })
    }
    data.nom = nom
  }
  if ("type" in body) data.type = body.type?.trim() || null
  if ("statut" in body) data.statut = body.statut?.trim() || null
  if ("description" in body) data.description = body.description?.trim() || null
  if ("dateDebut" in body) data.dateDebut = body.dateDebut ? new Date(body.dateDebut) : null
  if ("dateFin" in body) data.dateFin = body.dateFin ? new Date(body.dateFin) : null
  if ("montant" in body) data.montant = typeof body.montant === "number" ? body.montant : null
  if (archivage) data.archivedAt = body.archive ? new Date() : null

  const projet = await prisma.projet.update({ where: { id }, data })
  return NextResponse.json({ success: true, projet })
}
