"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Check } from "lucide-react"
import { Champ, CHAMP, Dialogue } from "@/components/dialogue"
import { ChoixEtape } from "@/components/projet/choix-etape"
import { publierElement, type ElementProjet } from "@/components/projet/elements"
import { chargerProjetsAccessibles, lienProjet, type ProjetAccessible } from "@/lib/projet-suivi"
import { trouverEtape } from "@/lib/referentiel"

// « Joindre au projet » (2026-09-30, maquette validée « Fil, dossier et
// études ») : une copie d'une réponse d'Archiaccess AI rejoint le dossier
// du projet et le fil de l'étape choisie. La conversation, elle, reste
// privée. Projet et étape de la conversation sont proposés d'office. Sur
// téléphone la fenêtre s'ouvre en volet depuis le bas (components/dialogue).

// Titre proposé : la première ligne utile de la réponse, sans balisage.
function titreDepuis(texte: string): string {
  const ligne =
    texte
      .split("\n")
      .map((l) => l.replace(/^[#>\-*\d.)\s]+/, "").replace(/[*_`]/g, "").trim())
      .find((l) => l.length > 3) ?? ""
  return ligne.length > 120 ? `${ligne.slice(0, 117).trimEnd()}…` : ligne
}

export function JoindreAuProjet({
  texte,
  projetId,
  etapeCode,
  onFermer,
  onJoint,
}: {
  texte: string
  projetId?: string | null
  etapeCode?: string | null
  onFermer: () => void
  // Pour que la page du projet ouverte affiche aussitôt la réponse jointe.
  onJoint?: (projetId: string, element: ElementProjet) => void
}) {
  const [projets, setProjets] = useState<ProjetAccessible[] | null>(null)
  const [choix, setChoix] = useState<string>(projetId ?? "")
  const [etape, setEtape] = useState(etapeCode && trouverEtape(etapeCode) ? etapeCode : "")
  const [titre, setTitre] = useState(() => titreDepuis(texte))
  const [message, setMessage] = useState("")
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [fait, setFait] = useState<{ projet: ProjetAccessible; etape: string | null } | null>(null)

  useEffect(() => {
    void chargerProjetsAccessibles().then((l) => {
      setProjets(l)
      setChoix((c) => (c && l.some((p) => p.id === c) ? c : l[0]?.id ?? ""))
    })
  }, [])

  const projet = projets?.find((p) => p.id === choix) ?? null
  const nbMembres = projet?.membres?.length ?? 0
  const visibilite = !projet
    ? ""
    : projet.espace === "COLLABORATIF"
      ? `Visible par ${nbMembres > 1 ? `les ${nbMembres} membres` : "les membres"} du projet, avec votre nom et la date.`
      : "Projet personnel : visible par vous seul, avec la date."
  // Projets proposés : celui de la conversation en tête.
  const liste = projets ? [...projets].sort((a, b) => (a.id === projetId ? -1 : b.id === projetId ? 1 : 0)) : []

  async function joindre(e: React.FormEvent) {
    e.preventDefault()
    if (!projet || !titre.trim() || enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      const element = await publierElement(projet.id, { type: "REPONSE_IA", etapeCode: etape || null, titre, texte, message })
      onJoint?.(projet.id, element)
      setFait({ projet, etape: etape || null })
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Impossible de joindre la réponse.")
    } finally {
      setEnCours(false)
    }
  }

  if (fait) {
    const et = fait.etape ? trouverEtape(fait.etape) : null
    return (
      <Dialogue titre="Réponse jointe" onFermer={onFermer}>
        <p className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
          <Check size={18} className="mt-0.5 shrink-0" />
          <span>
            Elle est dans le dossier de <b>{fait.projet.nom}</b>
            {et ? (
              <>
                {" "}
                et dans le fil de l'étape <b>{et.code} {et.titre}</b>
              </>
            ) : null}
            .
          </span>
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFermer} className="liquid-glass-pill rounded-xl px-4 py-2 text-[13px] font-semibold">
            Fermer
          </button>
          <Link
            href={fait.etape ? lienProjet(fait.projet, fait.etape) : `${lienProjet(fait.projet)}?vue=dossier`}
            className="chrome-black flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-medium text-white"
          >
            {fait.etape ? "Ouvrir l'étape" : "Ouvrir le dossier"}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </Dialogue>
    )
  }

  return (
    <Dialogue
      titre="Joindre au projet"
      sousTitre="Une copie de cette réponse rejoint le dossier et le fil de l'étape. Votre conversation reste privée."
      onFermer={onFermer}
    >
      <form onSubmit={joindre} className="flex flex-col gap-3.5">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[12.5px] font-semibold">Projet</legend>
          {!projets && <p className="text-[13px] text-muted-foreground">Chargement…</p>}
          {projets && projets.length === 0 && (
            <p className="text-[13px] text-muted-foreground">Aucun projet ouvert pour l'instant : créez-en un dans l'espace projet.</p>
          )}
          <div className="custom-scrollbar flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {liste.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-[13.5px] ${p.id === choix ? "border-foreground shadow-[0_0_0_0.5px_var(--foreground)]" : "border-foreground/10"}`}
              >
                <input type="radio" name="projet" value={p.id} checked={p.id === choix} onChange={() => setChoix(p.id)} className="accent-foreground" />
                <span className="min-w-0 flex-1 truncate">{p.nom}</span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">{p.espace === "COLLABORATIF" ? "Espace collaboratif" : "Mon espace"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Champ libelle="Étape">
          <ChoixEtape valeur={etape} onChange={setEtape} />
        </Champ>
        <Champ libelle="Titre">
          <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={300} className={CHAMP} />
        </Champ>
        <Champ libelle="Message pour l'équipe (facultatif)">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Ex. : à relire par le chef de projet avant envoi" className={`${CHAMP} resize-y`} />
        </Champ>
        {visibilite && <p className="text-[12.5px] text-muted-foreground">{visibilite}</p>}
        {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFermer} className="liquid-glass-pill rounded-xl px-4 py-2 text-[13px] font-semibold">
            Annuler
          </button>
          <button type="submit" disabled={!projet || !titre.trim() || enCours} className="chrome-black rounded-xl px-5 py-2 text-[13px] font-medium text-white disabled:opacity-40">
            {enCours ? "Envoi…" : "Joindre"}
          </button>
        </div>
      </form>
    </Dialogue>
  )
}
