"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, FolderKanban, LayoutDashboard, Search, Sparkles } from "lucide-react"

// En-tête commun aux écrans du SIT centrés sur les projets (tableau de
// bord, projets, méthode) : même logo et mêmes pilules en verre que la
// recherche de données (/sit/recherche).
const LIENS = [
  { href: "/sit", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/sit/projets", label: "Projets", icon: FolderKanban, exact: false },
  { href: "/sit/recherche", label: "Recherche de données", icon: Search, exact: false },
  { href: "/sit/referentiel", label: "Méthode", icon: BookOpen, exact: false },
  { href: "/ai", label: "Archiaccess AI", icon: Sparkles, exact: false },
]

export function SitNav({ titre, sousTitre }: { titre: string; sousTitre?: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <Image src="/logo-sit.png" alt="Archiaccess SIT" width={40} height={40} className="shrink-0" />
        <div className="min-w-0">
          {sousTitre && <div className="text-xs text-muted-foreground">{sousTitre}</div>}
          <h1 className="truncate text-[17px] font-medium tracking-tight">{titre}</h1>
        </div>
      </div>
      {/* Petit écran : une seule ligne qui défile horizontalement plutôt que
          trois lignes de pilules qui repoussent le contenu. */}
      <nav
        className="-mx-4 flex w-[calc(100%+2rem)] flex-nowrap items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:w-auto md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Navigation principale"
      >
        {LIENS.map(({ href, label, icon: Icon, exact }) => {
          const actif = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium ${actif ? "chrome-black text-white" : "liquid-glass-pill text-foreground/80 hover:text-foreground"}`}
            >
              <Icon size={12} />
              {label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
