"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { ArrowUpRight, Download, Paperclip } from "lucide-react"
import { formatReply } from "@/lib/format-reply"
import logoPuce from "@/public/logo-ai-puce.png"

// Éléments du dossier d'un projet et fil des étapes (2026-09-30, maquette
// validée « Fil, dossier et études ») : notes signées et datées, fichiers
// déposés, réponses d'Archiaccess AI jointes, liens. Lus et écrits par
// /api/sit/projets/[id]/elements ; le serveur dit qui peut retirer quoi.

export type TypeElement = "NOTE" | "FICHIER" | "REPONSE_IA" | "LIEN"

export interface ElementProjet {
  id: string
  type: TypeElement
  etapeCode: string | null
  titre: string | null
  texte: string | null
  message: string | null
  url: string | null
  nomFichier: string | null
  mimeType: string | null
  tailleOctets: number | null
  createdAt: string
  auteur: { id: string; name: string } | null
  peutRetirer: boolean
}

export const FICHIER_MAX_OCTETS = 4 * 1024 * 1024

export function initialesDe(nom: string | null | undefined): string {
  const mots = (nom ?? "").trim().split(/\s+/).filter(Boolean)
  if (!mots.length) return "?"
  return ((mots[0][0] ?? "") + (mots.length > 1 ? mots[mots.length - 1][0] : "")).toUpperCase()
}

export function Avatar({ nom, petit = false }: { nom: string | null | undefined; petit?: boolean }) {
  return (
    <span
      className={`chrome-black flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${petit ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[11px]"}`}
      aria-hidden="true"
    >
      {initialesDe(nom)}
    </span>
  )
}

const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString()

// « aujourd'hui, 09:05 », « hier, 18:20 », « 26 sept., 16:40 ».
export function dateHeure(iso: string): string {
  const d = new Date(iso)
  const maintenant = new Date()
  const hier = new Date(maintenant)
  hier.setDate(hier.getDate() - 1)
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  if (memeJour(d, maintenant)) return `aujourd'hui, ${heure}`
  if (memeJour(d, hier)) return `hier, ${heure}`
  const jour = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(d.getFullYear() !== maintenant.getFullYear() ? { year: "numeric" } : {}) })
  return `${jour}, ${heure}`
}

export function dateCourte(iso: string): string {
  const d = new Date(iso)
  const maintenant = new Date()
  if (memeJour(d, maintenant)) return "aujourd'hui"
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(d.getFullYear() !== maintenant.getFullYear() ? { year: "numeric" } : {}) })
}

export function tailleLisible(octets: number | null): string {
  if (octets === null) return ""
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`
}

export function extension(nom: string | null): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(nom ?? "")
  return m ? m[1].toUpperCase() : "FICHIER"
}

export const lienFichier = (projetId: string, elementId: string) => `/api/sit/projets/${projetId}/elements/${elementId}/fichier`

export const ACTION_FIL: Record<TypeElement, string> = {
  NOTE: "note",
  FICHIER: "a déposé un fichier",
  REPONSE_IA: "a joint une réponse d'Archiaccess AI",
  LIEN: "a ajouté un lien",
}

// Corps d'un élément, commun au fil de l'étape et au dossier.
export function ContenuElement({ projetId, e }: { projetId: string; e: ElementProjet }) {
  const [entier, setEntier] = useState(false)
  if (e.type === "NOTE") return <p className="whitespace-pre-wrap break-words">{e.texte}</p>
  if (e.type === "FICHIER")
    return (
      <>
        <a
          href={lienFichier(projetId, e.id)}
          className="liquid-glass-soft flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-white/85"
        >
          <span className="shrink-0 rounded-md border border-foreground/15 bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-semibold">{extension(e.nomFichier)}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{e.nomFichier}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{tailleLisible(e.tailleOctets)}</span>
          <Download size={14} className="shrink-0 text-muted-foreground" />
        </a>
        {e.texte && <p className="whitespace-pre-wrap break-words">{e.texte}</p>}
      </>
    )
  if (e.type === "LIEN")
    return (
      <>
        <a href={e.url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 font-semibold hover:underline">
          <span className="truncate">{e.titre ?? e.url}</span>
          <ArrowUpRight size={13} className="shrink-0" />
        </a>
        {e.texte && <p className="whitespace-pre-wrap break-words">{e.texte}</p>}
      </>
    )
  // Réponse d'Archiaccess AI : même mise en forme que dans la conversation
  // (formatReply échappe le texte avant d'y poser le balisage).
  const texte = e.texte ?? ""
  const long = texte.length > 420
  return (
    <>
      {e.message && <p className="whitespace-pre-wrap break-words">{e.message}</p>}
      <div className="flex flex-col gap-1.5 rounded-xl border border-white/80 bg-white/80 px-3 py-2.5">
        <span className="flex items-center gap-2 text-[13px] font-bold">
          <Image src={logoPuce} alt="" width={15} height={15} className="shrink-0" />
          {e.titre}
        </span>
        <div
          className={`ai-msg-assistant break-words text-[12.5px] leading-relaxed ${entier || !long ? "" : "max-h-24 overflow-hidden text-muted-foreground [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"}`}
          dangerouslySetInnerHTML={{ __html: formatReply(texte) }}
        />
        {long && (
          <button type="button" onClick={() => setEntier((x) => !x)} className="self-start text-[12.5px] font-semibold hover:underline">
            {entier ? "Réduire" : "Lire en entier"}
          </button>
        )}
      </div>
    </>
  )
}

// Envoi d'un fichier (dossier ou fil d'une étape).
export async function deposerFichier(projetId: string, fichier: File, etapeCode: string | null, texte = ""): Promise<ElementProjet> {
  if (fichier.size > FICHIER_MAX_OCTETS) throw new Error("Fichier trop volumineux (4 Mo au maximum).")
  const form = new FormData()
  form.append("fichier", fichier)
  if (etapeCode) form.append("etapeCode", etapeCode)
  if (texte.trim()) form.append("texte", texte.trim())
  const r = await fetch(`/api/sit/projets/${projetId}/elements/fichier`, { method: "POST", body: form })
  const d = await r.json().catch(() => ({ success: false, error: r.status === 413 ? "Fichier trop volumineux (4 Mo au maximum)." : undefined }))
  if (!d.success) throw new Error(d.error ?? "Dépôt impossible.")
  return d.element
}

export async function publierElement(projetId: string, corps: Record<string, unknown>): Promise<ElementProjet> {
  const r = await fetch(`/api/sit/projets/${projetId}/elements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  })
  const d = await r.json().catch(() => ({}))
  if (!d.success) throw new Error(d.error ?? "Enregistrement impossible.")
  return d.element
}

