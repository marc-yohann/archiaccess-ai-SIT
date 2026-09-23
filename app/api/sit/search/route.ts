import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { searchAddress } from "@/lib/data-sources/ban"
import { searchCompanies, looksLikeSirenOrSiret } from "@/lib/data-sources/entreprises"
import { serializeDocumentSit } from "@/lib/documents-sit"

// Recherche universelle du SIT — les 6 axes (voir app/sit/page.tsx::
// SEARCH_CATEGORIES). Historiquement, seuls Localiser (BAN) et Acteur
// (SIRENE) interrogeaient réellement un backend ; Projet/Document/
// Référence/Besoin ne pilotaient que l'affichage (label/placeholder),
// documenté explicitement comme tel dans le code. Cette route branche
// désormais réellement les 4 axes restants sur leurs modèles Prisma
// respectifs (Projet/DocumentSit/AvisMarche+Unite+Parcelle/Besoin),
// jamais une donnée inventée.
//
// `category` optionnel : absent -> comportement historique inchangé
// (Localiser + Acteur combinés, comme avant cette évolution) pour ne
// jamais casser un appelant existant qui ne le transmettrait pas encore.
// Présent -> interroge uniquement le domaine correspondant, évite de
// scanner les 6 domaines à chaque recherche.
//
// Recherche textuelle : `contains`/`mode: insensitive` sur les champs
// libres (nom, titre, description...) ; `startsWith` sur les
// identifiants (sourceId, numeroDpe, idu) — un identifiant administratif
// se complète par la droite, jamais par une recherche floue au milieu,
// et `startsWith` reste seul capable d'exploiter l'index btree existant
// sur ces colonnes (contrairement à `contains`, qui impose un scan quel
// que soit l'index — voir l'audit de performance, aucun index
// supplémentaire ajouté faute de volume réel le justifiant aujourd'hui).
// `take: 20` par domaine : borne de bon sens contre un résultat non
// borné, pas un index préventif.
const RESULT_LIMIT = 20

