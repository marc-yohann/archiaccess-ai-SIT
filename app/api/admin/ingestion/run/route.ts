import { NextResponse } from "next/server"
import { getIngestToken } from "@/lib/secrets"
import { runOneInvocation } from "@/lib/ingestion/runner"
import { SireneIngestionRunner } from "@/lib/ingestion/sources/sirene"
import { GeorisquesIngestionRunner } from "@/lib/ingestion/sources/georisques"
import type { IngestionRunner } from "@/lib/ingestion/types"

// Déclenche une invocation bornée du moteur d'ingestion national (voir
// CLAUDE.md et l'audit "transformation en data platform" du 2026-09-12) —
// même pattern d'authentification que /api/admin/run-migration (jeton
// bearer, pas de session : appelée par EventBridge Scheduler, pas par un
// employé). Une invocation = un lot borné, jamais tout le fichier/toute
// l'itération d'un coup — voir lib/ingestion/runner.ts.
const RUNNERS: Record<string, () => IngestionRunner> = {
  sirene: () => new SireneIngestionRunner(),
  georisques: () => new GeorisquesIngestionRunner(),
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization")
  const expected = await getIngestToken()
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const { source } = (await request.json().catch(() => ({}))) as { source?: string }
  const factory = source ? RUNNERS[source] : undefined
  if (!factory) {
    return NextResponse.json(
      { success: false, error: `Source inconnue ou manquante. Sources disponibles : ${Object.keys(RUNNERS).join(", ")}.` },
      { status: 400 },
    )
  }

  try {
    const result = await runOneInvocation(factory())
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 500 },
    )
  }
}
