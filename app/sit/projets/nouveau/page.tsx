"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AuthGate } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { LIBELLES_COURTS, MISSIONS, MONTAGES, STATUTS_MOA, TYPOLOGIES } from "@/lib/referentiel/libelles"

// Création d'un projet : le cadrage de l'opération en quatre questions à
// boutons (maître d'ouvrage, ouvrage, montage, mission). Chaque réponse
// peut rester vide et se compléter plus tard depuis l'espace projet.

// Libellés courts pour les boutons (lib/referentiel/libelles.ts) ; pour le
// montage, le libellé complet reste plus explicite au moment du cadrage.
const COURTS: Record<string, string> = {
  ...LIBELLES_COURTS,
  MOE_LOTS_SEPARES: "Maîtrise d'œuvre + lots séparés",
  MOE_ENTREPRISE_GENERALE: "Maîtrise d'œuvre + entreprise générale",
  AMO: "Assistance à maîtrise d'ouvrage",
}

type Cle = "statutMoa" | "typologie" | "montage" | "mission"

const QUESTIONS: { cle: Cle; titre: string; valeurs: Record<string, string>; colonnes: string; indecis?: string }[] = [
  { cle: "statutMoa", titre: "Qui est le maître d'ouvrage ?", valeurs: STATUTS_MOA, colonnes: "sm:grid-cols-3 xl:grid-cols-5" },
  { cle: "typologie", titre: "Quel ouvrage ?", valeurs: TYPOLOGIES, colonnes: "sm:grid-cols-2 xl:grid-cols-4" },
  { cle: "montage", titre: "Quel montage contractuel ?", valeurs: MONTAGES, colonnes: "sm:grid-cols-2 xl:grid-cols-4", indecis: "Pas encore décidé" },
  { cle: "mission", titre: "Quelle mission pour Archiaccess ?", valeurs: MISSIONS, colonnes: "sm:grid-cols-2 xl:grid-cols-4" },
]

function NouveauProjet() {
  const router = useRouter()
  const [nom, setNom] = useState("")
  const [description, setDescription] = useState("")
  const [choix, setChoix] = useState<Record<Cle, string | null>>({ statutMoa: null, typologie: null, montage: null, mission: null })
  const [rehabilitation, setRehabilitation] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    try {
      const r = await fetch("/api/sit/projets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, description: description || null, ...choix, rehabilitation }),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error ?? "Création impossible.")
      router.push(`/sit/projets/${d.projet.id}`)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Création impossible.")
      setEnCours(false)
    }
  }

  return (
    <main className="glass-scene custom-scrollbar flex h-screen w-full items-start justify-center overflow-y-auto p-4">
      <div className="flex w-full max-w-6xl flex-col gap-4 pb-10">
        <SitNav titre="Nouveau projet" sousTitre={<Link href="/sit/projets" className="hover:underline">Projets</Link>} />

        <form onSubmit={creer} className="liquid-glass-panel flex flex-col gap-6 rounded-2xl p-4 sm:p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Nom de l'opération</span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              placeholder="Ex. : Groupe scolaire Jules-Ferry"
              className="liquid-glass-inset min-w-0 rounded-xl px-3.5 py-3 text-base outline-none sm:text-lg"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Description (facultatif)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="liquid-glass-inset rounded-xl px-3.5 py-2.5 text-sm outline-none"
            />
          </label>

          {QUESTIONS.map((q, i) => (
            <fieldset key={q.cle} className="flex flex-col gap-2">
              <legend className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {i + 1} · {q.titre}
              </legend>
              <div className={`grid gap-2 ${q.colonnes}`}>
                {Object.keys(q.valeurs).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={choix[q.cle] === k}
                    onClick={() => setChoix((c) => ({ ...c, [q.cle]: c[q.cle] === k ? null : k }))}
                    className={`rounded-xl px-3.5 py-3 text-left text-[13px] ${choix[q.cle] === k ? "chrome-black text-white" : "liquid-glass-pill"}`}
                  >
                    {COURTS[k] ?? q.valeurs[k]}
                  </button>
                ))}
                {q.indecis && (
                  <button
                    type="button"
                    aria-pressed={choix[q.cle] === null}
                    onClick={() => setChoix((c) => ({ ...c, [q.cle]: null }))}
                    className={`rounded-xl px-3.5 py-3 text-left text-[13px] ${choix[q.cle] === null ? "chrome-black text-white" : "liquid-glass-pill"}`}
                  >
                    {q.indecis}
                  </button>
                )}
              </div>
              {q.cle === "typologie" && (
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rehabilitation} onChange={(e) => setRehabilitation(e.target.checked)} />
                  Réhabilitation ou travaux en site occupé
                </label>
              )}
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={enCours || !nom.trim()} className="chrome-black flex-1 rounded-xl px-5 py-3 text-sm font-medium text-white disabled:opacity-50 sm:flex-none">
              Créer le projet
            </button>
            <Link href="/sit/projets" className="liquid-glass-pill rounded-xl px-5 py-3 text-center text-sm">
              Annuler
            </Link>
            {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          </div>
        </form>
      </div>
    </main>
  )
}

export default function NouveauProjetPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <NouveauProjet />
    </AuthGate>
  )
}
