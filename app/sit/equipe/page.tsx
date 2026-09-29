"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Archive, CalendarDays, Settings } from "lucide-react"
import { AuthGate, useUser } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { PanneauIA } from "@/components/panneau-ia"
import { CarteProjet, type ProjetResume } from "@/components/projet/carte-projet"
import { trouverEtape } from "@/lib/referentiel"
import { dateCourte, estTraitee, joursRestants } from "@/lib/referentiel/avancement"
import { contexteTableauDeBord } from "@/lib/referentiel/contexte-ia"
import { ETAPE_STATUTS_LIBELLES } from "@/lib/referentiel/profil"

// Espace collaboratif (2026-09-28) — un endroit à part de « Mon espace » :
// seulement les projets d'équipe auxquels l'administrateur a donné accès
// (lib/projet-acces.ts). Même logique que le tableau de bord personnel :
// rien d'inventé, les échéances viennent des étapes renseignées.

const HORIZON_JOURS = 14

function EspaceCollaboratif() {
  const user = useUser()
  const [projets, setProjets] = useState<ProjetResume[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/sit/projets?espace=collaboratif")
      .then((r) => r.json())
      .then((d) => (d.success ? setProjets(d.projets) : setErreur(d.error ?? "Chargement impossible.")))
      .catch(() => setErreur("Chargement impossible."))
  }, [])

  const actifs = useMemo(() => (projets ?? []).filter((p) => !p.archivedAt), [projets])
  const archives = useMemo(() => (projets ?? []).filter((p) => p.archivedAt), [projets])

  const aTraiter = useMemo(
    () =>
      actifs
        .flatMap((p) =>
          p.etapes
            .filter((e) => e.echeance && !estTraitee(e.statut) && joursRestants(e.echeance) <= HORIZON_JOURS)
            .map((e) => ({ projet: p, etat: e, etape: trouverEtape(e.etapeCode) })),
        )
        .filter((x) => x.etape)
        .sort((a, b) => (a.etat.echeance! < b.etat.echeance! ? -1 : 1)),
    [actifs],
  )

  const prenom = user.name.split(" ")[0]
  const aujourdhui = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })

  return (
    <main className="glass-scene flex min-h-screen w-full flex-col gap-4 p-4 pb-40 md:pb-24 lg:h-screen lg:flex-row lg:overflow-hidden lg:pb-4">
      <div className="custom-scrollbar flex min-w-0 flex-1 flex-col gap-5 px-1 pb-4 lg:overflow-y-auto">
        <SitNav titre="Espace collaboratif" />

        <section className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12.5px] font-medium text-muted-foreground">{aujourdhui}</p>
            <h2 className="mt-1.5 text-2xl font-bold leading-tight tracking-[-0.03em] sm:text-[30px]">
              Bonjour {prenom}, voici les projets de l'équipe.
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {user.isAdmin
                ? "En tant qu'administrateur, vous voyez tous les projets collaboratifs et gérez qui y a accès."
                : "Les projets auxquels l'administrateur vous a donné accès. Votre travail personnel reste dans « Mon espace »."}
            </p>
          </div>
          {user.isAdmin && (
            <Link href="/admin/projets" className="chrome-black flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white">
              <Settings size={14} />
              Gérer les projets collaboratifs
            </Link>
          )}
        </section>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        {projets === null && !erreur && <p className="text-sm text-muted-foreground">Chargement…</p>}

        {projets && actifs.length === 0 && (
          <div className="liquid-glass-panel rounded-[22px] p-6">
            <p className="font-medium">Aucun projet collaboratif pour l'instant.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.isAdmin
                ? "Créez un projet collaboratif et choisissez les collaborateurs qui y ont accès."
                : "Dès que l'administrateur vous donnera accès à un projet de l'équipe, il apparaîtra ici."}
            </p>
            {user.isAdmin && (
              <Link href="/admin/projets" className="chrome-black mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white">
                Créer un projet collaboratif
              </Link>
            )}
          </div>
        )}

        {actifs.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {actifs.map((p) => (
              <CarteProjet key={p.id} projet={p} href={`/sit/equipe/${p.id}`} equipe />
            ))}
          </section>
        )}

        {actifs.length > 0 && (
          <section className="liquid-glass-panel flex flex-col gap-2.5 rounded-[22px] p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight"><span className="glass-icon size-7 rounded-[9px]"><CalendarDays size={15} /></span>À traiter dans les projets de l'équipe</h2>
              <span className="text-xs text-muted-foreground">Échéances des {HORIZON_JOURS} prochains jours et retards</span>
            </div>
            {aTraiter.length === 0 && <p className="text-sm text-muted-foreground">Aucune échéance proche.</p>}
            {aTraiter.map(({ projet, etat, etape }) => {
              const d = dateCourte(etat.echeance!)
              const retard = joursRestants(etat.echeance!) < 0
              return (
                <Link
                  key={`${projet.id}-${etat.etapeCode}`}
                  href={`/sit/equipe/${projet.id}?etape=${etat.etapeCode}`}
                  className="liquid-glass-soft flex items-center gap-4 rounded-xl px-3 py-2.5 transition-shadow hover:shadow-md"
                >
                  <div className="w-11 shrink-0 text-center">
                    <div className="text-lg font-semibold leading-tight">{d.jour}</div>
                    <div className="text-[10px] text-muted-foreground">{d.mois}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {etape!.code} {etape!.titre}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{projet.nom}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] ${retard ? "chrome-black text-white" : "liquid-glass-pill"}`}>
                    {retard ? "En retard" : ETAPE_STATUTS_LIBELLES[etat.statut]}
                  </span>
                </Link>
              )
            })}
          </section>
        )}

        {archives.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight"><span className="glass-icon size-7 rounded-[9px]"><Archive size={15} /></span>Projets archivés</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {archives.map((p) => (
                <CarteProjet key={p.id} projet={p} href={`/sit/equipe/${p.id}`} equipe />
              ))}
            </div>
          </section>
        )}
      </div>

      <PanneauIA
        titreConversation="Équipe · Projets collaboratifs"
        contexte={contexteTableauDeBord(actifs)}
        intro={
          actifs.length
            ? `${actifs.length} projet${actifs.length > 1 ? "s" : ""} de l'équipe. Je peux faire le point sur les échéances ou préparer une réunion ; vos conversations avec moi restent privées.`
            : "Je peux répondre à une question réglementaire ou vous aider à préparer une réunion."
        }
        suggestions={["Fais le point sur les échéances de l'équipe", "Quels projets demandent une attention particulière ?", "Prépare l'ordre du jour d'une réunion d'équipe"]}
      />
    </main>
  )
}

export default function EquipePage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <EspaceCollaboratif />
    </AuthGate>
  )
}
