"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronRight } from "lucide-react"
import { AuthGate, useUser } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { PanneauIA } from "@/components/panneau-ia"
import { EtapeDetail, type MajEtape } from "@/components/projet/etape-detail"
import { ProfilChamps, profilVersRequete, type ProfilSaisi } from "@/components/referentiel/profil-champs"
import { PHASES, trouverEtape } from "@/lib/referentiel"
import { avancementPhases, estTraitee, indexEtats, phaseCourante, prochaineEtape, type EtatEtapeProjet } from "@/lib/referentiel/avancement"
import { contexteProjet } from "@/lib/referentiel/contexte-ia"
import { MISSIONS, MONTAGES, STATUTS_MOA, TYPOLOGIES } from "@/lib/referentiel/libelles"
import { profilComplet } from "@/lib/referentiel/profil"

// Espace projet : la méthode Archiaccess appliquée à une opération, avec
// Archiaccess AI à portée de main. À gauche les phases et leurs étapes, au
// centre l'étape ouverte (actions, livrables, vigilances, particularités de
// l'opération, notes, échéance), à droite le copilote, qui reçoit en
// contexte le projet et l'étape ouverte. Les étapes viennent du
// référentiel (lib/referentiel) ; seuls leur avancement, leur échéance et
// les notes sont propres au projet (ProjetEtape).

type EtapeProjet = EtatEtapeProjet & { updatedAt: string; updatedBy: { id: string; name: string } | null }

interface ProjetDetail {
  id: string
  nom: string
  description: string | null
  statutMoa: string | null
  montage: string | null
  typologie: string | null
  mission: string | null
  rehabilitation: boolean
  etapes: EtapeProjet[]
  sites: unknown[]
  acteurs: unknown[]
  avisMarches: unknown[]
  lots: unknown[]
  documentSitLinks: unknown[]
}

const lib = (table: Record<string, string>, v: string | null) => (v && v in table ? table[v] : null)

const PUCE: Record<string, string> = {
  FAIT: "bg-foreground",
  EN_COURS: "border-2 border-foreground",
  A_FAIRE: "border-[1.5px] border-foreground/30",
  SANS_OBJET: "border border-dashed border-foreground/40",
}

