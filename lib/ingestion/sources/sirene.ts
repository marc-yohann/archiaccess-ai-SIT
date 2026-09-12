// Runners SIRENE — ingestion nationale des fichiers officiels
// StockEtablissement ET StockUniteLegale (INSEE, via data.gouv.fr), voir
// CLAUDE.md et l'audit du 2026-09-12/13 ("transformation en data
// platform" puis "industrialisation"). Utilise le moteur générique de
// découpage en chunks (lib/ingestion/chunked-zip.ts) — plus de
// redécompression depuis le début à chaque reprise (limite identifiée
// lors de la validation Phase 3.1, voir le rapport).
//
// Deux fichiers distincts, deux niveaux distincts (D du brief Phase 3) :
//   StockEtablissement → SIRET (+ SIREN) → Etablissement
//   StockUniteLegale   → SIREN           → Acteur (dénomination réelle)
// Ne jamais confondre SIREN et SIRET.
//
// Coordonnées : ces fichiers donnent des coordonnées Lambert, pas WGS84 —
// aucune conversion appliquée (pas de valeur approximée non vérifiée).
// Résolution de Site (BAN) jamais tentée en masse (quotas d'une API
// publique) — siteId reste null à l'ingestion bulk.

import { getPrisma } from "@/lib/prisma"
import { StagingRunner, ChunkIngestionRunner } from "@/lib/ingestion/chunked-zip"
import type { ResolvedResource, RowPersister } from "@/lib/ingestion/chunked-zip"
import { getBatchSize } from "@/lib/ingestion/types"

const DATASET_API_URL =
  "https://www.data.gouv.fr/api/1/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/"

async function resolveResource(titlePrefix: string): Promise<ResolvedResource> {
  const res = await fetch(DATASET_API_URL, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`API data.gouv.fr a répondu ${res.status}`)
  const data = (await res.json()) as { resources: Array<{ title: string; url: string; filesize: number }> }
  const resource = data.resources.find((r) => r.title.startsWith(titlePrefix) && r.url.endsWith(".zip"))
  if (!resource) throw new Error(`Ressource "${titlePrefix}" (zip) introuvable dans le catalogue data.gouv.fr.`)
  const version = resource.title.slice(titlePrefix.length).trim()
  return { url: resource.url, totalBytes: resource.filesize, version }
}

function isEmpty(value: string | undefined): boolean {
  return value === undefined || value === ""
}

const CHUNK_TARGET_ROWS = getBatchSize(50000, "INGESTION_CHUNK_TARGET_ROWS")

// ===== StockEtablissement =====

const ETAB_TITLE_PREFIX = "Sirene : Fichier StockEtablissement - "

function composeAdresse(row: Record<string, string>): string | null {
  const parts = [row.numeroVoieEtablissement, row.indiceRepetitionEtablissement, row.typeVoieEtablissement, row.libelleVoieEtablissement].filter(
    (p) => !isEmpty(p),
  )
  return parts.length > 0 ? parts.join(" ") : null
}

// A/F (Actif/Fermé) — vocabulaire de l'ÉTABLISSEMENT, distinct de A/C au
// niveau de l'unité légale (voir persistUniteLegaleRow ci-dessous).
function actifFromEtatEtablissement(etat: string | undefined): boolean | null {
  if (etat === "A") return true
  if (etat === "F") return false
  return null
}

const persistEtablissementRow: RowPersister = async (row) => {
  const siren = row.siren
  const siret = row.siret
  if (isEmpty(siren) || isEmpty(siret)) {
    return { inserted: false, updated: false, rejected: true, error: `Ligne rejetée (siren/siret manquant) : ${JSON.stringify(row).slice(0, 150)}` }
  }

  const prisma = await getPrisma()
  try {
    const nom = row.denominationUsuelleEtablissement || row.enseigne1Etablissement || undefined
    const acteurBefore = await prisma.acteur.findUnique({ where: { siren }, select: { id: true } })

    const acteur = await prisma.acteur.upsert({
      where: { siren },
      create: {
        siren,
        nom: nom ?? null,
        nomCommercial: row.enseigne1Etablissement || null,
        codeNaf: row.activitePrincipaleEtablissement || null,
        dateCreation: row.dateCreationEtablissement || null,
      },
      // undefined = ne touche pas au champ. StockUniteLegale (plus
      // autoritaire pour nom/dateCreation) écrase ces valeurs quand il
      // s'exécute — voir persistUniteLegaleRow.
      update: {
        nom,
        nomCommercial: row.enseigne1Etablissement || undefined,
        codeNaf: row.activitePrincipaleEtablissement || undefined,
      },
    })

    const etabBefore = await prisma.etablissement.findUnique({ where: { siret }, select: { id: true } })
    await prisma.etablissement.upsert({
      where: { siret },
      create: {
        acteurId: acteur.id,
        siret,
        adresse: composeAdresse(row),
        codePostal: row.codePostalEtablissement || null,
        codeInsee: row.codeCommuneEtablissement || null,
        commune: row.libelleCommuneEtablissement || null,
        estSiege: row.etablissementSiege === "true",
        actif: actifFromEtatEtablissement(row.etatAdministratifEtablissement),
      },
      update: {
        adresse: composeAdresse(row) ?? undefined,
        codePostal: row.codePostalEtablissement || undefined,
        commune: row.libelleCommuneEtablissement || undefined,
        actif: actifFromEtatEtablissement(row.etatAdministratifEtablissement) ?? undefined,
      },
    })

    await prisma.acteurSource.upsert({
      where: { acteurId_source: { acteurId: acteur.id, source: "sirene-stock-etablissement" } },
      create: { acteurId: acteur.id, source: "sirene-stock-etablissement" },
      update: { fetchedAt: new Date() },
    })

    return { inserted: !acteurBefore || !etabBefore, updated: Boolean(acteurBefore && etabBefore), rejected: false }
  } catch (error) {
    return { inserted: false, updated: false, rejected: true, error: `SIRET ${siret} : ${error instanceof Error ? error.message : "erreur inconnue"}` }
  }
}

