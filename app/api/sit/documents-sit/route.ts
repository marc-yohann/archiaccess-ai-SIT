import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { DocumentSitType } from "@/lib/generated/prisma/client"
import { serializeDocumentSit } from "@/lib/documents-sit"

// DocumentSit (Phase 11) — domaine documentaire SIT (DCE, CCTP, rapports,
// plans...), STRICTEMENT DISTINCT du modèle `Document` (corpus
// réglementaire/RAG du copilote, voir prisma/schema.prisma) — jamais
// touché ici. Accessible à tout employé authentifié, même principe que
// Projet (Phase 10) : pas de cloisonnement par utilisateur.
const VALID_TYPES = new Set<string>(Object.values(DocumentSitType))

export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const prisma = await getPrisma()
  const documents = await prisma.documentSit.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { sites: true, projets: true, avisMarches: true, lots: true, acteurs: true } },
    },
  })

  return NextResponse.json({ success: true, documents: documents.map(serializeDocumentSit) })
}

export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await getSessionUser(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

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
  }

  const titre = body.titre?.trim()
  if (!titre) {
    return NextResponse.json({ success: false, error: "Le titre du document est requis." }, { status: 400 })
  }
  if (body.type && !VALID_TYPES.has(body.type)) {
    return NextResponse.json({ success: false, error: `Type inconnu. Valeurs possibles : ${[...VALID_TYPES].join(", ")}.` }, { status: 400 })
  }

  const prisma = await getPrisma()
  const document = await prisma.documentSit.create({
    data: {
      titre,
      type: (body.type as DocumentSitType | null) ?? null,
      description: body.description?.trim() || null,
      // Provenance jamais inventée (voir le rapport d'audit Phase 11) —
      // toujours ce que l'appelant fournit explicitement, jamais déduit.
      source: body.source?.trim() || null,
      sourceId: body.sourceId?.trim() || null,
      sourceUrl: body.sourceUrl?.trim() || null,
      retrievedAt: body.source ? new Date() : null,
      checksum: body.checksum?.trim() || null,
      mimeType: body.mimeType?.trim() || null,
      tailleOctets: body.tailleOctets != null ? BigInt(body.tailleOctets) : null,
      dateDocument: body.dateDocument ? new Date(body.dateDocument) : null,
      storageKey: body.storageKey?.trim() || null,
    },
  })

  return NextResponse.json({ success: true, document: serializeDocumentSit(document) })
}
