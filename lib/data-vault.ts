// "Coffre" du SIT — voir CLAUDE.md, décision utilisateur du 2026-08-31.
// Enveloppe chaque connecteur externe (lib/data-sources/*) : la source
// est toujours interrogée en direct (données à jour, esprit "terminal de
// trading"), mais le résultat est systématiquement conservé dans
// DataCacheEntry — jamais supprimé, jamais purgé. Sert de mémoire
// permanente ET de repli si l'API externe est indisponible. L'échec
// d'une lecture/écriture du coffre lui-même (base indisponible) ne doit
// jamais faire échouer la recherche — c'est un plus, pas une dépendance.

import { randomUUID } from "node:crypto"
import { after } from "next/server"
import { getPrisma } from "@/lib/prisma"

// Écriture dans le coffre (audit du 2026-10-03) :
// - après la réponse (after()) : la recherche n'attend plus l'écriture ;
//   hors d'une requête (script), écriture immédiate ;
// - le contenu n'est réécrit que s'il a changé. fetchedAt est toujours mis
//   à jour (« recherches récentes ») ; un contenu identique garde sa
//   valeur stockée, sans nouvelle copie du JSON volumineux, ce qui ménage
//   l'espace disque de la base (voir le garde-fou de stockage BOAMP).
async function ecrireDansLeCoffre(source: string, cacheKey: string, result: unknown): Promise<void> {
  try {
    const prisma = await getPrisma()
    const payload = JSON.stringify(result ?? null)
    await prisma.$executeRaw`
      INSERT INTO "DataCacheEntry" ("id", "source", "cacheKey", "payload", "fetchedAt", "createdAt")
      VALUES (${randomUUID()}, ${source}, ${cacheKey}, ${payload}::jsonb, now(), now())
      ON CONFLICT ("source", "cacheKey") DO UPDATE SET
        "fetchedAt" = now(),
        "payload" = CASE
          WHEN "DataCacheEntry"."payload" IS DISTINCT FROM EXCLUDED."payload" THEN EXCLUDED."payload"
          ELSE "DataCacheEntry"."payload"
        END
    `
  } catch {
    // L'écriture dans le coffre est un plus (mémoire permanente, repli
    // futur) : un échec ne doit jamais empêcher de renvoyer un résultat
    // fraîchement récupéré à l'appelant.
  }
}

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
    after(() => ecrireDansLeCoffre(source, cacheKey, result))
  } catch {
    await ecrireDansLeCoffre(source, cacheKey, result)
  }

  return result
}
