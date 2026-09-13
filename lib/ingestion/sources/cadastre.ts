// Runner Cadastre — ingestion nationale bulk (Phase 4, voir CLAUDE.md et
// l'audit du 2026-09-13). Source officielle vérifiée en direct :
// cadastre.data.gouv.fr (dataset "Cadastre" Etalab, aligné sur PCI
// Vecteur DGFiP depuis le 1er septembre 2025, licence fr-lo/Licence
// Ouverte) — fichiers GeoJSON.gz réels, téléchargeables par commune,
// département ou EPCI. Partition retenue : DÉPARTEMENT (même grain que
// BAN, 101 départements réels confirmés) — un fichier "France entière"
// existe en théorie pour certaines couches mais s'est avéré introuvable
// à la vérification réelle (404 sur l'objet résolu) pour "parcelles" ;
// jamais supposé. Contrairement à BAN, chaque département a SON PROPRE
// manifeste/chunks (dataset = "parcelles/<deptCode>") : les fichiers
// sont assez volumineux (119 Mo pour le 51, jusqu'à plusieurs centaines
// de Mo pour les départements les plus peuplés) pour justifier le
// découpage en chunks (voir lib/ingestion/chunked-geojson.ts), à la
// différence des fichiers BAN qui restent petits.
//
// Schéma RÉELLEMENT vérifié par téléchargement direct (jamais supposé
// depuis l'ancien connecteur à la demande, dont le schéma est différent) :
// properties = { id, commune, prefixe, section, numero, contenance,
// arpente, created, updated } — id EST l'identifiant cadastral officiel
// complet déjà composé par la source (ex: "514540000T0266" = commune(5)
// + prefixe + section + numero(4, complété à gauche par des zéros — le
// "numero" brut lui n'est PAS complété, ex: numero="108" → id "...0108")),
// jamais recomposé nous-mêmes. La largeur de "prefixe" VARIE réellement
// selon la commune (4 caractères pour la commune 51454, 3 pour la 90102
// — constaté par inspection directe, jamais supposé uniforme) : ne
// jamais reconstruire "idu" à partir de champs séparés en supposant une
// largeur fixe, "id" est toujours utilisé tel quel.
// geometry.type = "Polygon" (jamais MultiPolygon dans ce fichier) —
// normalisé via ST_Multi() à l'écriture pour rester compatible avec la
// colonne géométrique existante (Phase 3). Pas de champ "crs" dans le
// GeoJSON : conforme à RFC 7946, WGS84/EPSG:4326 implicite — cohérent
// avec les coordonnées observées (ex: lon≈4.11, lat≈49.22 pour Reims).
// Le nom de commune n'existe PAS dans ce fichier (seul le code INSEE,
// nommé "commune") — résolu via la même liste officielle que BAN/
// Géorisques (geo.api.gouv.fr/communes), jamais fabriqué.
//
// Relation Site<->Parcelle : ce runner n'écrit plus AUCUNE relation
// depuis Phase 4.5 (voir CLAUDE.md et le rapport de consolidation) —
// seule la géométrie de la Parcelle est écrite ici. La relation N:N
// (voir modèle SiteParcelle, prisma/schema.prisma) est calculée
// séparément par lib/ingestion/sources/site-parcelle.ts
// (SiteParcelleResolutionRunner), un passage différé et idempotent sur
// les géométries déjà en base — jamais entrelacé avec cette ingestion.
// Ce découplage règle à la racine le problème de concurrence identifié
// au rapport Phase 4 (une lecture pouvait observer transitoirement une
// relation avant qu'une parcelle ingérée juste après ne révèle une
// ambiguïté) : l'ingestion ne dépend plus de l'ordre d'arrivée des
// parcelles pour décider d'une relation.

import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import { StagingRunner, GeoJsonChunkIngestionRunner } from "@/lib/ingestion/chunked-geojson"
import type { GeoJsonFeature } from "@/lib/ingestion/chunked-geojson"
import type { ResolvedResource } from "@/lib/ingestion/chunked-zip"

const CADASTRE_BASE_URL = "https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements"

let communeNameCache: Map<string, string> | null = null