export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim()
  const category = url.searchParams.get("category")?.trim() || null
  if (!query) {
    return NextResponse.json({ success: false, error: "Paramètre q manquant." }, { status: 400 })
  }

  const prisma = await getPrisma()

  // --- LOCALISER + ACTEUR (comportement historique, inchangé) ---
  async function searchLocaliserActeur() {
    if (looksLikeSirenOrSiret(query!)) {
      const companies = await searchCompanies(query!)
      return { addresses: [] as Awaited<ReturnType<typeof searchAddress>>, companies }
    }
    const [addressResult, companyResult] = await Promise.allSettled([searchAddress(query!), searchCompanies(query!)])
    const addresses = addressResult.status === "fulfilled" ? addressResult.value : []
    const companies = companyResult.status === "fulfilled" ? companyResult.value : []
    if (addressResult.status === "rejected" && companyResult.status === "rejected") {
      throw new Error("Recherche impossible (adresse et entreprise).")
    }
    return { addresses, companies }
  }

  // --- PROJET ---
  async function searchProjet() {
    return prisma.projet.findMany({
      where: {
        OR: [
          { nom: { contains: query!, mode: "insensitive" } },
          { type: { contains: query!, mode: "insensitive" } },
          { statut: { contains: query!, mode: "insensitive" } },
          { description: { contains: query!, mode: "insensitive" } },
        ],
      },
      select: { id: true, nom: true, type: true, statut: true, description: true, dateDebut: true, dateFin: true, montant: true, createdAt: true },
      take: RESULT_LIMIT,
      orderBy: { updatedAt: "desc" },
    })
  }

  // --- DOCUMENT (DocumentSit — jamais Document/DocumentChunk, corpus RAG distinct) ---
  async function searchDocument() {
    const docs = await prisma.documentSit.findMany({
      where: {
        OR: [
          { titre: { contains: query!, mode: "insensitive" } },
          { description: { contains: query!, mode: "insensitive" } },
          { source: { contains: query!, mode: "insensitive" } },
          { sourceId: { startsWith: query! } },
          { contenuExtrait: { contains: query!, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, titre: true, type: true, description: true, source: true, sourceId: true, sourceUrl: true,
        retrievedAt: true, dateDocument: true, tailleOctets: true, createdAt: true,
      },
      take: RESULT_LIMIT,
      orderBy: { updatedAt: "desc" },
    })
    return docs.map(serializeDocumentSit)
  }

  // --- RÉFÉRENCE (Marché/AvisMarche, DPE/Unite, Cadastre/Parcelle — identifiants réellement stockés) ---
  async function searchReference() {
    const [avisMarches, unites, parcelles] = await Promise.all([
      prisma.avisMarche.findMany({
        where: {
          OR: [
            { sourceId: { startsWith: query! } },
            { objet: { contains: query!, mode: "insensitive" } },
            { acheteurNom: { contains: query!, mode: "insensitive" } },
          ],
        },
        select: { id: true, sourceId: true, objet: true, typeMarche: true, acheteurNom: true, datePublication: true, codeDepartement: true, urlAvis: true },
        take: RESULT_LIMIT,
      }),
      prisma.unite.findMany({
        where: { numeroDpe: { startsWith: query! } },
        select: { id: true, numeroDpe: true, etiquetteEnergie: true, etiquetteGes: true, typeBatiment: true, siteId: true },
        take: RESULT_LIMIT,
      }),
      prisma.parcelle.findMany({
        where: { idu: { startsWith: query! } },
        select: { id: true, idu: true, section: true, numero: true, commune: true, codeInsee: true },
        take: RESULT_LIMIT,
      }),
    ])
    return {
      avisMarches: avisMarches.map((a) => ({ categorie: "reference" as const, type: "avis-marche" as const, id: a.id, identifiant: a.sourceId, titre: a.objet ?? "(objet non renseigné)", details: { typeMarche: a.typeMarche, acheteurNom: a.acheteurNom, datePublication: a.datePublication, codeDepartement: a.codeDepartement }, source: "boamp", sourceUrl: a.urlAvis })),
      unites: unites.map((u) => ({ categorie: "reference" as const, type: "dpe" as const, id: u.id, identifiant: u.numeroDpe, titre: `DPE ${u.numeroDpe ?? ""}`.trim(), details: { etiquetteEnergie: u.etiquetteEnergie, etiquetteGes: u.etiquetteGes, typeBatiment: u.typeBatiment }, source: "ademe" })),
      parcelles: parcelles.map((p) => ({ categorie: "reference" as const, type: "cadastre" as const, id: p.id, identifiant: p.idu, titre: `Parcelle ${p.idu}`, details: { section: p.section, numero: p.numero, commune: p.commune, codeInsee: p.codeInsee }, source: "cadastre" })),
    }
  }

  // --- BESOIN ---
  async function searchBesoin() {
    return prisma.besoin.findMany({
      where: {
        OR: [
          { titre: { contains: query!, mode: "insensitive" } },
          { description: { contains: query!, mode: "insensitive" } },
          { statut: { contains: query!, mode: "insensitive" } },
          { type: { contains: query!, mode: "insensitive" } },
          { discipline: { contains: query!, mode: "insensitive" } },
          { problematique: { contains: query!, mode: "insensitive" } },
          { typeOuvrage: { contains: query!, mode: "insensitive" } },
          { source: { contains: query!, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, titre: true, description: true, statut: true, type: true, discipline: true, problematique: true,
        typeOuvrage: true, source: true, sourceId: true, createdAt: true,
      },
      take: RESULT_LIMIT,
      orderBy: { updatedAt: "desc" },
    })
  }

  try {
    // Sans catégorie : comportement historique exact (compatibilité avec
    // tout appelant qui ne la transmettrait pas encore).
    if (!category || category === "localiser" || category === "acteur") {
      const { addresses, companies } = await searchLocaliserActeur()
      return NextResponse.json({ success: true, addresses, companies, projets: [], documentsSit: [], references: { avisMarches: [], unites: [], parcelles: [] }, besoins: [] })
    }

    if (category === "projet") {
      const projets = await searchProjet()
      return NextResponse.json({ success: true, addresses: [], companies: [], projets, documentsSit: [], references: { avisMarches: [], unites: [], parcelles: [] }, besoins: [] })
    }

    if (category === "document") {
      const documentsSit = await searchDocument()
      return NextResponse.json({ success: true, addresses: [], companies: [], projets: [], documentsSit, references: { avisMarches: [], unites: [], parcelles: [] }, besoins: [] })
    }

    if (category === "reference") {
      const references = await searchReference()
      return NextResponse.json({ success: true, addresses: [], companies: [], projets: [], documentsSit: [], references, besoins: [] })
    }

    if (category === "besoin") {
      const besoins = await searchBesoin()
      return NextResponse.json({ success: true, addresses: [], companies: [], projets: [], documentsSit: [], references: { avisMarches: [], unites: [], parcelles: [] }, besoins })
    }

    return NextResponse.json({ success: false, error: "Catégorie de recherche inconnue." }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
