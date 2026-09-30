"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Database, FolderKanban, ShieldCheck, Users } from "lucide-react"
import { useUser } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"

// Cadre commun des pages d'administration (direction « Verre dépoli ») :
// en-tête du SIT, puis les trois rubriques de l'administration dans un
// rail, comme la navigation principale. Les droits sont revérifiés par
// chaque route serveur ; ce cadre ne fait qu'afficher un message aux
// comptes non administrateurs.

const RUBRIQUES = [
  { href: "/admin", label: "Comptes", icon: Users, exact: true },
  { href: "/admin/projets", label: "Projets collaboratifs", icon: FolderKanban, exact: false },
  { href: "/admin/ingestion", label: "Données publiques", icon: Database, exact: false },
]

export function CadreAdmin({
  titre,
  description,
  actions,
  children,
}: {
  titre: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { isAdmin } = useUser()
  return (
    <main className="glass-scene flex min-h-screen w-full justify-center p-4 pb-32 md:pb-10">
      <div className="flex w-full max-w-6xl flex-col gap-4">
        <SitNav titre="Administration" />

        {!isAdmin ? (
          <div className="liquid-glass-panel mx-auto mt-10 flex w-full max-w-md flex-col items-center gap-3 rounded-[22px] p-8 text-center">
            <span className="glass-icon size-10 rounded-xl">
              <ShieldCheck size={18} />
            </span>
            <p className="text-sm font-semibold">Réservé aux administrateurs.</p>
            <Link href="/sit" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Retour au tableau de bord
            </Link>
          </div>
        ) : (
          <>
            <nav
              aria-label="Rubriques de l'administration"
              className="custom-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:w-fit md:rounded-[14px] md:border md:border-white/60 md:bg-white/40 md:p-1"
            >
              {RUBRIQUES.map(({ href, label, icon: Icone, exact }) => {
                const actif = exact ? pathname === href : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={actif ? "page" : undefined}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-[13.5px] font-semibold transition-colors md:py-[7px] ${actif ? "glass-on" : "liquid-glass-pill text-muted-foreground hover:text-foreground md:border-transparent md:bg-transparent md:shadow-none md:hover:bg-white/60"}`}
                  >
                    <Icone size={15} className="shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </nav>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[24px] font-bold leading-tight tracking-[-0.03em] sm:text-[28px]">{titre}</h2>
                {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
              </div>
              {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>

            {children}
          </>
        )}
      </div>
    </main>
  )
}

// Module de verre avec pastille d'icône en tête, pour les rubriques.
export function ModuleAdmin({
  icone: Icone,
  titre,
  aside,
  className = "",
  children,
}: {
  icone: React.ComponentType<{ size?: number }>
  titre: string
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`liquid-glass-panel flex min-w-0 flex-col gap-3 rounded-[22px] p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight">
          <span className="glass-icon size-7 rounded-[9px]">
            <Icone size={15} />
          </span>
          {titre}
        </h3>
        {aside && <div className="text-xs text-muted-foreground">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

// Chiffre clé, calculé à partir des données réellement chargées.
export function Chiffre({ valeur, libelle, accent = false }: { valeur: string | number; libelle: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-[18px] px-4 py-3 ${accent ? "chrome-black text-white" : "liquid-glass-soft"}`}>
      <span className="font-mono text-[22px] font-semibold tabular-nums leading-tight">{valeur}</span>
      <span className={`text-xs ${accent ? "text-white/75" : "text-muted-foreground"}`}>{libelle}</span>
    </div>
  )
}

// Pastille d'état (Actif, Désactivé, En attente…), mêmes teintes que le
// reste du SIT : neutre, sombre, ou rouge léger pour ce qui demande de
// l'attention.
export function Pastille({ ton = "neutre", children }: { ton?: "neutre" | "sombre" | "alerte"; children: React.ReactNode }) {
  const tons = {
    neutre: "bg-foreground/[0.06] text-foreground/80",
    sombre: "bg-foreground/90 text-white",
    alerte: "bg-destructive/10 text-destructive",
  }
  return <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${tons[ton]}`}>{children}</span>
}
