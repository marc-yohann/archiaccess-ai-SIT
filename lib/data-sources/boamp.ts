// Client pour le BOAMP (Bulletin officiel des annonces des marchés
// publics, opendatasoft — même plateforme que le BODACC, voir
// lib/data-sources/bodacc.ts). Pas de clé requise. Recherche par
// département (dérivé du code INSEE de l'adresse sélectionnée) : donne
// une vue "marché" des appels d'offres publics récents dans la zone —
// utile pour une étude AMO/OPC (repérer des opportunités, ou situer un
// projet dans le contexte de la commande publique locale). Validé par
// appel réel avant d'écrire ce code (voir CLAUDE.md).

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://boamp-datadila.opendatasoft.com/api/records/1.0/search/"

export interface PublicMarket {
  id: string
  acheteur: string
  objet: string
  datePublication: string
  famille: string
  urlAvis: string | null
}

interface RawRecord {
  recordid: string
  fields: {
    nomacheteur: string
    objet: string
    dateparution: string
    famille_libelle: string
    url_avis: string | null
  }
}

interface BoampResponse {
  records: RawRecord[]
}

export async function getPublicMarketsForDepartment(codeDepartement: string, limit = 10): Promise<PublicMarket[]> {
  return withVault("boamp", codeDepartement, () => fetchPublicMarketsLive(codeDepartement, limit))
}

