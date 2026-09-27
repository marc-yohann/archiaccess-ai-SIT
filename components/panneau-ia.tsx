"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Send, Sparkles } from "lucide-react"
import { formatReply } from "@/lib/format-reply"

// Panneau Archiaccess AI intégré (tableau de bord, espace projet). Même
// route que /ai et que le panneau de la recherche (/api/mistral/chat),
// avec un contexte explicite construit par la page appelante : le
// copilote voit le projet et l'étape en cours sans que l'ingénieur les
// retape. La conversation est persistée comme toutes les autres (visible
// dans /ai sous le titre fourni).
//
// `demande` permet à la page d'envoyer une question depuis un bouton
// (« Préparer avec Archiaccess AI ») : chaque nouvel `id` déclenche un envoi.

interface MessageIA {
  role: "user" | "assistant"
  content: string
}

export function PanneauIA({
  titreConversation,
  contexte,
  intro,
  suggestions,
  demande,
}: {
  titreConversation: string
  contexte: string
  intro: string
  suggestions: string[]
  demande?: { id: number; texte: string } | null
}) {
  const [messages, setMessages] = useState<MessageIA[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [saisie, setSaisie] = useState("")
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [copie, setCopie] = useState<number | null>(null)
  const finRef = useRef<HTMLDivElement>(null)
  // Le contexte change à chaque sélection d'étape : toujours envoyer le
  // plus récent, même depuis un envoi déclenché par effet.
  const contexteRef = useRef(contexte)
  contexteRef.current = contexte
  const conversationRef = useRef<string | null>(null)
  conversationRef.current = conversationId

  async function envoyer(texte: string) {
    const message = texte.trim()
    if (!message || enCours) return
    setSaisie("")
    setErreur(null)
    setMessages((m) => [...m, { role: "user", content: message }])
    setEnCours(true)
    try {
      const r = await fetch("/api/mistral/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationRef.current ?? undefined,
          message,
          context: contexteRef.current,
          title: titreConversation,
        }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error ?? "Archiaccess AI est indisponible.")
      setConversationId(d.conversationId)
      setMessages((m) => [...m, { role: "assistant", content: d.reply }])
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Archiaccess AI est indisponible.")
    } finally {
      setEnCours(false)
    }
  }

  const derniereDemande = useRef<number | null>(null)
  useEffect(() => {
    if (demande && demande.id !== derniereDemande.current) {
      derniereDemande.current = demande.id
      void envoyer(demande.texte)
    }
    // envoyer lit ses entrées par ref : seule une nouvelle demande compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demande?.id])

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" })
  }, [messages, enCours])

  async function copier(i: number, texte: string) {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(i)
      setTimeout(() => setCopie(null), 1500)
    } catch {
      // Presse-papiers indisponible : rien à signaler de plus.
    }
  }

  return (
    <aside className="liquid-glass-panel flex h-full min-h-0 flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} />
        <h2 className="text-sm font-semibold">Archiaccess AI</h2>
      </div>

      <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {messages.length === 0 && (
          <>
            <p className="liquid-glass-inset rounded-xl p-3 text-xs leading-relaxed">{intro}</p>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void envoyer(s)}
                  disabled={enCours}
                  className="liquid-glass-pill rounded-xl px-3 py-2 text-left text-xs disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="text-right">
              <span className="chrome-black inline-block max-w-[90%] rounded-2xl px-3 py-2 text-left text-xs text-white">{m.content}</span>
            </div>
          ) : (
            <div key={i} className="text-left">
              <span className="liquid-glass-soft relative inline-block max-w-[95%] rounded-2xl px-3 py-2 text-xs">
                <span className="ai-msg-assistant" dangerouslySetInnerHTML={{ __html: formatReply(m.content) }} />
                <button
                  type="button"
                  onClick={() => void copier(i, m.content)}
                  title="Copier la réponse"
                  aria-label="Copier la réponse"
                  className="mt-1 rounded-md p-1 text-muted-foreground/70 hover:bg-black/5 hover:text-foreground"
                >
                  {copie === i ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </span>
            </div>
          ),
        )}
        {enCours && <p className="text-xs text-muted-foreground">Archiaccess AI rédige…</p>}
        {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        <div ref={finRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void envoyer(saisie)
        }}
        className="liquid-glass-soft flex items-center gap-2 rounded-xl px-3 py-2"
      >
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Poser une question…"
          aria-label="Question à Archiaccess AI"
          className="flex-1 bg-transparent text-xs outline-none"
        />
        <button
          type="submit"
          disabled={enCours || !saisie.trim()}
          aria-label="Envoyer"
          className="chrome-black flex h-8 w-8 items-center justify-center rounded-lg text-white disabled:opacity-40"
        >
          <Send size={13} />
        </button>
      </form>
    </aside>
  )
}
