// Résolution différée des relations Site<->Parcelle (Phase 4.5 —
// consolidation du modèle géospatial, voir CLAUDE.md et le rapport). Suit
// la même architecture que les autres runners (IngestionJob/IngestionRunner,
// lib/ingestion/runner.ts) mais ne télécharge/n'importe rien : elle
// recalcule la relation N:N (voir SiteParcelle, prisma/schema.prisma) à
// partir des géométries déjà en base (Parcelle.geom, Site.geom).
//
// Remplace la résolution qui vivait auparavant ligne par ligne DANS
// CadastreIngestionRunner (Phase 4). Cette approche entrelacée souffrait
// d'un problème de concurrence documenté au rapport Phase 4 : une lecture
// concurrente pouvait observer transitoirement une relation "certaine"
// avant qu'une parcelle ingérée juste après ne révèle qu'elle était en
// fait ambiguë. Séparer la résolution de l'ingestion elle-même règle ce
// problème À LA RACINE plutôt que de le contourner : l'ingestion Cadastre
// n'écrit plus JAMAIS de relation (seulement la géométrie de la parcelle),
// et ce runner est le SEUL à lire/écrire SiteParcelle, dans un passage
// idempotent et ré-exécutable à volonté.
//
// Limite assumée et documentée (jamais cachée, voir le rapport) : ce
// passage reste batché — si la Parcelle B (contenant le même Site que la
// Parcelle A, cas ambigu) est ingérée APRÈS que ce runner ait déjà traité
// A lors d'un passage, l'ambiguïté n'est détectée qu'au PROCHAIN passage
// de résolution (quand B sera à son tour traitée et redécouvrira/corrigera
// la relation de A pour ce même Site). Aucun système batché ne peut
// garantir une cohérence temps réel sans verrouiller l'intégralité de la
// table à chaque écriture, ce qui n'est pas justifié ici. La seule
// garantie de cohérence totale : ingestion terminée pour les partitions
// concernées, PUIS résolution exécutée jusqu'à son terme (done=true).
//
// Chaque parcelle est résolue dans SA PROPRE transaction (jamais un
// batch entier dans une seule transaction) : un crash/timeout Lambda en
// cours de traitement ne laisse donc jamais une parcelle à moitié
// résolue (un Site marqué ambigu sans que l'autre candidate le soit
// aussi, par exemple) — au pire, le prochain passage retraite cette
// parcelle depuis un état cohérent.

import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

interface ResolveCheckpoint extends IngestionCheckpoint {
  afterId: string | null
}

// Transaction généreuse (30s, pas les 5s par défaut de Prisma) : une
// parcelle avec beaucoup de Sites réels à l'intérieur (immeuble collectif
// dense) peut nécessiter plusieurs dizaines de requêtes d'ambiguïté —
// jamais mesuré comme un problème réel à l'échelle testée, mais une
// marge explicite plutôt qu'un timeout par défaut arbitraire.
const RESOLVE_TRANSACTION_TIMEOUT_MS = 30_000

