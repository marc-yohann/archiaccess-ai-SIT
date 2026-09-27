"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { CarteProjet, type ProjetResume } from "@/components/projet/carte-projet"

// Tous les projets de l'espace projet (le tableau de bord n'en montre que
// les six plus récemment modifiés). Projet est le modèle existant
// (Phase 10) : l'espace projet l'enrichit, il ne le remplace pas.

function Projets() {
  const [projets, setProjets] = useState<ProjetResume[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/sit/projets")
      .then((r) => r.json())
      .then((d) => (d.success ? setProjets(d.projets) : setErreur(d.error ?? "Chargement impossible.")))
      .catch(() => setErreur("Chargement impossible."))
  }, [])

  return (
    <main className="glass-scene custom-scrollbar flex h-screen w-full items-start justify-center overflow-y-auto p-4">
      <div className="flex w-full max-w-6xl flex-col gap-4 pb-10">
        <SitNav titre="Projets" />

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{projets ? `${projets.length} opération${projets.length > 1 ? "s" : ""}` : ""}</p>
          <Link href="/sit/projets/nouveau" className="chrome-black flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white">
            <Plus size={14} />
            Nouveau projet
          </Link>
        </div>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        {projets === null && !erreur && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {projets?.length === 0 && <p className="text-sm text-muted-foreground">Aucun projet pour l'instant.</p>}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projets?.map((p) => (
            <CarteProjet key={p.id} projet={p} />
          ))}
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
