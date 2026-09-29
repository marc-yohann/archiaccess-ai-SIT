"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, ChevronRight, Users } from "lucide-react"
import { useUser } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { PanneauIA } from "@/components/panneau-ia"
import { EtapeDetail, type MajEtape } from "@/components/projet/etape-detail"
import { ProfilChamps, profilVersRequete, type ProfilSaisi } from "@/components/referentiel/profil-champs"
import { PHASES, trouverEtape } from "@/lib/referentiel"
import { avancementPhases, estTraitee, indexEtats, phaseCourante, prochaineEtape, type EtatEtapeProjet } from "@/lib/referentiel/avancement"
import { contexteProjet } from "@/lib/referentiel/contexte-ia"
import { LIBELLES_COURTS } from "@/lib/referentiel/libelles"
import { profilComplet } from "@/lib/referentiel/profil"

// Espace projet : la méthode Archiaccess appliquée à une opération, avec
// Archiaccess AI à portée de main. À gauche les phases et leurs étapes, au
// centre l'étape ouverte (actions, livrables, vigilances, particularités de
// l'opération, notes, échéance), à droite le copilote, qui reçoit en
// contexte le projet et l'étape ouverte. Les étapes viennent du
// référentiel (lib/referentiel) ; seuls leur avancement, leur échéance et
// les notes sont propres au projet (ProjetEtape).
//
// Partagé par les deux espaces (2026-09-28) : /sit/projets/[id] (mon
// espace, projets personnels) et /sit/equipe/[id] (espace collaboratif :
// sélecteur de projet, équipe, droits selon le rôle). L'accès est décidé
// par le serveur (lib/projet-acces.ts) ; un projet ouvert depuis le mauvais
// espace est redirigé vers le bon.

export type EspaceVue = "personnel" | "collaboratif"

interface Membre {
  role: "MEMBRE" | "CHEF_DE_PROJET"
  user: { id: string; name: string }
}

interface Acces {
  niveau: "proprietaire" | "administrateur" | "chef_de_projet" | "membre"
  modifierProfil: boolean
  administrer: boolean
}

export const ROLE_LIBELLE: Record<Membre["role"], string> = { MEMBRE: "Membre", CHEF_DE_PROJET: "Chef de projet" }

export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/)
  return ((mots[0]?.[0] ?? "") + (mots.length > 1 ? mots[mots.length - 1][0] : "")).toUpperCase()
}

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
  espace: "PERSONNEL" | "COLLABORATIF"
  archivedAt: string | null
  membres: Membre[]
}

const court = (v: string | null) => (v && v in LIBELLES_COURTS ? LIBELLES_COURTS[v as keyof typeof LIBELLES_COURTS] : null)

const PUCE: Record<string, string> = {
  FAIT: "bg-foreground",
  EN_COURS: "border-2 border-foreground",
  A_FAIRE: "border-[1.5px] border-foreground/30",
  SANS_OBJET: "border border-dashed border-foreground/40",
}

