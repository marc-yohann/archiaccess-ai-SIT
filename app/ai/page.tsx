"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Plus, Trash2, Menu, X, MapPin, Copy, Check, RefreshCw, ArrowRight, FolderKanban } from "lucide-react"
import { AuthGate, useUser } from "@/components/auth-gate"
import { AutoGrowTextarea } from "@/components/auto-grow-textarea"
import { SitNav } from "@/components/sit-nav"
import { AccueilAI, BandeauProjet, lienProjet, type EspaceProjet, type ProjetAI } from "@/components/ai/accueil"
import type { ProjetResume } from "@/components/projet/carte-projet"
import { trouverEtape } from "@/lib/referentiel"
import { contexteProjet } from "@/lib/referentiel/contexte-ia"
import type { Etape } from "@/lib/referentiel/types"
import { formatReply } from "@/lib/format-reply"
import logoPuce from "@/public/logo-ai-puce.png"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  // Question à l'origine de cette réponse — absent sur les messages
  // "user", permet de régénérer sans dupliquer la bulle question (voir
  // regenerate(), même principe que le panneau IA de /sit).
  forText?: string
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
// Même convention pour les panneaux de l'espace projet : « SIT · <projet> »
// (projet personnel) et « Équipe · <projet> » (projet collaboratif).
const EQUIPE_PREFIX = "Équipe · "

function parseConversationTitle(title: string | null): { label: string; sitSubject: string | null } {
  for (const prefixe of [SIT_PREFIX, EQUIPE_PREFIX]) {
    if (title?.startsWith(prefixe)) {
      const subject = title.slice(prefixe.length)
      return { label: subject, sitSubject: subject }
    }
  }
  return { label: title ?? "Nouvelle conversation", sitSubject: null }
}

