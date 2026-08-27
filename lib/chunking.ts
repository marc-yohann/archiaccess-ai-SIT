// Découpe un document Markdown en paragraphes de taille raisonnable pour
// l'indexation pgvector — accumule les paragraphes jusqu'à la taille
// cible pour éviter des chunks dégénérés (un titre isolé, ou dix pages
// d'un coup) qui nuiraient à la recherche par similarité.

const MAX_CHUNK_SIZE = 1500

export function chunkText(content: string): string[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ""

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length > MAX_CHUNK_SIZE && current) {
      chunks.push(current)
      current = paragraph
    } else {
      current = candidate
    }
  }
  if (current) chunks.push(current)

  // Découpe brute des paragraphes individuels encore trop longs (ex: un
  // seul bloc de texte sans saut de ligne) plutôt que de les envoyer tels
  // quels à l'API d'embeddings.
  return chunks.flatMap((chunk) => {
    if (chunk.length <= MAX_CHUNK_SIZE) return [chunk]
    const pieces: string[] = []
    for (let i = 0; i < chunk.length; i += MAX_CHUNK_SIZE) {
      pieces.push(chunk.slice(i, i + MAX_CHUNK_SIZE))
    }
    return pieces
  })
}