export function VueProjet({ espace }: { espace: EspaceVue }) {
  const { id } = useParams<{ id: string }>()
  const params = useSearchParams()
  const user = useUser()
  const router = useRouter()
  const [projet, setProjet] = useState<ProjetDetail | null>(null)
  const [acces, setAcces] = useState<Acces | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [codeOuvert, setCodeOuvert] = useState<string | null>(params.get("etape"))
  const [phasesOuvertes, setPhasesOuvertes] = useState<Set<number>>(new Set())
  const [edition, setEdition] = useState<ProfilSaisi | null>(null)
  const [demandeIA, setDemandeIA] = useState<{ id: number; texte: string } | null>(null)
  const [listeOuverte, setListeOuverte] = useState(false)

  useEffect(() => {
    fetch(`/api/sit/projets/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return setErreur(d.error ?? "Chargement impossible.")
        const p: ProjetDetail = d.projet
        // Ouvert depuis le mauvais espace : redirection vers le bon.
        const attendu = p.espace === "COLLABORATIF" ? "collaboratif" : "personnel"
        if (attendu !== espace) {
          router.replace(`${attendu === "collaboratif" ? "/sit/equipe" : "/sit/projets"}/${p.id}${window.location.search}`)
          return
        }
        setProjet(p)
        setAcces(d.acces)
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

  const collaboratif = espace === "collaboratif"
  const retour = collaboratif ? { href: "/sit/equipe", libelle: "Projets de l'équipe" } : { href: "/sit/projets", libelle: "Projets" }

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

  const pastilles = [court(projet.statutMoa), court(projet.typologie), court(projet.montage), court(projet.mission)].filter(Boolean) as string[]
  const rattaches = [
    [projet.sites.length, "site"],
    [projet.acteurs.length, "acteur"],
    [projet.avisMarches.length, "avis de marché"],
    [projet.lots.length, "lot"],
    [projet.documentSitLinks.length, "document"],
  ].filter(([n]) => (n as number) > 0) as [number, string][]

  return (
    <Cadre titre={projet.nom} sousTitre={<Link href={retour.href} className="hover:underline">{retour.libelle}</Link>}>
      {collaboratif && (
        <div className="flex flex-wrap items-center gap-2">
          <SelecteurProjet actuel={projet.id} />
          <Equipe membres={projet.membres} />
          {projet.archivedAt && <span className="rounded-full border border-foreground/40 px-2.5 py-1 text-xs font-medium">Archivé</span>}
          {acces?.administrer && (
            <Link href={`/admin/projets?projet=${projet.id}`} className="liquid-glass-pill rounded-full px-3 py-1.5 text-[13px] font-medium">
              Gérer les accès
            </Link>
          )}
        </div>
      )}
      <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        <span>{pastilles.length ? pastilles.join(" · ") : "Profil de l'opération à compléter"}</span>
        {projet.rehabilitation && <span>· Réhabilitation ou site occupé</span>}
        {acces?.modifierProfil && (
        <button
          type="button"
          onClick={() =>
            setEdition(
              edition
                ? null
                : { statutMoa: projet.statutMoa ?? "", montage: projet.montage ?? "", typologie: projet.typologie ?? "", mission: projet.mission ?? "", rehabilitation: projet.rehabilitation },
            )
          }
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {edition ? "Fermer" : "Modifier le profil"}
        </button>
        )}
        {rattaches.length > 0 && (
          <span className="lg:ml-auto">
            {rattaches.map(([n, l]) => `${n} ${l}${n > 1 && !l.endsWith("marché") ? "s" : ""}`).join(" · ")}
          </span>
        )}
      </div>

      {edition && (
        <div className="liquid-glass-panel space-y-3 rounded-[22px] p-4">
          <ProfilChamps valeur={edition} onChange={setEdition} />
          <button type="button" onClick={() => void enregistrerProfil()} className="chrome-black rounded-xl px-4 py-2 text-sm text-white">
            Enregistrer le profil
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row">
        {/* Tablette et téléphone : la liste des étapes se replie au-dessus
            du détail, pour que l'étape ouverte reste immédiatement visible. */}
        <button
          type="button"
          onClick={() => setListeOuverte((o) => !o)}
          className="liquid-glass-panel flex items-center gap-3 rounded-[22px] px-4 py-3 text-left lg:hidden"
          aria-expanded={listeOuverte}
        >
          <span className="text-[12.5px] font-medium text-muted-foreground">Étapes</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{etapeOuverte ? `${etapeOuverte.code} ${etapeOuverte.titre}` : "Choisir une étape"}</span>
          {listeOuverte ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <nav className={`liquid-glass-panel custom-scrollbar ${listeOuverte ? "flex" : "hidden"} shrink-0 flex-col gap-0.5 rounded-[22px] p-3 lg:flex lg:w-[19rem] lg:overflow-y-auto`} aria-label="Phases et étapes">
          {phases.map(({ phase, total, traitees, complete }) => {
            const ouverte = phasesOuvertes.has(phase.numero)
            return (
              <div key={phase.numero}>
                <button
                  type="button"
                  onClick={() => basculerPhase(phase.numero)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-[13px] font-medium transition-colors hover:bg-white/50"
                  aria-expanded={ouverte}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${complete ? "chrome-black text-white" : traitees > 0 ? "border-[1.5px] border-foreground" : "border border-foreground/25 text-muted-foreground"}`}
                  >
                    {phase.numero}
                  </span>
                  <span className="flex-1 leading-snug">{phase.titre}</span>
                  <span className="text-[11px] font-normal tabular-nums text-muted-foreground">
                    {traitees}/{total}
                  </span>
                  {ouverte ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                </button>
                {ouverte && (
                  <div className="mb-2 ml-[1.15rem] flex flex-col gap-0.5 border-l border-foreground/10 pl-2.5">
                    {phase.etapes.map((e) => {
                      const etat = etats.get(e.code)
                      const actif = e.code === codeOuvert
                      return (
                        <button
                          key={e.code}
                          type="button"
                          onClick={() => {
                            setCodeOuvert(e.code)
                            setListeOuverte(false)
                          }}
                          className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition-colors ${actif ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08),0_2px_8px_-2px_rgba(16,24,40,0.1)] font-medium" : "hover:bg-white/50"}`}
                          aria-current={actif ? "step" : undefined}
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${actif ? "border-2 border-foreground" : PUCE[etat?.statut ?? "A_FAIRE"]}`} />
                          <span className={`w-8 shrink-0 tabular-nums ${actif ? "text-foreground" : "text-muted-foreground"}`}>{e.code}</span>
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

        <div className="min-w-0 lg:min-h-0 lg:flex-1">
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

        <PanneauIA
          key={projet.id}
          titreConversation={`${collaboratif ? "Équipe" : "SIT"} · ${projet.nom}`}
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
    </Cadre>
  )
}

function Cadre({ titre, sousTitre, children }: { titre: string; sousTitre?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="glass-scene flex min-h-screen w-full flex-col gap-4 p-4 pb-40 md:pb-24 lg:h-screen lg:overflow-hidden lg:pb-4">
      <SitNav titre={titre} sousTitre={sousTitre} />
      {children}
    </main>
  )
}


// Espace collaboratif — passer d'un projet d'équipe à un autre sans
// repasser par l'accueil (projets auxquels l'utilisateur a accès).
function SelecteurProjet({ actuel }: { actuel: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [projets, setProjets] = useState<{ id: string; nom: string }[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert || projets) return
    fetch("/api/sit/projets?espace=collaboratif")
      .then((r) => r.json())
      .then((d) => setProjets(d.success ? d.projets : []))
      .catch(() => setProjets([]))
  }, [ouvert, projets])

  useEffect(() => {
    if (!ouvert) return
    const fermer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener("mousedown", fermer)
    return () => document.removeEventListener("mousedown", fermer)
  }, [ouvert])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="true"
        className="liquid-glass-pill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium"
      >
        Changer de projet
        <ChevronDown size={14} />
      </button>
      {ouvert && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/70 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
          <p className="px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground">Vos projets collaboratifs</p>
          {!projets && <p className="px-2.5 py-2 text-sm text-muted-foreground">Chargement…</p>}
          {projets?.map((p) => (
            <Link
              key={p.id}
              href={`/sit/equipe/${p.id}`}
              onClick={() => setOuvert(false)}
              className={`block rounded-xl px-2.5 py-2 text-sm ${p.id === actuel ? "bg-foreground/[0.06] font-semibold" : "hover:bg-foreground/[0.04]"}`}
              aria-current={p.id === actuel ? "page" : undefined}
            >
              {p.nom}
            </Link>
          ))}
          <Link href="/sit/equipe" className="mt-1 block border-t border-foreground/10 px-2.5 pt-2 text-[13px] text-muted-foreground hover:text-foreground">
            Tous les projets de l'équipe
          </Link>
        </div>
      )}
    </div>
  )
}

// Espace collaboratif — l'équipe du projet (lecture seule : seul un
// administrateur donne ou retire un accès, depuis /admin/projets).
function Equipe({ membres }: { membres: Membre[] }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="liquid-glass-pill flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-[13px]"
      >
        <span className="flex">
          {membres.slice(0, 4).map((m, i) => (
            <span
              key={m.user.id}
              className={`chrome-black flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ${i > 0 ? "-ml-1.5" : ""}`}
              aria-hidden="true"
            >
              {initiales(m.user.name)}
            </span>
          ))}
          {membres.length === 0 && <Users size={14} className="mx-1" aria-hidden="true" />}
        </span>
        {membres.length} membre{membres.length > 1 ? "s" : ""}
      </button>
      {ouvert && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/70 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
          <p className="px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground">Équipe du projet</p>
          {membres.length === 0 && <p className="px-2.5 py-2 text-sm text-muted-foreground">Aucun membre pour l'instant.</p>}
          {membres.map((m) => (
            <div key={m.user.id} className="flex items-center justify-between gap-3 px-2.5 py-2 text-sm">
              <span>{m.user.name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LIBELLE[m.role]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
