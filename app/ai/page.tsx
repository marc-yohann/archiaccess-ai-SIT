"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Plus, Trash2, Menu, X, MapPin, Copy, Check, RefreshCw, ArrowRight, FolderKanban, Paperclip } from "lucide-react"
import { JoindreAuProjet } from "@/components/projet/joindre-projet"
import { AuthGate, useUser } from "@/components/auth-gate"
import { AutoGrowTextarea } from "@/components/auto-grow-textarea"
import { SitNav } from "@/components/sit-nav"
import { AccueilAI, BandeauProjet, lienProjet, type EspaceProjet, type ProjetAI } from "@/components/ai/accueil"
import { chargerProjetsAccessibles, lireProjetSuivi, suivreProjet } from "@/lib/projet-suivi"
import { trouverEtape } from "@/lib/referentiel"
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
  // Projet et étape de rattachement (jonction au SIT), seulement si le
  // projet est encore accessible.
  projet: { id: string; nom: string; espace: EspaceProjet } | null
  etapeCode: string | null
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
  // « Joindre au projet » : réponse dont une copie va au dossier d'un projet.
  const [aJoindre, setAJoindre] = useState<string | null>(null)
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
    void chargerProjetsAccessibles().then(setProjets)
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
    // Sans projet transmis, on part du projet suivi dans le SIT (s'il
    // n'est plus accessible, il n'apparaît pas dans la liste des projets
    // et le choix reste « Sans projet »).
    setProjetId(searchParams.get("projet") ?? (conversation ? null : lireProjetSuivi()?.id ?? null))
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
      // La conversation garde son projet et son étape : ils reviennent en
      // contexte à l'ouverture.
      setProjetId(data.conversation.projetId ?? null)
      setEtapeCode(data.conversation.etapeCode ?? null)
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

  // « Travailler sur » de l'accueil : le choix devient aussi le projet
  // suivi dans le SIT (et « Sans projet » n'en suit plus aucun).
  function travaillerSur(id: string | null) {
    choisirProjet(id)
    const p = projets?.find((x) => x.id === id)
    suivreProjet(p ? { id: p.id, nom: p.nom, espace: p.espace } : null)
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/mistral/conversations/${id}`, { method: "DELETE" })
    if (id === conversationId) newConversation()
    loadConversations()
  }

  // Projet et étape transmis avec chaque question : la conversation y est
  // rattachée en base, et le serveur reconstruit le contexte du projet (le
  // même que celui du panneau de l'espace projet). « Sans projet » (null)
  // détache la conversation.
  type Rattachement = { projetId: string | null; etapeCode: string | null }
  const rattachementCourant: Rattachement = { projetId: projet?.id ?? null, etapeCode: projet ? etapeCode : null }

  // Toute panne (réseau, réponse non-JSON d'un plantage inattendu côté
  // serveur...) retombe sur ce message plutôt que de laisser l'appelant
  // planter en silence — voir CLAUDE.md, incident "l'IA ne répond plus"
  // (2026-09-07) : un rejet de promesse non rattrapé ne montrait
  // strictement rien à l'employé.
  async function fetchReply(text: string, rattachement = rattachementCourant, idConversation = conversationId) {
    try {
      const res = await fetch("/api/mistral/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: idConversation, message: text, ...rattachement }),
      })
      return await res.json()
    } catch {
      return { success: false, error: "Le copilote est temporairement indisponible. Réessayez dans quelques instants." }
    }
  }

  async function envoyer(text: string, rattachement = rattachementCourant, idConversation = conversationId) {
    text = text.trim()
    if (!text || isSending) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: text }])
    setIsSending(true)
    try {
      const data = await fetchReply(text, rattachement, idConversation)
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
      { projetId: p.id, etapeCode: et.code },
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

  // Liste rangée par projet (rattachement en base). Chaque conversation
  // garde un lien vers l'endroit du SIT d'où elle vient : son projet, le
  // tableau de bord d'un des deux espaces, ou la recherche (adresse,
  // entreprise).
  const listeConversations = conversations.map((c) => {
    const t = parseConversationTitle(c.title)
    const retour = c.projet
      ? { href: lienProjet(c.projet, c.etapeCode), titre: c.etapeCode ? "Ouvrir l'étape" : "Ouvrir le projet" }
      : t.sitSubject === "Tableau de bord"
        ? { href: "/sit", titre: "Ouvrir le tableau de bord" }
        : t.sitSubject === "Projets collaboratifs"
          ? { href: "/sit/equipe", titre: "Ouvrir l'espace collaboratif" }
          : t.sitSubject
            ? { href: `/sit/recherche?resume=${encodeURIComponent(t.sitSubject)}`, titre: "Reprendre dans le SIT" }
            : null
    // Dans un groupe de projet, le titre répète le nom du projet : on
    // affiche plutôt l'étape quand elle est connue.
    const etapeConv = c.etapeCode ? trouverEtape(c.etapeCode) : undefined
    const label = c.projet && t.sitSubject === c.projet.nom ? (etapeConv ? `${etapeConv.code} ${etapeConv.titre}` : "Tout le projet") : t.label
    return { ...c, ...t, label, retour }
  })
  const groupes: { cle: string; titre: string; conversations: typeof listeConversations }[] = []
  for (const c of listeConversations) {
    const cle = c.projet?.id ?? "general"
    let g = groupes.find((x) => x.cle === cle)
    if (!g) {
      g = { cle, titre: c.projet?.nom ?? "Général", conversations: [] }
      groupes.push(g)
    }
    g.conversations.push(c)
  }
  // « Général » en dernier, les projets par conversation la plus récente.
  groupes.sort((x, y) => Number(x.cle === "general") - Number(y.cle === "general"))

  function ouvrir(id: string) {
    void openConversation(id)
  }

  return (
    <main className="glass-scene flex h-[100dvh] w-full flex-col gap-4 overflow-hidden p-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
      <SitNav titre="Archiaccess AI" logo="/logo-ai.png" />

      {/* Sous 1024 px (téléphone, tablette en portrait), la liste des
          conversations s'ouvre en volet pour laisser toute la largeur à
          la conversation. */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex min-h-0 flex-1 gap-4">
        <aside
          className={`liquid-glass-panel fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col gap-2 rounded-r-[22px] p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] transition-transform duration-200 max-lg:bg-white lg:static lg:z-auto lg:w-[270px] lg:translate-x-0 lg:rounded-[22px] lg:pt-3 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Conversations"
        >
          <div className="flex items-center justify-between gap-2 lg:hidden">
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
            {groupes.map((g) => (
              <div key={g.cle} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between px-2 pb-1 pt-2 text-xs font-bold text-muted-foreground">
                  <span className="truncate">{g.titre}</span>
                  <span className="font-mono font-medium">{g.conversations.length}</span>
                </div>
                {g.conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => ouvrir(c.id)}
                    className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium ${
                      c.id === conversationId ? "glass-on font-semibold" : "hover:bg-white/60"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{c.label}</span>
                      <span className="block text-[11.5px] font-normal text-muted-foreground">
                        {new Date(c.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                      </span>
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
                          {c.projet ? <FolderKanban size={14} /> : <MapPin size={14} />}
                        </Link>
                      )}
                      <button onClick={(e) => deleteConversation(c.id, e)} className="hover:!opacity-100" aria-label="Supprimer la conversation">
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 lg:hidden">
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
              onChoisirProjet={travaillerSur}
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
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAJoindre(m.content)}
                            title="Joindre une copie de cette réponse au dossier d'un projet"
                            className="chrome-black flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-xs font-medium text-white"
                          >
                            <Paperclip size={13} />
                            Joindre au projet
                          </button>
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
              {aJoindre !== null && (
                <JoindreAuProjet texte={aJoindre} projetId={projet?.id ?? null} etapeCode={projet ? etapeCode : null} onFermer={() => setAJoindre(null)} />
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
              Le corpus du SIT est consulté à chaque question. Archiaccess AI prépare ; vous relisez et décidez.
            </p>
          </form>
        </section>
      </div>
    </main>
  )
}
