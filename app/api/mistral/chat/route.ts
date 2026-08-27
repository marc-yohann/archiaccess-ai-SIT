import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { chatCompletion, type MistralMessage } from "@/lib/mistral"

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

  const history: MistralMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
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
