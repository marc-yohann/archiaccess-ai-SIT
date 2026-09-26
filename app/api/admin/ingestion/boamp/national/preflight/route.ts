import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { refreshPreflight } from "@/lib/ingestion/boamp-campaign"

// Re-preflight ciblé de départements déjà vérifiés — à utiliser après une
// correction de la requête BOAMP (ex: Corse 2A/2B -> 20A/20B), le
// preflight automatique ne revérifiant jamais un département déjà présent.
// Body : { "departments": ["2A", "2B"] } (codes administratifs, 20 max).
export async function POST(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const { departments } = (await request.json().catch(() => ({}))) as { departments?: unknown }
  if (!Array.isArray(departments) || departments.length === 0 || !departments.every((d) => typeof d === "string")) {
    return NextResponse.json({ success: false, error: "Paramètre 'departments' requis (liste de codes)." }, { status: 400 })
  }

  try {
    const results = await refreshPreflight(departments as string[])
    return NextResponse.json({ success: true, results })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Erreur inconnue." }, { status: 400 })
  }
}
