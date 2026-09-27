import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// Veille commerciale du tableau de bord : avis de marché récents dont
// l'objet relève d'une mission d'AMO, de conduite d'opération ou d'OPC,
// lus dans les AvisMarche déjà ingérés (campagne BOAMP nationale) — aucun
// appel externe ici. Filtre par mots de l'objet uniquement : volontairement
// simple et vérifiable, jamais une classification devinée.
const JOURS = 7
// ILIKE : « _ » absorbe les variantes d'accent (maîtrise/maitrise).
const MOTIFS = ["%assistance%ma_trise d%ouvrage%", "%conduite d%op_ration%", "%ordonnancement%pilotage%"]

interface AvisVeille {
  id: string
  objet: string | null
  acheteurNom: string | null
  codeDepartement: string | null
  datePublication: string | null
  dateLimiteReponse: string | null
  urlAvis: string | null
}

export async function GET() {
  const store = await cookies()
  if (!(await getSessionUser(store.get(SESSION_COOKIE_NAME)?.value))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  // datePublication est conservée au format de la source (AAAA-MM-JJ pour
  // BOAMP) : comparaison lexicographique valable sur ce format.
  const depuis = new Date(Date.now() - JOURS * 86_400_000).toISOString().slice(0, 10)
  const prisma = await getPrisma()
  // Sigles AMO / OPC en mot entier seulement (\m \M), pour ne pas capter
  // « amortissement » ou un code quelconque.
  const avis = await prisma.$queryRaw<AvisVeille[]>`
    SELECT "id", "objet", "acheteurNom", "codeDepartement", "datePublication", "dateLimiteReponse", "urlAvis"
    FROM "AvisMarche"
    WHERE "datePublication" >= ${depuis}
      AND ("objet" ILIKE ANY(${MOTIFS}::text[]) OR "objet" ~ '\\m(AMO|OPC)\\M')
    ORDER BY "datePublication" DESC
    LIMIT 8`

  return NextResponse.json({ success: true, jours: JOURS, avis })
}
