"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

// Fenêtre par-dessus la page (lot fil / dossier / études, 2026-09-30) :
// centrée sur ordinateur et tablette, volet montant du bas de l'écran sur
// téléphone (maquette validée « Fil, dossier et études »). Rendue dans
// <body> : un parent en verre dépoli (backdrop-filter) deviendrait sinon le
// repère de position:fixed. Échap et un clic hors de la fenêtre ferment.

export function Dialogue({
  titre,
  sousTitre,
  onFermer,
  children,
  large = false,
}: {
  titre: string
  sousTitre?: React.ReactNode
  onFermer: () => void
  children: React.ReactNode
  large?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null
    const premier =
      ref.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      ref.current?.querySelector<HTMLElement>("input:not([type=radio]):not([type=file]), textarea, select")
    premier?.focus()
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer()
    }
    document.addEventListener("keydown", touche)
    const defilement = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", touche)
      document.body.style.overflow = defilement
      precedent?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-[rgba(22,26,32,0.32)]" onClick={onFermer} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={`custom-scrollbar relative flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-[26px] bg-[#f5f6f8] p-5 pb-8 shadow-[0_-20px_50px_-20px_rgba(16,20,28,0.5)] sm:rounded-[22px] sm:p-6 sm:shadow-[0_30px_70px_-25px_rgba(16,20,28,0.55)] ${large ? "sm:max-w-[40rem]" : "sm:max-w-[32rem]"}`}
      >
        <div className="mx-auto -mt-1 h-1 w-10 shrink-0 rounded-full bg-foreground/20 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight tracking-[-0.02em] sm:text-[22px]">{titre}</h2>
            {sousTitre && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{sousTitre}</p>}
          </div>
          <button type="button" onClick={onFermer} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

// Libellé + champ, même présentation dans toutes les fenêtres.
export function Champ({ libelle, children, aide }: { libelle: string; children: React.ReactNode; aide?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[12.5px] font-semibold">
      {libelle}
      {children}
      {aide && <span className="text-[11.5px] font-normal text-muted-foreground">{aide}</span>}
    </label>
  )
}

export const CHAMP = "w-full rounded-xl border border-foreground/10 bg-white px-3 py-2 text-[13.5px] font-normal outline-none focus:border-foreground/30"
