// Runner BOAMP (Phase 9 — Marchés/Lots) — itération paginée de l'API
// BOAMP par département (partition technique, même principe que RNB/
// Cadastre : lib/ingestion/sources/rnb.ts). Pas de fichier bulk
// disponible pour BOAMP (contrairement à SIRENE) : l'API opendatasoft
// supporte une pagination par offset réelle (paramètre "start", vérifié
// réellement — voir lib/data-sources/boamp.ts et le rapport d'audit
// Phase 9), bulkable par itération complète comme Géorisques
// (lib/ingestion/sources/georisques.ts).
//
// Persistance idempotente : AvisMarche upserté sur (source, sourceId) —
// sourceId = idweb, jamais recordid (voir lib/data-sources/boamp.ts).
// Lot upserté sur (avisMarcheId, numero). CPV (AvisMarcheCpv/LotCpv)
// upsertés sur (parentId, code) — additifs uniquement : un code CPV
// disparu d'une republication ne serait pas retiré (cas non rencontré
// sur les données réelles auditées, documenté comme limite dans le
// rapport Phase 9).
//
// Aucune résolution Acteur ici (ni acheteur ni titulaire) — conforme à
// la règle Phase 9 : aucun SIREN/SIRET fiable dans BOAMP, acheteurId/
// titulaireId restent null (capacité future uniquement).
//
// Phase 13 (mission "SUPPRIMER LE BLOCAGE DES 10 000") — sous-découpage
// par plage de dates : l'API impose start+rows <= 10000 par requête
// (vérifié réellement par appel direct, message d'erreur explicite —
// voir lib/data-sources/boamp.ts pour le détail et la comparaison avec
// le "Download service"). Un département volumineux (ex: 38, 34 730
// avis toutes années confondues, vérifié réellement) dépasse cette
// limite en pagination pure. Solution retenue : parcourir le
// département par fenêtres de dates dont la taille est vérifiée AVANT
// pagination (countAvisMarcheForDepartment, rows=0) et subdivisée par
// dichotomie tant qu'elle dépasse MAX_PER_WINDOW — jamais une taille de
// fenêtre supposée (ex: "un mois suffit toujours"), toujours mesurée.
// Chaque fenêtre est ensuite paginée exactement comme avant (offset
// start, page 100). Aucun nouveau composant d'infrastructure (pas de
// S3, pas de nouveau format de données) : la même API, le même parseur,
// le même schéma de persistance qu'avant cette mission.

import { fetchAvisMarcheRawForDepartment, countAvisMarcheForDepartment, parseAvisMarche, type DateWindow } from "@/lib/data-sources/boamp"
import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

interface BoampCheckpoint extends IngestionCheckpoint {
  windowStart: string // "YYYY-MM-DD", inclusive
  windowEnd: string // "YYYY-MM-DD", inclusive
  offset: number // offset de pagination DANS la fenêtre courante
}

// Page opendatasoft — 100 vérifié réellement comme une taille de page
// fonctionnelle (voir le rapport Phase 9) ; distincte de la taille de
// lot globale (batchSize, configurable), qui peut nécessiter plusieurs
// pages.
const PAGE_SIZE = 100

// Première date avec des avis réels observés sur ce dataset (vérifié
// réellement par appel — voir le rapport de mission Phase 13). Point de
// départ du balayage, jamais une hypothèse non vérifiée.
const EARLIEST_DATE = "2015-01-01"

// Marge de sécurité sous la limite dure de 10 000 (vérifiée réellement :
// start+rows <= 10000). Volontairement en dessous de 10000 pour laisser
// de la marge à la pagination elle-même (start avance par pas de 100
// jusqu'à nhits, jamais au-delà).
const MAX_PER_WINDOW = 9000

// Taille de fenêtre initiale proposée avant vérification/subdivision —
// point de départ raisonnable (vu la densité réelle observée : ~2975
// avis/an pour le département le plus chargé mesuré), jamais utilisée
// sans compter réellement (countAvisMarcheForDepartment) et subdiviser
// si nécessaire.
const INITIAL_WINDOW_SPAN_DAYS = 365

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(startStr: string, endStr: string): number {
  const start = new Date(startStr + "T00:00:00Z").getTime()
  const end = new Date(endStr + "T00:00:00Z").getTime()
  return Math.floor((end - start) / 86_400_000)
}

