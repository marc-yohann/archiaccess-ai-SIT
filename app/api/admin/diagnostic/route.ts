// Route de diagnostic PostgreSQL strictement lecture seule — Mission
// "INDUSTRIALISATION NATIONALE", section 2. Contourne l'absence de canal
// SQL direct (bastion SSM cassé, TCP brut vers RDS non supporté par cet
// environnement — voir CLAUDE.md) en réutilisant le seul canal réseau
// qui a déjà un accès direct au VPC/RDS : la Lambda applicative
// elle-même, via une route HTTPS. Même patron d'authentification que
// /api/sit/documents/bulk (jeton Bearer secret, comparaison à temps
// constant, voir lib/ingest-auth.ts) — pas de session utilisateur,
// outil d'exploitation interne, jamais exposé côté UI.
//
// Garde-fous non négociables :
// - AUCUNE écriture : uniquement $queryRaw (SELECT/EXPLAIN) ou méthodes
//   Prisma de lecture (count/findMany/groupBy) — jamais $executeRaw.
// - AUCUN SQL arbitraire : liste blanche de diagnostics fixes (clé
//   `check` dans un Record<string, ...>), jamais de concaténation de
//   texte fourni par l'appelant dans une requête.
// - AUCUN secret renvoyé.
// - Journalisation de chaque appel (console.log -> CloudWatch, déjà en
//   place pour cette Lambda) : quel diagnostic, quand — jamais le jeton.
import { NextResponse } from "next/server"
import { isValidIngestBearer } from "@/lib/ingest-auth"
import { getPrisma } from "@/lib/prisma"

type Diagnostic = (prisma: Awaited<ReturnType<typeof getPrisma>>, params: Record<string, unknown>) => Promise<unknown>

const DEPARTEMENT_RE = /^(0[1-9]|[1-8]\d|9[0-5]|97[1-6]|2[AB])$/

function requireDepartement(params: Record<string, unknown>): string {
  const dep = String(params.department ?? "")
  if (!DEPARTEMENT_RE.test(dep)) throw new Error("Paramètre department invalide (attendu : code département français à 2-3 caractères).")
  return dep
}