async function getCommuneName(codeInsee: string): Promise<string | null> {
  if (!communeNameCache) {
    const res = await fetch("https://geo.api.gouv.fr/communes?fields=code,nom&format=json", { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`API communes (geo.api.gouv.fr) a répondu ${res.status}`)
    const data = (await res.json()) as Array<{ code: string; nom: string }>
    communeNameCache = new Map(data.map((c) => [c.code, c.nom]))
  }
  return communeNameCache.get(codeInsee) ?? null
}

// Résout le millésime réel via la redirection HTTP (le chemin contient la
// date du snapshot, ex: ".../2026-06-01/geojson/...") — jamais supposé.
async function resolveDepartementResource(deptCode: string): Promise<ResolvedResource> {
  const url = `${CADASTRE_BASE_URL}/${deptCode}/cadastre-${deptCode}-parcelles.json.gz`
  const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Fichier Cadastre département ${deptCode} : réponse ${res.status}`)
  const contentLength = res.headers.get("content-length")
  if (!contentLength) throw new Error(`Fichier Cadastre département ${deptCode} : Content-Length absent.`)
  const versionMatch = res.url.match(/etalab-cadastre\/(\d{4}-\d{2}-\d{2})\//)
  const version = versionMatch?.[1] ?? "inconnu"
  return { url: res.url, totalBytes: Number(contentLength), version }
}

// Une instance = un département — partition technique explicite (section
// 6 du brief), jamais une priorité métier. dataset = "parcelles/<dept>"
// pour que chaque département ait son propre IngestionJob/DatasetManifest,
// observables et repris indépendamment.
export class CadastreStagingRunner extends StagingRunner {
  constructor(deptCode: string) {
    super("cadastre", `parcelles/${deptCode}`, () => resolveDepartementResource(deptCode), getBatchSize(20000, "INGESTION_CHUNK_TARGET_ROWS"))
  }
}

function hasFiniteCoordinates(coordinates: unknown): boolean {
  if (Array.isArray(coordinates)) return coordinates.every(hasFiniteCoordinates)
  return typeof coordinates === "number" && Number.isFinite(coordinates)
}

async function persistParcelle(feature: GeoJsonFeature, datasetVersion: string): Promise<{ inserted: boolean; updated: boolean; rejected: boolean; error?: string }> {
  const props = feature.properties as {
    id?: string
    commune?: string
    prefixe?: string
    section?: string
    numero?: string
    contenance?: number
  }

  if (!props.id || !props.commune || !props.section || !props.numero || !feature.geometry) {
    return { inserted: false, updated: false, rejected: true, error: `Ligne rejetée (champ requis absent) : ${JSON.stringify(props).slice(0, 150)}` }
  }

  // Validation des coordonnées AVANT toute écriture — constaté réellement
  // pendant les tests : ST_GeomFromGeoJSON ne rejette pas une coordonnée
  // non numérique, il la convertit silencieusement en 0, produisant un
  // polygone dégénéré en (0,0) — jamais une géométrie fabriquée ne doit
  // entrer en base (voir CLAUDE.md). Rejeté ici, avant tout upsert.
  if (!hasFiniteCoordinates(feature.geometry.coordinates)) {
    return { inserted: false, updated: false, rejected: true, error: `Ligne rejetée (coordonnées non numériques) : ${props.id}` }
  }

  const prisma = await getPrisma()
  try {
    const communeName = await getCommuneName(props.commune).catch(() => null)
    const before = await prisma.parcelle.findUnique({ where: { idu: props.id }, select: { id: true } })

    const parcelle = await prisma.parcelle.upsert({
      where: { idu: props.id },
      create: {
        idu: props.id,
        section: props.section,
        sectionPrefixe: props.prefixe ?? "",
        numero: props.numero,
        contenanceM2: props.contenance ?? 0,
        codeInsee: props.commune,
        commune: communeName,
        geometry: feature.geometry as object,
        source: "cadastre-etalab-bulk",
        dataset: "parcelles",
        datasetVersion,
        retrievedAt: new Date(),
      },
      update: {
        section: props.section,
        sectionPrefixe: props.prefixe ?? "",
        numero: props.numero,
        contenanceM2: props.contenance ?? 0,
        commune: communeName ?? undefined,
        geometry: feature.geometry as object,
        datasetVersion,
        retrievedAt: new Date(),
      },
    })

    // geom (PostGIS) — normalisée en MultiPolygon (la source donne des
    // Polygon simples, voir l'en-tête de ce fichier) — jamais approximée,
    // reprojection directe de la géométrie réelle reçue. Aucune relation
    // Site<->Parcelle écrite ici depuis Phase 4.5 — voir SiteParcelleResolutionRunner
    // (lib/ingestion/sources/site-parcelle.ts).
    await prisma.$executeRaw`UPDATE "Parcelle" SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(feature.geometry)}), 4326)) WHERE "id" = ${parcelle.id}`

    return { inserted: !before, updated: Boolean(before), rejected: false }
  } catch (error) {
    return { inserted: false, updated: false, rejected: true, error: `${props.id} : ${error instanceof Error ? error.message : "erreur inconnue"}` }
  }
}

export class CadastreIngestionRunner extends GeoJsonChunkIngestionRunner {
  constructor(deptCode: string) {
    super("cadastre", `parcelles/${deptCode}`, (feature, datasetVersion) => persistParcelle(feature, datasetVersion))
  }
}
