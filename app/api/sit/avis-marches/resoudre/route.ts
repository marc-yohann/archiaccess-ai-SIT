import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

// « Ajouter au projet » depuis la recherche (jonction SIT / Archiaccess AI,
// étape 4) : un avis BOAMP trouvé en direct n'est rattachable à un projet
// que s'il est déjà enregistré en base (AvisMarche, alimenté par la
// campagne nationale). On le retrouve par sa clé unique (source,
// sourceId = idweb), jamais par l'objet, l'acheteur ou recordId. Rien
// n'est créé ici : un avis pas encore enregistré n'est simplement pas
// proposé à l'ajout. Lecture seule, sans lien avec un projet.
const MAX = 50

export async function POST(request: Request) {
  const store = await cookies()
  if (!(await isValidSession(store.get(SESSION_COOKIE_NAME)?.value))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { idwebs } = (await request.json().catch(() => ({}))) as { idwebs?: unknown }
  const liste = Array.isArray(idwebs) ? [...new Set(idwebs.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 40))].slice(0, MAX) : []
  if (liste.length === 0) return NextResponse.json({ success: true, ids: {} })

  const prisma = await getPrisma()
  const avis = await prisma.avisMarche.findMany({
    where: { source: "boamp", sourceId: { in: liste } },
    select: { id: true, sourceId: true },
  })
  return NextResponse.json({ success: true, ids: Object.fromEntries(avis.map((a) => [a.sourceId, a.id])) })
}
