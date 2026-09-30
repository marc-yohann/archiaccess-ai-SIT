"use client"

import { useEffect, useState } from "react"
import { Activity, Building2, Gauge, Layers, RefreshCw, ShieldCheck } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { CadreAdmin, Chiffre, ModuleAdmin, Pastille } from "@/components/admin/cadre-admin"

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
  cadastre: {
    totalParcelles: number
    geomPresentes: number
    geomValides: number
    geomInvalides: number
    geomVides: number
    sridCorrect: number
    idusValides: number
    iduDoublons: number
  }
  siteParcelle: {
    totalSites: number
    totalParcelles: number
    relationsTotal: number
    relationsSpatialesContains: number
    relationsSpatialesNearby: number
    relationsDeterministic: number
    sitesAmbigus: number
    lignesAmbigues: number
    sitesSansParcelle: number
    sitesAvec1Parcelle: number
    sitesAvecPlusieursParcelles: number
    parcellesSansSite: number
    parcellesAvec1Site: number
    parcellesAvecPlusieursSites: number
  }
  batimentPhysique: {
    total: number
    geomPresentes: number
    geomValides: number
    geomInvalides: number
    geomTypes: Record<string, number>
    rnbIdDoublons: number
    relationsParcelle: {
      total: number
      valid: number
      notFound: number
      invalidFormat: number
      ambiguous: number
      batimentsAucuneReference: number
      batimentsSansParcelleValidee: number
      batimentsAvec1Parcelle: number
      batimentsAvecPlusieursParcelles: number
    }
    relationsSite: {
      total: number
      valid: number
      notFound: number
      invalidFormat: number
      ambiguous: number
      batimentsAucuneReference: number
      batimentsSansSiteValide: number
      batimentsAvec1Site: number
      batimentsAvecPlusieursSites: number
    }
  }
}

interface RnbPartition {
  departement: string
  status: string
  originalSizeBytes: string | null
  datasetVersion: string | null
  totalChunks: number | null
  totalRows: number | null
  batiments: number
  recordsRead: number
  errorCount: number
  lastError: string | null
  nextRunAt: string | null
  lastUpdatedAt: string | null
}

interface RnbPartitionsResponse {
  summary: {
    total: number
    pending: number
    downloading: number
    staged: number
    chunked: number
    running: number
    done: number
    failed: number
    paused: number
    batimentsTotal: number
  }
  partitions: RnbPartition[]
}

export default function IngestionAdminPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <IngestionPanel />
    </AuthGate>
  )
}

function ratioLabel(numerator: number, denominator: number | null): string {
  if (denominator === null) return `${numerator.toLocaleString("fr-FR")} (dénominateur pas encore connu)`
  if (denominator === 0) return "0 / 0"
  const pct = ((numerator / denominator) * 100).toFixed(1)
  return `${numerator.toLocaleString("fr-FR")} / ${denominator.toLocaleString("fr-FR")} (${pct} %)`
}

// Libellés des états (jobs, manifestes, partitions, couverture) : les
// valeurs viennent telles quelles des routes /api/admin/ingestion/*, on ne
// fait que les traduire ; une valeur inconnue s'affiche telle quelle.
const ETATS: Record<string, { libelle: string; ton: "neutre" | "sombre" | "alerte" }> = {
  PENDING: { libelle: "En attente", ton: "neutre" },
  pending: { libelle: "En attente", ton: "neutre" },
  RUNNING: { libelle: "En cours", ton: "sombre" },
  running: { libelle: "En cours", ton: "sombre" },
  "en cours": { libelle: "En cours", ton: "sombre" },
  PAUSED: { libelle: "En pause", ton: "neutre" },
  paused: { libelle: "En pause", ton: "neutre" },
  COMPLETED: { libelle: "Terminé", ton: "sombre" },
  done: { libelle: "Terminé", ton: "sombre" },
  READY: { libelle: "Prêt", ton: "sombre" },
  FAILED: { libelle: "En échec", ton: "alerte" },
  failed: { libelle: "En échec", ton: "alerte" },
  FAILED_REQUIRES_REVIEW: { libelle: "À examiner", ton: "alerte" },
  CANCELLED: { libelle: "Annulé", ton: "neutre" },
  STAGING: { libelle: "Préparation", ton: "neutre" },
  PREPROCESSING: { libelle: "Préparation", ton: "neutre" },
  downloading: { libelle: "Téléchargement", ton: "neutre" },
  staged: { libelle: "Téléchargé", ton: "neutre" },
  chunked: { libelle: "Découpé", ton: "neutre" },
  "non démarré": { libelle: "Non démarré", ton: "neutre" },
  info: { libelle: "Information", ton: "neutre" },
}

