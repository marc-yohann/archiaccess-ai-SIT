"use client"

import Link from "next/link"
import { avancementPhases, dateCourte, indexEtats, joursRestants, phaseCourante, prochaineEtape, type EtatEtapeProjet } from "@/lib/referentiel/avancement"
import { MISSIONS, MONTAGES, TYPOLOGIES } from "@/lib/referentiel/libelles"

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

const lib = (table: Record<string, string>, v: string | null) => (v && v in table ? table[v] : null)

export function profilCourt(p: ProjetResume): string {
  return [lib(TYPOLOGIES, p.typologie), lib(MONTAGES, p.montage), lib(MISSIONS, p.mission)].filter(Boolean).join(" · ")
}

export function CarteProjet({ projet }: { projet: ProjetResume }) {
  const etats = indexEtats(projet.etapes)
  const phases = avancementPhases(etats)
  const courante = phaseCourante(etats)
  const suivante = prochaineEtape(etats)
  const etatSuivante = suivante ? etats.get(suivante.code) : undefined
  const retard = etatSuivante?.echeance ? joursRestants(etatSuivante.echeance) < 0 : false

  return (
    <Link href={`/sit/projets/${projet.id}`} className="liquid-glass-panel flex flex-col gap-3 rounded-2xl p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{projet.nom}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{profilCourt(projet) || "Profil de l'opération à compléter"}</p>
        </div>
        <span className="chrome-black shrink-0 rounded-full px-2.5 py-0.5 text-[11px] text-white">Phase {courante.numero}</span>
      </div>
      <div>
        <div className="flex gap-1" aria-hidden="true">
          {phases.map((a) => (
            <span
              key={a.phase.numero}
              className={`h-1.5 flex-1 rounded-full ${a.complete ? "bg-foreground" : a.phase.numero === courante.numero ? "bg-foreground/45" : "bg-foreground/15"}`}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Phase {courante.numero} sur 9 — {courante.titre.toLowerCase()}
        </p>
      </div>
      <div className="liquid-glass-inset rounded-xl px-3 py-2 text-[13px]">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Prochaine étape</p>
        {suivante ? (
          <p className="mt-0.5">
            {suivante.code} {suivante.titre}
            {etatSuivante?.echeance && (
              <span className={retard ? "font-semibold" : "text-muted-foreground"}>
                {" "}
                — {retard ? "en retard, " : ""}
                {dateCourte(etatSuivante.echeance).jour} {dateCourte(etatSuivante.echeance).mois.toLowerCase()}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-0.5">Toutes les étapes sont traitées.</p>
        )}
      </div>
    </Link>
  )
}
