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

import { fetchAvisMarcheRawForDepartment, parseAvisMarche } from "@/lib/data-sources/boamp"
import { getPrisma } from "@/lib/prisma"
import { getBatchSize } from "@/lib/ingestion/types"
import type { IngestionRunner, IngestionCheckpoint, BatchResult } from "@/lib/ingestion/types"

interface BoampCheckpoint extends IngestionCheckpoint {
  offset: number
}

// Page opendatasoft — 100 vérifié réellement comme une taille de page
// fonctionnelle (voir le rapport Phase 9) ; distincte de la taille de
// lot globale (batchSize, configurable), qui peut nécessiter plusieurs
// pages.
const PAGE_SIZE = 100

export class BoampIngestionRunner implements IngestionRunner {
  source = "boamp"
  dataset = "avis-marche"
  partition: string

  constructor(private codeDepartement: string) {
    this.partition = codeDepartement
  }

  async runBatch(checkpoint: IngestionCheckpoint | null, deadlineMs: number): Promise<BatchResult> {
    const cp: BoampCheckpoint = (checkpoint as BoampCheckpoint) ?? { offset: 0 }
    const batchSize = getBatchSize(100, "INGESTION_BOAMP_BATCH_SIZE")
    const prisma = await getPrisma()

    let read = 0
    let inserted = 0
    let updated = 0
    let rejected = 0
    const errors: string[] = []
    let offset = cp.offset
    let done = false

    while (read < batchSize && Date.now() < deadlineMs) {
      const pageSize = Math.min(PAGE_SIZE, batchSize - read)
      let records
      try {
        records = await fetchAvisMarcheRawForDepartment(this.codeDepartement, pageSize, offset)
      } catch (error) {
        // Indisponibilité de l'API BOAMP — panne systémique, on remonte
        // l'erreur (le harnais met le job en FAILED avec backoff), même
        // principe que GeorisquesIngestionRunner.
        throw new Error(`API BOAMP indisponible (département ${this.codeDepartement}, offset ${offset}) : ${error instanceof Error ? error.message : "erreur inconnue"}`)
      }

      if (records.length === 0) {
        done = true
        break
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
      offset += records.length

      if (records.length < pageSize) {
        done = true
        break
      }
    }

    return { read, inserted, updated, rejected, errors, checkpoint: { offset }, done }
  }
}
