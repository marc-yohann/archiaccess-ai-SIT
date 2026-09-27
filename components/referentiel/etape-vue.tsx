"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { itemsApplicables, missionsItem, texteItem, variantesApplicables, type Condition, type Etape, type ProfilOperation } from "@/lib/referentiel"
import { ACTEURS, MISSIONS, MONTAGES, STATUTS_MOA, STATUTS_VALIDATION, TYPOLOGIES } from "@/lib/referentiel/libelles"
import { ETAPE_STATUTS, ETAPE_STATUTS_LIBELLES, type EtapeStatut } from "@/lib/referentiel/profil"

// Affichage d'une étape du référentiel Archiaccess, partagé par la
// consultation du référentiel (/sit/referentiel) et l'espace projet
// (/sit/projets/[id]). Avec un profil d'opération, seules les variantes et
// livrables applicables sont montrés ; sans profil, tout est affiché avec
// la condition de chaque variante.

export interface EtatEtape {
  statut: EtapeStatut
  note: string | null
  updatedBy?: { name: string } | null
  updatedAt?: string
}

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
      <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{titre}</h4>
      {children}
    </div>
  )
}

export const PASTILLE_STATUT: Record<EtapeStatut, string> = {
  A_FAIRE: "border border-border text-muted-foreground",
  EN_COURS: "border border-foreground text-foreground",
  FAIT: "chrome-black text-white",
  SANS_OBJET: "border border-dashed border-border text-muted-foreground",
}

export function EtapeVue({
  etape,
  profil,
  etat,
  onEnregistrer,
  ouverteParDefaut = false,
}: {
  etape: Etape
  profil?: ProfilOperation | null
  etat?: EtatEtape
  onEnregistrer?: (maj: { statut?: EtapeStatut; note?: string | null }) => Promise<void>
  ouverteParDefaut?: boolean
}) {
  const [ouverte, setOuverte] = useState(ouverteParDefaut)
  const [note, setNote] = useState(etat?.note ?? "")
  // Resynchronise la note après un enregistrement (valeur nettoyée côté
  // serveur) sans refermer l'étape.
  useEffect(() => setNote(etat?.note ?? ""), [etat?.note])
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const variantes = profil ? variantesApplicables(etape, profil) : etape.variantes
  const livrables = profil
    ? itemsApplicables(etape.livrables, profil.mission)
    : etape.livrables.map((i) => {
        const m = missionsItem(i)
        return m ? `${texteItem(i)} (${m.map((x) => MISSIONS[x]).join(" / ")})` : texteItem(i)
      })

  async function enregistrer(maj: { statut?: EtapeStatut; note?: string | null }) {
    if (!onEnregistrer) return
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

  const statut = etat?.statut ?? "A_FAIRE"

  return (
    <div className="liquid-glass-soft rounded-2xl">
      <button onClick={() => setOuverte((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left">
        {ouverte ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
        <span className="w-10 shrink-0 text-sm font-semibold">{etape.code}</span>
        <span className="flex-1 text-sm font-medium">{etape.titre}</span>
        {onEnregistrer ? (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] ${PASTILLE_STATUT[statut]}`}>{ETAPE_STATUTS_LIBELLES[statut]}</span>
        ) : (
          <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
            {STATUTS_VALIDATION[etape.statut]}
          </span>
        )}
      </button>

      {ouverte && (
        <div className="space-y-4 px-4 pb-4">
          <p className="rounded-xl bg-background/60 px-3 py-2 text-sm font-medium">{etape.objectif}</p>

          {onEnregistrer && (
            <div className="liquid-glass-inset space-y-3 rounded-xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Avancement</span>
                {ETAPE_STATUTS.map((s) => (
                  <button
                    key={s}
                    disabled={enCours}
                    onClick={() => void enregistrer({ statut: s })}
                    className={`rounded-full px-3 py-1 text-xs transition-opacity disabled:opacity-50 ${statut === s ? PASTILLE_STATUT[s] : "liquid-glass-pill"}`}
                  >
                    {ETAPE_STATUTS_LIBELLES[s]}
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Notes de l'ingénieur : décisions, points ouverts, échéances…"
                className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {etat?.updatedAt ? `Mis à jour le ${new Date(etat.updatedAt).toLocaleDateString("fr-FR")}${etat.updatedBy ? ` par ${etat.updatedBy.name}` : ""}` : "Pas encore renseignée"}
                </span>
                <button
                  disabled={enCours || note === (etat?.note ?? "")}
                  onClick={() => void enregistrer({ note })}
                  className="chrome-black rounded-xl px-3 py-1.5 text-xs text-white disabled:opacity-40"
                >
                  Enregistrer la note
                </button>
              </div>
              {erreur && <p className="text-xs text-red-600">{erreur}</p>}
            </div>
          )}

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

          <Rubrique titre="Livrables Archiaccess">
            <Liste items={livrables} />
          </Rubrique>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-dashed border-border p-3">
              <Rubrique titre="Ce que l'outil prépare">
                <Liste items={etape.outil} />
              </Rubrique>
            </div>
            <div className="chrome-black rounded-xl p-3 text-white">
              <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/70">Ce que l'ingénieur fait lui-même</h4>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {etape.humain.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>

          <Rubrique titre="Points de vigilance">
            <Liste items={etape.vigilance} />
          </Rubrique>

          {variantes.length > 0 && (
            <Rubrique titre={profil ? "Variantes applicables à cette opération" : "Variantes"}>
              <div className="space-y-2">
                {variantes.map((v) => (
                  <div key={v.texte} className="rounded-xl bg-background/60 px-3 py-2 text-sm">
                    {!profil && <p className="mb-0.5 text-xs font-medium text-muted-foreground">{libelleCondition(v.quand)}</p>}
                    <p>
                      {v.texte}
                      {v.aPreciser && (
                        <span className="ml-2 whitespace-nowrap rounded-full border border-foreground px-2 py-0.5 text-[10px] uppercase tracking-wide">
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
