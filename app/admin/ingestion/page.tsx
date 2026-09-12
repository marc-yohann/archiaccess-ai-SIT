"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AuthGate, useUser } from "@/components/auth-gate"

// Observabilité du moteur d'ingestion national (voir CLAUDE.md, section L
// du brief Phase 3) — lit uniquement les routes /api/admin/ingestion/*
// déjà réelles (jobs/coverage/quality), aucune donnée fabriquée ici.
// Séparée de /admin (comptes employés) pour ne pas alourdir/casser cette
// page existante — voir CLAUDE.md, section 14 ("ne pas casser le SIT
// existant").

interface IngestionJob {
  id: string
  source: string
  dataset: string
  partition: string
  datasetVersion: string | null
  status: string
  recordsRead: number
  recordsInserted: number
  recordsUpdated: number
  recordsRejected: number
  errorCount: number
  lastError: string | null
  retryCount: number
  nextRunAt: string | null
  lastHeartbeatAt: string | null
  updatedAt: string
}

interface SourceCoverage {
  source: string
  label: string
  numerator: number
  denominator: number | null
  unit: string
  status: string
}

interface QualityReport {
  sirene: { totalActeurs: number; totalEtablissements: number; sirenValides: number; siretValides: number; acteursSansUniteLegale: number; siretDoublons: number; sirenDoublons: number }
  ban: { totalSites: number; coordsValides: number; sitesDoublons: number }
  georisques: { totalRisques: number; risquesVides: number; codeInseeDoublons: number }
}

export default function IngestionAdminPage() {
  return (
    <AuthGate logoSrc="/logo-ai.png" appName="Archiaccess">
      <IngestionGuard />
    </AuthGate>
  )
}

function IngestionGuard() {
  const user = useUser()
  if (!user.isAdmin) {
    return (
      <main className="glass-scene flex min-h-screen items-center justify-center p-4">
        <div className="liquid-glass w-full max-w-md rounded-3xl p-8 text-center">
          <p className="text-sm">Réservé aux administrateurs.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-muted-foreground hover:underline">
            Retour à l'accueil
          </Link>
        </div>
      </main>
    )
  }
  return <IngestionPanel />
}

function ratioLabel(numerator: number, denominator: number | null): string {
  if (denominator === null) return `${numerator.toLocaleString("fr-FR")} (dénominateur pas encore connu)`
  if (denominator === 0) return "0 / 0"
  const pct = ((numerator / denominator) * 100).toFixed(1)
  return `${numerator.toLocaleString("fr-FR")} / ${denominator.toLocaleString("fr-FR")} (${pct} %)`
}

function IngestionPanel() {
  const [jobs, setJobs] = useState<IngestionJob[]>([])
  const [coverage, setCoverage] = useState<SourceCoverage[]>([])
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    Promise.all([
      fetch("/api/admin/ingestion/jobs").then((r) => r.json()),
      fetch("/api/admin/ingestion/coverage").then((r) => r.json()),
      fetch("/api/admin/ingestion/quality").then((r) => r.json()),
    ])
      .then(([jobsData, coverageData, qualityData]) => {
        if (jobsData.success) setJobs(jobsData.jobs)
        if (coverageData.success) setCoverage(coverageData.coverage)
        if (qualityData.success) setQuality(qualityData.quality)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="glass-scene flex min-h-screen justify-center p-4">
      <div className="flex w-full max-w-5xl flex-col gap-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Administration — ingestion nationale</h1>
          <div className="flex items-center gap-3">
            <button onClick={load} className="liquid-glass-pill px-3 py-1.5 text-xs">
              Rafraîchir
            </button>
            <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
              Comptes
            </Link>
            <Link href="/" className="text-sm text-muted-foreground hover:underline">
              Accueil
            </Link>
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}

        <div className="liquid-glass rounded-3xl p-6">
          <h2 className="mb-3 font-medium">Couverture SIT (dénominateur réel, mesuré)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2">Source</th>
                  <th className="pb-2">Statut</th>
                  <th className="pb-2">Ratio</th>
                  <th className="pb-2">Unité</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((c) => (
                  <tr key={c.source} className="border-t border-white/10">
                    <td className="py-2 pr-3 font-medium">{c.label}</td>
                    <td className="py-2 pr-3">{c.status}</td>
                    <td className="py-2 pr-3">{ratioLabel(c.numerator, c.denominator)}</td>
                    <td className="py-2 text-xs text-muted-foreground">{c.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="liquid-glass rounded-3xl p-6">
          <h2 className="mb-3 font-medium">Jobs d'ingestion</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2">Source / dataset / partition</th>
                  <th className="pb-2">Statut</th>
                  <th className="pb-2">Lues</th>
                  <th className="pb-2">Insérées</th>
                  <th className="pb-2">MAJ</th>
                  <th className="pb-2">Rejets</th>
                  <th className="pb-2">Erreurs</th>
                  <th className="pb-2">Dernière erreur</th>
                  <th className="pb-2">Prochaine reprise</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-white/10">
                    <td className="py-2 pr-3">
                      {j.source}/{j.dataset}/{j.partition}
                      {j.datasetVersion ? ` (${j.datasetVersion})` : ""}
                    </td>
                    <td className="py-2 pr-3">{j.status}</td>
                    <td className="py-2 pr-3">{j.recordsRead.toLocaleString("fr-FR")}</td>
                    <td className="py-2 pr-3">{j.recordsInserted.toLocaleString("fr-FR")}</td>
                    <td className="py-2 pr-3">{j.recordsUpdated.toLocaleString("fr-FR")}</td>
                    <td className="py-2 pr-3">{j.recordsRejected.toLocaleString("fr-FR")}</td>
                    <td className="py-2 pr-3">{j.errorCount}</td>
                    <td className="py-2 pr-3 max-w-xs truncate text-xs text-muted-foreground" title={j.lastError ?? ""}>
                      {j.lastError ?? "—"}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{j.nextRunAt ? new Date(j.nextRunAt).toLocaleString("fr-FR") : "—"}</td>
                  </tr>
                ))}
                {jobs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-xs text-muted-foreground">
                      Aucun job d'ingestion pour l'instant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {quality && (
          <div className="liquid-glass rounded-3xl p-6">
            <h2 className="mb-3 font-medium">Qualité des données (mesurée, jamais estimée)</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">SIRENE</h3>
                <p className="text-sm">{quality.sirene.totalActeurs.toLocaleString("fr-FR")} acteurs, {quality.sirene.totalEtablissements.toLocaleString("fr-FR")} établissements</p>
                <p className="text-xs text-muted-foreground">SIREN valides : {quality.sirene.sirenValides.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-muted-foreground">SIRET valides : {quality.sirene.siretValides.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-muted-foreground">Sans unité légale : {quality.sirene.acteursSansUniteLegale.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-muted-foreground">Doublons SIREN/SIRET : {quality.sirene.sirenDoublons} / {quality.sirene.siretDoublons}</p>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">BAN</h3>
                <p className="text-sm">{quality.ban.totalSites.toLocaleString("fr-FR")} sites</p>
                <p className="text-xs text-muted-foreground">Coordonnées valides : {quality.ban.coordsValides.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-muted-foreground">Doublons : {quality.ban.sitesDoublons}</p>
              </div>
              <div>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">Géorisques</h3>
                <p className="text-sm">{quality.georisques.totalRisques.toLocaleString("fr-FR")} communes</p>
                <p className="text-xs text-muted-foreground">Sans donnée sismique/radon : {quality.georisques.risquesVides.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-muted-foreground">Doublons : {quality.georisques.codeInseeDoublons}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
