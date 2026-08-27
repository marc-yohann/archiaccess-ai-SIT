// Client minimal pour l'API Mistral (chat completions) — pas de SDK
// officiel ajouté pour l'instant, l'API REST est simple et évite une
// dépendance de plus. À étoffer (streaming, function calling pour les
// futurs skills) une fois le premier échange validé en conditions réelles.

import { getMistralApiKey } from "@/lib/secrets"

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"
// Repli temporaire sur "medium" : mistral-large-latest timeout
// systématiquement (0 octet reçu après 30-45s, testé avec deux clés API
// différentes) alors que small/medium répondent en <1s — voir CLAUDE.md.
// À rebasculer sur mistral-large-latest une fois le blocage résolu côté
// compte Mistral.
const MODEL = "mistral-medium-latest"

export interface MistralMessage {
  role: "system" | "user" | "assistant"
  content: string
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
    throw new Error(`Mistral API a répondu ${res.status} : ${body}`)
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ""
}