// Détermine, par mesure réelle (jamais par hypothèse), une fenêtre de
// dates démarrant à `windowStart` et ne dépassant pas `hardEnd`, dont le
// nombre réel d'avis reste sous MAX_PER_WINDOW — par dichotomie sur la
// durée si nécessaire.
async function findSafeWindow(codeDepartement: string, windowStart: string, hardEnd: string): Promise<DateWindow> {
  let spanDays = Math.min(INITIAL_WINDOW_SPAN_DAYS, Math.max(1, daysBetween(windowStart, hardEnd) + 1))

  while (spanDays > 1) {
    const windowEnd = daysBetween(windowStart, hardEnd) + 1 <= spanDays ? hardEnd : addDays(windowStart, spanDays - 1)
    const count = await countAvisMarcheForDepartment(codeDepartement, { start: windowStart, end: windowEnd })
    if (count <= MAX_PER_WINDOW) {
      return { start: windowStart, end: windowEnd }
    }
    spanDays = Math.floor(spanDays / 2)
  }

  // Dernier recours : fenêtre d'un seul jour, acceptée telle quelle même
  // si elle dépasse MAX_PER_WINDOW (cas non rencontré sur les données
  // réelles auditées — voir rapport de mission — mais jamais de boucle
  // infinie : un jour est la plus petite unité de subdivision utile ici).
  return { start: windowStart, end: windowStart }
}

// Phase 14 (mission "DERNIÈRE ÉTAPE AVANT INGESTION BOAMP NATIONALE") —
// correction de la "fenêtre vivante" : un écart réel de 70 avis (sur
// 34 737, département 38) a été mesuré et expliqué par la pagination
// offset d'une fenêtre dont la borne haute était "aujourd'hui" au moment
// de sa création, alors que ce jeu de données continue de recevoir de
// nouveaux avis en continu — si cette fenêtre met des heures à être
// intégralement paginée (cas réel constaté : ~23h, fenêtres de
// credentials AWS de 5-15 min), de nouveaux avis insérés en tête de tri
// (`sort=-dateparution`) décalent les positions et peuvent faire
// manquer quelques enregistrements en bordure.
//
// Correction : toute fenêtre "historique" (calculée par findSafeWindow)
// est désormais plafonnée à HIER, jamais à aujourd'hui — un jour déjà
// entièrement écoulé ne reçoit plus jamais de nouvel avis, une fenêtre
// qui s'y arrête est donc immuable pour toute sa durée de pagination,
// quelle que soit sa longueur réelle. Le jour courant est traité à part,
// comme une fenêtre dédiée d'un seul jour ({start: today, end: today})
// — toujours petite (quelques avis/jour observés en pratique), donc
// jamais soumise au même risque de dérive sur une longue pagination.
async function computeWindow(codeDepartement: string, windowStart: string, today: string, yesterday: string): Promise<DateWindow> {
  if (windowStart > yesterday) {
    return { start: today, end: today }
  }
  return findSafeWindow(codeDepartement, windowStart, yesterday)
}

export class BoampIngestionRunner implements IngestionRunner {
  source = "boamp"
  dataset = "avis-marche"
  partition: string

  constructor(private codeDepartement: string) {
    this.partition = codeDepartement
  }

