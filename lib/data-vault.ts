// "Coffre" du SIT — voir CLAUDE.md, décision utilisateur du 2026-08-31.
// Enveloppe chaque connecteur externe (lib/data-sources/*) : la source
// est toujours interrogée en direct (données à jour, esprit "terminal de
// trading"), mais le résultat est systématiquement conservé dans
// DataCacheEntry — jamais supprimé, jamais purgé. Sert de mémoire
// permanente ET de repli si l'API externe est indisponible. L'échec
// d'une lecture/écriture du coffre lui-même (base indisponible) ne doit
// jamais faire échouer la recherche — c'est un plus, pas une dépendance.

import { getPrisma } from "@/lib/prisma"

export async function withVault<T>(source: string, cacheKey: string, fetchLive: () => Promise<T>): Promise<T> {
  let result: T
  try {
    result = await fetchLive()
  } catch (liveError) {
    try {
      const prisma = await getPrisma()
      const cached = await prisma.dataCacheEntry.findUnique({ where: { source_cacheKey: { source, cacheKey } } })
      if (cached) return cached.payload as T
    } catch {
      // Coffre indisponible aussi : on remonte l'erreur d'origine plutôt
      // que d'en masquer la vraie cause.
    }
    throw liveError
  }

  try {
    const prisma = await getPrisma()
    await prisma.dataCacheEntry.upsert({
      where: { source_cacheKey: { source, cacheKey } },
      create: { source, cacheKey, payload: result as object, fetchedAt: new Date() },
      update: { payload: result as object, fetchedAt: new Date() },
    })
  } catch {
    // L'écriture dans le coffre est un plus (mémoire permanente, repli
    // futur) — un échec ne doit jamais empêcher de renvoyer un résultat
    // fraîchement récupéré à l'appelant.
  }

  return result
}
