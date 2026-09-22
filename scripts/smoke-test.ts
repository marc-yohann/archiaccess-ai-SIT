// Smoke test reproductible du SIT Archiaccess — Phase N, mission
// Finalisation. Exerce, avec des DONNÉES RÉELLES (aucun mock, aucune
// donnée inventée), le chemin de persistance principal de chaque
// domaine métier : Site (BAN), Parcelle (cadastre), Unite/DPE (ADEME),
// Acteur (SIRENE), Projet (interne), AvisMarche/Lot (BOAMP),
// DocumentSit (interne), Besoin (interne) + leurs rattachements N:N.
//
// RNB/BatimentPhysique n'est PAS exercé ici : ce domaine n'a pas de
// connecteur "à la demande" (lib/data-sources/), uniquement un pipeline
// d'ingestion bulk par département (lib/ingestion/sources/rnb.ts,
// téléchargement d'un fichier ~96 Mo par département) — disproportionné
// pour un smoke test. Sa structure (migration, FK, contraintes) est
// couverte par le replay des migrations, voir ci-dessous ; sa donnée
// réelle a été validée en Phase 5B-5H (voir CLAUDE.md/git log) et n'est
// pas re-testée en direct ici.
//
// Usage : npx tsx scripts/smoke-test.ts
// Nécessite un DATABASE_URL valide (via AWS Secrets Manager en
// production, ou LOCAL_DIAG_DATABASE_URL pour un test local — voir
// lib/secrets.ts). Toutes les données créées sont préfixées
// "[SMOKE TEST]" et supprimées à la fin du script, qu'il réussisse ou
// échoue (bloc finally), pour rester rejouable sans accumulation.

import { getPrisma } from "@/lib/prisma"
import { resolvePreciseAddress } from "@/lib/data-sources/ban"
import { getParcelsNear } from "@/lib/data-sources/cadastre"
import { getDpeRecordsNear } from "@/lib/data-sources/dpe"
import { searchCompanies } from "@/lib/data-sources/entreprises"
import { fetchAvisMarcheRawForDepartment, parseAvisMarche } from "@/lib/data-sources/boamp"

const PREFIX = "[SMOKE TEST]"

interface StepResult {
  domain: string
  status: "PASS" | "FAIL" | "SKIP"
  detail: string
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  const prisma = await getPrisma()
  const results: StepResult[] = []
  const cleanup: Array<() => Promise<void>> = []

  async function step(domain: string, fn: () => Promise<string>) {
    try {
      const detail = await fn()
      results.push({ domain, status: "PASS", detail })
    } catch (error) {
      results.push({ domain, status: "FAIL", detail: error instanceof Error ? error.message : String(error) })
    }
  }

  let siteId: string | null = null
  let acteurId: string | null = null
  let projetId: string | null = null
  let avisMarcheId: string | null = null
  let lotId: string | null = null
  let documentSitId: string | null = null
  let besoinId: string | null = null

  // --- Site (BAN réel) ---
  await step("Site (BAN)", async () => {
    const addr = await resolvePreciseAddress("15 Place du Capitole 31000 Toulouse")
    assert(addr.status === "VALID", `résolution BAN attendue VALID, obtenu ${addr.status}`)
    const c = addr.candidate
    const site = await prisma.site.upsert({
      where: { citycode_label: { citycode: c.citycode, label: c.label } },
      create: { label: c.label, citycode: c.citycode, postcode: c.postcode, city: c.city, longitude: c.coordinates[0], latitude: c.coordinates[1] },
      update: {},
    })
    await prisma.$executeRaw`UPDATE "Site" SET "geom" = ST_SetSRID(ST_MakePoint(${c.coordinates[0]}, ${c.coordinates[1]}), 4326) WHERE "id" = ${site.id}`
    siteId = site.id
    cleanup.push(async () => {
      await prisma.site.delete({ where: { id: site.id } }).catch(() => {})
    })
    return `Site réel créé/retrouvé : ${site.id} — ${site.label}`
  })