  async runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult> {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = addDays(today, -1)
    let cp: BoampCheckpoint
    if (checkpoint && "windowStart" in checkpoint) {
      cp = checkpoint as BoampCheckpoint
    } else {
      const window = await computeWindow(this.codeDepartement, EARLIEST_DATE, today, yesterday)
      cp = { windowStart: window.start, windowEnd: window.end, offset: 0 }
    }

    const batchSize = getBatchSize(100, "INGESTION_BOAMP_BATCH_SIZE")
    const prisma = await getPrisma()

    let read = 0
    let inserted = 0
    let updated = 0
    let rejected = 0
    const errors: string[] = []
    let done = false

    while (read < batchSize && Date.now() < deadlineMs) {
      const pageSize = Math.min(PAGE_SIZE, batchSize - read)
      let records
      try {
        records = await fetchAvisMarcheRawForDepartment(this.codeDepartement, pageSize, cp.offset, {
          start: cp.windowStart,
          end: cp.windowEnd,
        })
      } catch (error) {
        // Indisponibilité de l'API BOAMP — panne systémique, on remonte
        // l'erreur (le harnais met le job en FAILED avec backoff), même
        // principe que GeorisquesIngestionRunner.
        throw new Error(
          `API BOAMP indisponible (département ${this.codeDepartement}, fenêtre ${cp.windowStart}..${cp.windowEnd}, offset ${cp.offset}) : ${error instanceof Error ? error.message : "erreur inconnue"}`,
        )
      }

      if (records.length === 0) {
        // Fenêtre épuisée — passe à la suivante (ou termine si on a
        // atteint aujourd'hui).
        if (cp.windowEnd >= today) {
          done = true
          break
        }
        const nextStart = addDays(cp.windowEnd, 1)
        const nextWindow = await computeWindow(this.codeDepartement, nextStart, today, yesterday)
        cp = { windowStart: nextWindow.start, windowEnd: nextWindow.end, offset: 0 }
        continue
      }

      for (const rec of records) {
        const parsed = parseAvisMarche(rec.fields, rec.recordId)
        if (!parsed) {
          rejected += 1
          errors.push(`Enregistrement sans idweb rejeté (recordId=${rec.recordId ?? "inconnu"})`)
          continue
        }

        try {
          const before = await prisma.avisMarche.findUnique({
            where: { source_sourceId: { source: parsed.source, sourceId: parsed.sourceId } },
            select: { id: true },
          })

          const avisData = {
            recordId: parsed.recordId,
            objet: parsed.objet,
            natureAvis: parsed.natureAvis,
            typeProcedure: parsed.typeProcedure,
            typeMarche: parsed.typeMarche,
            datePublication: parsed.datePublication,
            dateLimiteReponse: parsed.dateLimiteReponse,
            montant: parsed.montant,
            montantDevise: parsed.montantDevise,
            acheteurNom: parsed.acheteurNom,
            titulaireNom: parsed.titulaireNom,
            codeDepartement: parsed.codeDepartement,
            urlAvis: parsed.urlAvis,
            referenceAvisAnterieurSourceId: parsed.referenceAvisAnterieurSourceId,
            lieuExecution: parsed.lieuExecution,
            retrievedAt: new Date(),
          }

          const avis = await prisma.avisMarche.upsert({
            where: { source_sourceId: { source: parsed.source, sourceId: parsed.sourceId } },
            create: { source: parsed.source, sourceId: parsed.sourceId, ...avisData },
            update: avisData,
          })

          for (const code of parsed.cpvCodes) {
            await prisma.avisMarcheCpv.upsert({
              where: { avisMarcheId_code: { avisMarcheId: avis.id, code } },
              create: { avisMarcheId: avis.id, code },
              update: {},
            })
          }

          for (const parsedLot of parsed.lots) {
            const lot = await prisma.lot.upsert({
              where: { avisMarcheId_numero: { avisMarcheId: avis.id, numero: parsedLot.numero } },
              create: {
                avisMarcheId: avis.id,
                numero: parsedLot.numero,
                description: parsedLot.description,
                montant: parsedLot.montant,
                montantDevise: parsedLot.montantDevise,
                titulaireNom: parsedLot.titulaireNom,
              },
              update: {
                description: parsedLot.description,
                montant: parsedLot.montant,
                montantDevise: parsedLot.montantDevise,
                titulaireNom: parsedLot.titulaireNom,
              },
            })

            for (const code of parsedLot.cpvCodes) {
              await prisma.lotCpv.upsert({
                where: { lotId_code: { lotId: lot.id, code } },
                create: { lotId: lot.id, code },
                update: {},
              })
            }
          }

          if (before) updated += 1
          else inserted += 1
        } catch (error) {
          rejected += 1
          errors.push(`${parsed.sourceId} : ${error instanceof Error ? error.message : "erreur inconnue"}`)
        }
      }

      read += records.length
      cp = { ...cp, offset: cp.offset + records.length }

      if (records.length < pageSize) {
        // Fenêtre courante épuisée (moins de résultats que demandé) —
        // même logique que le cas records.length === 0 ci-dessus, mais
        // après avoir traité le dernier lot partiel.
        if (cp.windowEnd >= today) {
          done = true
          break
        }
        const nextStart = addDays(cp.windowEnd, 1)
        const nextWindow = await computeWindow(this.codeDepartement, nextStart, today, yesterday)
        cp = { windowStart: nextWindow.start, windowEnd: nextWindow.end, offset: 0 }
      }
    }

    return { read, inserted, updated, rejected, errors, checkpoint: cp, done }
  }
}