export class SireneEtablissementStagingRunner extends StagingRunner {
  constructor() {
    super("sirene", "stock-etablissement", () => resolveResource(ETAB_TITLE_PREFIX), CHUNK_TARGET_ROWS)
  }
}
export class SireneEtablissementIngestionRunner extends ChunkIngestionRunner {
  constructor() {
    super("sirene", "stock-etablissement", persistEtablissementRow)
  }
}

// ===== StockUniteLegale =====

const UL_TITLE_PREFIX = "Sirene : Fichier StockUniteLegale - "

// A/C (Actif/Cessé) — vocabulaire de l'UNITÉ LÉGALE, le même que l'API de
// recherche ponctuelle (lib/data-sources/entreprises.ts) puisque les
// deux opèrent à ce niveau — contrairement à l'établissement (A/F).
function statutFromEtatUniteLegale(etat: string | undefined): string | null {
  if (etat === "A") return "actif"
  if (etat === "C") return "cessé"
  return null
}

// Personne morale (société) → denominationUniteLegale. Personne physique
// (entrepreneur individuel, categorieJuridique commençant par "1") →
// prénom + nom d'usage/naissance — jamais fabriqué : si aucun des deux
// n'est présent, reste null.
function nomFromUniteLegale(row: Record<string, string>): string | null {
  if (!isEmpty(row.denominationUniteLegale)) return row.denominationUniteLegale
  const nomPersonne = row.nomUsageUniteLegale || row.nomUniteLegale
  if (!isEmpty(nomPersonne)) {
    return [row.prenom1UniteLegale, nomPersonne].filter((p) => !isEmpty(p)).join(" ")
  }
  return null
}

const persistUniteLegaleRow: RowPersister = async (row) => {
  const siren = row.siren
  if (isEmpty(siren)) {
    return { inserted: false, updated: false, rejected: true, error: "Ligne rejetée (siren manquant)" }
  }

  const prisma = await getPrisma()
  try {
    const before = await prisma.acteur.findUnique({ where: { siren }, select: { id: true } })
    const nom = nomFromUniteLegale(row)

    const acteur = await prisma.acteur.upsert({
      where: { siren },
      create: {
        siren,
        nom,
        statut: statutFromEtatUniteLegale(row.etatAdministratifUniteLegale),
        dateCreation: row.dateCreationUniteLegale || null,
        categorieJuridique: row.categorieJuridiqueUniteLegale || null,
        categorieEntreprise: row.categorieEntreprise || null,
        trancheEffectifs: row.trancheEffectifsUniteLegale || null,
      },
      // StockUniteLegale est la source AUTORITAIRE pour ces champs (plus
      // fiable qu'un proxy au niveau établissement) — toujours écrasé
      // quand une valeur réelle existe sur la ligne, jamais par null.
      update: {
        nom: nom ?? undefined,
        statut: statutFromEtatUniteLegale(row.etatAdministratifUniteLegale) ?? undefined,
        dateCreation: row.dateCreationUniteLegale || undefined,
        categorieJuridique: row.categorieJuridiqueUniteLegale || undefined,
        categorieEntreprise: row.categorieEntreprise || undefined,
        trancheEffectifs: row.trancheEffectifsUniteLegale || undefined,
      },
    })

    await prisma.acteurSource.upsert({
      where: { acteurId_source: { acteurId: acteur.id, source: "sirene-stock-unite-legale" } },
      create: { acteurId: acteur.id, source: "sirene-stock-unite-legale" },
      update: { fetchedAt: new Date() },
    })

    return { inserted: !before, updated: Boolean(before), rejected: false }
  } catch (error) {
    return { inserted: false, updated: false, rejected: true, error: `SIREN ${siren} : ${error instanceof Error ? error.message : "erreur inconnue"}` }
  }
}

export class SireneUniteLegaleStagingRunner extends StagingRunner {
  constructor() {
    super("sirene", "stock-unite-legale", () => resolveResource(UL_TITLE_PREFIX), CHUNK_TARGET_ROWS)
  }
}
export class SireneUniteLegaleIngestionRunner extends ChunkIngestionRunner {
  constructor() {
    super("sirene", "stock-unite-legale", persistUniteLegaleRow)
  }
}
