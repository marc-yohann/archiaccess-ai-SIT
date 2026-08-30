"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { AuthGate } from "@/components/auth-gate"
import type { AddressResult } from "@/lib/data-sources/ban"
import type { Parcel } from "@/lib/data-sources/cadastre"
import type { CommuneRisks } from "@/lib/data-sources/georisques"
import type { Mutation } from "@/lib/data-sources/dvf"

// Connecteurs du hub SIT : recherche d'adresse (Base Adresse Nationale),
// cadastre/parcelles (API Carto IGN), Géorisques (risques réglementaires),
// DVF (valeurs foncières) — tous s'articulent autour d'une adresse
// sélectionnée (DVF a en plus besoin de la section cadastrale, fournie
// par ParcelList) — voir CLAUDE.md.
export default function SitPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <main className="glass-scene flex min-h-screen justify-center p-4">
        <div className="flex w-full max-w-2xl flex-col gap-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo-sit.png" alt="Archiaccess SIT" width={36} height={36} className="rounded-xl" />
              <h1 className="text-lg font-medium">Système d'Information Technique</h1>
            </div>
            <Link href="/" className="text-sm text-muted-foreground hover:underline">
              Accueil
            </Link>
          </div>
          <AddressSearch />
          <DocumentUpload />
        </div>
      </main>
    </AuthGate>
  )
}

function AddressSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AddressResult[]>([])
  const [selected, setSelected] = useState<AddressResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")
  const [parcels, setParcels] = useState<Parcel[]>([])

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || isSearching) return
    setIsSearching(true)
    setError("")
    setSelected(null)
    setParcels([])
    try {
      const res = await fetch(`/api/sit/search-address?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.success) {
        setResults(data.results)
      } else {
        setError(data.error ?? "Recherche impossible.")
        setResults([])
      }
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="liquid-glass w-full rounded-3xl p-6">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recherche d'adresse</h2>

      <form onSubmit={search} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une adresse (ex: 8 boulevard du Port, Amiens)…"
          className="liquid-glass-inset flex-1 rounded-xl px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="chrome-black rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isSearching ? "…" : "Rechercher"}
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <div className="custom-scrollbar mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
        {results.map((r) => (
          <button
            key={`${r.citycode}-${r.label}`}
            onClick={() => {
              setSelected(r)
              setParcels([])
            }}
            className="liquid-glass-soft block w-full rounded-xl p-3 text-left text-sm transition-shadow hover:shadow-md"
          >
            <p className="font-medium">{r.label}</p>
            <p className="text-xs text-muted-foreground">{r.context}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="liquid-glass-panel mt-4 rounded-2xl p-4 text-sm">
          <h3 className="mb-2 font-medium">{selected.label}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <dt>Code commune (INSEE)</dt>
            <dd>{selected.citycode}</dd>
            <dt>Code postal</dt>
            <dd>{selected.postcode}</dd>
            <dt>Coordonnées (lon, lat)</dt>
            <dd>
              {selected.coordinates[0].toFixed(5)}, {selected.coordinates[1].toFixed(5)}
            </dd>
            <dt>Score de fiabilité</dt>
            <dd>{Math.round(selected.score * 100)}%</dd>
          </dl>
          <ParcelList lon={selected.coordinates[0]} lat={selected.coordinates[1]} onLoaded={setParcels} />
          <RiskList codeInsee={selected.citycode} />
          {parcels[0] && <DvfList codeCommune={parcels[0].codeInsee} sectionPrefixe={parcels[0].sectionPrefixe} />}
        </div>
      )}
    </div>
  )
}

function ParcelList({ lon, lat, onLoaded }: { lon: number; lat: number; onLoaded: (parcels: Parcel[]) => void }) {
  const [parcels, setParcels] = useState<Parcel[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setParcels(null)
    setError("")
    fetch(`/api/sit/parcels?lon=${lon}&lat=${lat}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setParcels(data.parcels)
          onLoaded(data.parcels)
        } else {
          setError(data.error ?? "Recherche de parcelle impossible.")
        }
      })
      .catch(() => {
        if (!cancelled) setError("Recherche de parcelle impossible.")
      })
    return () => {
      cancelled = true
    }
  }, [lon, lat, onLoaded])

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <h4 className="mb-1 text-xs font-medium text-muted-foreground">Cadastre</h4>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && parcels === null && <p className="text-xs text-muted-foreground">Recherche…</p>}
      {parcels?.length === 0 && <p className="text-xs text-muted-foreground">Aucune parcelle trouvée à proximité.</p>}
      {parcels && parcels.length > 0 && (
        <ul className="space-y-1">
          {parcels.map((p) => (
            <li key={p.idu} className="text-xs text-muted-foreground">
              Section {p.section}, parcelle {p.numero} — {p.contenanceM2} m² (
              <span className="font-mono">{p.idu}</span>)
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DvfList({ codeCommune, sectionPrefixe }: { codeCommune: string; sectionPrefixe: string }) {
  const [mutations, setMutations] = useState<Mutation[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setMutations(null)
    setError("")
    fetch(`/api/sit/dvf?codeCommune=${codeCommune}&sectionPrefixe=${sectionPrefixe}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setMutations(data.mutations)
        } else {
          setError(data.error ?? "Recherche DVF impossible.")
        }
      })
      .catch(() => {
        if (!cancelled) setError("Recherche DVF impossible.")
      })
    return () => {
      cancelled = true
    }
  }, [codeCommune, sectionPrefixe])

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <h4 className="mb-1 text-xs font-medium text-muted-foreground">DVF — ventes récentes (section {sectionPrefixe.slice(3)})</h4>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && mutations === null && <p className="text-xs text-muted-foreground">Recherche…</p>}
      {mutations?.length === 0 && <p className="text-xs text-muted-foreground">Aucune vente répertoriée dans cette section.</p>}
      {mutations && mutations.length > 0 && (
        <ul className="custom-scrollbar max-h-40 space-y-1 overflow-y-auto">
          {mutations.slice(0, 10).map((m) => (
            <li key={m.idMutation} className="text-xs text-muted-foreground">
              {m.date} — {m.nature} — {m.adresse}
              {m.valeurFonciere !== null && ` — ${m.valeurFonciere.toLocaleString("fr-FR")} €`}
              {m.surfaceReelleBati !== null && ` (${m.surfaceReelleBati} m²)`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RiskList({ codeInsee }: { codeInsee: string }) {
  const [risks, setRisks] = useState<CommuneRisks | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setRisks(null)
    setError("")
    fetch(`/api/sit/risks?codeInsee=${codeInsee}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.success) {
          setRisks(data.risks)
        } else {
          setError(data.error ?? "Recherche de risques impossible.")
        }
      })
      .catch(() => {
        if (!cancelled) setError("Recherche de risques impossible.")
      })
    return () => {
      cancelled = true
    }
  }, [codeInsee])

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <h4 className="mb-1 text-xs font-medium text-muted-foreground">Géorisques (échelle commune)</h4>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && risks === null && <p className="text-xs text-muted-foreground">Recherche…</p>}
      {risks && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Zone sismique : {risks.seismicZone ?? "non renseignée"} · Potentiel radon : {risks.radonPotential ?? "non renseigné"}
          </p>
          {risks.risks.length > 0 ? (
            <ul className="list-inside list-disc">
              {risks.risks.map((r) => (
                <li key={r.code}>{r.label}</li>
              ))}
            </ul>
          ) : (
            <p>Aucun risque répertorié pour cette commune.</p>
          )}
        </div>
      )}
    </div>
  )
}

function DocumentUpload() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim() || isSaving) return
    setIsSaving(true)
    setFeedback("")
    try {
      const res = await fetch("/api/sit/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceType: "etude", content }),
      })
      const data = await res.json()
      if (data.success) {
        setFeedback("Étude indexée — le copilote Archiaccess AI peut s'en servir de contexte.")
        setTitle("")
        setContent("")
      } else {
        setFeedback(`Erreur : ${data.error}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="liquid-glass w-full rounded-3xl p-6">
      <h2 className="mb-1 text-sm font-medium text-muted-foreground">Ajouter une étude (Markdown)</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Indexée pour que le copilote Archiaccess AI puisse s'en servir comme contexte (recherche par similarité, pgvector).
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de l'étude"
          className="liquid-glass-inset rounded-xl px-3 py-2 text-sm outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Contenu en Markdown…"
          rows={6}
          className="liquid-glass-inset custom-scrollbar rounded-xl px-3 py-2 text-sm outline-none"
        />
        <div className="flex items-center justify-between">
          {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="chrome-black ml-auto rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isSaving ? "Indexation…" : "Ajouter au SIT"}
          </button>
        </div>
      </form>
    </div>
  )
}
