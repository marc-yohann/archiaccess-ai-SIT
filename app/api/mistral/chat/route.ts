import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { chatCompletion, type MistralMessage } from "@/lib/mistral"
import { searchSimilarChunks } from "@/lib/rag"

// Le prompt système sera enrichi projet par projet (skills internes,
// contexte des études en cours) à mesure que le hub de données existera —
// volontairement minimal pour ce premier échange fonctionnel.
const SYSTEM_PROMPT =
  "Tu es Archiaccess AI, l'assistant technique interne du bureau d'études d'Archiaccess. " +
  "Tu accompagnes les collaborateurs dans leurs études AMO/OPC (technique, financier, foncier). " +
  "Si une information dépend d'une source de données externe non encore connectée, dis-le clairement plutôt que d'inventer un chiffre."

export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { conversationId, message } = (await request.json()) as {
    conversationId?: string
    message?: string
  }
  if (!message?.trim()) {
    return NextResponse.json({ success: false, error: "Message vide." }, { status: 400 })
  }

  const prisma = await getPrisma()

  const conversation = conversationId
    ? await prisma.conversation.findUnique({ where: { id: conversationId }, include: { messages: true } })
    : await prisma.conversation.create({ data: { sessionId: token! }, include: { messages: true } })

  if (!conversation) {
    return NextResponse.json({ success: false, error: "Conversation introuvable." }, { status: 404 })
  }

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "USER", content: message },
  })

  // Contexte SIT : les études/documents déjà indexés (voir lib/rag.ts)
  // les plus proches de la question, s'il y en a. Un échec de recherche
  // (pgvector pas encore branché, aucun document indexé) ne doit pas
  // faire échouer la conversation — le copilote répond alors sans ce
  // contexte, comme avant.
  let contextMessage: MistralMessage | undefined
  try {
    const relevant = await searchSimilarChunks(message)
    if (relevant.length > 0) {
      const context = relevant
        .map((r) => `### ${r.title}\n${r.content}`)
        .join("\n\n---\n\n")
      contextMessage = {
        role: "system",
        content: `Extraits du Système d'Information Technique pertinents pour la question :\n\n${context}`,
      }
    }
  } catch {
    contextMessage = undefined
  }

  const history: MistralMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(contextMessage ? [contextMessage] : []),
    ...conversation.messages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    { role: "user", content: message },
  ]

  const reply = await chatCompletion(history)

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "ASSISTANT", content: reply },
  })

  return NextResponse.json({ success: true, conversationId: conversation.id, reply })
}
