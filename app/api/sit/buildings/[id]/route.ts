import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Fiche d'un bâtiment physique (RNB, Phase 5C) — même principe que
// /api/sit/sites/[id] : lecture brute des relations réelles, pas encore
// d'assemblage de vue dédiée (aucun consommateur UI connu aujourd'hui).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse

  const { id } = await params
  const prisma = await getPrisma()
  const batiment = await prisma.batimentPhysique.findUnique({
    where: { id },
    include: {
      parcelleLinks: { include: { parcelle: true } },
      siteLinks: { include: { site: true } },
    },
  })
  if (!batiment) {
    return NextResponse.json({ success: false, error: "Bâtiment introuvable." }, { status: 404 })
  }

  return NextResponse.json({ success: true, batiment })
}
