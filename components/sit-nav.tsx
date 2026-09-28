"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { BookOpen, FolderKanban, LayoutDashboard, Search, Users } from "lucide-react"

// En-tête commun aux écrans du SIT centrés sur les projets (tableau de
// bord, projets, méthode) : même logo et mêmes pilules en verre que la
// recherche de données (/sit/recherche).
// `court` : libellé affiché sur téléphone, où les cinq entrées tiennent
// en une rangée d'onglets sans rien couper ni faire défiler.
const OUTILS = [
  { href: "/sit/recherche", label: "Recherche de données", court: "Données", icon: Search, exact: false },
  { href: "/sit/referentiel", label: "Méthode", court: "Méthode", icon: BookOpen, exact: false },
  { href: "/ai", label: "Archiaccess AI", court: "AI", icon: null, exact: false },
]
const LIENS_PERSONNEL = [
  { href: "/sit", label: "Tableau de bord", court: "Accueil", icon: LayoutDashboard, exact: true },
  { href: "/sit/projets", label: "Projets", court: "Projets", icon: FolderKanban, exact: false },
  ...OUTILS,
]
// Espace collaboratif (2026-09-28) : un endroit à part, avec ses propres
// projets ; recherche, méthode et Archiaccess AI restent communs.
const LIENS_EQUIPE = [
  { href: "/sit/equipe", label: "Projets de l'équipe", court: "Équipe", icon: Users, exact: false },
  ...OUTILS,
]
const ESPACE_KEY = "sit.espace"

export function SitNav({ titre, sousTitre }: { titre: string; sousTitre?: React.ReactNode }) {
  const pathname = usePathname()
  // L'espace courant se lit dans l'adresse ; sur les pages communes
  // (recherche, méthode), on garde le dernier espace visité.
  const [dernierEspace, setDernierEspace] = useState<"personnel" | "equipe">("personnel")
  const surEquipe = pathname.startsWith("/sit/equipe")
  const surPersonnel = pathname === "/sit" || pathname.startsWith("/sit/projets")
  useEffect(() => {
    try {
      if (surEquipe) localStorage.setItem(ESPACE_KEY, "equipe")
      else if (surPersonnel) localStorage.setItem(ESPACE_KEY, "personnel")
      else if (localStorage.getItem(ESPACE_KEY) === "equipe") setDernierEspace("equipe")
    } catch {
      // stockage indisponible : on reste sur l'espace personnel
    }
  }, [surEquipe, surPersonnel])
  const equipe = surEquipe || (!surPersonnel && dernierEspace === "equipe")
  const LIENS = equipe ? LIENS_EQUIPE : LIENS_PERSONNEL
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <Image src="/logo-sit.png" alt="Archiaccess SIT" width={40} height={40} className="shrink-0" />
        <div className="min-w-0">
          {sousTitre && <div className="text-xs text-muted-foreground">{sousTitre}</div>}
          <h1 className="line-clamp-2 text-[17px] font-medium leading-snug tracking-tight md:line-clamp-1">{titre}</h1>
        </div>
      </div>
      {/* Bascule entre les deux espaces : mon espace (projets personnels)
          et l'espace collaboratif (projets d'équipe). */}
      <div className="liquid-glass-inset order-first flex w-full gap-0.5 rounded-full p-1 md:order-none md:w-auto" role="group" aria-label="Changer d'espace">
        <Link
          href="/sit"
          aria-current={!equipe ? "true" : undefined}
          className={`flex-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-center text-[13px] font-medium md:flex-none ${!equipe ? "chrome-black text-white" : "text-muted-foreground hover:text-foreground"}`}
        >
          Mon espace
        </Link>
        <Link
          href="/sit/equipe"
          aria-current={equipe ? "true" : undefined}
          className={`flex-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-center text-[13px] font-medium md:flex-none ${equipe ? "chrome-black text-white" : "text-muted-foreground hover:text-foreground"}`}
        >
          Espace collaboratif
        </Link>
      </div>
      {/* Téléphone : cinq onglets égaux (icône + libellé court) sur toute la
          largeur. À partir de la tablette : les pilules habituelles. */}
      <nav className={`grid w-full ${equipe ? "grid-cols-4" : "grid-cols-5"} gap-1 md:flex md:w-auto md:flex-wrap md:items-center md:gap-1.5`} aria-label="Navigation principale">
        {LIENS.map(({ href, label, court, icon: Icon, exact }) => {
          const actif = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium md:flex-row md:gap-1.5 md:whitespace-nowrap md:rounded-full md:px-3 md:py-1.5 md:text-[13px] ${actif ? "chrome-black text-white" : "liquid-glass-pill text-foreground/80 hover:text-foreground"}`}
            >
              {Icon ? (
                <Icon size={16} className="shrink-0 md:size-3" />
              ) : (
                <Image src="/logo-ai.png" alt="" width={18} height={18} className="shrink-0 md:size-4" />
              )}
              <span className="max-w-full truncate md:hidden">{court}</span>
              <span className="hidden md:inline">{label}</span>
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
