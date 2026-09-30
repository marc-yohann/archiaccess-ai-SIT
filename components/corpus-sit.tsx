"use client"

import { useEffect, useState } from "react"
import { BookOpen, MoreHorizontal, Plus, Users } from "lucide-react"
import { Champ, CHAMP, Dialogue } from "@/components/dialogue"

// « Corpus du SIT » (2026-09-30, maquette validée « Fil, dossier et
// études ») : en bas de l'accueil de la recherche, ce dont Archiaccess AI
// se sert pour tous les collaborateurs — les textes réglementaires (domaine
// public) et les études ajoutées par l'équipe, distinguées par un filtre.
// Une étude affiche son auteur et sa date ; son auteur peut la retirer,
// l'administrateur aussi (revérifié par /api/sit/documents/[id]). Ce qui
// est propre à un projet va dans le dossier du projet, pas ici.

interface DocumentCorpus {
  id: string
  titre: string
  type: "etude" | "texte"
  discipline: string | null
  auteur: string | null
  createdAt: string
  peutRetirer: boolean
}

type Filtre = "tout" | "etude" | "texte"

const date = (iso: string) => {
  const d = new Date(iso)
  const annee = d.getFullYear() !== new Date().getFullYear()
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(annee ? { year: "numeric" } : {}) })
}

export function CorpusSit({ disciplines, onDemander }: { disciplines: string[]; onDemander: (titre: string) => void }) {
  const [documents, setDocuments] = useState<DocumentCorpus[] | null>(null)
  const [filtre, setFiltre] = useState<Filtre>("tout")
  const [ajout, setAjout] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  function charger() {
    fetch("/api/sit/documents")
      .then((r) => r.json())
      .then((d) => setDocuments(d.success ? d.documents : []))
      .catch(() => setDocuments([]))
  }
  useEffect(charger, [])

  async function retirer(id: string) {
    setErreur(null)
    const r = await fetch(`/api/sit/documents/${id}`, { method: "DELETE" })
    const d = await r.json().catch(() => ({}))
    if (!d.success) return setErreur(d.error ?? "Retrait impossible.")
    setDocuments((l) => l?.filter((x) => x.id !== id) ?? l)
  }

  const liste = documents ?? []
  const nbEtudes = liste.filter((d) => d.type === "etude").length
  const nbTextes = liste.length - nbEtudes
  // Les études d'abord (les plus récentes en tête), puis les textes.
  const visibles = liste
    .filter((d) => filtre === "tout" || d.type === filtre)
    .sort((a, b) => (a.type === b.type ? 0 : a.type === "etude" ? -1 : 1))
  const chips: { id: Filtre; libelle: string }[] = [
    { id: "tout", libelle: "Tout" },
    { id: "etude", libelle: `Études · ${nbEtudes}` },
    { id: "texte", libelle: `Textes réglementaires · ${nbTextes}` },
  ]

  return (
    <div className="liquid-glass-panel flex min-w-0 flex-col gap-2.5 rounded-[22px] p-4">
      <div className="flex items-center gap-2.5">
        <span className="glass-icon size-8 rounded-[10px]">
          <BookOpen size={15} />
        </span>
        <h2 className="flex-1 text-[15px] font-bold">Corpus du SIT</h2>
        <button
          type="button"
          onClick={() => setAjout(true)}
          className="chrome-black flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-medium text-white"
        >
          <Plus size={13} />
          Ajouter une étude
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFiltre(c.id)}
            aria-pressed={filtre === c.id}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${filtre === c.id ? "chrome-black text-white" : "border border-foreground/12 bg-white/70 text-muted-foreground hover:text-foreground"}`}
          >
            {c.libelle}
          </button>
        ))}
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      {!documents && <p className="text-xs text-muted-foreground">Chargement…</p>}
      {documents && visibles.length === 0 && (
        <p className="text-xs text-muted-foreground">{filtre === "etude" ? "Aucune étude ajoutée pour l'instant." : "Aucun document pour l'instant."}</p>
      )}
      <ul className="custom-scrollbar flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {visibles.map((d) =>
          d.peutRetirer ? (
            <LigneEtude key={d.id} d={d} onDemander={() => onDemander(d.titre)} onRetirer={() => retirer(d.id)} />
          ) : (
            <li key={d.id} className="liquid-glass-soft flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px]">
              <Pastille type={d.type} />
              <Titre d={d} onDemander={() => onDemander(d.titre)} />
            </li>
          ),
        )}
      </ul>
      <p className="mt-0.5 border-t border-border/40 pt-2.5 text-[0.68rem] leading-relaxed text-muted-foreground">
        Textes réglementaires du domaine public uniquement — Eurocodes, DTU et normes EN (structures, thermique, acoustique de
        salle…) sont protégés AFNOR/CEN et non indexables ici ; Archiaccess AI s'appuie sur ses connaissances générales pour ces
        sujets.
      </p>
      {ajout && (
        <AjoutEtude
          disciplines={disciplines}
          onFermer={() => setAjout(false)}
          onAjoutee={() => {
            setAjout(false)
            setFiltre("etude")
            charger()
          }}
        />
      )}
    </div>
  )
}

// Actions d'une étude retirable, dépliées sous sa ligne (la liste défile :
// un menu flottant y serait coupé).
function LigneEtude({ d, onDemander, onRetirer }: { d: DocumentCorpus; onDemander: () => void; onRetirer: () => Promise<void> }) {
  const [ouvert, setOuvert] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [enCours, setEnCours] = useState(false)
  return (
    <li className="liquid-glass-soft flex shrink-0 flex-col rounded-xl text-[13px]">
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <Pastille type={d.type} />
        <Titre d={d} onDemander={onDemander} />
        <button
          type="button"
          onClick={() => {
            setOuvert((o) => !o)
            setConfirmer(false)
          }}
          aria-expanded={ouvert}
          aria-label={`Actions sur « ${d.titre} »`}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-white/70 hover:text-foreground"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      {ouvert && (
        <div className="flex flex-wrap items-center gap-2 border-t border-foreground/[0.06] px-2.5 py-2 text-[12.5px]">
          {confirmer ? (
            <>
              <span className="text-muted-foreground">Archiaccess AI ne pourra plus la citer.</span>
              <button
                type="button"
                disabled={enCours}
                onClick={() => {
                  setEnCours(true)
                  void onRetirer().finally(() => setEnCours(false))
                }}
                className="chrome-black rounded-lg px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {enCours ? "Retrait…" : "Retirer"}
              </button>
              <button type="button" onClick={() => setConfirmer(false)} className="rounded-lg px-2 py-1 text-xs font-semibold">
                Annuler
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onDemander} className="liquid-glass-pill rounded-lg px-2.5 py-1 text-xs font-semibold">
                Demander à Archiaccess AI
              </button>
              <button type="button" onClick={() => setConfirmer(true)} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-white/60">
                Retirer du SIT
              </button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function Pastille({ type }: { type: DocumentCorpus["type"] }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${type === "etude" ? "chrome-black text-white" : "border border-foreground/12 bg-white"}`}>
      {type === "etude" ? "Étude" : "Texte"}
    </span>
  )
}

