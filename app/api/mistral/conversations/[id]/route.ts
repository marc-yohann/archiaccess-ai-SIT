import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const prisma = await getPrisma()
  const conversation = await prisma.conversation.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })
  if (!conversation) {
    return NextResponse.json({ success: false, error: "Conversation introuvable." }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages.map((m) => ({ role: m.role.toLowerCase(), content: m.content })),
    },
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  const user = await getSessionUser(token)
  if (!user) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { id } = await params
  const prisma = await getPrisma()
  await prisma.conversation.deleteMany({ where: { id, userId: user.id } })

  return NextResponse.json({ success: true })
}
