import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { projetDeConversation } from "@/lib/conversation-projet"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse
  const { user } = garde

  const { id } = await params
  const prisma = await getPrisma()
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })
  if (!conversation) {
    return NextResponse.json({ success: false, error: "Conversation introuvable." }, { status: 404 })
  }
  // Projet rattaché, seulement s'il est toujours accessible.
  const projet = conversation.projetId ? await projetDeConversation(user, conversation.projetId) : null

  return NextResponse.json({
    success: true,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      projetId: projet?.id ?? null,
      etapeCode: projet ? conversation.etapeCode : null,
      messages: conversation.messages.map((m) => ({ role: m.role.toLowerCase(), content: m.content })),
    },
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse
  const { user } = garde

  const { id } = await params
  const prisma = await getPrisma()
  await prisma.conversation.deleteMany({ where: { id, userId: user.id } })

  return NextResponse.json({ success: true })
}