export async function retirerElement(projetId: string, elementId: string): Promise<void> {
  const r = await fetch(`/api/sit/projets/${projetId}/elements/${elementId}`, { method: "DELETE" })
  const d = await r.json().catch(() => ({}))
  if (!d.success) throw new Error(d.error ?? "Retrait impossible.")
}

// Fil de l'étape : entrées du plus ancien au plus récent, puis la zone
// d'écriture (note pour l'équipe, dépôt de fichier). Sur téléphone il se
// lit comme une conversation, la zone d'écriture en bas.
export function FilEtape({
  projetId,
  etapeCode,
  elements,
  visibilite,
  onAjout,
  onRetrait,
}: {
  projetId: string
  etapeCode: string
  elements: ElementProjet[]
  visibilite: string
  onAjout: (e: ElementProjet) => void
  onRetrait: (id: string) => void
}) {
  const [texte, setTexte] = useState("")
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const fichierRef = useRef<HTMLInputElement>(null)

  async function executer(action: () => Promise<void>) {
    setEnCours(true)
    setErreur(null)
    try {
      await action()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Action impossible.")
    } finally {
      setEnCours(false)
    }
  }

  const publier = () =>
    executer(async () => {
      if (!texte.trim()) return
      onAjout(await publierElement(projetId, { type: "NOTE", etapeCode, texte }))
      setTexte("")
    })

  const deposer = (f: File) =>
    executer(async () => {
      // Le texte en cours d'écriture accompagne le fichier.
      onAjout(await deposerFichier(projetId, f, etapeCode, texte))
      setTexte("")
    })

  const retirer = (id: string) =>
    executer(async () => {
      await retirerElement(projetId, id)
      onRetrait(id)
    })

  return (
    <section className="flex flex-col gap-3" aria-label="Fil de l'étape">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[15px] font-bold">Fil de l'étape</h3>
        <span className="text-xs text-muted-foreground">{visibilite}</span>
      </div>
      {elements.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          Rien pour l'instant. Une note, un fichier ou une réponse d'Archiaccess AI jointe apparaîtront ici, signés et datés.
        </p>
      )}
      <ol className="flex flex-col gap-3">
        {elements.map((e) => (
          <li key={e.id} className="flex gap-2.5">
            <Avatar nom={e.auteur?.name} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] leading-relaxed">
              <div className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
                <b className="font-semibold text-foreground">{e.auteur?.name ?? "Ancien membre"}</b>
                <span>· {dateHeure(e.createdAt)}</span>
                {e.type !== "NOTE" && <span>· {ACTION_FIL[e.type]}</span>}
                {e.peutRetirer && (
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => void retirer(e.id)}
                    className="ml-auto font-medium hover:text-destructive disabled:opacity-50"
                  >
                    Retirer
                  </button>
                )}
              </div>
              <ContenuElement projetId={projetId} e={e} />
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 rounded-[16px] border border-foreground/10 bg-white p-2.5 sm:flex-row sm:items-end">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void publier()
          }}
          rows={2}
          placeholder="Écrire une note pour l'équipe…"
          aria-label="Note pour l'équipe"
          className="min-h-[2.5rem] flex-1 resize-y bg-transparent px-1.5 py-1 text-[13px] outline-none"
        />
        <div className="flex shrink-0 gap-2">
          <input
            ref={fichierRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void deposer(f)
            }}
          />
          <button
            type="button"
            disabled={enCours}
            onClick={() => fichierRef.current?.click()}
            className="liquid-glass-pill flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50 sm:flex-none"
          >
            <Paperclip size={13} />
            Déposer un fichier
          </button>
          <button
            type="button"
            disabled={enCours || !texte.trim()}
            onClick={() => void publier()}
            className="chrome-black flex-1 rounded-xl px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-40 sm:flex-none"
          >
            {enCours ? "Envoi…" : "Publier"}
          </button>
        </div>
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </section>
  )
}
