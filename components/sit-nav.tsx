"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, FolderKanban, Home, Search } from "lucide-react"

// En-tête commun aux écrans de l'espace projet (/sit/projets,
// /sit/referentiel) : même logo et mêmes pilules en verre que /sit.
const LIENS = [
  { href: "/sit", label: "Recherche", icon: Search, exact: true },
  { href: "/sit/projets", label: "Projets", icon: FolderKanban, exact: false },
  { href: "/sit/referentiel", label: "Méthode", icon: BookOpen, exact: false },
  { href: "/", label: "Accueil", icon: Home, exact: true },
]

export function SitNav({ titre }: { titre: string }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Image src="/logo-sit.png" alt="Archiaccess SIT" width={40} height={40} />
        <h1 className="text-lg font-medium">{titre}</h1>
      </div>
      <nav className="flex flex-wrap items-center gap-2">
        {LIENS.map(({ href, label, icon: Icon, exact }) => {
          const actif = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium ${actif ? "chrome-black text-white" : "liquid-glass-pill"}`}
            >
              <Icon size={13} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