// Quand un projet est choisi : mêmes suggestions que le panneau du projet.
const SUGGESTIONS_PROJET = [
  "Que dois-je vérifier en priorité sur ce projet ?",
  "Rédige un projet de courrier au maître d'ouvrage",
  "Quels textes s'appliquent à cette opération ?",
]

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
  const [copiedMsgIndex, setCopiedMsgIndex] = useState<number | null>(null)
  // Jonction au SIT (2026-09-29) : projet et étape sur lesquels on
  // travaille. Archiaccess AI reçoit leur contexte à chaque question, comme
  // le panneau du SIT ; « Continuer dans Archiaccess AI » les transmet
  // (?projet=&etape=) pour ne rien perdre en passant au plein écran.
  const [projets, setProjets] = useState<ProjetAI[] | null>(null)
  const [projetId, setProjetId] = useState<string | null>(null)
  const [etapeCode, setEtapeCode] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const projet = projets?.find((p) => p.id === projetId) ?? null
  const etape = projet && etapeCode ? trouverEtape(etapeCode) ?? null : null

  function loadConversations() {
    fetch("/api/mistral/conversations")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setConversations(data.conversations)
      })
      .catch(() => {})
  }

  // Projets accessibles des deux espaces (mêmes routes et mêmes règles
  // d'accès que le SIT), les plus récemment modifiés d'abord.
  useEffect(() => {
    const charger = (espace: EspaceProjet) =>
      fetch(`/api/sit/projets${espace === "COLLABORATIF" ? "?espace=collaboratif" : ""}`)
        .then((r) => r.json())
        .then((d) => (d.success ? (d.projets as ProjetResume[]).map((p) => ({ ...p, espace })) : []))
        .catch(() => [] as ProjetAI[])
    Promise.all([charger("PERSONNEL"), charger("COLLABORATIF")]).then(([perso, equipe]) =>
      setProjets([...perso, ...equipe].filter((p) => !p.archivedAt).sort((x, y) => (x.updatedAt < y.updatedAt ? 1 : -1))),
    )
  }, [])

  // Reprise depuis /sit : le bouton "Ouvrir dans AI" du panneau intégré au
  // SIT amène ici avec ?prefill=<ce qui a été trouvé> — préremplit la
  // barre de saisie sans envoyer automatiquement, pour que l'employé
  // relise/complète avant d'envoyer.
  const searchParams = useSearchParams()
  useEffect(() => {
    const prefill = searchParams.get("prefill")
    if (prefill) setInput(prefill)
    // ?conversation=<id> : « Continuer dans Archiaccess AI » depuis un
    // panneau du SIT — reprend la même conversation (scopée à
    // l'utilisateur côté API, un id d'autrui renvoie 404), avec son projet
    // et son étape (?projet=&etape=) quand ils sont transmis.
    const conversation = searchParams.get("conversation")
    if (conversation) void openConversation(conversation)
    setProjetId(searchParams.get("projet"))
    setEtapeCode(searchParams.get("etape"))
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
      setSidebarOpen(false)
    }
  }

  function newConversation() {
    setConversationId(undefined)
    setMessages([])
    setInput("")
    setSidebarOpen(false)
  }

  function choisirProjet(id: string | null) {
    setProjetId(id)
    setEtapeCode(null)
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/mistral/conversations/${id}`, { method: "DELETE" })
    if (id === conversationId) newConversation()
    loadConversations()
  }

  // Contexte transmis avec chaque question quand un projet est choisi —
  // le même que celui du panneau de l'espace projet.
  const contexteCourant = projet ? contexteProjet(projet, etape) : undefined

  // Toute panne (réseau, réponse non-JSON d'un plantage inattendu côté
  // serveur...) retombe sur ce message plutôt que de laisser l'appelant
  // planter en silence — voir CLAUDE.md, incident "l'IA ne répond plus"
  // (2026-09-07) : un rejet de promesse non rattrapé ne montrait
  // strictement rien à l'employé.
  async function fetchReply(text: string, context = contexteCourant, idConversation = conversationId) {
    try {
      const res = await fetch("/api/mistral/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: idConversation, message: text, context }),
      })
      return await res.json()
    } catch {
      return { success: false, error: "Le copilote est temporairement indisponible. Réessayez dans quelques instants." }
    }
  }

  async function envoyer(text: string, context = contexteCourant, idConversation = conversationId) {
    text = text.trim()
    if (!text || isSending) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setIsSending(true)
    try {
      const data = await fetchReply(text, context, idConversation)
      if (data.success) {
        setConversationId(data.conversationId)
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply, forText: text }])
        loadConversations()
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: `Erreur : ${data.error}` }])
      }
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault()
    void envoyer(input)
  }

  // « Préparer » depuis « Dans vos projets » : même demande que le bouton
  // de l'étape dans le SIT, dans une nouvelle conversation.
  function preparer(p: ProjetAI, et: Etape) {
    setProjetId(p.id)
    setEtapeCode(et.code)
    setConversationId(undefined)
    setMessages([])
    void envoyer(
      `Aide-moi à préparer l'étape ${et.code} « ${et.titre} » pour ce projet : propose une trame pour les livrables attendus et les points à vérifier. Je relirai et déciderai.`,
      contexteProjet(p, et),
      undefined,
    )
  }

  // Régénère une réponse assistant sans dupliquer la bulle "question" —
  // renvoie exactement la même question, remplace juste le contenu de la
  // bulle assistant existante (même principe que app/sit/page.tsx).
  async function regenerate(index: number) {
    const msg = messages[index]
    if (msg.role !== "assistant" || !msg.forText || isSending) return
    setIsSending(true)
    try {
      const data = await fetchReply(msg.forText)
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, content: data.success ? data.reply : `Erreur : ${data.error}` } : m)),
      )
    } finally {
      setIsSending(false)
    }
  }

  async function copyMessage(index: number, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMsgIndex(index)
      setTimeout(() => setCopiedMsgIndex((cur) => (cur === index ? null : cur)), 1400)
    } catch {
      // Presse-papiers indisponible — pas grave, l'employé peut sélectionner/copier à la main.
    }
  }

  // Une conversation née sur un projet (panneau de l'espace projet) est
  // reliée à ce projet : l'ouvrir remet le projet en contexte, et son lien
  // ramène au projet plutôt qu'à une recherche d'adresse.
  const listeConversations = conversations.map((c) => {
    const t = parseConversationTitle(c.title)
    const projetLie = t.sitSubject ? projets?.find((p) => p.nom === t.sitSubject) ?? null : null
    // Retour vers l'endroit du SIT d'où vient la conversation : le projet,
    // le tableau de bord d'un des deux espaces, ou la recherche (adresse,
    // entreprise).
    const retour = projetLie
      ? { href: lienProjet(projetLie), titre: "Ouvrir le projet" }
      : t.sitSubject === "Tableau de bord"
        ? { href: "/sit", titre: "Ouvrir le tableau de bord" }
        : t.sitSubject === "Projets collaboratifs"
          ? { href: "/sit/equipe", titre: "Ouvrir l'espace collaboratif" }
          : t.sitSubject
            ? { href: `/sit/recherche?resume=${encodeURIComponent(t.sitSubject)}`, titre: "Reprendre dans le SIT" }
            : null
    return { ...c, ...t, projetLie, retour }
  })

  function ouvrir(id: string) {
    const c = listeConversations.find((x) => x.id === id)
    if (c?.projetLie) {
      setProjetId(c.projetLie.id)
      setEtapeCode(null)
    }
    void openConversation(id)
  }

  return (
    <main className="glass-scene flex h-[100dvh] w-full flex-col gap-4 overflow-hidden p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
      <SitNav titre="Archiaccess AI" logo="/logo-ai.png" />

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex min-h-0 flex-1 gap-4">
        <aside
          className={`liquid-glass-panel fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col gap-2 rounded-r-[22px] p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] transition-transform duration-200 max-md:bg-white md:static md:z-auto md:w-[270px] md:translate-x-0 md:rounded-[22px] md:pt-3 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Conversations"
        >
          <div className="flex items-center justify-between gap-2 md:hidden">
            <span className="px-1 text-[15px] font-bold">Conversations</span>
            <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5" aria-label="Fermer la liste">
              <X size={18} />
            </button>
          </div>
          <button
            onClick={newConversation}
            className="chrome-black flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
          >
            <Plus size={16} />
            Nouvelle conversation
          </button>
          <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto pt-1">
            {listeConversations.length === 0 && <p className="px-2 py-2 text-[13px] text-muted-foreground">Aucune conversation pour l'instant.</p>}
            {listeConversations.map((c) => (
              <div
                key={c.id}
                onClick={() => ouvrir(c.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium ${
                  c.id === conversationId ? "glass-on font-semibold" : "hover:bg-white/60"
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {c.sitSubject && (
                    <span
                      className="inline-flex shrink-0 items-center rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      title={c.projetLie ? "Conversation sur un projet" : "Conversation démarrée depuis le SIT"}
                    >
                      {c.projetLie ? "Projet" : "SIT"}
                    </span>
                  )}
                  <span className="truncate">{c.label}</span>
                </span>
                <span className="ml-2 flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-60">
                  {c.retour && (
                    <Link
                      href={c.retour.href}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:!opacity-100"
                      aria-label={c.retour.titre}
                      title={c.retour.titre}
                    >
                      {c.projetLie ? <FolderKanban size={14} /> : <MapPin size={14} />}
                    </Link>
                  )}
                  <button onClick={(e) => deleteConversation(c.id, e)} className="hover:!opacity-100" aria-label="Supprimer la conversation">
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="liquid-glass-btn flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold"
            >
              <Menu size={16} />
              Conversations
            </button>
            {messages.length > 0 && (
              <button onClick={newConversation} className="liquid-glass-btn ml-auto rounded-xl p-2" aria-label="Nouvelle conversation">
                <Plus size={16} />
              </button>
            )}
          </div>

          {projet && projets && <BandeauProjet projet={projet} etape={etape} projets={projets} onChoisir={choisirProjet} />}

          {messages.length === 0 ? (
            <AccueilAI
              prenom={user.name.split(" ")[0]}
              projets={projets}
              projetId={projetId}
              onChoisirProjet={choisirProjet}
              conversations={listeConversations}
              onOuvrirConversation={ouvrir}
              onPreparer={preparer}
              suggestions={projet ? SUGGESTIONS_PROJET : SUGGESTIONS}
              onSuggestion={(t) => void envoyer(t)}
            />
          ) : (
            <div ref={scrollRef} className="custom-scrollbar mx-auto w-full max-w-3xl flex-1 space-y-3 overflow-y-auto py-2">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="text-right">
                    <span className="chrome-black inline-block max-w-[80%] rounded-[20px] rounded-br-md px-4 py-3 text-left text-[14.5px] text-white">
                      {m.content}
                    </span>
                  </div>
                ) : (
                  <div key={i} className="text-left">
                    <span className="liquid-glass-panel inline-flex max-w-[88%] gap-3 rounded-[22px] rounded-bl-lg px-5 py-4 text-[14.5px] leading-relaxed">
                      <Image src={logoPuce} alt="" width={24} height={24} className="mt-0.5 hidden size-6 shrink-0 self-start object-contain sm:block" />
                      <span className="min-w-0">
                        <span className="ai-msg-assistant" dangerouslySetInnerHTML={{ __html: formatReply(m.content) }} />
                        <span className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyMessage(i, m.content)}
                            title="Copier la réponse"
                            className="liquid-glass-btn flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            {copiedMsgIndex === i ? <Check size={13} /> : <Copy size={13} />}
                            {copiedMsgIndex === i ? "Copié" : "Copier"}
                          </button>
                          {m.forText && (
                            <button
                              type="button"
                              onClick={() => regenerate(i)}
                              title="Régénérer la réponse"
                              disabled={isSending}
                              className="liquid-glass-btn flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                            >
                              <RefreshCw size={13} />
                              Régénérer
                            </button>
                          )}
                        </span>
                      </span>
                    </span>
                  </div>
                ),
              )}
              {isSending && (
                <div className="text-left">
                  <span className="liquid-glass-panel inline-flex items-center gap-1 rounded-[22px] rounded-bl-lg px-4 py-3.5">
                    <span className="think-dot" />
                    <span className="think-dot" />
                    <span className="think-dot" />
                  </span>
                </div>
              )}
            </div>
          )}

          <form ref={formRef} onSubmit={send} className="mx-auto w-full max-w-4xl">
            <div className="flex items-end gap-2 rounded-[18px] border border-white bg-white/90 p-2 pl-4 shadow-[0_6px_18px_-10px_rgba(16,24,40,0.3)]">
              <AutoGrowTextarea
                ref={inputRef}
                autoFocus
                value={input}
                onChange={setInput}
                onSubmit={() => formRef.current?.requestSubmit()}
                disabled={isSending}
                placeholder={projet ? "Poser une question sur ce projet…" : "Poser une question…"}
                className="flex-1 resize-none bg-transparent py-2 text-[14.5px] outline-none"
              />
              <button
                type="submit"
                disabled={isSending}
                aria-label="Envoyer"
                title="Envoyer"
                className="chrome-black flex size-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50"
              >
                <ArrowRight size={17} />
              </button>
            </div>
            <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
              Le corpus réglementaire est consulté à chaque question. Archiaccess AI prépare ; vous relisez et décidez.
            </p>
          </form>
        </section>
      </div>
    </main>
  )
}