function Etat({ valeur }: { valeur: string }) {
  const e = ETATS[valeur]
  return <Pastille ton={e?.ton ?? "neutre"}>{e?.libelle ?? valeur}</Pastille>
}

const nb = (n: number) => n.toLocaleString("fr-FR")

// Ligne « libellé : valeur » des blocs de qualité.
function Mesure({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-foreground/[0.06] py-1.5 text-[13px] first:border-t-0">
      <span className="text-muted-foreground">{libelle}</span>
      <span className="shrink-0 font-mono tabular-nums">{valeur}</span>
    </div>
  )
}

function Bloc({ titre, resume, children }: { titre: string; resume?: string; children: React.ReactNode }) {
  return (
    <div className="liquid-glass-soft flex flex-col rounded-[18px] px-4 py-3">
      <h4 className="text-[13px] font-bold">{titre}</h4>
      {resume && <p className="mb-1 text-[13px] text-muted-foreground">{resume}</p>}
      {children}
    </div>
  )
}

const TH = "pb-2 pr-3 text-left text-xs font-medium text-muted-foreground"
const TD = "py-2 pr-3 align-top"

function IngestionPanel() {
  const [jobs, setJobs] = useState<IngestionJob[]>([])
  const [coverage, setCoverage] = useState<SourceCoverage[]>([])
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [rnbPartitions, setRnbPartitions] = useState<RnbPartitionsResponse | null>(null)
  const [showAllPartitions, setShowAllPartitions] = useState(false)
  const [loading, setLoading] = useState(true)
  const [majLe, setMajLe] = useState<Date | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch("/api/admin/ingestion/jobs").then((r) => r.json()),
      fetch("/api/admin/ingestion/coverage").then((r) => r.json()),
      fetch("/api/admin/ingestion/quality").then((r) => r.json()),
      fetch("/api/admin/ingestion/rnb-partitions").then((r) => r.json()),
    ])
      .then(([jobsData, coverageData, qualityData, rnbPartitionsData]) => {
        if (jobsData.success) setJobs(jobsData.jobs)
        if (coverageData.success) setCoverage(coverageData.coverage)
        if (qualityData.success) setQuality(qualityData.quality)
        if (rnbPartitionsData.success) setRnbPartitions({ summary: rnbPartitionsData.summary, partitions: rnbPartitionsData.partitions })
        setMajLe(new Date())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const enEchec = jobs.filter((j) => j.status === "FAILED" || j.status === "FAILED_REQUIRES_REVIEW").length
  const enCours = jobs.filter((j) => j.status === "RUNNING").length

  return (
    <CadreAdmin
      titre="Données publiques"
      description="Suivi des chargements nationaux de données publiques : couverture, traitements, qualité. Tout est mesuré en base, rien n'est estimé."
      actions={
        <>
          {majLe && <span className="text-xs text-muted-foreground">Mis à jour à {majLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
          <button type="button" onClick={load} disabled={loading} className="liquid-glass-btn flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Rafraîchir
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Chiffre valeur={loading && !majLe ? "–" : nb(jobs.length)} libelle="Traitements suivis" accent />
        <Chiffre valeur={loading && !majLe ? "–" : nb(enCours)} libelle="En cours" />
        <Chiffre valeur={loading && !majLe ? "–" : nb(enEchec)} libelle="En échec ou à examiner" />
        <Chiffre valeur={rnbPartitions ? nb(rnbPartitions.summary.batimentsTotal) : "–"} libelle="Bâtiments en base" />
      </div>

      <ModuleAdmin icone={Gauge} titre="Couverture" aside="Dénominateur réel, mesuré">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={TH}>Source</th>
                <th className={TH}>État</th>
                <th className={TH}>Avancement</th>
                <th className={TH}>Unité</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => {
                const pct = c.denominator ? Math.min(100, (c.numerator / c.denominator) * 100) : null
                return (
                  <tr key={c.source} className="border-t border-foreground/[0.06]">
                    <td className={`${TD} font-semibold`}>{c.label}</td>
                    <td className={TD}>
                      <Etat valeur={c.status} />
                    </td>
                    <td className={`${TD} min-w-[14rem]`}>
                      <span className="font-mono text-[12.5px] tabular-nums">{ratioLabel(c.numerator, c.denominator)}</span>
                      {pct !== null && (
                        <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
                          <span className="block h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-xs text-muted-foreground`}>{c.unit}</td>
                  </tr>
                )
              })}
              {coverage.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                    Aucune mesure de couverture disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ModuleAdmin>

      <ModuleAdmin icone={Activity} titre="Traitements" aside={`${nb(jobs.length)} au total`}>
        <div className="custom-scrollbar max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/80 backdrop-blur">
              <tr>
                <th className={TH}>Source · jeu · partition</th>
                <th className={TH}>État</th>
                <th className={`${TH} text-right`}>Lues</th>
                <th className={`${TH} text-right`}>Insérées</th>
                <th className={`${TH} text-right`}>Mises à jour</th>
                <th className={`${TH} text-right`}>Rejets</th>
                <th className={`${TH} text-right`}>Erreurs</th>
                <th className={TH}>Dernière erreur</th>
                <th className={TH}>Prochaine reprise</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-foreground/[0.06]">
                  <td className={TD}>
                    <span className="font-semibold">{j.source}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {j.dataset} · {j.partition}
                    </span>
                    {j.datasetVersion && <span className="block text-xs text-muted-foreground">Version {j.datasetVersion}</span>}
                  </td>
                  <td className={TD}>
                    <Etat valeur={j.status} />
                  </td>
                  <td className={`${TD} text-right font-mono tabular-nums`}>{nb(j.recordsRead)}</td>
                  <td className={`${TD} text-right font-mono tabular-nums`}>{nb(j.recordsInserted)}</td>
                  <td className={`${TD} text-right font-mono tabular-nums`}>{nb(j.recordsUpdated)}</td>
                  <td className={`${TD} text-right font-mono tabular-nums`}>{nb(j.recordsRejected)}</td>
                  <td className={`${TD} text-right font-mono tabular-nums ${j.errorCount ? "text-destructive" : ""}`}>{j.errorCount}</td>
                  <td className={`${TD} max-w-xs truncate text-xs text-muted-foreground`} title={j.lastError ?? ""}>
                    {j.lastError ?? "—"}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-xs text-muted-foreground`}>{j.nextRunAt ? new Date(j.nextRunAt).toLocaleString("fr-FR") : "—"}</td>
                </tr>
              ))}
              {jobs.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-xs text-muted-foreground">
                    Aucun traitement pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ModuleAdmin>

      {quality && (
        <ModuleAdmin icone={ShieldCheck} titre="Qualité des données" aside="Mesurée, jamais estimée">
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            <Bloc titre="Entreprises (SIRENE)" resume={`${nb(quality.sirene.totalActeurs)} entreprises, ${nb(quality.sirene.totalEtablissements)} établissements`}>
              <Mesure libelle="SIREN valides" valeur={nb(quality.sirene.sirenValides)} />
              <Mesure libelle="SIRET valides" valeur={nb(quality.sirene.siretValides)} />
              <Mesure libelle="Sans unité légale" valeur={nb(quality.sirene.acteursSansUniteLegale)} />
              <Mesure libelle="Doublons SIREN / SIRET" valeur={`${quality.sirene.sirenDoublons} / ${quality.sirene.siretDoublons}`} />
            </Bloc>
            <Bloc titre="Adresses (BAN)" resume={`${nb(quality.ban.totalSites)} sites`}>
              <Mesure libelle="Coordonnées valides" valeur={nb(quality.ban.coordsValides)} />
              <Mesure libelle="Doublons" valeur={quality.ban.sitesDoublons} />
            </Bloc>
            <Bloc titre="Risques (Géorisques)" resume={`${nb(quality.georisques.totalRisques)} communes`}>
              <Mesure libelle="Sans donnée sismique ou radon" valeur={nb(quality.georisques.risquesVides)} />
              <Mesure libelle="Doublons" valeur={quality.georisques.codeInseeDoublons} />
            </Bloc>
            <Bloc titre="Cadastre" resume={`${nb(quality.cadastre.totalParcelles)} parcelles`}>
              <Mesure libelle="Géométries valides / présentes" valeur={`${nb(quality.cadastre.geomValides)} / ${nb(quality.cadastre.geomPresentes)}`} />
              <Mesure libelle="Géométries invalides · vides" valeur={`${quality.cadastre.geomInvalides} · ${quality.cadastre.geomVides}`} />
              <Mesure libelle="Projection correcte" valeur={nb(quality.cadastre.sridCorrect)} />
              <Mesure libelle="Identifiants valides · doublons" valeur={`${nb(quality.cadastre.idusValides)} · ${quality.cadastre.iduDoublons}`} />
            </Bloc>
          </div>

          <h4 className="mt-2 flex items-center gap-2 text-[14px] font-bold">
            <Layers size={15} />
            Sites et parcelles
          </h4>
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            <Bloc titre="Volumes" resume={`${nb(quality.siteParcelle.totalSites)} sites · ${nb(quality.siteParcelle.totalParcelles)} parcelles`}>
              <Mesure libelle="Relations au total" valeur={nb(quality.siteParcelle.relationsTotal)} />
              <Mesure libelle="Spatiales (inclusion)" valeur={nb(quality.siteParcelle.relationsSpatialesContains)} />
              <Mesure libelle="Spatiales (proximité)" valeur={nb(quality.siteParcelle.relationsSpatialesNearby)} />
              <Mesure libelle="Déterministes" valeur={nb(quality.siteParcelle.relationsDeterministic)} />
            </Bloc>
            <Bloc titre="Côté site" resume="Relations non ambiguës">
              <Mesure libelle="Sans parcelle" valeur={nb(quality.siteParcelle.sitesSansParcelle)} />
              <Mesure libelle="Avec 1 parcelle" valeur={nb(quality.siteParcelle.sitesAvec1Parcelle)} />
              <Mesure libelle="Avec plusieurs parcelles" valeur={nb(quality.siteParcelle.sitesAvecPlusieursParcelles)} />
            </Bloc>
            <Bloc titre="Côté parcelle" resume="Relations non ambiguës">
              <Mesure libelle="Sans site" valeur={nb(quality.siteParcelle.parcellesSansSite)} />
              <Mesure libelle="Avec 1 site" valeur={nb(quality.siteParcelle.parcellesAvec1Site)} />
              <Mesure libelle="Avec plusieurs sites" valeur={nb(quality.siteParcelle.parcellesAvecPlusieursSites)} />
            </Bloc>
            <Bloc titre="Ambiguïtés" resume="Jamais tranchées arbitrairement">
              <Mesure libelle="Sites ambigus" valeur={nb(quality.siteParcelle.sitesAmbigus)} />
              <Mesure libelle="Lignes candidates ambiguës" valeur={nb(quality.siteParcelle.lignesAmbigues)} />
            </Bloc>
          </div>

          <h4 className="mt-2 flex items-center gap-2 text-[14px] font-bold">
            <Building2 size={15} />
            Bâtiments (RNB)
          </h4>
          <div className="grid gap-2.5 md:grid-cols-3">
            <Bloc titre="Géométrie" resume={`${nb(quality.batimentPhysique.total)} bâtiments`}>
              <Mesure libelle="Présentes / valides" valeur={`${nb(quality.batimentPhysique.geomPresentes)} / ${nb(quality.batimentPhysique.geomValides)}`} />
              <Mesure libelle="Invalides" valeur={quality.batimentPhysique.geomInvalides} />
              <Mesure libelle="Doublons d'identifiant" valeur={quality.batimentPhysique.rnbIdDoublons} />
              <Mesure
                libelle="Types"
                valeur={
                  Object.entries(quality.batimentPhysique.geomTypes)
                    .map(([t, c]) => `${t} ${nb(c)}`)
                    .join(" · ") || "—"
                }
              />
            </Bloc>
            <Bloc titre="Références aux parcelles" resume="Fournies par le registre">
              <Mesure libelle="Total" valeur={nb(quality.batimentPhysique.relationsParcelle.total)} />
              <Mesure libelle="Valides · non trouvées" valeur={`${nb(quality.batimentPhysique.relationsParcelle.valid)} · ${nb(quality.batimentPhysique.relationsParcelle.notFound)}`} />
              <Mesure libelle="Format invalide · ambiguës" valeur={`${quality.batimentPhysique.relationsParcelle.invalidFormat} · ${quality.batimentPhysique.relationsParcelle.ambiguous}`} />
              <Mesure
                libelle="Bâtiments avec 1 / plusieurs parcelles"
                valeur={`${nb(quality.batimentPhysique.relationsParcelle.batimentsAvec1Parcelle)} / ${nb(quality.batimentPhysique.relationsParcelle.batimentsAvecPlusieursParcelles)}`}
              />
              <Mesure libelle="Sans aucune référence" valeur={nb(quality.batimentPhysique.relationsParcelle.batimentsAucuneReference)} />
              <Mesure libelle="Sans parcelle validée" valeur={nb(quality.batimentPhysique.relationsParcelle.batimentsSansParcelleValidee)} />
            </Bloc>
            <Bloc titre="Références aux adresses" resume="Fournies par le registre">
              <Mesure libelle="Total" valeur={nb(quality.batimentPhysique.relationsSite.total)} />
              <Mesure libelle="Valides · non trouvées" valeur={`${nb(quality.batimentPhysique.relationsSite.valid)} · ${nb(quality.batimentPhysique.relationsSite.notFound)}`} />
              <Mesure libelle="Format invalide · ambiguës" valeur={`${quality.batimentPhysique.relationsSite.invalidFormat} · ${quality.batimentPhysique.relationsSite.ambiguous}`} />
              <Mesure
                libelle="Bâtiments avec 1 / plusieurs sites"
                valeur={`${nb(quality.batimentPhysique.relationsSite.batimentsAvec1Site)} / ${nb(quality.batimentPhysique.relationsSite.batimentsAvecPlusieursSites)}`}
              />
              <Mesure libelle="Sans aucune référence" valeur={nb(quality.batimentPhysique.relationsSite.batimentsAucuneReference)} />
              <Mesure libelle="Sans site validé" valeur={nb(quality.batimentPhysique.relationsSite.batimentsSansSiteValide)} />
            </Bloc>
          </div>
        </ModuleAdmin>
      )}

      {rnbPartitions && (
        <ModuleAdmin icone={Building2} titre="Bâtiments : les 101 départements" aside="Préparation, aucun chargement national lancé">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {[
              ["Total", rnbPartitions.summary.total],
              ["En attente", rnbPartitions.summary.pending],
              ["Téléchargement", rnbPartitions.summary.downloading],
              ["Téléchargés", rnbPartitions.summary.staged],
              ["Découpés", rnbPartitions.summary.chunked],
              ["En cours", rnbPartitions.summary.running],
              ["Terminés", rnbPartitions.summary.done],
              ["Échec / pause", `${rnbPartitions.summary.failed} / ${rnbPartitions.summary.paused}`],
            ].map(([l, v]) => (
              <div key={l as string} className="liquid-glass-soft rounded-[14px] px-3 py-2">
                <p className="text-[11.5px] text-muted-foreground">{l}</p>
                <p className="font-mono text-[15px] font-semibold tabular-nums">{v}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAllPartitions((v) => !v)}
            className="liquid-glass-btn w-fit rounded-xl px-3.5 py-2 text-[13px] font-semibold"
            aria-expanded={showAllPartitions}
          >
            {showAllPartitions ? "Masquer le détail par département" : "Voir le détail par département"}
          </button>

          {showAllPartitions && (
            <div className="custom-scrollbar max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/80 backdrop-blur">
                  <tr>
                    <th className={TH}>Département</th>
                    <th className={TH}>État</th>
                    <th className={TH}>Version</th>
                    <th className={`${TH} text-right`}>Morceaux</th>
                    <th className={`${TH} text-right`}>Bâtiments</th>
                    <th className={`${TH} text-right`}>Erreurs</th>
                    <th className={TH}>Dernière erreur</th>
                  </tr>
                </thead>
                <tbody>
                  {rnbPartitions.partitions.map((p) => (
                    <tr key={p.departement} className="border-t border-foreground/[0.06]">
                      <td className="py-1.5 pr-3 font-mono font-semibold">{p.departement}</td>
                      <td className="py-1.5 pr-3">
                        <Etat valeur={p.status} />
                      </td>
                      <td className="py-1.5 pr-3 text-xs text-muted-foreground">{p.datasetVersion ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-xs tabular-nums">{p.totalChunks ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-xs tabular-nums">{nb(p.batiments)}</td>
                      <td className={`py-1.5 pr-3 text-right font-mono text-xs tabular-nums ${p.errorCount ? "text-destructive" : ""}`}>{p.errorCount}</td>
                      <td className="max-w-xs truncate py-1.5 text-xs text-muted-foreground" title={p.lastError ?? ""}>
                        {p.lastError ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModuleAdmin>
      )}
    </CadreAdmin>
  )
}
