import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { trouverEtape } from "@/lib/referentiel"
import { ETAPE_STATUTS, type EtapeStatut } from "@/lib/referentiel/profil"

// Espace projet — avancement d'un Projet sur une étape du référentiel
// Archiaccess (statut, note, échéance). Upsert : la ligne ProjetEtape n'existe
// qu'une fois l'étape renseignée. Le code d'étape est vérifié contre le
// référentiel (lib/referentiel) : jamais d'étape inventée côté client.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; code: string }> }) {
  const store = await cookies()
  const user = await getSessionUser(store.get(SESSION_COOKIE_NAME)?.value)
  if (!user) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id, code } = await params
  if (!trouverEtape(code)) {
    return NextResponse.json({ success: false, error: "Étape inconnue du référentiel." }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as { statut?: unknown; note?: unknown; echeance?: unknown }
  const data: { statut?: EtapeStatut; note?: string | null; echeance?: Date | null } = {}
  if ("statut" in body) {
    if (typeof body.statut !== "string" || !(ETAPE_STATUTS as readonly string[]).includes(body.statut)) {
      return NextResponse.json({ success: false, error: "Statut d'étape invalide." }, { status: 400 })
    }
    data.statut = body.statut as EtapeStatut
  }
  if ("note" in body) {
    if (body.note !== null && typeof body.note !== "string") {
      return NextResponse.json({ success: false, error: "Note invalide." }, { status: 400 })
    }
    data.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null
  }

  // Échéance : date seule "AAAA-MM-JJ" (champ date du navigateur), ou null
  // pour l'effacer. Stockée à midi UTC pour ne jamais changer de jour
  // selon le fuseau d'affichage.
  if ("echeance" in body) {
    if (body.echeance === null || body.echeance === "") {
      data.echeance = null
    } else if (typeof body.echeance === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.echeance)) {
      const d = new Date(`${body.echeance}T12:00:00Z`)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ success: false, error: "Échéance invalide." }, { status: 400 })
      }
      data.echeance = d
    } else {
      return NextResponse.json({ success: false, error: "Échéance invalide." }, { status: 400 })
    }
  }

  const prisma = await getPrisma()
  const projet = await prisma.projet.findUnique({ where: { id }, select: { id: true } })
  if (!projet) {
    return NextResponse.json({ success: false, error: "Projet introuvable." }, { status: 404 })
  }

  const etape = await prisma.projetEtape.upsert({
    where: { projetId_etapeCode: { projetId: id, etapeCode: code } },
    create: { projetId: id, etapeCode: code, ...data, updatedById: user.id },
    update: { ...data, updatedById: user.id },
    include: { updatedBy: { select: { id: true, name: true } } },
  })
  // Le projet remonte en tête de liste quand son avancement change.
  await prisma.projet.update({ where: { id }, data: { updatedAt: new Date() } })

  return NextResponse.json({ success: true, etape })
}