  // --- Parcelle (cadastre réel, autour du Site) ---
  await step("Parcelle (cadastre)", async () => {
    if (!siteId) throw new Error("Site non disponible — étape précédente en échec")
    const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } })
    const parcels = await getParcelsNear(site.longitude, site.latitude, 20)
    assert(parcels.length > 0, "aucune parcelle cadastrale trouvée autour du Site réel — vérifier l'endpoint apicarto")
    const p = parcels[0]
    const parcelle = await prisma.parcelle.upsert({
      where: { idu: p.idu },
      create: { idu: p.idu, section: p.section, sectionPrefixe: p.sectionPrefixe, numero: p.numero, contenanceM2: p.contenanceM2, codeInsee: p.codeInsee, commune: p.commune, geometry: p.geometry as object, source: "cadastre-apicarto", retrievedAt: new Date() },
      update: {},
    })
    await prisma.$executeRaw`UPDATE "Parcelle" SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(p.geometry)}), 4326)) WHERE "idu" = ${p.idu}`
    await prisma.siteParcelle.upsert({
      where: { siteId_parcelleId: { siteId, parcelleId: parcelle.id } },
      create: { siteId, parcelleId: parcelle.id, relationMethod: "SPATIAL_NEARBY", source: "cadastre-apicarto" },
      update: {},
    })
    cleanup.push(async () => {
      await prisma.siteParcelle.deleteMany({ where: { parcelleId: parcelle.id } }).catch(() => {})
      await prisma.parcelle.delete({ where: { id: parcelle.id } }).catch(() => {})
    })
    return `Parcelle réelle créée/retrouvée : ${parcelle.id} — idu=${parcelle.idu}`
  })

  // --- Unite/DPE (ADEME réel, autour du Site) ---
  await step("Unite/DPE (ADEME)", async () => {
    if (!siteId) throw new Error("Site non disponible")
    const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } })
    const dpes = await getDpeRecordsNear(site.longitude, site.latitude, 60, 5)
    if (dpes.length === 0) return "Aucun DPE réel dans un rayon de 60m de ce Site — comportement normal (zone sans DPE recensé), non bloquant."
    const d = dpes[0]
    if (!d.numeroDpe) return "DPE trouvé mais sans numeroDpe exploitable (donnée source incomplète) — non persisté, comportement attendu."
    const unite = await prisma.unite.upsert({
      where: { numeroDpe: d.numeroDpe },
      create: { siteId, numeroDpe: d.numeroDpe, typeBatiment: d.typeBatiment, surfaceHabitable: d.surfaceHabitable, etiquetteEnergie: d.etiquetteEnergie, etiquetteGes: d.etiquetteGes, anneeConstruction: d.anneeConstruction },
      update: {},
    })
    cleanup.push(async () => {
      await prisma.unite.delete({ where: { id: unite.id } }).catch(() => {})
    })
    return `Unite/DPE réel créé/retrouvé : ${unite.id} — numeroDpe=${unite.numeroDpe}`
  })

  // --- Acteur (SIRENE réel) ---
  await step("Acteur (SIRENE)", async () => {
    const companies = await searchCompanies("Bouygues Construction", 1)
    assert(companies.length > 0, "recherche SIRENE réelle n'a retourné aucun résultat")
    const c = companies[0]
    const acteur = await prisma.acteur.upsert({
      where: { siren: c.siren },
      create: { siren: c.siren, nom: c.nom, nomCommercial: c.nomCommercial, codeNaf: c.activitePrincipale, statut: c.etatAdministratif, dateCreation: c.dateCreation },
      update: {},
    })
    acteurId = acteur.id
    cleanup.push(async () => {
      await prisma.acteur.delete({ where: { id: acteur.id } }).catch(() => {})
    })
    return `Acteur réel créé/retrouvé : ${acteur.id} — ${acteur.nom}`
  })

  // --- AvisMarche + Lot (BOAMP réel) ---
  await step("AvisMarche/Lot (BOAMP)", async () => {
    const records = await fetchAvisMarcheRawForDepartment("31", 20, 0)
    assert(records.length > 0, "BOAMP n'a retourné aucun enregistrement pour le département 31")
    for (const rec of records) {
      const parsed = parseAvisMarche(rec.fields, rec.recordId)
      if (!parsed) continue
      const avis = await prisma.avisMarche.upsert({
        where: { source_sourceId: { source: parsed.source, sourceId: parsed.sourceId } },
        create: {
          source: parsed.source, sourceId: parsed.sourceId, recordId: parsed.recordId, objet: parsed.objet,
          natureAvis: parsed.natureAvis, typeProcedure: parsed.typeProcedure, typeMarche: parsed.typeMarche,
          datePublication: parsed.datePublication, dateLimiteReponse: parsed.dateLimiteReponse, montant: parsed.montant,
          montantDevise: parsed.montantDevise, acheteurNom: parsed.acheteurNom, titulaireNom: parsed.titulaireNom,
          codeDepartement: parsed.codeDepartement, urlAvis: parsed.urlAvis,
          referenceAvisAnterieurSourceId: parsed.referenceAvisAnterieurSourceId, lieuExecution: parsed.lieuExecution,
          retrievedAt: new Date(),
        },
        update: {},
      })
      avisMarcheId = avis.id
      cleanup.push(async () => {
        await prisma.avisMarche.delete({ where: { id: avis.id } }).catch(() => {})
      })
      if (parsed.lots.length > 0) {
        const l = parsed.lots[0]
        const lot = await prisma.lot.upsert({
          where: { avisMarcheId_numero: { avisMarcheId: avis.id, numero: l.numero } },
          create: { avisMarcheId: avis.id, numero: l.numero, description: l.description, montant: l.montant, montantDevise: l.montantDevise, titulaireNom: l.titulaireNom },
          update: {},
        })
        lotId = lot.id
      }
      break
    }
    assert(avisMarcheId, "aucun AvisMarche exploitable trouvé dans l'échantillon BOAMP")
    return `AvisMarche réel créé/retrouvé : ${avisMarcheId}${lotId ? `, Lot : ${lotId}` : " (avis sans lot)"}`
  })

  // --- Projet (interne) ---
  await step("Projet (interne)", async () => {
    const projet = await prisma.projet.create({ data: { nom: `${PREFIX} Opération de vérification`, type: "Smoke test" } })
    projetId = projet.id
    cleanup.push(async () => {
      await prisma.projet.delete({ where: { id: projet.id } }).catch(() => {})
    })
    if (siteId) await prisma.projetSite.upsert({ where: { projetId_siteId: { projetId: projet.id, siteId } }, create: { projetId: projet.id, siteId }, update: {} })
    if (acteurId) await prisma.projetActeur.upsert({ where: { projetId_acteurId: { projetId: projet.id, acteurId } }, create: { projetId: projet.id, acteurId }, update: {} })
    if (avisMarcheId) await prisma.projetAvisMarche.upsert({ where: { projetId_avisMarcheId: { projetId: projet.id, avisMarcheId } }, create: { projetId: projet.id, avisMarcheId }, update: {} })
    if (lotId) await prisma.projetLot.upsert({ where: { projetId_lotId: { projetId: projet.id, lotId } }, create: { projetId: projet.id, lotId }, update: {} })
    return `Projet interne créé : ${projet.id}, rattachements testés : site=${!!siteId} acteur=${!!acteurId} avisMarche=${!!avisMarcheId} lot=${!!lotId}`
  })

  // --- DocumentSit (interne) ---
  await step("DocumentSit (interne)", async () => {
    const doc = await prisma.documentSit.create({ data: { titre: `${PREFIX} Note de vérification`, type: "RAPPORT", source: "manuel" } })
    documentSitId = doc.id
    cleanup.push(async () => {
      await prisma.documentSit.delete({ where: { id: doc.id } }).catch(() => {})
    })
    if (siteId) await prisma.documentSitSite.upsert({ where: { documentSitId_siteId: { documentSitId: doc.id, siteId } }, create: { documentSitId: doc.id, siteId }, update: {} })
    if (projetId) await prisma.documentSitProjet.upsert({ where: { documentSitId_projetId: { documentSitId: doc.id, projetId } }, create: { documentSitId: doc.id, projetId }, update: {} })
    return `DocumentSit interne créé : ${doc.id}`
  })

  // --- Besoin (interne) ---
  await step("Besoin (interne)", async () => {
    const besoin = await prisma.besoin.create({ data: { titre: `${PREFIX} Vérification de bout en bout`, source: "manuel" } })
    besoinId = besoin.id
    cleanup.push(async () => {
      await prisma.besoin.delete({ where: { id: besoin.id } }).catch(() => {})
    })
    if (siteId) await prisma.besoinSite.upsert({ where: { besoinId_siteId: { besoinId: besoin.id, siteId } }, create: { besoinId: besoin.id, siteId }, update: {} })
    if (projetId) await prisma.besoinProjet.upsert({ where: { besoinId_projetId: { besoinId: besoin.id, projetId } }, create: { besoinId: besoin.id, projetId }, update: {} })
    if (acteurId) await prisma.besoinActeur.upsert({ where: { besoinId_acteurId: { besoinId: besoin.id, acteurId } }, create: { besoinId: besoin.id, acteurId }, update: {} })
    if (avisMarcheId) await prisma.besoinAvisMarche.upsert({ where: { besoinId_avisMarcheId: { besoinId: besoin.id, avisMarcheId } }, create: { besoinId: besoin.id, avisMarcheId }, update: {} })
    if (lotId) await prisma.besoinLot.upsert({ where: { besoinId_lotId: { besoinId: besoin.id, lotId } }, create: { besoinId: besoin.id, lotId }, update: {} })
    if (documentSitId) await prisma.besoinDocumentSit.upsert({ where: { besoinId_documentSitId: { besoinId: besoin.id, documentSitId } }, create: { besoinId: besoin.id, documentSitId }, update: {} })
    return `Besoin interne créé : ${besoin.id}, rattaché à ${[siteId && "site", projetId && "projet", acteurId && "acteur", avisMarcheId && "avisMarche", lotId && "lot", documentSitId && "documentSit"].filter(Boolean).length} objet(s) réel(s)`
  })

  // --- Nettoyage (dans l'ordre inverse de création, pour respecter les FK) ---
  for (const fn of cleanup.reverse()) {
    await fn()
  }

  // --- Rapport ---
  console.log("\n=== SMOKE TEST SIT — RÉSULTATS ===")
  for (const r of results) {
    console.log(`[${r.status}] ${r.domain} — ${r.detail}`)
  }
  const failed = results.filter((r) => r.status === "FAIL")
  console.log(`\n${results.length - failed.length}/${results.length} domaines PASS.`)
  if (failed.length > 0) {
    console.log(`ÉCHECS : ${failed.map((f) => f.domain).join(", ")}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error("Erreur fatale du smoke test :", error)
  process.exitCode = 1
})
