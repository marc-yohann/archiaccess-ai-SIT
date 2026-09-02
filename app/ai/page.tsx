"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Plus, Trash2, LogOut, Home, Menu, X, Settings, MapPin } from "lucide-react"
import { AuthGate, useUser } from "@/components/auth-gate"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ConversationSummary {
  id: string
  title: string | null
  updatedAt: string
}

// Convention posée côté /sit (voir app/sit/page.tsx::sendAiMessage) pour
// signaler qu'une conversation vient d'une recherche du tableau de bord
// fédéré plutôt que d'avoir été démarrée ici — pas de colonne dédiée en
// base (éviterait une migration Prisma, actuellement bloquée, voir
// CLAUDE.md "Pièges" sur le bastion SSM), juste un préfixe de titre.
const SIT_PREFIX = "SIT · "

function parseConversationTitle(title: string | null): { label: string; sitSubject: string | null } {
  if (title?.startsWith(SIT_PREFIX)) {
    const subject = title.slice(SIT_PREFIX.length)
    return { label: subject, sitSubject: subject }
  }
  return { label: title ?? "Nouvelle conversation", sitSubject: null }
}

const SUGGESTIONS = [
  "Rédige un mail pour informer un client d'un retard de chantier",
  "Quelles sont les étapes pour déclarer un aléa sur un chantier ?",
  "Résume les points clés d'une mission OPC",
  "Prépare une trame de compte-rendu de réunion de chantier",
]

export default function AiPage() {
  return (
    <AuthGate logoSrc="/logo-ai.png" appName="Archiaccess AI">
      {/* useSearchParams() (voir ?prefill= plus bas) exige un ancêtre
          Suspense côté build Next.js. */}
      <Suspense fallback={null}>
        <Chat />
      </Suspense>
    </AuthGate>
  )
}

function Chat() {
  const user = useUser()
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  function loadConversations() {
    fetch("/api/mistral/conversations")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setConversations(data.conversations)
      })
      .catch(() => {})
  }

  // Reprise depuis /sit : le bouton "Ouvrir dans AI" du panneau intégré au
  // SIT amène ici avec ?prefill=<ce qui a été trouvé> — préremplit la
  // barre de saisie sans envoyer automatiquement, pour que l'employé
  // relise/complète avant d'envoyer.
  const searchParams = useSearchParams()
  useEffect(() => {
    const prefill = searchParams.get("prefill")
    if (prefill) setInput(prefill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function openConversation(id: string) {
    const res = await fetch(`/api/mistral/conversations/${id}`)
    const data = await res.json()
    if (data.success) {
      setConversationId(data.conversation.id)
      setMessages(data.conversation.messages)
    }
  }

  function newConversation() {
    setConversationId(undefined)
    setMessages([])
    setInput("")
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/mistral/conversations/${id}`, { method: "DELETE" })
    if (id === conversationId) newConversation()
    loadConversations()
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.reload()
  }

  async function send(e: React.FormEvent, prefill?: string) {
    e.preventDefault()
    const text = (prefill ?? input).trim()
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
        loadConversations()
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `Erreur : ${data.error}` }])
      }
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="glass-scene relative flex h-screen w-full overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`liquid-glass-panel fixed inset-y-0 left-0 z-30 flex h-full w-72 shrink-0 flex-col gap-3 p-4 transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Image src="/logo-ai.png" alt="Archiaccess AI" width={36} height={36} />
            <span className="text-sm font-medium">Archiaccess AI</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden" aria-label="Fermer le menu">
            <X size={18} />
          </button>
        </div>
        <button
          onClick={newConversation}
          className="chrome-black flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-white"
        >
          <Plus size={16} />
          Nouvelle conversation
        </button>
        <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
          {conversations.map((c) => {
            const { label, sitSubject } = parseConversationTitle(c.title)
            return (
              <div
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-black/5 ${
                  c.id === conversationId ? "liquid-glass-soft" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {sitSubject && (
                    <span
                      className="inline-flex shrink-0 items-center rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      title="Conversation démarrée depuis une recherche du SIT"
                    >
                      SIT
                    </span>
                  )}
                  <span className="truncate">{label}</span>
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-60">
                  {sitSubject && (
                    <Link
                      href={`/sit?resume=${encodeURIComponent(sitSubject)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:!opacity-100"
                      aria-label="Reprendre dans le SIT"
                      title="Reprendre dans le SIT"
                    >
                      <MapPin size={14} />
                    </Link>
                  )}
                  <button
                    onClick={(e) => deleteConversation(c.id, e)}
                    className="hover:!opacity-100"
                    aria-label="Supprimer la conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-1 border-t border-black/10 pt-3 text-sm text-muted-foreground">
          <span className="truncate px-1">{user.name}</span>
          <Link href="/" className="flex items-center gap-2 rounded-lg px-1 py-1 hover:underline">
            <Home size={14} />
            Accueil
          </Link>
          {user.isAdmin && (
            <Link href="/admin" className="flex items-center gap-2 rounded-lg px-1 py-1 hover:underline">
              <Settings size={14} />
              Administration
            </Link>
          )}
          <button onClick={logout} className="flex items-center gap-2 rounded-lg px-1 py-1 text-left hover:underline">
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 p-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">
            <Menu size={20} />
          </button>
          <Image src="/logo-ai.png" alt="Archiaccess AI" width={24} height={24} />
          <span className="text-sm font-medium">Archiaccess AI</span>
        </div>
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            <Image src="/logo-ai.png" alt="Archiaccess AI" width={112} height={112} />
            <div>
              <h1 className="text-xl font-medium">Prêt à vous aider, {user.name.split(" ")[0]} ?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Posez une question sur vos études AMO/OPC ou vos tâches du quotidien.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={(e) => send(e, s)}
                  className="liquid-glass-soft rounded-full px-4 py-2 text-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="custom-scrollbar mx-auto w-full max-w-3xl flex-1 space-y-3 overflow-y-auto p-6">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <span
                  className={
                    m.role === "user"
                      ? "chrome-black inline-block max-w-[80%] rounded-2xl px-3 py-2 text-sm text-white"
                      : "liquid-glass-soft inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm"
                  }
                >
                  {m.content}
                </span>
              </div>
            ))}
            {isSending && (
              <div className="text-left">
                <span className="liquid-glass-soft inline-block rounded-2xl px-3 py-2 text-sm text-muted-foreground">
                  Archiaccess AI écrit…
                </span>
              </div>
            )}
          </div>
        )}

        <form onSubmit={send} className="mx-auto flex w-full max-w-3xl gap-2 p-4 pt-0">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Poser une question…"
            className="liquid-glass-inset flex-1 rounded-xl px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={isSending}
            className="chrome-black rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Envoyer
          </button>
        </form>
      </div>
    </main>
  )
}
