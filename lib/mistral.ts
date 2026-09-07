// Client minimal pour l'API Mistral (chat completions) — pas de SDK
// officiel ajouté pour l'instant, l'API REST est simple et évite une
// dépendance de plus. À étoffer (streaming, function calling pour les
// futurs skills) une fois le premier échange validé en conditions réelles.

import { getMistralApiKey } from "@/lib/secrets"

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"
// mistral-large-latest : d'abord timeout systématique (incident
// infrastructure Mistral, résolu le 2026-08-29), puis 403
// "tier_not_allowed" constaté le 2026-08-30 ("This model is not available
// in your subscription tier") — un problème différent, côté abonnement
// Mistral cette fois, pas infrastructure. Vérifié en direct : large → 403,
// medium → 200 avec la même clé. Repli sur medium en attendant que
// l'utilisateur vérifie/mette à niveau son plan sur la console Mistral —
// voir CLAUDE.md.
const MODEL = "mistral-medium-latest"

export interface MistralMessage {
  role: "system" | "user" | "assistant"
  content: string
}

// Erreur typée (status HTTP joint) plutôt qu'un Error générique — permet
// à l'appelant (route /api/mistral/chat) de distinguer un simple
// rate-limit (429, transitoire) d'une vraie panne, sans reparser le
// message. Voir CLAUDE.md, piège "l'IA ne répond plus" (2026-09-07) :
// un 429 non attrapé ici faisait planter la route sans réponse JSON, donc
// sans aucun message côté employé — juste un silence.
export class MistralApiError extends Error {
  constructor(public status: number, body: string) {
    super(`Mistral API a répondu ${status} : ${body}`)
    this.name = "MistralApiError"
  }
}

export async function chatCompletion(messages: MistralMessage[]): Promise<string> {
  const apiKey = await getMistralApiKey()

  const res = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new MistralApiError(res.status, body)
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ""
}
