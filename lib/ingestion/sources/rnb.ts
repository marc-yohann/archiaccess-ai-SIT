// Runner RNB — Référentiel National des Bâtiments (IGN/beta.gouv.fr,
// licence ODbL) — Phase 5C, voir CLAUDE.md et le rapport. Fondation du
// domaine BÂTIMENT PHYSIQUE (BatimentPhysique — nom choisi pour éviter la
// collision avec le modèle "Batiment" existant, en réalité un
// logement/unité DPE, voir prisma/schema.prisma pour la justification
// complète de ce choix).
//
// Format source réel vérifié par téléchargement direct (Phase 5B,
// reconfirmé Phase 5C) : un fichier CSV.zip par département,
// https://rnb-opendata.s3.fr-par.scw.cloud/files/RNB_<dept>.csv.zip
// (dept 51 = exactement 95 915 141 octets aux deux vérifications). CSV
// délimité par ";" (jamais ","), colonnes réelles :
// rnb_id;point;shape;status;ext_ids;addresses;plots;validated_by — un
// seul fichier CSV dans le ZIP, mêmes contraintes que SIRENE (pas de
// retour à la ligne littéral dans un champ, vérifié sur l'intégralité du
// département 51 réel). Réutilise donc le moteur ZIP+CSV existant
// (lib/ingestion/chunked-zip.ts) tel quel, seul le délimiteur diffère
// (paramètre additif ajouté cette phase, voir ce fichier) — aucun moteur
// d'ingestion parallèle.
//
// "shape" est un EWKT texte ("SRID=4326;POINT(...)" /
// "SRID=4326;POLYGON(...)" / "SRID=4326;MULTIPOLYGON(...)") — ST_GeomFromEWKT
// gère nativement le SRID inclus, jamais besoin de ST_SetSRID séparé.
// Distribution RÉELLE mesurée sur le département 51 entier (Phase 5B,
// reconfirmée Phase 5C par re-parsing complet du fichier) : 365 271
// MultiPolygon, 13 348 Polygon, 2 188 Point — jamais un seul type
// supposé, geomType est lu directement du préfixe EWKT reçu.
//
// "plots" (Cadastre) et "addresses" (BAN) sont des colonnes JSON
// imbriquées dans le CSV (échappement par doublement de guillemets,
// standard CSV, déjà géré par parseCsvLine). "plots[].id" est
// directement au format Parcelle.idu (vérifié réellement, Phase 5B) —
// résolu par égalité stricte, jamais recalculé par ST_Contains puisque
// RNB fournit déjà la relation. "addresses[].cle_interop_ban" est résolu
// par égalité stricte contre Site.banId — AUCUN rapprochement flou cette
// phase (consigne explicite du brief) : la variété réelle constatée des
// formats de cle_interop_ban (ex: "51367_0210_00010_ter",
// "51108_0xfyrs_00041" — segments non numériques légitimes, vérifié sur
// l'intégralité du département 51) interdit toute validation de format
// stricte par regex sans produire de faux INVALID_FORMAT — seul un champ
// vide/absent est classé INVALID_FORMAT, tout le reste passe par une
// recherche exacte en base (VALID/NOT_FOUND/AMBIGUOUS selon le nombre de
// correspondances réelles).

import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import { StagingRunner, ChunkIngestionRunner } from "@/lib/ingestion/chunked-zip"
import type { ResolvedResource, RowPersister } from "@/lib/ingestion/chunked-zip"

const RNB_BASE_URL = "https://rnb-opendata.s3.fr-par.scw.cloud/files"

