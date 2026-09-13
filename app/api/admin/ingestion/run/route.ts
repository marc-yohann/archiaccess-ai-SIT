import { NextResponse } from "next/server"
import { getIngestToken } from "@/lib/secrets"
import { runOneInvocation } from "@/lib/ingestion/runner"
import {
  SireneEtablissementStagingRunner,
  SireneEtablissementIngestionRunner,
  SireneUniteLegaleStagingRunner,
  SireneUniteLegaleIngestionRunner,
} from "@/lib/ingestion/sources/sirene"
import { GeorisquesIngestionRunner } from "@/lib/ingestion/sources/georisques"
import { BanIngestionRunner } from "@/lib/ingestion/sources/ban"
import { CadastreStagingRunner, CadastreIngestionRunner } from "@/lib/ingestion/sources/cadastre"
import type { IngestionRunner } from "@/lib/ingestion/types"

// Déclenche une invocation bornée du moteur d'ingestion national (voir
// CLAUDE.md et l'audit "transformation en data platform" du 2026-09-12) —
// même pattern d'authentification que /api/admin/run-migration (jeton
// bearer, pas de session : appelée par EventBridge Scheduler, pas par un
// employé). Une invocation = un lot borné, jamais tout le fichier/toute
// l'itération d'un coup — voir lib/ingestion/runner.ts.
//
// "-stage" télécharge le fichier officiel par morceaux (resumable) ;
// "-ingest" consomme les chunks d'un manifeste READY (voir
// lib/ingestion/chunked-zip.ts) — le préprocessing (décompression unique
// + découpage) est déclenché séparément via /api/admin/ingestion/preprocess,
// PAS par cette route (il ne peut pas être borné à 30s pour un gros
// fichier, voir le rapport).
// Cadastre a besoin d'un paramètre "department" (une instance = un
// département — partition technique, section 6/16 du brief Phase 4,
// jamais une priorité métier) — les autres factories l'ignorent.
const RUNNERS: Record<string, (department?: string) => IngestionRunner> = {
  "sirene-etablissement-stage": () => new SireneEtablissementStagingRunner(),
  "sirene-etablissement-ingest": () => new SireneEtablissementIngestionRunner(),
  "sirene-unitelegale-stage": () => new SireneUniteLegaleStagingRunner(),
  "sirene-unitelegale-ingest": () => new SireneUniteLegaleIngestionRunner(),
  georisques: () => new GeorisquesIngestionRunner(),
  ban: () => new BanIngestionRunner(),
  "cadastre-stage": (department) => {
    if (!department) throw new Error("cadastre-stage requiert un paramètre 'department'.")
    return new CadastreStagingRunner(department)
  },
  "cadastre-ingest": (department) => {
    if (!department) throw new Error("cadastre-ingest requiert un paramètre 'department'.")
    return new CadastreIngestionRunner(department)
  },
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization")
  const expected = await getIngestToken()
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const { source, department } = (await request.json().catch(() => ({}))) as { source?: string; department?: string }
  const factory = source ? RUNNERS[source] : undefined
  if (!factory) {
    return NextResponse.json(
      { success: false, error: `Source inconnue ou manquante. Sources disponibles : ${Object.keys(RUNNERS).join(", ")}.` },
      { status: 400 },
    )
  }

  try {
    const result = await runOneInvocation(factory(department))
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 500 },
    )
  }
}
