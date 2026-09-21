import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { DocumentSitType } from "@/lib/generated/prisma/client"
import { serializeDocumentSit } from "@/lib/documents-sit"

const VALID_TYPES = new Set<string>(Object.values(DocumentSitType))

// Lecture/modification d'un DocumentSit (Phase 11) et de ses
// rattachements réels — jamais une résolution automatique, voir les
// sous-routes (sites/projets/acteurs/avis-marches/lots) pour les
// rattachements explicites.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const prisma = await getPrisma()
  const document = await prisma.documentSit.findUnique({
    where: { id },
    include: {
      sites: { include: { site: true } },
      projets: { include: { projet: true } },
      avisMarches: { include: { avisMarche: true } },
      lots: { include: { lot: true } },
      acteurs: { include: { acteur: true } },
    },
  })
  if (!document) {
    return NextResponse.json({ success: false, error: "Document introuvable." }, { status: 404 })
  }

  return NextResponse.json({ success: true, document: serializeDocumentSit(document) })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json()) as {
    titre?: string
    type?: string | null
    description?: string | null
    source?: string | null
    sourceId?: string | null
    sourceUrl?: string | null
    checksum?: string | null
    mimeType?: string | null
    tailleOctets?: number | string | null
    dateDocument?: string | null
    storageKey?: string | null
    contenuExtrait?: string | null
  }

  const prisma = await getPrisma()
  const existing = await prisma.documentSit.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ success: false, error: "Document introuvable." }, { status: 404 })
  }

  if (body.type && !VALID_TYPES.has(body.type)) {
    return NextResponse.json({ success: false, error: `Type inconnu. Valeurs possibles : ${[...VALID_TYPES].join(", ")}.` }, { status: 400 })
  }

  const data: {
    titre?: string
    type?: DocumentSitType | null
    description?: string | null
    source?: string | null
    sourceId?: string | null
    sourceUrl?: string | null
    checksum?: string | null
    mimeType?: string | null
    tailleOctets?: bigint | null
    dateDocument?: Date | null
    storageKey?: string | null
    contenuExtrait?: string | null
    contenuExtraitAt?: Date | null
  } = {}
  if (typeof body.titre === "string") {
    const titre = body.titre.trim()
    if (!titre) {
      return NextResponse.json({ success: false, error: "Le titre du document ne peut pas être vide." }, { status: 400 })
    }
    data.titre = titre
  }
  if ("type" in body) data.type = (body.type as DocumentSitType | null) ?? null
  if ("description" in body) data.description = body.description?.trim() || null
  if ("source" in body) data.source = body.source?.trim() || null
  if ("sourceId" in body) data.sourceId = body.sourceId?.trim() || null
  if ("sourceUrl" in body) data.sourceUrl = body.sourceUrl?.trim() || null
  if ("checksum" in body) data.checksum = body.checksum?.trim() || null
  if ("mimeType" in body) data.mimeType = body.mimeType?.trim() || null
  if ("tailleOctets" in body) data.tailleOctets = body.tailleOctets != null ? BigInt(body.tailleOctets) : null
  if ("dateDocument" in body) data.dateDocument = body.dateDocument ? new Date(body.dateDocument) : null
  if ("storageKey" in body) data.storageKey = body.storageKey?.trim() || null
  // contenuExtrait n'est jamais rempli automatiquement par ce système
  // (aucun OCR/parsing implémenté, voir le rapport d'audit Phase 11) —
  // seule une valeur explicitement fournie par l'appelant est acceptée,
  // et contenuExtraitAt n'est renseigné que dans ce cas précis.
  if ("contenuExtrait" in body) {
    data.contenuExtrait = body.contenuExtrait?.trim() || null
    data.contenuExtraitAt = data.contenuExtrait ? new Date() : null
  }

  const document = await prisma.documentSit.update({ where: { id }, data })
  return NextResponse.json({ success: true, document: serializeDocumentSit(document) })
}