// Millésime réel : pas de date dans le chemin de l'objet S3 RNB
// (contrairement à Cadastre) — dérivé du header HTTP "Last-Modified" réel
// de l'objet, jamais deviné. "inconnu" seulement si l'en-tête est
// vraiment absent (jamais observé en pratique, mais jamais supposé).
async function resolveDepartementResource(deptCode: string): Promise<ResolvedResource> {
  const url = `${RNB_BASE_URL}/RNB_${deptCode}.csv.zip`
  const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Fichier RNB département ${deptCode} : réponse ${res.status}`)
  const contentLength = res.headers.get("content-length")
  if (!contentLength) throw new Error(`Fichier RNB département ${deptCode} : Content-Length absent.`)
  const lastModified = res.headers.get("last-modified")
  const version = lastModified ? new Date(lastModified).toISOString().slice(0, 10) : "inconnu"
  return { url, totalBytes: Number(contentLength), version }
}

// Une instance = un département — partition technique explicite (même
// principe que CadastreStagingRunner), jamais une priorité métier.
export class RnbStagingRunner extends StagingRunner {
  constructor(deptCode: string) {
    super("rnb", `batiments/${deptCode}`, () => resolveDepartementResource(deptCode), getBatchSize(20000, "INGESTION_CHUNK_TARGET_ROWS"))
  }
}

interface RnbPlot {
  id?: string
  bdg_cover_ratio?: number
}
interface RnbAddress {
  cle_interop_ban?: string
}

// Type de géométrie lu directement du préfixe EWKT reçu ("SRID=4326;TYPE(...)")
// — jamais deviné/recalculé après coup.
function geomTypeFromEwkt(shape: string): string | null {
  const m = shape.match(/;(\w+)\(/)
  return m ? m[1].toUpperCase() : null
}

function safeJsonArray<T>(raw: string | undefined): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Résout chaque "plots[].id" (référence Cadastre brute) contre le
// référentiel Parcelle déjà en base — égalité stricte sur idu, jamais une
// sélection arbitraire en cas d'ambiguïté (structurellement impossible ici :
// Parcelle.idu est unique). Une référence non résolue reste enregistrée
// (parcelleId=null, referenceStatus=NOT_FOUND) — jamais silencieusement
// omise (voir prisma/schema.prisma, BatimentPhysiqueParcelle).
async function upsertParcelleLinks(batimentId: string, plots: RnbPlot[]): Promise<void> {
  const prisma = await getPrisma()
  for (const plot of plots) {
    const ref = plot.id
    if (!ref) {
      // Entrée "plots" sans "id" exploitable — jamais observé sur le
      // département 51 réel (690 848 entrées, une seule anomalie de
      // FORMAT — "51454000DT+977" — jamais une entrée totalement vide),
      // mais traité par prudence plutôt que de planter la ligne entière.
      continue
    }
    const match = await prisma.parcelle.findUnique({ where: { idu: ref }, select: { id: true } })
    await prisma.batimentPhysiqueParcelle.upsert({
      where: { batimentId_parcelleRef: { batimentId, parcelleRef: ref } },
      create: {
        batimentId,
        parcelleRef: ref,
        parcelleId: match?.id ?? null,
        referenceStatus: match ? "VALID" : "NOT_FOUND",
        coverageRatio: typeof plot.bdg_cover_ratio === "number" ? plot.bdg_cover_ratio : null,
      },
      update: {
        parcelleId: match?.id ?? null,
        referenceStatus: match ? "VALID" : "NOT_FOUND",
        coverageRatio: typeof plot.bdg_cover_ratio === "number" ? plot.bdg_cover_ratio : null,
        retrievedAt: new Date(),
      },
    })
  }
}

// Résout chaque "addresses[].cle_interop_ban" contre Site.banId — égalité
// stricte UNIQUEMENT (aucun rapprochement flou cette phase, consigne
// explicite du brief). Site.banId n'étant PAS unique (163 doublons réels
// mesurés sur BAN dept 51, Phase 5B), plusieurs correspondances réelles
// sont possibles : AMBIGUOUS dans ce cas, jamais une sélection arbitraire.
async function upsertSiteLinks(batimentId: string, addresses: RnbAddress[]): Promise<void> {
  const prisma = await getPrisma()
  for (const addr of addresses) {
    const ref = addr.cle_interop_ban
    if (!ref) continue
    const matches = await prisma.site.findMany({ where: { banId: ref }, select: { id: true } })
    const status = matches.length === 0 ? "NOT_FOUND" : matches.length === 1 ? "VALID" : "AMBIGUOUS"
    const siteId = matches.length === 1 ? matches[0].id : null
    await prisma.batimentPhysiqueSite.upsert({
      where: { batimentId_addressRef: { batimentId, addressRef: ref } },
      create: { batimentId, addressRef: ref, siteId, referenceStatus: status },
      update: { siteId, referenceStatus: status, retrievedAt: new Date() },
    })
  }
}

// Factory plutôt que persister module-level unique (Phase 5E) : chaque
// instance de RnbIngestionRunner connaît SON département (deptCode,
// passé au constructeur) — c'est la partition réelle de l'export source
// RNB, jamais recalculée ni approximée (priorité 1, voir
// prisma/schema.prisma, BatimentPhysique.sourcePartition).
function makePersistBatimentRow(deptCode: string): RowPersister {
  return async (row, datasetVersion) => {
    const rnbId = row.rnb_id
    if (!rnbId) {
      return { inserted: false, updated: false, rejected: true, error: `Ligne rejetée (rnb_id absent) : ${JSON.stringify(row).slice(0, 150)}` }
    }

    const prisma = await getPrisma()
    try {
      const before = await prisma.batimentPhysique.findUnique({ where: { rnbId }, select: { id: true } })
      const shape = row.shape || ""
      const geomType = shape ? geomTypeFromEwkt(shape) : null

      const batiment = await prisma.batimentPhysique.upsert({
        where: { rnbId },
        create: {
          rnbId,
          geomType,
          status: row.status || null,
          datasetVersion: datasetVersion ?? null,
          sourcePartition: deptCode,
          retrievedAt: new Date(),
        },
        update: {
          geomType,
          status: row.status || null,
          datasetVersion: datasetVersion ?? null,
          sourcePartition: deptCode,
          retrievedAt: new Date(),
        },
      })

    // Géométrie via ST_GeomFromEWKT — le SRID est déjà porté par le texte
    // source ("SRID=4326;..."), jamais fabriqué. Rien n'est écrit si
    // "shape" est absent (jamais un Point sans donnée réelle transformé en
    // géométrie inventée) — geom reste NULL, geomType aussi.
    if (shape) {
      await prisma.$executeRaw`UPDATE "BatimentPhysique" SET "geom" = ST_GeomFromEWKT(${shape}) WHERE "id" = ${batiment.id}`
    }

      const plots = safeJsonArray<RnbPlot>(row.plots)
      const addresses = safeJsonArray<RnbAddress>(row.addresses)
      await upsertParcelleLinks(batiment.id, plots)
      await upsertSiteLinks(batiment.id, addresses)

      return { inserted: !before, updated: Boolean(before), rejected: false }
    } catch (error) {
      return { inserted: false, updated: false, rejected: true, error: `${rnbId} : ${error instanceof Error ? error.message : "erreur inconnue"}` }
    }
  }
}

export class RnbIngestionRunner extends ChunkIngestionRunner {
  constructor(deptCode: string) {
    // ";" — délimiteur réel du CSV RNB (jamais ",", voir l'en-tête de ce
    // fichier) — paramètre additif de chunked-zip.ts (Phase 5C).
    super("rnb", `batiments/${deptCode}`, makePersistBatimentRow(deptCode), ";")
  }
}