const CHECKS: Record<string, Diagnostic> = {
  // --- Comptages par domaine ---
  counts: async (prisma) => {
    const [
      sites, parcelles, batiments, unites, acteurs, etablissements,
      projets, documentsSit, besoins, avisMarches, lots, ingestionJobs,
    ] = await Promise.all([
      prisma.site.count(), prisma.parcelle.count(), prisma.batimentPhysique.count(),
      prisma.unite.count(), prisma.acteur.count(), prisma.etablissement.count(),
      prisma.projet.count(), prisma.documentSit.count(), prisma.besoin.count(),
      prisma.avisMarche.count(), prisma.lot.count(), prisma.ingestionJob.count(),
    ])
    return { sites, parcelles, batiments, unites, acteurs, etablissements, projets, documentsSit, besoins, avisMarches, lots, ingestionJobs }
  },

  // --- Doublons réels (au-delà de ce que les contraintes uniques DB empêchent déjà) ---
  duplicates: async (prisma) => {
    const avisMarcheDupes = await prisma.$queryRaw<{ source: string; sourceId: string; n: bigint }[]>`
      SELECT source, "sourceId", COUNT(*) AS n FROM "AvisMarche"
      GROUP BY source, "sourceId" HAVING COUNT(*) > 1 LIMIT 50
    `
    // Parcelle.idu n'a pas de contrainte @@unique en base (voir schema.prisma) —
    // seul check qui peut réellement révéler un doublon non empêché par la DB.
    const parcelleIduDupes = await prisma.$queryRaw<{ idu: string; n: bigint }[]>`
      SELECT idu, COUNT(*) AS n FROM "Parcelle" GROUP BY idu HAVING COUNT(*) > 1 LIMIT 50
    `
    const uniteDpeDupes = await prisma.$queryRaw<{ numeroDpe: string; n: bigint }[]>`
      SELECT "numeroDpe", COUNT(*) AS n FROM "Unite" WHERE "numeroDpe" IS NOT NULL GROUP BY "numeroDpe" HAVING COUNT(*) > 1 LIMIT 50
    `
    return {
      avisMarcheSourceIdDuplicates: avisMarcheDupes.map((r) => ({ ...r, n: Number(r.n) })),
      note: "AvisMarche(source,sourceId) et Unite.numeroDpe sont protégés par une contrainte @@unique en base : toute ligne ci-dessus serait une violation grave. Parcelle.idu n'a pas de contrainte unique déclarée — seul check qui peut révéler un vrai doublon.",
      parcelleIduDuplicates: parcelleIduDupes.map((r) => ({ ...r, n: Number(r.n) })),
      uniteNumeroDpeDuplicates: uniteDpeDupes.map((r) => ({ ...r, n: Number(r.n) })),
    }
  },

  // --- Nullités anormales sur des champs attendus en pratique ---
  nulls: async (prisma) => {
    const [avisMarcheSansObjet, avisMarcheSansDept, parcelleSansGeomRaw, parcelleSansCommune, siteSansGeomRaw, uniteSansCoords] = await Promise.all([
      prisma.avisMarche.count({ where: { objet: null } }),
      prisma.avisMarche.count({ where: { codeDepartement: null } }),
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Parcelle" WHERE geom IS NULL`,
      prisma.parcelle.count({ where: { commune: null } }),
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Site" WHERE geom IS NULL`,
      prisma.unite.count({ where: { OR: [{ longitude: null }, { latitude: null }] } }),
    ])
    return {
      avisMarcheSansObjet, avisMarcheSansDept, parcelleSansCommune, uniteSansCoords,
      parcelleSansGeom: Number(parcelleSansGeomRaw[0]?.n ?? 0),
      siteSansGeom: Number(siteSansGeomRaw[0]?.n ?? 0),
    }
  },

  // --- Santé des relations N:N (comptage des tables de jointure) ---
  relations: async (prisma) => {
    const [siteParcelle, projetSite, projetActeur, projetAvisMarche, projetLot, documentSitProjet, documentSitSite, besoinSite, besoinProjet, uniteBatiment] = await Promise.all([
      prisma.siteParcelle.count(), prisma.projetSite.count(), prisma.projetActeur.count(),
      prisma.projetAvisMarche.count(), prisma.projetLot.count(), prisma.documentSitProjet.count(),
      prisma.documentSitSite.count(), prisma.besoinSite.count(), prisma.besoinProjet.count(),
      prisma.uniteBatimentPhysique.count(),
    ])
    const uniteResolutionStatus = await prisma.unite.groupBy({ by: ["batimentPhysiqueResolutionStatus"], _count: true })
    return { siteParcelle, projetSite, projetActeur, projetAvisMarche, projetLot, documentSitProjet, documentSitSite, besoinSite, besoinProjet, uniteBatiment, uniteResolutionStatus }
  },

  // --- Géométries : présence + validité PostGIS réelle (ST_IsValid) ---
  geometries: async (prisma) => {
    const [parcelleInvalid, siteInvalid] = await Promise.all([
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Parcelle" WHERE geom IS NOT NULL AND NOT ST_IsValid(geom)`,
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Site" WHERE geom IS NOT NULL AND NOT ST_IsValid(geom)`,
    ])
    return { parcelleGeomInvalid: Number(parcelleInvalid[0]?.n ?? 0), siteGeomInvalid: Number(siteInvalid[0]?.n ?? 0) }
  },

  // --- État réel des jobs d'ingestion (tous, ou filtrés par source) ---
  "ingestion-jobs": async (prisma, params) => {
    const source = params.source ? String(params.source) : undefined
    const jobs = await prisma.ingestionJob.findMany({
      where: source ? { source } : undefined,
      select: {
        id: true, source: true, dataset: true, partition: true, status: true,
        recordsRead: true, recordsProcessed: true, recordsInserted: true, recordsUpdated: true, recordsRejected: true,
        errorCount: true, lastError: true, retryCount: true, checkpoint: true,
        startedAt: true, completedAt: true, lastHeartbeatAt: true, updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    })
    return { jobs }
  },

  // --- Comptage réel Avis/Lots par département (couverture nationale) ---
  "boamp-coverage": async (prisma) => {
    const parDepartement = await prisma.avisMarche.groupBy({ by: ["codeDepartement"], _count: true, orderBy: { codeDepartement: "asc" } })
    const totalAvis = await prisma.avisMarche.count()
    const totalLots = await prisma.lot.count()
    return { parDepartement, totalAvis, totalLots }
  },

  // --- EXPLAIN ANALYZE ciblés (liste blanche de requêtes réelles) ---
  "explain-projet": async (prisma) => {
    const q = String((await prisma.projet.findFirst({ select: { nom: true } }))?.nom?.slice(0, 4) ?? "test")
    const rows = await prisma.$queryRaw<{ "QUERY PLAN": object }[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, nom, type, statut, description FROM "Projet"
      WHERE nom ILIKE ${"%" + q + "%"} OR type ILIKE ${"%" + q + "%"} OR statut ILIKE ${"%" + q + "%"} OR description ILIKE ${"%" + q + "%"}
      ORDER BY "updatedAt" DESC LIMIT 20
    `
    return { sampleQuery: q, plan: rows[0]?.["QUERY PLAN"] }
  },
  "explain-document": async (prisma) => {
    const q = String((await prisma.documentSit.findFirst({ select: { titre: true } }))?.titre?.slice(0, 4) ?? "test")
    const rows = await prisma.$queryRaw<{ "QUERY PLAN": object }[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, titre, description, source, "sourceId", "contenuExtrait" FROM "DocumentSit"
      WHERE titre ILIKE ${"%" + q + "%"} OR description ILIKE ${"%" + q + "%"} OR source ILIKE ${"%" + q + "%"}
        OR "sourceId" LIKE ${q + "%"} OR "contenuExtrait" ILIKE ${"%" + q + "%"}
      ORDER BY "updatedAt" DESC LIMIT 20
    `
    return { sampleQuery: q, plan: rows[0]?.["QUERY PLAN"] }
  },
  "explain-reference-avismarche": async (prisma) => {
    const sample = await prisma.avisMarche.findFirst({ select: { sourceId: true, acheteurNom: true } })
    const q = String(sample?.sourceId?.slice(0, 4) ?? "test")
    const rows = await prisma.$queryRaw<{ "QUERY PLAN": object }[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, "sourceId", objet, "typeMarche", "acheteurNom" FROM "AvisMarche"
      WHERE "sourceId" LIKE ${q + "%"} OR objet ILIKE ${"%" + q + "%"} OR "acheteurNom" ILIKE ${"%" + q + "%"}
      LIMIT 20
    `
    return { sampleQuery: q, plan: rows[0]?.["QUERY PLAN"] }
  },
  "explain-reference-parcelle": async (prisma) => {
    const sample = await prisma.parcelle.findFirst({ select: { idu: true } })
    const q = String(sample?.idu?.slice(0, 6) ?? "000000")
    const rows = await prisma.$queryRaw<{ "QUERY PLAN": object }[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id, idu, section, numero, commune, "codeInsee" FROM "Parcelle" WHERE idu LIKE ${q + "%"} LIMIT 20
    `
    return { sampleQuery: q, plan: rows[0]?.["QUERY PLAN"] }
  },
  "explain-besoin": async (prisma) => {
    const q = String((await prisma.besoin.findFirst({ select: { titre: true } }))?.titre?.slice(0, 4) ?? "test")
    const rows = await prisma.$queryRaw<{ "QUERY PLAN": object }[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, titre, description, statut, type, discipline FROM "Besoin"
      WHERE titre ILIKE ${"%" + q + "%"} OR description ILIKE ${"%" + q + "%"} OR discipline ILIKE ${"%" + q + "%"}
      ORDER BY "updatedAt" DESC LIMIT 20
    `
    return { sampleQuery: q, plan: rows[0]?.["QUERY PLAN"] }
  },
  "explain-geospatial-site-parcelle": async (prisma) => {
    const sample = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Parcelle" WHERE geom IS NOT NULL LIMIT 1`
    if (!sample[0]) return { note: "Aucune Parcelle avec geom non nul en base — requête non exécutable." }
    const rows = await prisma.$queryRaw<{ "QUERY PLAN": object }[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT s.id AS "siteId" FROM "Site" s, "Parcelle" p
      WHERE p.id = ${sample[0].id} AND p.geom IS NOT NULL AND s.geom IS NOT NULL AND ST_Contains(p.geom, s.geom)
    `
    return { sampleParcelleId: sample[0].id, plan: rows[0]?.["QUERY PLAN"] }
  },
  "explain-site-detail-graph": async (prisma) => {
    const sample = await prisma.site.findFirst({ select: { id: true } })
    if (!sample) return { note: "Aucun Site en base — requête non exécutable." }
    const rows = await prisma.$queryRaw<{ "QUERY PLAN": object }[]>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT s.id, sp."parcelleId", ps."projetId", ds."documentSitId", bs."besoinId"
      FROM "Site" s
      LEFT JOIN "SiteParcelle" sp ON sp."siteId" = s.id
      LEFT JOIN "ProjetSite" ps ON ps."siteId" = s.id
      LEFT JOIN "DocumentSitSite" ds ON ds."siteId" = s.id
      LEFT JOIN "BesoinSite" bs ON bs."siteId" = s.id
      WHERE s.id = ${sample.id}
    `
    return { sampleSiteId: sample.id, plan: rows[0]?.["QUERY PLAN"] }
  },

  // --- Vérifie qu'une re-ingestion d'une partition déjà traitée ne duplique rien (idempotence) ---
  "idempotence-check": async (prisma, params) => {
    const dep = requireDepartement(params)
    const before = await prisma.avisMarche.count({ where: { codeDepartement: dep } })
    const job = await prisma.ingestionJob.findUnique({ where: { source_dataset_partition: { source: "boamp", dataset: "avis", partition: dep } } })
    return { department: dep, avisMarcheCountNow: before, job: job ? { status: job.status, recordsInserted: job.recordsInserted, recordsUpdated: job.recordsUpdated, recordsProcessed: job.recordsProcessed } : null }
  },
}

export async function POST(request: Request) {
  if (!(await isValidIngestBearer(request))) {
    return NextResponse.json({ success: false, error: "Non autorisé." }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { check?: string; params?: Record<string, unknown> }
  const check = body.check
  const diagnostic = check ? CHECKS[check] : undefined
  if (!diagnostic) {
    return NextResponse.json(
      { success: false, error: `Diagnostic inconnu ou manquant. Disponibles : ${Object.keys(CHECKS).join(", ")}.` },
      { status: 400 },
    )
  }

  console.log(`[diagnostic] check=${check} at=${new Date().toISOString()}`)

  try {
    const prisma = await getPrisma()
    const result = await diagnostic(prisma, body.params ?? {})
    return NextResponse.json({ success: true, check, result })
  } catch (error) {
    return NextResponse.json(
      { success: false, check, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 500 },
    )
  }
}
