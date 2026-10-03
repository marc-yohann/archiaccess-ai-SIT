import { NextResponse } from "next/server"
import { exigerAdmin } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"

// Observabilité du moteur d'ingestion (voir CLAUDE.md, section
// "administration data" de l'audit du 2026-09-12) : répond à "SIRENE
// national est-il réellement chargé ?", "combien de lignes traitées ?",
// "quelle partition est bloquée ?"... Réservé aux admins (session), pas
// le jeton bearer d'ingestion (lecture humaine, pas machine-à-machine).
export async function GET() {
  const garde = await exigerAdmin()
  if ("reponse" in garde) return garde.reponse

  const prisma = await getPrisma()
  const jobs = await prisma.ingestionJob.findMany({
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ success: true, jobs })
}
