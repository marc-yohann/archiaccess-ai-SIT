import { NextResponse } from "next/server"
import { getIngestToken } from "@/lib/secrets"
import { getPrisma } from "@/lib/prisma"
import { preprocessManifest } from "@/lib/ingestion/chunked-zip"

// Décompresse UNE SEULE FOIS le fichier original déjà stagé (voir
// lib/ingestion/chunked-zip.ts) et le découpe en chunks — volontairement
// SÉPARÉE de /api/admin/ingestion/run : cette passe ne peut pas être
// bornée à 30s pour un gros fichier (aucune reprise possible à un octet
// arbitraire d'un flux DEFLATE) et doit tourner à son terme dans un
// contexte à connexion longue (voir le rapport pour le seuil concret).
// Jamais appelée par la même règle EventBridge que /run — un déclenchement
// manuel ou un job à timeout long (Fargate/Batch) est requis en
// production pour les fichiers de plusieurs Go.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization")
  const expected = await getIngestToken()
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const { source, dataset } = (await request.json().catch(() => ({}))) as { source?: string; dataset?: string }
  if (!source || !dataset) {
    return NextResponse.json({ success: false, error: "source et dataset requis." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const stageJob = await prisma.ingestionJob.findUnique({ where: { source_dataset_partition: { source, dataset, partition: "stage" } } })
  if (!stageJob || !stageJob.checkpoint) {
    return NextResponse.json({ success: false, error: "Aucun staging trouvé — lancer le partition 'stage' d'abord." }, { status: 400 })
  }
  const checkpoint = stageJob.checkpoint as { manifestId: string; datasetVersion: string; partCount: number; bytesDownloaded: number; totalBytes: number }
  if (checkpoint.bytesDownloaded < checkpoint.totalBytes) {
    return NextResponse.json(
      { success: false, error: `Staging incomplet (${checkpoint.bytesDownloaded}/${checkpoint.totalBytes} octets) — le preprocessing doit attendre la fin du téléchargement.` },
      { status: 409 },
    )
  }

  const manifest = await prisma.datasetManifest.findUnique({ where: { id: checkpoint.manifestId } })
  if (!manifest) {
    return NextResponse.json({ success: false, error: "Manifeste introuvable." }, { status: 404 })
  }

  try {
    const result = await preprocessManifest(manifest.id, source, dataset, checkpoint.datasetVersion, checkpoint.partCount, manifest.chunkTargetRows)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 500 },
    )
  }
}
