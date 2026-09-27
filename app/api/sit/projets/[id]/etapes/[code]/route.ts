import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { trouverEtape } from "@/lib/referentiel"
import { ETAPE_STATUTS, type EtapeStatut } from "@/lib/referentiel/profil"

// Espace projet — avancement d'un Projet sur une étape du référentiel
// Archiaccess (statut + note). Upsert : la ligne ProjetEtape n'existe
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

  const body = (await request.json().catch(() => ({}))) as { statut?: unknown; note?: unknown }
  const data: { statut?: EtapeStatut; note?: string | null } = {}
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