async function fetchPublicMarketsLive(codeDepartement: string, limit: number): Promise<PublicMarket[]> {
  const url = new URL(BASE_URL)
  url.searchParams.set("dataset", "boamp")
  url.searchParams.set("q", `code_departement:${codeDepartement}`)
  url.searchParams.set("rows", String(limit))
  url.searchParams.set("sort", "-dateparution")

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API BOAMP a répondu ${res.status}`)
  }

  const data = (await res.json()) as BoampResponse
  return data.records.map((r) => ({
    id: r.recordid,
    acheteur: r.fields.nomacheteur,
    objet: r.fields.objet,
    datePublication: r.fields.dateparution,
    famille: r.fields.famille_libelle,
    urlAvis: r.fields.url_avis,
  }))
}

// departmentCodeFromCityCode() a été déplacée dans lib/insee.ts (aucune
// dépendance serveur) pour rester importable depuis un composant client
// (app/sit/page.tsx) sans embarquer withVault/Prisma dans le bundle
// navigateur — voir CLAUDE.md.

// ===== Phase 9 — extraction complète pour la persistance Marché/Lot =====
//
// Distinct de PublicMarket/getPublicMarketsForDepartment ci-dessus (écran
// /sit, recherche interactive, jamais modifié) : ici on extrait TOUS les
// champs réellement vérifiés par appels réels contre l'API BOAMP brute
// (voir le rapport d'audit Phase 9), pour lib/ingestion/sources/boamp.ts
// (persistance AvisMarche/Lot). PAS caché via withVault : c'est un flux
// d'ingestion type SIRENE/RNB (lib/ingestion/sources/*), pas une
// recherche ponctuelle d'employé (voir CLAUDE.md sur la distinction).
//
// Champs "donnees"/"gestion" de l'API opendatasoft : vérifié réellement,
// ce sont des CHAÎNES JSON à parser (pas des objets déjà imbriqués) —
// voir le rapport d'audit Phase 9.

interface RawCpv {
  PRINCIPAL?: string
}

interface RawMontant {
  "@DEVISE"?: string
  "#text"?: string
}

interface RawLot {
  NUM?: string
  DESCRIPTION?: string
  CPV?: RawCpv | RawCpv[]
}

interface RawAttributionDecision {
  NUM_LOT?: string
  DESCRIPTION?: string
  TITULAIRE?: { DENOMINATION?: string }
  RENSEIGNEMENT?: { MONTANT?: RawMontant; DATE_ATTRIBUTION?: string }
}

interface RawDonnees {
  OBJET?: {
    CPV?: RawCpv | RawCpv[]
    DIV_EN_LOTS?: { OUI?: string; NON?: string }
    LOTS?: { LOT?: RawLot | RawLot[] }
    LIEU_EXEC_LIVR?: { ADRESSE?: string; CODE_NUTS?: string }
  }
  ATTRIBUTION?: {
    ATTRIBUE_PAR_LOTS_MARCHES?: string
    DECISION?: RawAttributionDecision | RawAttributionDecision[]
  }
}

interface RawGestion {
  MARCHE?: {
    ANNONCE_ANTERIEUR?: {
      REFERENCE?: { IDWEB?: string }
    }
  }
}

// recordid n'est PAS un champ de "fields" côté API opendatasoft — il vit
// au niveau de l'enregistrement (record.recordid, un hash technique,
// ex. "df13e83eebe14d876b97b27a4fa5ec4433921fd8"), vérifié réellement
// (voir le rapport d'audit Phase 9). fields.id est un champ DIFFÉRENT
// (copie de idweb avec un tiret remplacé par un underscore) — jamais
// confondu avec recordid ici.
export interface RawBoampRecordFields {
  idweb?: string
  nomacheteur?: string
  objet?: string
  dateparution?: string
  datelimitereponse?: string
  nature_libelle?: string
  procedure_libelle?: string
  type_procedure?: string
  type_marche_facette?: string
  code_departement_prestation?: string
  code_departement?: string
  url_avis?: string | null
  donnees?: string
  gestion?: string
}

// Un champ XML->JSON opendatasoft devient un objet unique s'il n'y a
// qu'une occurrence, un tableau s'il y en a plusieurs — vérifié
// réellement sur CPV, LOTS.LOT et ATTRIBUTION.DECISION (voir le rapport
// Phase 9). Jamais supposer une seule forme : toujours normaliser via
// cette fonction avant de traiter la valeur, ici comme pour tout futur
// champ présentant le même artefact.
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function extractCpvCodes(cpv: RawCpv | RawCpv[] | undefined): string[] {
  return asArray(cpv)
    .map((c) => c?.PRINCIPAL)
    .filter((code): code is string => Boolean(code))
}

function parseMontant(raw: RawMontant | undefined): { montant: number | null; devise: string | null } {
  const text = raw?.["#text"]
  const parsed = text ? Number.parseFloat(text) : NaN
  return { montant: Number.isNaN(parsed) ? null : parsed, devise: raw?.["@DEVISE"] ?? null }
}

// Seul placeholder générique vérifié réellement dans les données BOAMP
// (voir le rapport d'audit Phase 9, "France entière" observé sur
// plusieurs avis réels) — filtre volontairement étroit, jamais une
// heuristique large non vérifiée sur des exemples non observés.
const LIEU_EXEC_PLACEHOLDERS = new Set(["france entière", "france entiere"])

function parseLieuExecution(adresse: string | undefined): string | null {
  if (!adresse) return null
  if (LIEU_EXEC_PLACEHOLDERS.has(adresse.trim().toLowerCase())) return null
  return adresse
}

export interface ParsedLot {
  numero: string
  description: string | null
  montant: number | null
  montantDevise: string | null
  titulaireNom: string | null
  cpvCodes: string[]
}

export interface ParsedAvisMarche {
  source: "boamp"
  sourceId: string
  recordId: string | null
  objet: string | null
  natureAvis: string | null
  typeProcedure: string | null
  typeMarche: string | null
  datePublication: string | null
  dateLimiteReponse: string | null
  montant: number | null
  montantDevise: string | null
  acheteurNom: string | null
  titulaireNom: string | null
  codeDepartement: string | null
  urlAvis: string | null
  referenceAvisAnterieurSourceId: string | null
  lieuExecution: string | null
  cpvCodes: string[]
  lots: ParsedLot[]
}

// Parseur pur (aucun accès réseau/DB) — testable directement sur des
// données réelles capturées. Retourne null si l'enregistrement n'a même
// pas d'idweb (aucune identité métier exploitable, voir le rapport Phase
// 9 : sourceId = idweb, jamais recordid). recordId est passé séparément
// (voir RawBoampRecordFields ci-dessus pour pourquoi il n'est pas dans
// "fields").
export function parseAvisMarche(fields: RawBoampRecordFields, recordId: string | null = null): ParsedAvisMarche | null {
  if (!fields.idweb) return null

  const donnees: RawDonnees = fields.donnees ? (JSON.parse(fields.donnees) as RawDonnees) : {}
  const gestion: RawGestion = fields.gestion ? (JSON.parse(fields.gestion) as RawGestion) : {}

  const objet = donnees.OBJET
  const attribution = donnees.ATTRIBUTION

  const lotsByNumero = new Map<string, ParsedLot>()

  // Lots tels que déclarés dans l'avis initial (OBJET.LOTS.LOT).
  for (const rawLot of asArray(objet?.LOTS?.LOT)) {
    if (!rawLot.NUM) continue // pas de numéro = pas d'identité stable, jamais inventée
    lotsByNumero.set(rawLot.NUM, {
      numero: rawLot.NUM,
      description: rawLot.DESCRIPTION ?? null,
      montant: null,
      montantDevise: null,
      titulaireNom: null,
      cpvCodes: extractCpvCodes(rawLot.CPV),
    })
  }

  // Attribution — vérifié réellement (rapport Phase 9) : quand un marché
  // est attribué par lots, ATTRIBUTION.DECISION est un TABLEAU d'entrées
  // portant chacune NUM_LOT (fusionnées ici avec le lot déjà connu, ou
  // créées si l'avis de résultat ne répète pas le bloc OBJET.LOTS
  // d'origine) ; quand il ne l'est pas, DECISION est un objet UNIQUE sans
  // NUM_LOT, et titulaire/montant s'appliquent à l'avis entier.
  let avisMontant: number | null = null
  let avisMontantDevise: string | null = null
  let avisTitulaireNom: string | null = null

  for (const decision of asArray(attribution?.DECISION)) {
    const { montant, devise } = parseMontant(decision.RENSEIGNEMENT?.MONTANT)
    const titulaireNom = decision.TITULAIRE?.DENOMINATION ?? null

    if (decision.NUM_LOT) {
      const existing = lotsByNumero.get(decision.NUM_LOT)
      lotsByNumero.set(decision.NUM_LOT, {
        numero: decision.NUM_LOT,
        description: existing?.description ?? decision.DESCRIPTION ?? null,
        montant,
        montantDevise: devise,
        titulaireNom,
        cpvCodes: existing?.cpvCodes ?? [],
      })
    } else {
      avisMontant = montant
      avisMontantDevise = devise
      avisTitulaireNom = titulaireNom
    }
  }

  return {
    source: "boamp",
    sourceId: fields.idweb,
    recordId,
    objet: fields.objet ?? null,
    natureAvis: fields.nature_libelle ?? null,
    typeProcedure: fields.procedure_libelle ?? fields.type_procedure ?? null,
    typeMarche: fields.type_marche_facette ?? null,
    datePublication: fields.dateparution ?? null,
    dateLimiteReponse: fields.datelimitereponse ?? null,
    montant: avisMontant,
    montantDevise: avisMontantDevise,
    acheteurNom: fields.nomacheteur ?? null,
    titulaireNom: avisTitulaireNom,
    codeDepartement: fields.code_departement_prestation ?? fields.code_departement ?? null,
    urlAvis: fields.url_avis ?? null,
    referenceAvisAnterieurSourceId: gestion.MARCHE?.ANNONCE_ANTERIEUR?.REFERENCE?.IDWEB ?? null,
    lieuExecution: parseLieuExecution(objet?.LIEU_EXEC_LIVR?.ADRESSE),
    // descripteur_code/descripteur_libelle (classification interne BOAMP)
    // volontairement JAMAIS mappé ici ni ailleurs : ce n'est PAS le code
    // CPV officiel, la confusion est explicitement proscrite (voir le
    // rapport d'audit Phase 9).
    cpvCodes: extractCpvCodes(objet?.CPV),
    lots: [...lotsByNumero.values()],
  }
}

export interface RawBoampRecord {
  recordId: string | null
  fields: RawBoampRecordFields
}

// Fenêtre de dates [début, fin] inclusive, format "YYYY-MM-DD" — voir
// buildDepartmentQuery() ci-dessous. Optionnelle : omise, la requête ne
// filtre que par département (comportement historique).
export interface DateWindow {
  start: string
  end: string
}

function buildDepartmentQuery(codeDepartement: string, window?: DateWindow): string {
  const base = `code_departement:${codeDepartement}`
  return window ? `${base} AND dateparution:[${window.start} TO ${window.end}]` : base
}

// Fetch brut (pas via withVault, voir plus haut) pour le pilote/runner
// d'ingestion — renvoie les champs BOAMP complets tels que l'API les
// fournit, sans filtrage de colonnes. recordId conservé séparément de
// "fields" (voir RawBoampRecordFields) pour qu'il reste disponible côté
// appelant sans jamais être traité comme un champ métier. start = offset
// de pagination opendatasoft (vérifié réellement, voir le rapport
// d'audit Phase 9) — nécessaire à lib/ingestion/sources/boamp.ts pour
// parcourir un département au-delà des `rows` premiers résultats.
//
// `window` (Phase 13, mission "SUPPRIMER LE BLOCAGE DES 10 000") :
// l'API impose start+rows <= 10000 (vérifié réellement par appel direct,
// message d'erreur : "Please refine your query or use the Download
// service"). Le "Download service" (export CSV/JSON en masse,
// api/explore/v2.1/.../exports/) a été testé réellement : il contourne
// bien la limite, mais un seul département peut peser 350-400 Mo
// (vérifié sur le département 38, 34 730 avis), imposant un staging S3
// et une réécriture du parseur (schéma plat différent de fields.*) —
// disproportionné alors qu'un sous-découpage par plage de dates sur
// CETTE MÊME API suffit : vérifié réellement que start=9999 fonctionne
// tant que la requête (département + fenêtre de dates) reste sous
// 10 000 résultats, quel que soit le nombre total d'avis du département
// tous millésimes confondus. Voir countAvisMarcheForDepartment() et
// lib/ingestion/sources/boamp.ts pour le découpage dynamique.
export async function fetchAvisMarcheRawForDepartment(
  codeDepartement: string,
  rows: number,
  start = 0,
  window?: DateWindow,
): Promise<RawBoampRecord[]> {
  const url = new URL(BASE_URL)
  url.searchParams.set("dataset", "boamp")
  url.searchParams.set("q", buildDepartmentQuery(codeDepartement, window))
  url.searchParams.set("rows", String(rows))
  url.searchParams.set("start", String(start))
  url.searchParams.set("sort", "-dateparution")

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) {
    throw new Error(`API BOAMP a répondu ${res.status}`)
  }

  const data = (await res.json()) as { records: Array<{ recordid?: string; fields: RawBoampRecordFields }> }
  return data.records.map((r) => ({ recordId: r.recordid ?? null, fields: r.fields }))
}

// Comptage seul (rows=0, vérifié réellement : renvoie nhits sans
// enregistrement) — permet de décider AVANT de paginer si une fenêtre
// de dates doit être subdivisée pour rester sous la limite de 10 000.
export async function countAvisMarcheForDepartment(codeDepartement: string, window: DateWindow): Promise<number> {
  const url = new URL(BASE_URL)
  url.searchParams.set("dataset", "boamp")
  url.searchParams.set("q", buildDepartmentQuery(codeDepartement, window))
  url.searchParams.set("rows", "0")

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    throw new Error(`API BOAMP a répondu ${res.status} (comptage)`)
  }
  const data = (await res.json()) as { nhits: number }
  return data.nhits
}
