"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, Check, ChevronDown, FolderKanban, X } from "lucide-react"
import { chargerProjetsAccessibles, lienProjet, suivreProjet, useProjetSuivi, type ProjetAccessible } from "@/lib/projet-suivi"

// Projet suivi dans l'en-tête du SIT (maquette validée le 2026-09-29,
// « Projet relié ») : on voit sur quel projet on travaille, on l'ouvre, on
// en change ou on n'en suit plus aucun, d'un clic. La liste ne propose que
// les projets accessibles ; un projet suivi qui ne l'est plus est oublié à
// son ouverture.
export function ChoixProjetSuivi() {
  const suivi = useProjetSuivi()
  const [ouvert, setOuvert] = useState(false)
  const [projets, setProjets] = useState<ProjetAccessible[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    let actif = true
    void chargerProjetsAccessibles().then((liste) => {
      if (!actif) return
      setProjets(liste)
      if (suivi && !liste.some((p) => p.id === suivi.id)) suivreProjet(null)
    })
    const fermer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false)
    }
    document.addEventListener("mousedown", fermer)
    document.addEventListener("keydown", echap)
    return () => {
      actif = false
      document.removeEventListener("mousedown", fermer)
      document.removeEventListener("keydown", echap)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert])

  return (
    <div ref={ref} className="relative min-w-0 max-md:w-full md:ml-auto">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="true"
        className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-xl pl-1.5 pr-2.5 text-[13px] md:h-[38px] md:w-auto md:max-w-[18rem] ${suivi ? "bg-white shadow-[0_0_0_1.5px_var(--foreground)]" : "liquid-glass-pill text-muted-foreground hover:text-foreground"}`}
      >
        <span className={`flex size-[26px] shrink-0 items-center justify-center rounded-lg ${suivi ? "chrome-black text-white" : "bg-white/70"}`}>
          <FolderKanban size={13} />
        </span>
        {suivi ? (
          <span className="min-w-0 flex-1 truncate text-left">
            <span className="text-muted-foreground">Projet : </span>
            <b className="font-semibold">{suivi.nom}</b>
          </span>
        ) : (
          <span className="flex-1 whitespace-nowrap text-left font-semibold">Suivre un projet</span>
        )}
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>
      {ouvert && (
        <div className="absolute right-0 top-full z-40 mt-2 w-full rounded-2xl border border-white/70 bg-white/95 p-2 shadow-xl backdrop-blur-xl md:w-[20rem]">
          {suivi && (
            <Link
              href={lienProjet(suivi)}
              onClick={() => setOuvert(false)}
              className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold hover:bg-foreground/[0.04]"
            >
              Ouvrir le projet
              <ArrowUpRight size={14} />
            </Link>
          )}
          <p className="px-2.5 pb-1 pt-2 text-[12.5px] font-medium text-muted-foreground">
            {suivi ? "Suivre un autre projet" : "Choisir le projet sur lequel vous travaillez"}
          </p>
          <div className="custom-scrollbar max-h-64 overflow-y-auto">
            {!projets && <p className="px-2.5 py-2 text-sm text-muted-foreground">Chargement…</p>}
            {projets?.length === 0 && <p className="px-2.5 py-2 text-sm text-muted-foreground">Aucun projet pour l'instant.</p>}
            {projets?.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  suivreProjet({ id: p.id, nom: p.nom, espace: p.espace })
                  setOuvert(false)
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm ${p.id === suivi?.id ? "bg-foreground/[0.06] font-semibold" : "hover:bg-foreground/[0.04]"}`}
                aria-current={p.id === suivi?.id ? "true" : undefined}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.nom}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{p.espace === "COLLABORATIF" ? "Espace collaboratif" : "Mon espace"}</span>
                </span>
                {p.id === suivi?.id && <Check size={14} className="shrink-0" />}
              </button>
            ))}
          </div>
          {suivi && (
            <button
              type="button"
              onClick={() => {
                suivreProjet(null)
                setOuvert(false)
              }}
              className="mt-1 flex w-full items-center gap-2 border-t border-foreground/10 px-2.5 pt-2 text-[13px] text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
              Ne plus suivre de projet
            </button>
          )}
        </div>
      )}
    </div>
  )
}
