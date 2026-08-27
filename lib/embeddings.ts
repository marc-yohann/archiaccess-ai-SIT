// Client pour l'API Mistral Embeddings — sert à indexer le contenu du SIT
// (Document/DocumentChunk, voir prisma/schema.prisma) pour que le
// copilote puisse le retrouver par similarité (pgvector). Dimension 1024
// vérifiée par un appel réel à mistral-embed (voir CLAUDE.md), pas
// supposée.

import { getMistralApiKey } from "@/lib/secrets"

const MISTRAL_EMBEDDINGS_URL = "https://api.mistral.ai/v1/embeddings"
const MODEL = "mistral-embed"
export const EMBEDDING_DIMENSION = 1024

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const apiKey = await getMistralApiKey()
  const res = await fetch(MISTRAL_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Mistral Embeddings API a répondu ${res.status} : ${body}`)
  }

  const data = (await res.json()) as { data: Array<{ embedding: number[] }> }
  return data.data.map((d) => d.embedding)
}