function Titre({ d, onDemander }: { d: DocumentCorpus; onDemander: () => void }) {
  return (
    <button type="button" onClick={onDemander} title="Demander à Archiaccess AI ce que dit ce document" className="min-w-0 flex-1 text-left">
      <span className="block truncate font-semibold hover:underline">{d.titre}</span>
      <span className="block truncate text-[11.5px] text-muted-foreground">
        {d.type === "etude" ? [d.auteur, date(d.createdAt), d.discipline].filter(Boolean).join(" · ") : "Domaine public"}
      </span>
    </button>
  )
}

function AjoutEtude({ disciplines, onFermer, onAjoutee }: { disciplines: string[]; onFermer: () => void; onAjoutee: () => void }) {
  const [titre, setTitre] = useState("")
  const [discipline, setDiscipline] = useState("")
  const [texte, setTexte] = useState("")
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || !texte.trim() || enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      const r = await fetch("/api/sit/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titre, discipline, content: texte }),
      })
      const d = await r.json().catch(() => ({}))
      if (!d.success) throw new Error(d.error ?? "Ajout impossible.")
      onAjoutee()
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Ajout impossible.")
      setEnCours(false)
    }
  }

  return (
    <Dialogue
      titre="Ajouter une étude à la base de données du SIT"
      sousTitre="Elle rejoint le corpus du SIT, avec les textes réglementaires."
      onFermer={onFermer}
      large
    >
      <form onSubmit={valider} className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <Champ libelle="Titre">
            <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={300} className={CHAMP} />
          </Champ>
          <Champ libelle="Discipline (facultatif)">
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className={CHAMP}>
              <option value="">Aucune</option>
              {disciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Champ>
        </div>
        <Champ libelle="Texte de l'étude" aide="Séparez les parties par une ligne vide ; titres, listes et gras acceptés.">
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={9} className={`${CHAMP} resize-y`} />
        </Champ>
        <div className="liquid-glass-soft flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed">
          <Users size={16} className="mt-0.5 shrink-0" />
          <span>
            <b>Visible par tous les collaborateurs</b> — Archiaccess AI pourra la citer dans toutes les conversations. Les éléments
            propres à un projet vont dans le dossier du projet.
          </span>
        </div>
        <p className="text-[12.5px] text-muted-foreground">Votre nom et la date sont affichés avec l'étude. Vous pourrez la retirer ; l'administrateur aussi.</p>
        {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFermer} className="liquid-glass-pill rounded-xl px-4 py-2 text-[13px] font-semibold">
            Annuler
          </button>
          <button type="submit" disabled={!titre.trim() || !texte.trim() || enCours} className="chrome-black rounded-xl px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40">
            {enCours ? "Ajout en cours…" : "Ajouter au SIT"}
          </button>
        </div>
      </form>
    </Dialogue>
  )
}
