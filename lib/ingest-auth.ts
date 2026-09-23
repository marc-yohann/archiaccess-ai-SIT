// Comparaison à temps constant du jeton Bearer d'ingestion — évite une
// fuite d'information par canal auxiliaire (temps de réponse) sur les
// routes protégées par ce jeton unique partagé (voir lib/secrets.ts::
// getIngestToken()). Remplace la comparaison `!==` utilisée jusqu'ici sur
// ces 5 routes ; extrait dans un fichier neutre (pas un route.ts, qui ne
// peut exporter que des handlers HTTP reconnus — voir lib/documents-sit.ts
// pour le même principe).
import { timingSafeEqual } from "crypto"
import { getIngestToken } from "@/lib/secrets"

export async function isValidIngestBearer(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization")
  const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!provided) return false

  const expected = await getIngestToken()
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  // timingSafeEqual exige des buffers de même longueur — une différence de
  // longueur est déjà une non-correspondance, jamais un cas à tenter de
  // comparer (short-circuit intentionnel, pas une fuite exploitable : la
  // longueur du jeton n'est pas un secret en soi).
  if (providedBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(providedBuffer, expectedBuffer)
}
