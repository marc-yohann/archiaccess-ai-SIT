"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
// Import statique : le fichier est servi sous /_next/static/media/, déjà
// couvert par CloudFront. Un chemin /logo-ai-puce.png tomberait sur la
// Lambda (pas de comportement CloudFront pour ce nom) et renverrait 404.
import logoPuce from "@/public/logo-ai-puce.png"
import { Check, Copy, Maximize2, PanelRightClose, Plus, Send, X } from "lucide-react"
import { formatReply } from "@/lib/format-reply"

// Panneau Archiaccess AI intégré (tableau de bord, espace projet). Même
// route que /ai et que le panneau de la recherche (/api/mistral/chat),
// avec un contexte explicite construit par la page appelante : le
// copilote voit le projet et l'étape en cours sans que l'ingénieur les
// retape. La conversation est persistée comme toutes les autres.
//
// Modulable (demande utilisateur, même principe que le panneau de
// /sit/recherche) : largeur réglable en glissant le bord gauche, panneau
// repliable en bande étroite, « Nouvelle conversation », « Plein écran »
// qui reprend la même conversation dans /ai. Largeur et repli sont
// mémorisés par navigateur (simple confort, localStorage protégé).
//
// Sur tablette et téléphone (moins de 1024 px), pas de panneau latéral :
// un bouton flottant « Archiaccess AI » ouvre la même conversation en
// plein écran, pour ne jamais masquer le contenu de la page.
//
// `demande` permet à la page d'envoyer une question depuis un bouton
// (« Préparer avec Archiaccess AI ») : chaque nouvel `id` déclenche un
// envoi, et rouvre le panneau s'il était replié.

interface MessageIA {
  role: "user" | "assistant"
  content: string
}

const LARGEUR_MIN = 300
const LARGEUR_MAX = 720
const CLE_LARGEUR = "sit.panneau-ia.largeur"
const CLE_REPLIE = "sit.panneau-ia.replie"
const GRAND_ECRAN = "(min-width: 1024px)"

// Largeur « lg » de Tailwind : panneau latéral au-dessus, plein écran
// à la demande en dessous.
function useGrandEcran(): boolean {
  const [grand, setGrand] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia(GRAND_ECRAN)
    const maj = () => setGrand(mq.matches)
    maj()
    mq.addEventListener("change", maj)
    return () => mq.removeEventListener("change", maj)
  }, [])
  return grand
}

