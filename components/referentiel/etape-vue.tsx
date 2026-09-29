"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { missionsItem, texteItem, type Condition, type Etape } from "@/lib/referentiel"
import { ACTEURS, MISSIONS, MONTAGES, STATUTS_MOA, STATUTS_VALIDATION, TYPOLOGIES } from "@/lib/referentiel/libelles"

// Consultation d'une étape de la méthode (/sit/referentiel), toutes
// variantes affichées avec leur condition. L'espace projet a son propre
// affichage, filtré sur le profil de l'opération
// (components/projet/etape-detail.tsx).
//
// `admin` : la maintenance de la méthode (statut de validation, points à
// préciser avec un senior, fonctions prévues de l'outil — pas encore
// construites, donc jamais montrées aux collaborateurs) n'est visible que
// des administrateurs.

function libelleCondition(c: Condition): string {
  const parts: string[] = []
  if (c.statutMoa) parts.push(c.statutMoa.map((v) => STATUTS_MOA[v]).join(", "))
  if (c.montage) parts.push(c.montage.map((v) => MONTAGES[v]).join(", "))
  if (c.typologie) parts.push(c.typologie.map((v) => TYPOLOGIES[v]).join(", "))
  if (c.mission) parts.push(c.mission.map((v) => MISSIONS[v]).join(", "))
  if (c.rehabilitation) parts.push("Réhabilitation ou site occupé")
  return parts.join(" · ") || "Toutes opérations"
}

function Liste({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">—</p>
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

function Rubrique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">{titre}</h4>
      {children}
    </div>
  )
}

export function EtapeVue({ etape, admin }: { etape: Etape; admin: boolean }) {
  const [ouverte, setOuverte] = useState(false)
  const livrables = etape.livrables.map((i) => {
    const m = missionsItem(i)
    return m ? `${texteItem(i)} (${m.map((x) => MISSIONS[x]).join(" / ")})` : texteItem(i)
  })

  return (
    <div className="liquid-glass-soft rounded-2xl">
      <button type="button" onClick={() => setOuverte((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={ouverte}>
        {ouverte ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
        <span className="w-10 shrink-0 text-sm font-semibold">{etape.code}</span>
        <span className="flex-1 text-sm font-medium">{etape.titre}</span>
        {admin && (
          <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">{STATUTS_VALIDATION[etape.statut]}</span>
        )}
      </button>

      {ouverte && (
        <div className="space-y-4 px-4 pb-4">
          <p className="rounded-xl bg-background/60 px-3 py-2 text-sm font-medium">{etape.objectif}</p>

          <Rubrique titre="Qui fait quoi">
            <table className="w-full text-sm">
              <tbody>
                {etape.roles.map((r) => (
                  <tr key={r.acteur} className="border-b border-border/60 last:border-0">
                    <th className="w-44 py-1.5 pr-3 text-left align-top font-medium">{ACTEURS[r.acteur]}</th>
                    <td className="py-1.5 align-top">{r.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Rubrique>

          {etape.entrees?.length ? (
            <Rubrique titre="Entrées">
              <Liste items={etape.entrees} />
            </Rubrique>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="chrome-black rounded-xl p-3 text-white">
              <h4 className="mb-1.5 text-[12.5px] font-medium text-white/70">Actions de l'ingénieur</h4>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {etape.humain.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="liquid-glass-inset rounded-xl p-3">
              <Rubrique titre="Livrables Archiaccess">
                <Liste items={livrables} />
              </Rubrique>
            </div>
          </div>

          {admin && (
            <div className="rounded-xl border border-dashed border-border p-3">
              <Rubrique titre="Fonctions prévues de l'outil (non construites — visible des administrateurs)">
                <Liste items={etape.outil} />
              </Rubrique>
            </div>
          )}

          <Rubrique titre="Points de vigilance">
            <Liste items={etape.vigilance} />
          </Rubrique>

          {etape.variantes.length > 0 && (
            <Rubrique titre="Selon l'opération">
              <div className="space-y-2">
                {etape.variantes.map((v) => (
                  <div key={v.texte} className="rounded-xl bg-background/60 px-3 py-2 text-sm">
                    <p className="mb-0.5 text-xs font-medium text-muted-foreground">{libelleCondition(v.quand)}</p>
                    <p>
                      {v.texte}
                      {admin && v.aPreciser && (
                        <span className="ml-2 whitespace-nowrap rounded-full border border-foreground px-2 py-0.5 text-[11px] font-medium">
                          À préciser avec un senior
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </Rubrique>
          )}

          <Rubrique titre="Textes et formulaires publics">
            <Liste items={etape.textes} />
          </Rubrique>
        </div>
      )}
    </div>
  )
}
