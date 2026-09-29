"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, CalendarDays, ChevronDown, FolderKanban, History, X } from "lucide-react"
import logoPuce from "@/public/logo-ai-puce.png"
import type { ProjetResume } from "@/components/projet/carte-projet"
import { trouverEtape } from "@/lib/referentiel"
import { estTraitee, joursRestants } from "@/lib/referentiel/avancement"
import type { Etape } from "@/lib/referentiel/types"

// Accueil et bandeau de projet d'Archiaccess AI depuis sa jonction au SIT
// (maquette validée le 2026-09-29, artefact « Navigation SIT et
// Archiaccess AI ») : on choisit sur quel projet on travaille, on reprend
// une conversation, ou on part de ce que le SIT signale (retards,
// échéances proches). Rien n'est inventé : sans projet ni échéance, des
// états vides explicites.

export type EspaceProjet = "PERSONNEL" | "COLLABORATIF"
export interface ProjetAI extends ProjetResume {
  espace: EspaceProjet
}

export function lienProjet(p: ProjetAI, etapeCode?: string | null) {
  const base = p.espace === "COLLABORATIF" ? `/sit/equipe/${p.id}` : `/sit/projets/${p.id}`
  return etapeCode ? `${base}?etape=${encodeURIComponent(etapeCode)}` : base
}

const HORIZON_JOURS = 14
const PROJETS_EN_TETE = 3

function ChoixProjet({
  projets,
  projetId,
  onChoisir,
}: {
  projets: ProjetAI[]
  projetId: string | null
  onChoisir: (id: string | null) => void
}) {
  const enTete = projets.slice(0, PROJETS_EN_TETE)
  const autres = projets.slice(PROJETS_EN_TETE)
  const pastille = (actif: boolean) =>
    `rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-colors ${actif ? "bg-white shadow-[0_0_0_1.5px_var(--foreground)]" : "liquid-glass-pill hover:bg-white"}`
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-[13px] font-semibold text-muted-foreground">Travailler sur</span>
      {/* Téléphone : un seul menu déroulant, les pastilles prendraient
          tout l'écran. */}
      <label className="liquid-glass-pill relative flex items-center rounded-xl py-1.5 pl-3 pr-7 text-[13px] font-semibold sm:hidden">
        <span className="sr-only">Projet</span>
        <select value={projetId ?? ""} onChange={(e) => onChoisir(e.target.value || null)} className="max-w-[60vw] appearance-none truncate bg-transparent outline-none">
          <option value="">Sans projet</option>
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-2.5" />
      </label>
      <span className="hidden flex-wrap items-center justify-center gap-2 sm:flex">
      <button type="button" onClick={() => onChoisir(null)} className={pastille(projetId === null)}>
        Sans projet
      </button>
      {enTete.map((p) => (
        <button key={p.id} type="button" onClick={() => onChoisir(p.id)} className={pastille(projetId === p.id)}>
          {p.nom}
        </button>
      ))}
      {autres.length > 0 && (
        <label className="liquid-glass-pill relative flex items-center gap-1 rounded-xl px-3 py-1.5 text-[13px] font-medium">
          <span className="sr-only">Autre projet</span>
          <select
            value={autres.some((p) => p.id === projetId) ? projetId ?? "" : ""}
            onChange={(e) => onChoisir(e.target.value || null)}
            className="appearance-none bg-transparent pr-4 outline-none"
          >
            <option value="">Autre projet</option>
            {autres.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2" />
        </label>
      )}
      </span>
    </div>
  )
}

