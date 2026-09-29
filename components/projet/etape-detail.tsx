"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { itemsApplicables, texteItem, variantesApplicables, type Etape, type ProfilOperation } from "@/lib/referentiel"
import { ACTEURS, STATUTS_VALIDATION } from "@/lib/referentiel/libelles"
import { ETAPE_STATUTS, ETAPE_STATUTS_LIBELLES, type EtapeStatut } from "@/lib/referentiel/profil"
import type { EtatEtapeProjet } from "@/lib/referentiel/avancement"

// Détail d'une étape dans l'espace projet : ce que l'ingénieur doit faire,
// pour CETTE opération. Volontairement absents pour les collaborateurs :
// la liste « ce que l'outil prépare » (fonctions pas encore construites —
// jamais promises, voir CLAUDE.md) et les informations de maintenance de
// la méthode (statut de validation, points à préciser), réservées aux
// administrateurs.

export interface MajEtape {
  statut?: EtapeStatut
  note?: string | null
  echeance?: string | null
}

function Rubrique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">{titre}</h3>
      {children}
    </div>
  )
}

function Liste({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

export function EtapeDetail({
  etape,
  profil,
  etat,
  admin,
  onEnregistrer,
  onPreparer,
}: {
  etape: Etape
  profil: ProfilOperation | null
  etat: (EtatEtapeProjet & { updatedAt?: string; updatedBy?: { name: string } | null }) | undefined
  admin: boolean
  onEnregistrer: (maj: MajEtape) => Promise<void>
  onPreparer: (texte: string) => void
}) {
  const [note, setNote] = useState(etat?.note ?? "")
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  useEffect(() => setNote(etat?.note ?? ""), [etat?.note, etape.code])

  const statut = etat?.statut ?? "A_FAIRE"
  const variantes = profil ? variantesApplicables(etape, profil) : []
  const livrables = profil ? itemsApplicables(etape.livrables, profil.mission) : etape.livrables.map(texteItem)

  async function enregistrer(maj: MajEtape) {
    setEnCours(true)
    setErreur(null)
    try {
      await onEnregistrer(maj)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <article className="liquid-glass-panel custom-scrollbar flex flex-col gap-5 rounded-2xl p-5 sm:p-6 lg:h-full lg:min-h-0 lg:overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-muted-foreground">
            Étape {etape.code}
            {admin && ` · ${STATUTS_VALIDATION[etape.statut]}`}
          </p>
          <h2 className="mt-1 text-xl font-semibold leading-tight tracking-tight sm:text-[22px]">{etape.titre}</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{etape.objectif}</p>
        </div>
        <div className="liquid-glass-inset flex w-full shrink-0 gap-0.5 rounded-xl p-1 sm:w-auto" role="group" aria-label="Avancement de l'étape">
          {ETAPE_STATUTS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={enCours}
              onClick={() => void enregistrer({ statut: s })}
              className={`flex-auto whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] transition-colors sm:flex-none sm:px-3 sm:py-1 disabled:opacity-50 ${statut === s ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08),0_2px_8px_-2px_rgba(16,24,40,0.1)] font-medium" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={statut === s}
            >
              {ETAPE_STATUTS_LIBELLES[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Échéance
          <input
            type="date"
            value={etat?.echeance ? etat.echeance.slice(0, 10) : ""}
            onChange={(e) => void enregistrer({ echeance: e.target.value || null })}
            className="liquid-glass-inset rounded-lg px-2 py-1 text-sm text-foreground outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            onPreparer(
              `Aide-moi à préparer l'étape ${etape.code} « ${etape.titre} » pour ce projet : propose une trame pour les livrables attendus et les points à vérifier. Je relirai et déciderai.`,
            )
          }
          className="chrome-black flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white sm:ml-auto sm:w-auto sm:py-2"
        >
          <Image src="/logo-ai.png" alt="" width={18} height={18} />
          Préparer avec Archiaccess AI
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="chrome-black rounded-xl p-3 text-white">
          <h3 className="mb-1.5 text-[12.5px] font-medium text-white/70">Vos actions</h3>
          <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed">
            {etape.humain.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="liquid-glass-soft rounded-xl p-3">
          <Rubrique titre="Livrables Archiaccess">
            <Liste items={livrables} />
          </Rubrique>
        </div>
      </div>

      <Rubrique titre="Points de vigilance">
        <Liste items={etape.vigilance} />
      </Rubrique>

      {variantes.length > 0 && (
        <Rubrique titre="Propre à cette opération">
          <div className="space-y-1.5">
            {variantes.map((v) => (
              <p key={v.texte} className="liquid-glass-inset rounded-xl px-3 py-2 text-[13px]">
                {v.texte}
                {admin && v.aPreciser && (
                  <span className="ml-2 whitespace-nowrap rounded-full border border-foreground px-2 py-0.5 text-[11px] font-medium">
                    À préciser avec un senior
                  </span>
                )}
              </p>
            ))}
          </div>
        </Rubrique>
      )}

      <Rubrique titre="Qui fait quoi">
        <table className="w-full text-[13px]">
          <tbody>
            {etape.roles.map((r) => (
              <tr key={r.acteur} className="border-b border-border/60 last:border-0">
                <th className="w-28 py-1.5 pr-3 text-left align-top font-medium sm:w-44">{ACTEURS[r.acteur]}</th>
                <td className="py-1.5 align-top">{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Rubrique>

      {etape.textes.length > 0 && (
        <Rubrique titre="Textes de référence">
          <Liste items={etape.textes} />
        </Rubrique>
      )}

      <div className="liquid-glass-inset flex flex-col gap-2 rounded-xl p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[12.5px] font-medium text-muted-foreground">Notes de l'ingénieur</h3>
          {etat?.updatedAt && (
            <span className="text-[11px] text-muted-foreground">
              Modifié le {new Date(etat.updatedAt).toLocaleDateString("fr-FR")}
              {etat.updatedBy ? ` par ${etat.updatedBy.name}` : ""}
            </span>
          )}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Décisions, points ouverts, informations utiles…"
          aria-label="Notes de l'ingénieur"
          className="w-full resize-y bg-transparent text-[13px] outline-none"
        />
        <div className="flex items-center justify-between">
          {erreur ? <p className="text-xs text-red-600">{erreur}</p> : <span />}
          <button
            type="button"
            disabled={enCours || note === (etat?.note ?? "")}
            onClick={() => void enregistrer({ note })}
            className="chrome-black rounded-xl px-3 py-1.5 text-xs text-white disabled:opacity-40"
          >
            Enregistrer la note
          </button>
        </div>
      </div>
    </article>
  )
}
