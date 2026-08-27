"use client"

import { useState } from "react"
import Link from "next/link"
import { AuthGate } from "@/components/auth-gate"
import type { AddressResult } from "@/lib/data-sources/ban"

// Premier connecteur du hub SIT : recherche d'adresse (Base Adresse
// Nationale). Les futurs connecteurs (cadastre, Géorisques, DVF...)
// s'articuleront autour d'une adresse/parcelle sélectionnée ici — voir
// CLAUDE.md, "Prochaines étapes".
export default function SitPage() {
  return (
    <AuthGate>
      <AddressSearch />
    </AuthGate>
  )
}

function AddressSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AddressResult[]>([])
  const [selected, setSelected] = useState<AddressResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || isSearching) return
    setIsSearching(true)
    setError("")
    setSelected(null)
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
    <main className="glass-scene flex min-h-screen justify-center p-4">
      <div className="liquid-glass w-full max-w-2xl rounded-3xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-medium">Système d'Information Technique</h1>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Accueil
          </Link>
        </div>

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
              onClick={() => setSelected(r)}
              className="liquid-glass-soft block w-full rounded-xl p-3 text-left text-sm transition-shadow hover:shadow-md"
            >
              <p className="font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.context}</p>
            </button>
          ))}
        </div>

        {selected && (
          <div className="liquid-glass-panel mt-4 rounded-2xl p-4 text-sm">
            <h2 className="mb-2 font-medium">{selected.label}</h2>
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
            <p className="mt-3 text-xs text-muted-foreground">
              Cadastre, Géorisques, DVF et les autres sources arriveront ici pour cette localisation — pas encore construits.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