function EspaceProjet() {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const user = useUser()
  const [projet, setProjet] = useState<ProjetDetail | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [codeOuvert, setCodeOuvert] = useState<string | null>(params.get("etape"))
  const [phasesOuvertes, setPhasesOuvertes] = useState<Set<number>>(new Set())
  const [edition, setEdition] = useState<ProfilSaisi | null>(null)
  const [demandeIA, setDemandeIA] = useState<{ id: number; texte: string } | null>(null)

  useEffect(() => {
    fetch(`/api/sit/projets/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return setErreur(d.error ?? "Chargement impossible.")
        const p: ProjetDetail = d.projet
        setProjet(p)
        const etats = indexEtats(p.etapes)
        // Étape ouverte par défaut : celle demandée dans l'adresse, sinon la
        // prochaine étape de la méthode ; sa phase est dépliée.
        const code = (params.get("etape") && trouverEtape(params.get("etape")!)?.code) || prochaineEtape(etats)?.code || PHASES[0].etapes[0].code
        setCodeOuvert(code)
        const phase = PHASES.find((ph) => ph.etapes.some((e) => e.code === code)) ?? phaseCourante(etats)
        setPhasesOuvertes(new Set([phase.numero]))
      })
      .catch(() => setErreur("Chargement impossible."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const etats = useMemo(() => indexEtats(projet?.etapes ?? []), [projet])
  const etapeOuverte = codeOuvert ? trouverEtape(codeOuvert) ?? null : null

  if (erreur) return <Cadre titre="Espace projet"><p className="text-sm text-red-600">{erreur}</p></Cadre>
  if (!projet) return <Cadre titre="Espace projet"><p className="text-sm text-muted-foreground">Chargement…</p></Cadre>

  const profil = profilComplet(projet)
  const phases = avancementPhases(etats)

  async function enregistrerEtape(code: string, maj: MajEtape) {
    const r = await fetch(`/api/sit/projets/${id}/etapes/${encodeURIComponent(code)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(maj),
    })
    const d = await r.json()
    if (!d.success) throw new Error(d.error ?? "Enregistrement impossible.")
    setProjet((p) => (p ? { ...p, etapes: [...p.etapes.filter((e) => e.etapeCode !== code), d.etape] } : p))
  }

  async function enregistrerProfil() {
    if (!edition) return
    const r = await fetch(`/api/sit/projets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profilVersRequete(edition)),
    })
    const d = await r.json()
    if (!d.success) return setErreur(d.error ?? "Enregistrement impossible.")
    setProjet((p) => (p ? { ...p, ...d.projet, etapes: p.etapes } : p))
    setEdition(null)
  }

  function basculerPhase(n: number) {
    setPhasesOuvertes((s) => {
      const t = new Set(s)
      if (t.has(n)) t.delete(n)
      else t.add(n)
      return t
    })
  }

  const pastilles = [lib(STATUTS_MOA, projet.statutMoa), lib(TYPOLOGIES, projet.typologie), lib(MONTAGES, projet.montage), lib(MISSIONS, projet.mission)].filter(Boolean) as string[]
  const rattaches = [
    [projet.sites.length, "site"],
    [projet.acteurs.length, "acteur"],
    [projet.avisMarches.length, "avis de marché"],
    [projet.lots.length, "lot"],
    [projet.documentSitLinks.length, "document"],
  ].filter(([n]) => (n as number) > 0) as [number, string][]

  return (
    <Cadre titre={projet.nom} sousTitre={<Link href="/sit/projets" className="hover:underline">Projets</Link>}>
      <div className="flex flex-wrap items-center gap-2">
        {pastilles.map((t) => (
          <span key={t} className="liquid-glass-pill rounded-full px-3 py-1 text-xs">
            {t}
          </span>
        ))}
        {projet.rehabilitation && <span className="liquid-glass-pill rounded-full px-3 py-1 text-xs">Réhabilitation ou site occupé</span>}
        {!profil && <span className="text-xs text-muted-foreground">Profil de l'opération incomplet : les particularités de l'opération ne peuvent pas être affichées.</span>}
        <button
          type="button"
          onClick={() =>
            setEdition(
              edition
                ? null
                : { statutMoa: projet.statutMoa ?? "", montage: projet.montage ?? "", typologie: projet.typologie ?? "", mission: projet.mission ?? "", rehabilitation: projet.rehabilitation },
            )
          }
          className="text-xs text-muted-foreground hover:underline"
        >
          {edition ? "Fermer" : "Modifier le profil"}
        </button>
        {rattaches.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {rattaches.map(([n, l]) => `${n} ${l}${n > 1 && !l.endsWith("marché") ? "s" : ""}`).join(" · ")}
          </span>
        )}
      </div>

      {edition && (
        <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
          <ProfilChamps valeur={edition} onChange={setEdition} />
          <button type="button" onClick={() => void enregistrerProfil()} className="chrome-black rounded-xl px-4 py-2 text-sm text-white">
            Enregistrer le profil
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <nav className="liquid-glass-panel custom-scrollbar flex shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl p-3 lg:w-80" aria-label="Phases et étapes">
          {phases.map(({ phase, total, traitees, complete }) => {
            const ouverte = phasesOuvertes.has(phase.numero)
            return (
              <div key={phase.numero}>
                <button
                  type="button"
                  onClick={() => basculerPhase(phase.numero)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] font-medium hover:bg-white/30"
                  aria-expanded={ouverte}
                >
                  {ouverte ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${complete ? "bg-foreground" : traitees > 0 ? "border-2 border-foreground" : "border-[1.5px] border-foreground/30"}`} />
                  <span className="flex-1">
                    {phase.numero} · {phase.titre}
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {traitees}/{total}
                  </span>
                </button>
                {ouverte && (
                  <div className="mb-1 ml-3 flex flex-col gap-0.5 border-l border-foreground/10 pl-2">
                    {phase.etapes.map((e) => {
                      const etat = etats.get(e.code)
                      const actif = e.code === codeOuvert
                      return (
                        <button
                          key={e.code}
                          type="button"
                          onClick={() => setCodeOuvert(e.code)}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] ${actif ? "chrome-black text-white" : "hover:bg-white/30"}`}
                          aria-current={actif ? "step" : undefined}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${actif ? "border border-white" : PUCE[etat?.statut ?? "A_FAIRE"]}`} />
                          <span className="w-8 shrink-0 font-semibold">{e.code}</span>
                          <span className={`flex-1 ${estTraitee(etat?.statut) && !actif ? "text-muted-foreground" : ""}`}>{e.titre}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="min-h-0 min-w-0 flex-1">
          {etapeOuverte ? (
            <EtapeDetail
              key={etapeOuverte.code}
              etape={etapeOuverte}
              profil={profil}
              etat={etats.get(etapeOuverte.code) as EtapeProjet | undefined}
              admin={user.isAdmin}
              onEnregistrer={(maj) => enregistrerEtape(etapeOuverte.code, maj)}
              onPreparer={(texte) => setDemandeIA({ id: Date.now(), texte })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sélectionnez une étape.</p>
          )}
        </div>

        <div className="h-[50vh] shrink-0 lg:h-auto lg:w-[340px]">
          <PanneauIA
            key={projet.id}
            titreConversation={`SIT · ${projet.nom}`}
            contexte={contexteProjet(projet, etapeOuverte)}
            intro={`Je connais ce projet et l'étape que vous consultez${etapeOuverte ? ` (${etapeOuverte.code} ${etapeOuverte.titre})` : ""}. Je peux préparer une trame, un courrier ou une analyse ; vous relisez et décidez.`}
            suggestions={[
              "Que dois-je vérifier en priorité sur cette étape ?",
              "Rédige un projet de courrier au maître d'ouvrage",
              "Quels textes s'appliquent ici ?",
            ]}
            demande={demandeIA}
          />
        </div>
      </div>
    </Cadre>
  )
}

function Cadre({ titre, sousTitre, children }: { titre: string; sousTitre?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="glass-scene flex h-screen w-full flex-col gap-4 overflow-y-auto p-4 lg:overflow-hidden">
      <SitNav titre={titre} sousTitre={sousTitre} />
      {children}
    </main>
  )
}

export default function EspaceProjetPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      {/* useSearchParams (?etape=) exige un ancêtre Suspense au build. */}
      <Suspense fallback={null}>
        <EspaceProjet />
      </Suspense>
    </AuthGate>
  )
}
