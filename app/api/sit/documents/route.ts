import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { indexDocument } from "@/lib/rag"

export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { title, sourceType, content } = (await request.json()) as {
    title?: string
    sourceType?: string
    content?: string
  }
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ success: false, error: "Titre et contenu requis." }, { status: 400 })
  }

  try {
    const documentId = await indexDocument({
      title: title.trim(),
      sourceType: sourceType?.trim() || "etude",
      content,
    })
    return NextResponse.json({ success: true, documentId })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 500 },
    )
  }
}
