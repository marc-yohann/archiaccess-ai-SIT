// Résolution différée des relations Unite<->BatimentPhysique (Phase 7 —
// voir prisma/schema.prisma pour le contexte complet du renommage
// Batiment->Unite). Suit exactement la même architecture que
// SiteParcelleResolutionRunner (lib/ingestion/sources/site-parcelle.ts) :
// ne télécharge/n'importe rien, recalcule la relation à partir des
// géométries déjà en base (Unite.longitude/latitude, BatimentPhysique.geom).
//
// Différence avec SiteParcelleResolutionRunner : ST_Covers, pas
// ST_Contains (choix explicite Phase 7 — un point DPE exactement sur la
// frontière d'une empreinte RNB doit rester résolu). Et surtout : NOT_FOUND
// est un état PERSISTÉ sur Unite (batimentPhysiqueResolutionStatus), pas
// seulement l'absence de ligne UniteBatimentPhysique — contrairement à
// SiteParcelle où l'absence de relation suffit à signifier "sans site/
// parcelle", ici il faut distinguer "jamais traité" de "traité, 0 résultat"
// (aucune référence source à comparer, contrairement à RNB.plots/addresses
// qui fournissent toujours une chaîne à confronter même en échec).
//
// Chaque Unite est résolue dans SA PROPRE transaction (jamais un batch
// entier dans une seule transaction) — même garantie de cohérence qu'un
// crash/timeout Lambda en cours de traitement que SiteParcelleResolutionRunner.

import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

interface ResolveCheckpoint extends IngestionCheckpoint {
  afterId: string | null
}

const RESOLVE_TRANSACTION_TIMEOUT_MS = 30_000

async function resolveForUnite(uniteId: string): Promise<void> {
  const prisma = await getPrisma()
  await prisma.$transaction(
    async (tx) => {
      // Bâtiments physiques dont l'empreinte RÉELLE couvre le point DPE
      // (ST_Covers, pas ST_Contains : un point exactement sur la frontière
      // doit rester résolu) — jamais un LIMIT, jamais une sélection
      // arbitraire si plusieurs candidats.
      const matches = await tx.$queryRaw<{ batimentId: string }[]>`
        SELECT b."id" AS "batimentId" FROM "BatimentPhysique" b, "Unite" u
        WHERE u."id" = ${uniteId} AND b."geom" IS NOT NULL
          AND u."longitude" IS NOT NULL AND u."latitude" IS NOT NULL
          AND ST_Covers(b."geom", ST_SetSRID(ST_MakePoint(u."longitude", u."latitude"), 4326))
      `
      const matchedIds = new Set(matches.map((m) => m.batimentId))

      // Nettoie les relations devenues fausses (empreinte modifiée par un
      // nouveau millésime RNB, par ex.) — jamais laissées périmées en place.
      const existing = await tx.uniteBatimentPhysique.findMany({
        where: { uniteId },
        select: { id: true, batimentId: true },
      })
      for (const e of existing) {
        if (!matchedIds.has(e.batimentId)) {
          await tx.uniteBatimentPhysique.delete({ where: { id: e.id } })
        }
      }

      const status = matches.length === 0 ? "NOT_FOUND" : matches.length === 1 ? "VALID" : "AMBIGUOUS"
      const referenceStatus = matches.length === 1 ? "VALID" : "AMBIGUOUS"

      // NOT_FOUND : aucune ligne UniteBatimentPhysique créée (voir l'en-tête
      // de ce fichier) — seul le statut sur Unite est mis à jour.
      for (const m of matches) {
        await tx.uniteBatimentPhysique.upsert({
          where: { uniteId_batimentId: { uniteId, batimentId: m.batimentId } },
          create: { uniteId, batimentId: m.batimentId, referenceStatus },
          update: { referenceStatus },
        })
      }

      await tx.unite.update({
        where: { id: uniteId },
        data: { batimentPhysiqueResolutionStatus: status, batimentPhysiqueResolvedAt: new Date() },
      })
    },
    { timeout: RESOLVE_TRANSACTION_TIMEOUT_MS },
  )
}

export class UniteBatimentPhysiqueResolutionRunner implements IngestionRunner {
  source = "unite-batiment-physique"
  dataset = "relations"
  partition = "resolve"

  async runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult> {
    const prisma = await getPrisma()
    const cp = (checkpoint as ResolveCheckpoint | null) ?? { afterId: null }
    const batchSize = getBatchSize(300, "UNITE_BATIMENT_RESOLVE_BATCH_ROWS")

    // Seules les Unite avec coordonnées connues et non encore traitées
    // (PENDING) sont candidates — une Unite déjà VALID/NOT_FOUND/AMBIGUOUS
    // n'est jamais retraitée par ce passage (voir la note sur idempotence :
    // relancer runBatch sur un ensemble déjà résolu doit produire done=true
    // rapidement, pas retraiter en boucle ce qui l'est déjà). Un futur
    // passage de ré-résolution complète (millésime RNB plus récent, par
    // exemple) est hors périmètre de cette phase.
    const unites = cp.afterId
      ? await prisma.unite.findMany({
          where: { longitude: { not: null }, latitude: { not: null }, batimentPhysiqueResolutionStatus: "PENDING", id: { gt: cp.afterId } },
          select: { id: true },
          orderBy: { id: "asc" },
          take: batchSize,
        })
      : await prisma.unite.findMany({
          where: { longitude: { not: null }, latitude: { not: null }, batimentPhysiqueResolutionStatus: "PENDING" },
          select: { id: true },
          orderBy: { id: "asc" },
          take: batchSize,
        })

    if (unites.length === 0) {
      return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: cp, done: true }
    }

    let read = 0
    let updated = 0
    let rejected = 0
    const errors: string[] = []
    let lastId = cp.afterId

    for (const u of unites) {
      if (Date.now() >= deadlineMs) break
      try {
        await resolveForUnite(u.id)
        updated += 1
      } catch (error) {
        rejected += 1
        errors.push(`${u.id} : ${error instanceof Error ? error.message : "erreur inconnue"}`)
      }
      read += 1
      lastId = u.id
    }

    const next: ResolveCheckpoint = { afterId: lastId }
    return { read, inserted: 0, updated, rejected, errors, checkpoint: next, done: false }
  }
}
