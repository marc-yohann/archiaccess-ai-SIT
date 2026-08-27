"use client"

import { useState } from "react"
import Link from "next/link"
import { AuthGate } from "@/components/auth-gate"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export default function AiPage() {
  return (
    <AuthGate>
      <Chat />
    </AuthGate>
  )
}

function Chat() {
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isSending) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setIsSending(true)
    try {
      const res = await fetch("/api/mistral/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      })
      const data = await res.json()
      if (data.success) {
        setConversationId(data.conversationId)
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `Erreur : ${data.error}` }])
      }
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">Archiaccess AI</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          Accueil
        </Link>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className="inline-block max-w-[80%] rounded-lg border px-3 py-2 text-sm">{m.content}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Poser une question…"
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isSending}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </main>
  )
}