async function resolveForParcelle(parcelleId: string): Promise<number> {
  const prisma = await getPrisma()
  let touched = 0
  await prisma.$transaction(
    async (tx) => {
      // Sites RÉELLEMENT contenus par cette parcelle (containment exact,
      // jamais une proximité) — source de vérité unique : la géométrie.
      const matches = await tx.$queryRaw<{ siteId: string }[]>`
        SELECT s.id AS "siteId" FROM "Site" s, "Parcelle" p
        WHERE p.id = ${parcelleId} AND p.geom IS NOT NULL AND s.geom IS NOT NULL AND ST_Contains(p.geom, s.geom)
      `
      const matchedSiteIds = new Set(matches.map((m) => m.siteId))

      // Nettoie les relations SPATIAL_CONTAINS devenues fausses pour cette
      // parcelle (géométrie modifiée par un nouveau millésime, par ex.) —
      // jamais une relation périmée laissée silencieusement en place.
      const existing = await tx.siteParcelle.findMany({
        where: { parcelleId, relationMethod: "SPATIAL_CONTAINS" },
        select: { id: true, siteId: true },
      })
      for (const e of existing) {
        if (!matchedSiteIds.has(e.siteId)) {
          await tx.siteParcelle.delete({ where: { id: e.id } })
          touched += 1
        }
      }

      for (const m of matches) {
        // Ambiguïté réelle (constatée, jamais hypothétique — voir le
        // rapport Phase 4) : CE site est-il aussi contenu par une AUTRE
        // parcelle avec géométrie ? Si oui, AUCUNE sélection arbitraire —
        // toutes les candidates restent visibles, marquées ambiguous=true.
        const others = await tx.$queryRaw<{ parcelleId: string }[]>`
          SELECT p2.id AS "parcelleId" FROM "Parcelle" p2, "Site" s2
          WHERE s2.id = ${m.siteId} AND p2.geom IS NOT NULL AND ST_Contains(p2.geom, s2.geom)
        `
        const ambiguous = others.length > 1

        await tx.siteParcelle.upsert({
          where: { siteId_parcelleId: { siteId: m.siteId, parcelleId } },
          create: { siteId: m.siteId, parcelleId, relationMethod: "SPATIAL_CONTAINS", ambiguous, source: "cadastre-etalab-bulk" },
          update: { ambiguous },
        })
        touched += 1

        if (ambiguous) {
          for (const o of others) {
            if (o.parcelleId === parcelleId) continue
            await tx.siteParcelle.upsert({
              where: { siteId_parcelleId: { siteId: m.siteId, parcelleId: o.parcelleId } },
              create: { siteId: m.siteId, parcelleId: o.parcelleId, relationMethod: "SPATIAL_CONTAINS", ambiguous: true, source: "cadastre-etalab-bulk" },
              update: { ambiguous: true },
            })
            touched += 1
          }
        } else {
          // Non ambigu : nettoie toute autre relation SPATIAL_CONTAINS
          // pour ce même site (ex: ambiguïté antérieure désormais résolue
          // parce qu'une des deux parcelles candidates a perdu sa
          // géométrie ou n'existe plus).
          const removed = await tx.siteParcelle.deleteMany({
            where: { siteId: m.siteId, parcelleId: { not: parcelleId }, relationMethod: "SPATIAL_CONTAINS" },
          })
          touched += removed.count
        }
      }
    },
    { timeout: RESOLVE_TRANSACTION_TIMEOUT_MS },
  )
  return touched
}

export class SiteParcelleResolutionRunner implements IngestionRunner {
  source = "site-parcelle"
  dataset = "relations"
  partition = "resolve"

  async runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult> {
    const prisma = await getPrisma()
    const cp = (checkpoint as ResolveCheckpoint | null) ?? { afterId: null }
    const batchSize = getBatchSize(300, "SITEPARCELLE_RESOLVE_BATCH_ROWS")

    // geom est Unsupported() côté Prisma (voir Parcelle.geom) — non
    // filtrable via l'API Client, SQL brut nécessaire (même contrainte
    // que partout ailleurs où geom est lu/écrit dans ce projet).
    const parcelles = cp.afterId
      ? await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Parcelle" WHERE "geom" IS NOT NULL AND "id" > ${cp.afterId} ORDER BY "id" ASC LIMIT ${batchSize}`
      : await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Parcelle" WHERE "geom" IS NOT NULL ORDER BY "id" ASC LIMIT ${batchSize}`

    if (parcelles.length === 0) {
      return { read: 0, inserted: 0, updated: 0, rejected: 0, errors: [], checkpoint: cp, done: true }
    }

    let read = 0
    let touchedTotal = 0
    let rejected = 0
    const errors: string[] = []
    let lastId = cp.afterId

    for (const p of parcelles) {
      if (Date.now() >= deadlineMs) break
      try {
        touchedTotal += await resolveForParcelle(p.id)
      } catch (error) {
        rejected += 1
        errors.push(`${p.id} : ${error instanceof Error ? error.message : "erreur inconnue"}`)
      }
      read += 1
      lastId = p.id
    }

    const next: ResolveCheckpoint = { afterId: lastId }
    return { read, inserted: 0, updated: touchedTotal, rejected, errors, checkpoint: next, done: false }
  }
}
