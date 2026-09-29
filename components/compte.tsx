"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Home, LogOut, Settings } from "lucide-react"
import { useUser } from "@/components/auth-gate"

// Menu du compte (direction « Verre dépoli », 2026-09-29) : avatar aux
// initiales, nom, rôle, puis Accueil, Administration (administrateurs
// seulement) et Déconnexion. Deux présentations : `bloc` (bas de la barre
// latérale d'Archiaccess AI) et `MenuCompte` (avatar de l'en-tête du SIT
// qui ouvre le même contenu en menu déroulant).

export function initiales(nom: string) {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return "?"
  const premier = mots[0][0] ?? ""
  const dernier = mots.length > 1 ? mots[mots.length - 1][0] ?? "" : ""
  return (premier + dernier).toUpperCase()
}

async function deconnexion() {
  await fetch("/api/auth/logout", { method: "POST" })
  window.location.href = "/"
}

export function Avatar({ nom, taille = 34 }: { nom: string; taille?: number }) {
  return (
    <span
      aria-hidden="true"
      className="chrome-black inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: taille, height: taille, fontSize: Math.round(taille * 0.34) }}
    >
      {initiales(nom)}
    </span>
  )
}

function ContenuCompte({ surClic }: { surClic?: () => void }) {
  const user = useUser()
  const lien = "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-semibold transition-colors hover:bg-white/80"
  return (
    <>
      <div className="mb-1 flex items-center gap-2.5 border-b border-foreground/[0.07] px-2 pb-3 pt-1.5">
        <Avatar nom={user.name} taille={32} />
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight">{user.name}</div>
          <div className="text-xs text-muted-foreground">{user.isAdmin ? "Administrateur" : "Collaborateur"}</div>
        </div>
      </div>
      <Link href="/" onClick={surClic} className={lien}>
        <Home size={16} className="shrink-0" />
        Accueil
      </Link>
      {user.isAdmin && (
        <Link href="/admin" onClick={surClic} className={lien}>
          <Settings size={16} className="shrink-0" />
          Administration
        </Link>
      )}
      <div className="my-1 border-t border-foreground/[0.07]" />
      <button type="button" onClick={deconnexion} className={`${lien} text-left text-destructive`}>
        <LogOut size={16} className="shrink-0" />
        Déconnexion
      </button>
    </>
  )
}

export function BlocCompte() {
  return (
    <div className="liquid-glass-soft flex flex-col gap-0.5 rounded-2xl p-2">
      <ContenuCompte />
    </div>
  )
}

export function MenuCompte() {
  const user = useUser()
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ouvert) return
    function fermer(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOuvert(false)
        return
      }
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener("mousedown", fermer)
    document.addEventListener("keydown", fermer)
    return () => {
      document.removeEventListener("mousedown", fermer)
      document.removeEventListener("keydown", fermer)
    }
  }, [ouvert])
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={`Compte de ${user.name}`}
        className="flex rounded-full ring-[3px] ring-white/70 transition-shadow hover:ring-white"
      >
        <Avatar nom={user.name} />
      </button>
      {ouvert && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-40 flex w-72 flex-col gap-0.5 rounded-[18px] border border-white bg-white/95 p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.08),0_18px_40px_-16px_rgba(16,24,40,0.35)] backdrop-blur-xl"
        >
          <ContenuCompte surClic={() => setOuvert(false)} />
        </div>
      )}
    </div>
  )
}
