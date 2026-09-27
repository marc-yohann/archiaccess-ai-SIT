"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { PROFIL_VIDE, ProfilChamps, profilVersRequete, type ProfilSaisi } from "@/components/referentiel/profil-champs"
import { toutesLesEtapes } from "@/lib/referentiel"
import { MISSIONS, MONTAGES, TYPOLOGIES } from "@/lib/referentiel/libelles"

// Liste des projets (espace projet AMO/OPC) et création d'un projet avec
// son profil d'opération. Projet est le modèle existant (Phase 10) :
// l'espace projet l'enrichit, il ne le remplace pas.

interface ProjetListe {
  id: string
  nom: string
  description: string | null
  statutMoa: string | null
  montage: string | null
  typologie: string | null
  mission: string | null
  updatedAt: string
  createdBy: { name: string } | null
  etapes: { etapeCode: string; statut: string }[]
}

const NB_ETAPES = toutesLesEtapes().length

function avancement(p: ProjetListe) {
  const codes = new Set(toutesLesEtapes().map((e) => e.code))
  const traitees = p.etapes.filter((e) => codes.has(e.etapeCode) && (e.statut === "FAIT" || e.statut === "SANS_OBJET")).length
  return NB_ETAPES ? Math.round((traitees / NB_ETAPES) * 100) : 0
}

function Projets() {
  const router = useRouter()
  const [projets, setProjets] = useState<ProjetListe[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [creation, setCreation] = useState(false)
  const [nom, setNom] = useState("")
  const [description, setDescription] = useState("")
  const [profil, setProfil] = useState<ProfilSaisi>(PROFIL_VIDE)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    fetch("/api/sit/projets")
      .then((r) => r.json())
      .then((d) => (d.success ? setProjets(d.projets) : setErreur(d.error ?? "Chargement impossible.")))
      .catch(() => setErreur("Chargement impossible."))
  }, [])

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    try {
      const r = await fetch("/api/sit/projets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, description: description || null, ...profilVersRequete(profil) }),
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
      <div className="flex w-full max-w-5xl flex-col gap-4 pb-10">
        <SitNav titre="Projets" />

        <div className="liquid-glass-panel rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">Espace projet</h2>
              <p className="text-sm text-muted-foreground">
                Chaque projet suit la méthode Archiaccess, adaptée à son maître d'ouvrage, à son montage et à son type d'ouvrage.
              </p>
            </div>
            {!creation && (
              <button onClick={() => setCreation(true)} className="chrome-black flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white">
                <Plus size={14} />
                Nouveau projet
              </button>
            )}
          </div>

          {creation && (
            <form onSubmit={creer} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Nom de l'opération</span>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
                  placeholder="Ex. : Groupe scolaire — construction neuve"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Description (facultatif)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
                />
              </label>
              <ProfilChamps valeur={profil} onChange={setProfil} />
              <div className="flex gap-2">
                <button type="submit" disabled={enCours || !nom.trim()} className="chrome-black rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50">
                  Créer le projet
                </button>
                <button type="button" onClick={() => setCreation(false)} className="liquid-glass-pill rounded-xl px-4 py-2 text-sm">
                  Annuler
                </button>
              </div>
            </form>
          )}
          {erreur && <p className="mt-2 text-xs text-red-600">{erreur}</p>}
        </div>

        {projets === null && !erreur && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {projets?.length === 0 && <p className="text-sm text-muted-foreground">Aucun projet pour l'instant.</p>}

        <div className="grid gap-3 md:grid-cols-2">
          {projets?.map((p) => {
            const pct = avancement(p)
            return (
              <Link key={p.id} href={`/sit/projets/${p.id}`} className="liquid-glass-panel block rounded-2xl p-4 transition-shadow hover:shadow-md">
                <p className="font-medium">{p.nom}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[p.typologie && TYPOLOGIES[p.typologie as keyof typeof TYPOLOGIES], p.montage && MONTAGES[p.montage as keyof typeof MONTAGES], p.mission && MISSIONS[p.mission as keyof typeof MISSIONS]]
                    .filter(Boolean)
                    .join(" · ") || "Profil de l'opération à renseigner"}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                  <div className="chrome-black h-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {pct} % des étapes rédigées traitées — mis à jour le {new Date(p.updatedAt).toLocaleDateString("fr-FR")}
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    </main>
  )
}

export default function ProjetsPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <Projets />
    </AuthGate>
  )
}
