"use client"

import Link from "next/link"
import { avancementPhases, dateCourte, indexEtats, joursRestants, phaseCourante, prochaineEtape, type EtatEtapeProjet } from "@/lib/referentiel/avancement"
import { LIBELLES_COURTS, PHASES_COURTES } from "@/lib/referentiel/libelles"

// Carte d'un projet : profil, barre des 9 phases, prochaine étape. Partagée
// par le tableau de bord (/sit) et la liste des projets.

export interface ProjetResume {
  id: string
  nom: string
  statutMoa: string | null
  montage: string | null
  typologie: string | null
  mission: string | null
  rehabilitation: boolean
  description: string | null
  updatedAt: string
  etapes: EtatEtapeProjet[]
}

const court = (v: string | null) => (v && v in LIBELLES_COURTS ? LIBELLES_COURTS[v as keyof typeof LIBELLES_COURTS] : null)

export function profilCourt(p: ProjetResume): string {
  return [court(p.typologie), court(p.montage), court(p.mission)].filter(Boolean).join(" · ")
}

export function CarteProjet({ projet }: { projet: ProjetResume }) {
  const etats = indexEtats(projet.etapes)
  const phases = avancementPhases(etats)
  const courante = phaseCourante(etats)
  const suivante = prochaineEtape(etats)
  const etatSuivante = suivante ? etats.get(suivante.code) : undefined
  const retard = etatSuivante?.echeance ? joursRestants(etatSuivante.echeance) < 0 : false
  const profil = profilCourt(projet)

  return (
    <Link
      href={`/sit/projets/${projet.id}`}
      className="liquid-glass-panel group flex flex-col gap-4 rounded-[1.25rem] p-5 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{projet.nom}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
            {profil || "Profil à compléter"}
          </p>
        </div>
        <span className="liquid-glass-pill shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium">{PHASES_COURTES[courante.numero]}</span>
      </div>

      <div>
        <div className="flex gap-1" aria-hidden="true">
          {phases.map((a) => (
            <span
              key={a.phase.numero}
              className={`h-1 flex-1 rounded-full ${a.complete ? "bg-foreground" : a.phase.numero === courante.numero ? "bg-foreground/40" : "bg-foreground/10"}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Phase {courante.numero} sur 9 · {courante.titre}
        </p>
      </div>

      <div className="mt-auto border-t border-foreground/10 pt-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Prochaine étape</p>
        {suivante ? (
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="line-clamp-1 text-[13px]">
              <span className="font-semibold">{suivante.code}</span> {suivante.titre}
            </p>
            {etatSuivante?.echeance && (
              <span className={`shrink-0 text-xs ${retard ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {retard ? "En retard · " : ""}
                {dateCourte(etatSuivante.echeance).jour} {dateCourte(etatSuivante.echeance).mois.toLowerCase()}
              </span>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[13px]">Toutes les étapes sont traitées.</p>
        )}
      </div>
    </Link>
  )
}
