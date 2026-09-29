"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { BookOpen, FolderKanban, LayoutDashboard, Search, Settings, Users } from "lucide-react"
import { useUser } from "@/components/auth-gate"

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
  const { isAdmin } = useUser()
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
        <Image src="/logo-sit.png" alt="Archiaccess SIT" width={36} height={36} className="shrink-0" />
        <div className="min-w-0">
          {sousTitre && <div className="text-xs text-muted-foreground">{sousTitre}</div>}
          <h1 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.015em] md:line-clamp-1">{titre}</h1>
        </div>
      </div>
      {/* Bascule entre les deux espaces : mon espace (projets personnels)
          et l'espace collaboratif (projets d'équipe). */}
      <div className="order-first flex w-full items-center gap-2 md:order-none md:w-auto">
      <div className="liquid-glass-inset flex flex-1 gap-0.5 rounded-xl p-1 md:flex-none" role="group" aria-label="Changer d'espace">
        <Link
          href="/sit"
          aria-current={!equipe ? "true" : undefined}
          className={`flex-1 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-center text-[13px] font-medium transition-colors md:flex-none ${!equipe ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08),0_2px_8px_-2px_rgba(16,24,40,0.1)]" : "text-muted-foreground hover:text-foreground"}`}
        >
          Mon espace
        </Link>
        <Link
          href="/sit/equipe"
          aria-current={equipe ? "true" : undefined}
          className={`flex-1 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-center text-[13px] font-medium transition-colors md:flex-none ${equipe ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08),0_2px_8px_-2px_rgba(16,24,40,0.1)]" : "text-muted-foreground hover:text-foreground"}`}
        >
          Espace collaboratif
        </Link>
      </div>
      {/* Visible des seuls administrateurs : comptes, projets collaboratifs
          et accès, ingestion (les pages /admin revérifient le droit). */}
      {isAdmin && (
        <Link
          href="/admin"
          aria-label="Administration"
          aria-current={pathname.startsWith("/admin") ? "page" : undefined}
          className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-medium md:h-auto md:py-1.5 ${pathname.startsWith("/admin") ? "chrome-black text-white" : "liquid-glass-pill text-foreground/80 hover:text-foreground"}`}
        >
          <Settings size={15} className="shrink-0 md:size-3.5" />
          <span className="hidden md:inline">Administration</span>
        </Link>
      )}
      </div>
      {/* Téléphone : barre d'onglets fixée en bas de l'écran (demande
          utilisateur), icône + libellé court, à portée de pouce. À partir
          de la tablette : les pilules habituelles dans l'en-tête. Les pages
          réservent la hauteur de la barre en bas (pb-40 / pb-28 < md). */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-30 grid ${equipe ? "grid-cols-4" : "grid-cols-5"} gap-1 border-t border-foreground/[0.07] bg-white/[0.97] px-2 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:static md:z-auto md:flex md:w-auto md:flex-wrap md:items-center md:gap-0.5 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none`}
        aria-label="Navigation principale"
      >
        {LIENS.map(({ href, label, court, icon: Icon, exact }) => {
          const actif = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors md:flex-row md:gap-1.5 md:whitespace-nowrap md:rounded-lg md:px-3 md:py-1.5 md:text-[13.5px] ${actif ? "text-foreground md:bg-foreground/[0.07]" : "text-muted-foreground hover:text-foreground md:hover:bg-white/60"}`}
            >
              {Icon ? (
                <Icon size={20} strokeWidth={actif ? 2.2 : 1.8} className="shrink-0 md:size-3.5" />
              ) : (
                <Image src="/logo-ai.png" alt="" width={20} height={20} className={`shrink-0 md:size-4 ${actif ? "" : "opacity-70"}`} />
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