export function AccueilAI({
  prenom,
  projets,
  projetId,
  onChoisirProjet,
  conversations,
  onOuvrirConversation,
  onPreparer,
  suggestions,
  onSuggestion,
}: {
  prenom: string
  projets: ProjetAI[] | null
  projetId: string | null
  onChoisirProjet: (id: string | null) => void
  conversations: { id: string; label: string; updatedAt: string }[]
  onOuvrirConversation: (id: string) => void
  onPreparer: (projet: ProjetAI, etape: Etape) => void
  suggestions: string[]
  onSuggestion: (texte: string) => void
}) {
  // Ce que le SIT signale : étapes non traitées en retard ou à échéance
  // dans les 14 jours, sur tous les projets accessibles (mêmes règles que
  // « À traiter » du tableau de bord).
  const signaux = (projets ?? [])
    .flatMap((p) =>
      p.etapes
        .filter((e) => e.echeance && !estTraitee(e.statut) && joursRestants(e.echeance) <= HORIZON_JOURS)
        .map((e) => ({ projet: p, etat: e, etape: trouverEtape(e.etapeCode) })),
    )
    .filter((x): x is typeof x & { etape: Etape } => Boolean(x.etape))
    .sort((a, b) => (a.etat.echeance! < b.etat.echeance! ? -1 : 1))
    .slice(0, 4)

  const quand = (iso: string) => {
    const j = joursRestants(iso)
    if (j < 0) return { texte: `En retard de ${-j} jour${j === -1 ? "" : "s"}`, retard: true }
    if (j === 0) return { texte: "Aujourd'hui", retard: false }
    return { texte: `Dans ${j} jour${j === 1 ? "" : "s"}`, retard: false }
  }

  return (
    <div className="custom-scrollbar flex flex-1 flex-col items-center gap-5 overflow-y-auto px-1 py-4 md:py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image src="/logo-ai.png" alt="" width={64} height={64} className="hidden rounded-[18px] shadow-[0_18px_36px_-22px_rgba(30,40,60,0.5)] sm:block" />
        <h1 className="text-balance text-[22px] font-bold leading-tight tracking-[-0.025em] sm:text-[28px]">Bonjour {prenom}, sur quoi travaillez-vous ?</h1>
      </div>

      {projets && projets.length > 0 && <ChoixProjet projets={projets} projetId={projetId} onChoisir={onChoisirProjet} />}

      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
        <section className="liquid-glass-panel flex flex-col gap-1 rounded-[22px] p-4">
          <h2 className="mb-1 flex items-center gap-2.5 text-[15px] font-bold tracking-tight">
            <span className="glass-icon size-7 rounded-[9px]">
              <History size={15} />
            </span>
            Reprendre
          </h2>
          {conversations.length === 0 && <p className="text-sm text-muted-foreground">Aucune conversation pour l'instant.</p>}
          {conversations.slice(0, 4).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOuvrirConversation(c.id)}
              className="flex items-center gap-3 border-t border-foreground/[0.06] py-2.5 text-left first-of-type:border-t-0 hover:opacity-80"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{c.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                </span>
              </span>
              <ArrowUpRight size={14} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
        </section>

        <section className="liquid-glass-panel flex flex-col gap-1 rounded-[22px] p-4">
          <h2 className="mb-1 flex items-center justify-between gap-2 text-[15px] font-bold tracking-tight">
            <span className="flex items-center gap-2.5">
              <span className="glass-icon size-7 rounded-[9px]">
                <CalendarDays size={15} />
              </span>
              Dans vos projets
            </span>
            <span className="text-xs font-normal text-muted-foreground">depuis le SIT</span>
          </h2>
          {projets === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {projets && signaux.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune étape en retard ni d'échéance dans les {HORIZON_JOURS} prochains jours.</p>
          )}
          {signaux.map(({ projet, etat, etape }) => {
            const q = quand(etat.echeance!)
            return (
              <div key={`${projet.id}-${etape.code}`} className="flex items-start gap-3 border-t border-foreground/[0.06] py-2.5 first-of-type:border-t-0">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">
                    <span className="font-mono text-muted-foreground">{etape.code}</span> {etape.titre}
                  </span>
                  <span className="block text-xs text-muted-foreground">{projet.nom}</span>
                  <span
                    className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${q.retard ? "bg-destructive/10 text-destructive" : "bg-foreground/[0.06] text-foreground/80"}`}
                  >
                    {q.texte}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onPreparer(projet, etape)}
                  className="liquid-glass-btn flex shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-semibold"
                >
                  <Image src={logoPuce} alt="" width={14} height={14} />
                  Préparer
                </button>
              </div>
            )
          })}
        </section>
      </div>

      <div className="flex max-w-4xl flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => onSuggestion(s)} className="liquid-glass-pill rounded-full px-4 py-2 text-[13px] font-medium">
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// Bandeau au-dessus de la conversation quand un projet est choisi : on
// voit sur quoi Archiaccess AI travaille, on revient à l'étape dans le SIT,
// on change ou on retire le projet.
export function BandeauProjet({
  projet,
  etape,
  projets,
  onChoisir,
}: {
  projet: ProjetAI
  etape: Etape | null
  projets: ProjetAI[]
  onChoisir: (id: string | null) => void
}) {
  return (
    <div className="liquid-glass-soft flex items-center gap-2.5 rounded-2xl py-2 pl-3 pr-2">
      <span className="glass-icon size-7 rounded-[9px]">
        <FolderKanban size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px]">
        <b className="font-semibold">{projet.nom}</b>
        <span className="text-muted-foreground"> · {etape ? `Étape ${etape.code} ${etape.titre}` : "tout le projet"}</span>
      </span>
      <label className="liquid-glass-btn relative hidden items-center rounded-[10px] py-1.5 pl-2.5 pr-6 text-xs font-medium sm:flex">
        <span className="sr-only">Changer de projet</span>
        <select value={projet.id} onChange={(e) => onChoisir(e.target.value || null)} className="appearance-none bg-transparent outline-none">
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2" />
      </label>
      <Link
        href={lienProjet(projet, etape?.code)}
        className="chrome-black flex shrink-0 items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-xs font-semibold text-white"
      >
        {etape ? "Ouvrir l'étape" : "Ouvrir le projet"}
        <ArrowUpRight size={13} />
      </Link>
      <button
        type="button"
        onClick={() => onChoisir(null)}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/70 hover:text-foreground"
        title="Travailler sans projet"
        aria-label="Travailler sans projet"
      >
        <X size={14} />
      </button>
    </div>
  )
}
