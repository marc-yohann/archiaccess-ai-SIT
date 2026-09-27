"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AuthGate } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { EtapeVue, type EtatEtape } from "@/components/referentiel/etape-vue"
import { ProfilChamps, profilVersRequete, type ProfilSaisi } from "@/components/referentiel/profil-champs"
import { PHASES, REFERENTIEL_VERSION } from "@/lib/referentiel"
import { MISSIONS, MONTAGES, STATUTS_MOA, TYPOLOGIES } from "@/lib/referentiel/libelles"
import { profilComplet, type EtapeStatut } from "@/lib/referentiel/profil"

// Espace projet : la méthode Archiaccess appliquée à une opération. Les
// étapes viennent du référentiel (lib/referentiel) ; seuls leur avancement
// et les notes de l'ingénieur sont propres au projet (ProjetEtape). Les
// variantes affichées dépendent du profil de l'opération — jamais
// calculées sur un profil incomplet.

interface EtapeProjet {
  etapeCode: string
  statut: EtapeStatut
  note: string | null
  updatedAt: string
  updatedBy: { id: string; name: string } | null
}

interface ProjetDetail {
  id: string
  nom: string
  description: string | null
  statutMoa: string | null
  montage: string | null
  typologie: string | null
  mission: string | null
  rehabilitation: boolean
  createdBy: { name: string } | null
  createdAt: string
  etapes: EtapeProjet[]
  sites: unknown[]
  acteurs: unknown[]
  avisMarches: unknown[]
  lots: unknown[]
  documentSitLinks: unknown[]
}

function libelle(table: Record<string, string>, v: string | null) {
  return v && v in table ? table[v] : "Non renseigné"
}