function lire(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle)
  } catch {
    return null
  }
}
function ecrire(cle: string, valeur: string) {
  try {
    window.localStorage.setItem(cle, valeur)
  } catch {
    // Stockage indisponible (navigation privée...) : préférence non retenue.
  }
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
  const [largeur, setLargeur] = useState(360)
  const [replie, setReplie] = useState(false)
  const [ouvertMobile, setOuvertMobile] = useState(false)
  const grandEcran = useGrandEcran()
  const finRef = useRef<HTMLDivElement>(null)
  // Le contexte change à chaque sélection d'étape : toujours envoyer le
  // plus récent, même depuis un envoi déclenché par effet.
  const contexteRef = useRef(contexte)
  contexteRef.current = contexte
  const conversationRef = useRef<string | null>(null)
  conversationRef.current = conversationId

  useEffect(() => {
    const l = Number(lire(CLE_LARGEUR))
    if (l >= LARGEUR_MIN && l <= LARGEUR_MAX) setLargeur(l)
    setReplie(lire(CLE_REPLIE) === "1")
  }, [])

  function replier(v: boolean) {
    setReplie(v)
    ecrire(CLE_REPLIE, v ? "1" : "0")
  }

  function debutRedimension(e: React.PointerEvent) {
    e.preventDefault()
    const depart = e.clientX
    const largeurDepart = largeur
    let derniere = largeurDepart
    function bouger(ev: PointerEvent) {
      derniere = Math.min(LARGEUR_MAX, Math.max(LARGEUR_MIN, largeurDepart + (depart - ev.clientX)))
      setLargeur(derniere)
    }
    function fin() {
      window.removeEventListener("pointermove", bouger)
      window.removeEventListener("pointerup", fin)
      document.body.style.cursor = ""
      ecrire(CLE_LARGEUR, String(derniere))
    }
    document.body.style.cursor = "col-resize"
    window.addEventListener("pointermove", bouger)
    window.addEventListener("pointerup", fin)
  }

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

  function nouvelleConversation() {
    setMessages([])
    setConversationId(null)
    setErreur(null)
    setSaisie("")
  }

  const derniereDemande = useRef<number | null>(null)
  useEffect(() => {
    if (demande && demande.id !== derniereDemande.current) {
      derniereDemande.current = demande.id
      replier(false)
      setOuvertMobile(true)
      void envoyer(demande.texte)
    }
    // envoyer lit ses entrées par ref : seule une nouvelle demande compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demande?.id])

  // Défile uniquement la zone des messages, jamais la page entière (un
  // scrollIntoView faisait sauter la page en bas à l'ouverture d'un projet
  // sur téléphone).
  useEffect(() => {
    const zone = finRef.current?.parentElement
    if (zone) zone.scrollTop = zone.scrollHeight
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

  if (!grandEcran && !ouvertMobile) {
    return (
      <button
        type="button"
        onClick={() => setOuvertMobile(true)}
        className="chrome-black fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-40 md:bottom-4 flex items-center gap-2 rounded-[18px] p-3 text-sm font-semibold text-white sm:py-2.5 sm:pl-3 sm:pr-4"
        aria-label="Ouvrir Archiaccess AI"
      >
        {/* Téléphone : le pictogramme seul, pour ne pas masquer le texte
            en dessous ; libellé complet à partir de la tablette. */}
        <Image src={logoPuce} alt="" width={30} height={30} className="shrink-0 invert sm:size-6" />
        <span className="hidden sm:inline">Archiaccess AI</span>
        {messages.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-white px-1.5 text-[10px] leading-4 text-foreground sm:static">
            {messages.length}
          </span>
        )}
      </button>
    )
  }

  if (grandEcran && replie) {
    return (
      <aside className="liquid-glass-panel flex h-full w-14 shrink-0 rounded-[22px]">
        <button
          type="button"
          onClick={() => replier(false)}
          className="flex h-full w-full flex-col items-center justify-start gap-2 pt-5 text-muted-foreground hover:text-foreground"
          title="Afficher Archiaccess AI"
          aria-label="Afficher Archiaccess AI"
        >
          <Image src={logoPuce} alt="" width={28} height={28} />
          <span className="text-sm font-medium [writing-mode:vertical-rl]">Archiaccess AI</span>
          {messages.length > 0 && <span className="rounded-full bg-foreground/80 px-1.5 text-[10px] text-white">{messages.length}</span>}
        </button>
      </aside>
    )
  }

  return (
    <>
      {!grandEcran && <div className="glass-scene fixed inset-0 z-40" aria-hidden="true" onClick={() => setOuvertMobile(false)} />}
    <aside
      className={
        grandEcran
          ? "liquid-glass-panel relative flex h-full w-[var(--largeur-ia)] shrink-0 flex-col gap-3 rounded-[22px] p-4"
          : "liquid-glass-panel fixed inset-2 z-50 flex flex-col gap-3 rounded-[22px] p-4"
      }
      style={{ "--largeur-ia": `${largeur}px` } as React.CSSProperties}
      aria-label="Archiaccess AI"
    >
      {grandEcran && (
        <div
          onPointerDown={debutRedimension}
          className="group absolute -left-2 top-0 z-10 h-full w-4 cursor-col-resize"
          title="Glisser pour élargir ou réduire"
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/15 transition-colors group-hover:bg-foreground/40" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Image src={logoPuce} alt="" width={24} height={24} />
        <h2 className="text-[14.5px] font-bold">Archiaccess AI</h2>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={nouvelleConversation}
            disabled={messages.length === 0}
            className="liquid-glass-btn rounded-lg p-1.5 text-muted-foreground disabled:opacity-40"
            title="Nouvelle conversation"
            aria-label="Nouvelle conversation"
          >
            <Plus size={14} />
          </button>
          {conversationId && (
            <Link
              href={`/ai?conversation=${conversationId}`}
              className="liquid-glass-btn rounded-lg p-1.5 text-muted-foreground"
              title="Continuer en plein écran"
              aria-label="Continuer en plein écran"
            >
              <Maximize2 size={14} />
            </Link>
          )}
          {grandEcran ? (
            <button
              type="button"
              onClick={() => replier(true)}
              className="liquid-glass-btn rounded-lg p-1.5 text-muted-foreground"
              title="Replier le panneau"
              aria-label="Replier le panneau"
            >
              <PanelRightClose size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOuvertMobile(false)}
              className="liquid-glass-btn rounded-lg p-2 text-muted-foreground"
              aria-label="Fermer Archiaccess AI"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        {messages.length === 0 && (
          <>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{intro}</p>
            <div className="mt-1 flex flex-col gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void envoyer(s)}
                  disabled={enCours}
                  className="liquid-glass-soft rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-shadow hover:shadow-md disabled:opacity-50"
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
              <span className="chrome-black inline-block max-w-[88%] rounded-[18px] rounded-br-md px-3.5 py-2.5 text-left text-[13px] text-white">{m.content}</span>
            </div>
          ) : (
            <div key={i} className="text-left">
              <div className="liquid-glass-soft inline-block max-w-[96%] rounded-[18px] rounded-bl-md px-3.5 py-2.5 text-[13px]">
                <div className="ai-msg-assistant" dangerouslySetInnerHTML={{ __html: formatReply(m.content) }} />
                <button
                  type="button"
                  onClick={() => void copier(i, m.content)}
                  title="Copier la réponse"
                  aria-label="Copier la réponse"
                  className="mt-1 rounded-md p-1 text-muted-foreground/70 hover:bg-black/5 hover:text-foreground"
                >
                  {copie === i ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
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
        className="flex items-center gap-2 rounded-[14px] border border-white bg-white/90 py-1.5 pl-3.5 pr-1.5 shadow-[0_6px_18px_-10px_rgba(16,24,40,0.3)]"
      >
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Poser une question…"
          aria-label="Question à Archiaccess AI"
          className="flex-1 bg-transparent text-[13px] outline-none"
        />
        <button
          type="submit"
          disabled={enCours || !saisie.trim()}
          aria-label="Envoyer"
          className="chrome-black flex h-8 w-8 items-center justify-center rounded-[10px] text-white disabled:opacity-40"
        >
          <Send size={13} />
        </button>
      </form>
    </aside>
    </>
  )
}
