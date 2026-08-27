// Indexation et recherche par similarité pour le "second cerveau" du
// copilote (voir CLAUDE.md et prisma/schema.prisma). Le type vector de
// pgvector n'est pas modélisé nativement par Prisma (Unsupported() dans
// le schéma) : insertion et recherche passent par du SQL brut.

import { randomUUID } from "node:crypto"
import { getPrisma } from "@/lib/prisma"
import { embedTexts } from "@/lib/embeddings"
import { putDocument } from "@/lib/storage"
import { chunkText } from "@/lib/chunking"

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

export async function indexDocument(input: {
  title: string
  sourceType: string
  content: string
}): Promise<string> {
  const prisma = await getPrisma()
  const s3Key = `documents/${randomUUID()}.md`
  await putDocument(s3Key, input.content)

  const document = await prisma.document.create({
    data: { title: input.title, sourceType: input.sourceType, s3Key },
  })

  const chunks = chunkText(input.content)
  if (chunks.length === 0) return document.id

  const embeddings = await embedTexts(chunks)

  for (let i = 0; i < chunks.length; i++) {
    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, "documentId", "chunkIndex", content, embedding, "createdAt")
      VALUES (${randomUUID()}, ${document.id}, ${i}, ${chunks[i]}, ${toVectorLiteral(embeddings[i])}::vector, now())
    `
  }

  return document.id
}

export interface RelevantChunk {
  documentId: string
  title: string
  content: string
  distance: number
}

export async function searchSimilarChunks(query: string, limit = 5): Promise<RelevantChunk[]> {
  const prisma = await getPrisma()
  const [queryEmbedding] = await embedTexts([query])
  const vectorLiteral = toVectorLiteral(queryEmbedding)

  return prisma.$queryRaw<RelevantChunk[]>`
    SELECT dc."documentId" AS "documentId", d.title, dc.content, dc.embedding <=> ${vectorLiteral}::vector AS distance
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    ORDER BY distance ASC
    LIMIT ${limit}
  `
}