function EspaceProjet() {
  const { id } = useParams<{ id: string }>()
  const [projet, setProjet] = useState<ProjetDetail | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [edition, setEdition] = useState(false)
  const [profilSaisi, setProfilSaisi] = useState<ProfilSaisi | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    fetch(`/api/sit/projets/${id}`)
      .then((r) => r.json())
      .then((d) => (d.success ? setProjet(d.projet) : setErreur(d.error ?? "Chargement impossible.")))
      .catch(() => setErreur("Chargement impossible."))
  }, [id])

  if (erreur) return <Cadre><p className="text-sm text-red-600">{erreur}</p></Cadre>
  if (!projet) return <Cadre><p className="text-sm text-muted-foreground">Chargement…</p></Cadre>

  const profil = profilComplet(projet)
  const etats = new Map(projet.etapes.map((e) => [e.etapeCode, e]))

  function ouvrirEdition() {
    if (!projet) return
    setProfilSaisi({
      statutMoa: projet.statutMoa ?? "",
      montage: projet.montage ?? "",
      typologie: projet.typologie ?? "",
      mission: projet.mission ?? "",
      rehabilitation: projet.rehabilitation,
    })
    setEdition(true)
  }

  async function enregistrerProfil() {
    if (!profilSaisi) return
    setEnCours(true)
    try {
      const r = await fetch(`/api/sit/projets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilVersRequete(profilSaisi)),
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error ?? "Enregistrement impossible.")
      setProjet((p) => (p ? { ...p, ...d.projet } : p))
      setEdition(false)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.")
    } finally {
      setEnCours(false)
    }
  }

  async function enregistrerEtape(code: string, maj: { statut?: EtapeStatut; note?: string | null }) {
    const r = await fetch(`/api/sit/projets/${id}/etapes/${encodeURIComponent(code)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(maj),
    })
    const d = await r.json()
    if (!d.success) throw new Error(d.error ?? "Enregistrement impossible.")
    setProjet((p) => (p ? { ...p, etapes: [...p.etapes.filter((e) => e.etapeCode !== code), d.etape] } : p))
  }

  const rattachements = [
    [projet.sites.length, "site(s)"],
    [projet.acteurs.length, "acteur(s)"],
    [projet.avisMarches.length, "avis de marché"],
    [projet.lots.length, "lot(s)"],
    [projet.documentSitLinks.length, "document(s)"],
  ].filter(([n]) => (n as number) > 0)

  return (
    <Cadre>
      <div className="liquid-glass-panel rounded-2xl p-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Espace projet — méthode Archiaccess v{REFERENTIEL_VERSION}</p>
        <h2 className="mt-1 text-xl font-semibold">{projet.nom}</h2>
        {projet.description && <p className="mt-1 text-sm text-muted-foreground">{projet.description}</p>}

        {!edition ? (
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Maître d'ouvrage : </span>{libelle(STATUTS_MOA, projet.statutMoa)}</p>
            <p><span className="text-muted-foreground">Montage : </span>{libelle(MONTAGES, projet.montage)}</p>
            <p><span className="text-muted-foreground">Ouvrage : </span>{libelle(TYPOLOGIES, projet.typologie)}{projet.rehabilitation ? " — réhabilitation / site occupé" : ""}</p>
            <p><span className="text-muted-foreground">Mission Archiaccess : </span>{libelle(MISSIONS, projet.mission)}</p>
            <div className="sm:col-span-2">
              <button onClick={ouvrirEdition} className="liquid-glass-pill rounded-xl px-3 py-1.5 text-xs">
                Modifier le profil de l'opération
              </button>
            </div>
          </div>
        ) : (
          profilSaisi && (
            <div className="mt-4 space-y-3">
              <ProfilChamps valeur={profilSaisi} onChange={setProfilSaisi} />
              <div className="flex gap-2">
                <button onClick={() => void enregistrerProfil()} disabled={enCours} className="chrome-black rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50">
                  Enregistrer
                </button>
                <button onClick={() => setEdition(false)} className="liquid-glass-pill rounded-xl px-4 py-2 text-sm">
                  Annuler
                </button>
              </div>
            </div>
          )
        )}

        {!profil && !edition && (
          <p className="liquid-glass-inset mt-4 rounded-xl px-3 py-2 text-sm">
            Renseignez les quatre axes du profil pour n'afficher que les variantes et livrables propres à cette opération. En attente, toutes les variantes sont affichées.
          </p>
        )}
        {rattachements.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Rattachés : {rattachements.map(([n, l]) => `${n} ${l}`).join(" · ")}</p>
        )}
      </div>

      {PHASES.map((phase) => {
        const traitees = phase.etapes.filter((e) => {
          const s = etats.get(e.code)?.statut
          return s === "FAIT" || s === "SANS_OBJET"
        }).length
        return (
          <section key={phase.numero} className="liquid-glass-panel rounded-2xl p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Phase {phase.numero}</p>
                <h3 className="text-base font-semibold">{phase.titre}</h3>
              </div>
              {phase.etapes.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {traitees} / {phase.etapes.length} étapes traitées
                </span>
              )}
            </div>
            {phase.etapes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Phase de la méthode en cours de rédaction.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {phase.etapes.map((e) => {
                  const etat = etats.get(e.code)
                  const etatVue: EtatEtape | undefined = etat
                    ? { statut: etat.statut, note: etat.note, updatedAt: etat.updatedAt, updatedBy: etat.updatedBy }
                    : undefined
                  return (
                    <EtapeVue
                      key={e.code}
                      etape={e}
                      profil={profil}
                      etat={etatVue}
                      onEnregistrer={(maj) => enregistrerEtape(e.code, maj)}
                    />
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </Cadre>
  )
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="glass-scene custom-scrollbar flex h-screen w-full items-start justify-center overflow-y-auto p-4">
      <div className="flex w-full max-w-5xl flex-col gap-4 pb-10">
        <SitNav titre="Espace projet" />
        {children}
      </div>
    </main>
  )
}

export default function EspaceProjetPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <EspaceProjet />
    </AuthGate>
  )
}
