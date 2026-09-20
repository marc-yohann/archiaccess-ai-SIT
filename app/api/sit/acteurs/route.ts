import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { resolvePreciseAddress } from "@/lib/data-sources/ban"
import type { Company } from "@/lib/data-sources/entreprises"

// Persiste dans le référentiel des acteurs (Acteur/Etablissement, Phase 2 —
// voir prisma/schema.prisma) ce que la recherche universelle vient de
// récupérer en direct auprès de l'API Recherche d'entreprises
// (app/sit/page.tsx). Même principe que app/api/sit/sites : structure et
// relie une donnée déjà réellement récupérée, n'introduit rien de nouveau.
// Appelée en tâche de fond pour chaque entreprise trouvée — un échec ici ne
// doit jamais faire échouer la recherche elle-même (voir catch côté
// appelant).
export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { companies } = (await request.json()) as { companies: Company[] }
  if (!Array.isArray(companies) || companies.length === 0) {
    return NextResponse.json({ success: false, error: "Aucune entreprise fournie." }, { status: 400 })
  }

  const prisma = await getPrisma()
  const acteurIds: string[] = []

  for (const company of companies) {
    if (!company?.siren || !company.nom) continue

    const acteur = await prisma.acteur.upsert({
      where: { siren: company.siren },
      create: {
        siren: company.siren,
        nom: company.nom,
        nomCommercial: company.nomCommercial,
        codeNaf: company.activitePrincipale,
        statut: company.etatAdministratif,
        dateCreation: company.dateCreation,
      },
      update: {
        nom: company.nom,
        nomCommercial: company.nomCommercial,
        codeNaf: company.activitePrincipale,
        statut: company.etatAdministratif,
        dateCreation: company.dateCreation,
      },
    })
    acteurIds.push(acteur.id)

    await prisma.acteurSource.upsert({
      where: { acteurId_source: { acteurId: acteur.id, source: "entreprises" } },
      create: { acteurId: acteur.id, source: "entreprises" },
      update: { fetchedAt: new Date() },
    })

    const siege = company.siege
    if (!siege?.siret) continue

    // Résout un SITE réel pour l'adresse du siège via BAN — règle
    // déterministe documentée dans lib/data-sources/ban.ts::resolvePreciseAddress
    // (Phase 8, audit réel : jamais un score-seuil, jamais un top-1 par
    // défaut). citycode transmis dès qu'on le connaît déjà (Etablissement
    // codeInsee, fourni par SIRENE) — corroboration par une donnée déjà en
    // notre possession, pas une hypothèse.
    let siteId: string | null = null
    let resolutionOutcome: "VALID" | "NOT_FOUND" | "AMBIGUOUS" | "SKIPPED" = "SKIPPED"
    if (siege.adresse) {
      try {
        const resolution = await resolvePreciseAddress(siege.adresse, siege.codeInsee ?? undefined)
        resolutionOutcome = resolution.status
        if (resolution.status === "VALID") {
          const best = resolution.candidate
          const site = await prisma.site.upsert({
            where: { citycode_label: { citycode: best.citycode, label: best.label } },
            create: {
              label: best.label,
              citycode: best.citycode,
              postcode: best.postcode,
              city: best.city,
              longitude: best.coordinates[0],
              latitude: best.coordinates[1],
            },
            update: {
              postcode: best.postcode,
              city: best.city,
              longitude: best.coordinates[0],
              latitude: best.coordinates[1],
            },
          })
          siteId = site.id
        }
      } catch {
        // La résolution BAN peut échouer (timeout, adresse mal formée) —
        // l'établissement reste persisté sans site lié plutôt que de faire
        // échouer toute la requête. Un échec technique n'est pas un
        // NOT_FOUND (on ne sait rien, on n'a pas pu vérifier) : reste SKIPPED.
        resolutionOutcome = "SKIPPED"
      }
    }

    // Ne jamais rétrograder une résolution déjà VALID d'un appel précédent
    // si cette tentative n'en trouve pas une nouvelle (même principe que
    // pour siteId ci-dessous, appliqué explicitement au statut cette fois
    // car siteId seul ne suffit plus à représenter NOT_FOUND/AMBIGUOUS).
    const existing =
      resolutionOutcome !== "VALID"
        ? await prisma.etablissement.findUnique({ where: { siret: siege.siret }, select: { siteResolutionStatus: true } })
        : null
    const shouldWriteStatus = resolutionOutcome === "VALID" || existing === null || existing.siteResolutionStatus !== "VALID"

    await prisma.etablissement.upsert({
      where: { siret: siege.siret },
      create: {
        acteurId: acteur.id,
        siret: siege.siret,
        adresse: siege.adresse,
        codePostal: siege.codePostal,
        codeInsee: siege.codeInsee,
        commune: siege.communeLibelle,
        latitude: siege.latitude,
        longitude: siege.longitude,
        estSiege: true,
        actif: siege.actif,
        siteId,
        ...(resolutionOutcome !== "SKIPPED" ? { siteResolutionStatus: resolutionOutcome, siteResolvedAt: new Date() } : {}),
      },
      update: {
        adresse: siege.adresse,
        codePostal: siege.codePostal,
        codeInsee: siege.codeInsee,
        commune: siege.communeLibelle,
        latitude: siege.latitude,
        longitude: siege.longitude,
        actif: siege.actif,
        // Ne réinitialise jamais un lien déjà résolu si cet appel n'a pas
        // réussi à en retrouver un (voir try/catch ci-dessus).
        ...(siteId ? { siteId } : {}),
        ...(resolutionOutcome !== "SKIPPED" && shouldWriteStatus ? { siteResolutionStatus: resolutionOutcome, siteResolvedAt: new Date() } : {}),
      },
    })
  }

  return NextResponse.json({ success: true, acteurIds })
}
