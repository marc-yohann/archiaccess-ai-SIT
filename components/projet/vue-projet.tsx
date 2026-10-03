"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { ArrowUpRight, ChevronDown, ChevronRight, MapPin, Users } from "lucide-react"
import { useUser } from "@/components/auth-gate"
import { SitNav, type MailleAriane } from "@/components/sit-nav"
import { PanneauIA } from "@/components/panneau-ia"
import { EtapeDetail, type MajEtape } from "@/components/projet/etape-detail"
import { lienDonneesSite, type Rattachements, type TypeRetrait } from "@/components/projet/rattachements"
import { Avatar, FilEtape, type ElementProjet } from "@/components/projet/elements"
import { Dossier } from "@/components/projet/dossier"
import { ProfilChamps, profilVersRequete, type ProfilSaisi } from "@/components/referentiel/profil-champs"
import { PHASES, trouverEtape } from "@/lib/referentiel"
import { avancementPhases, estTraitee, indexEtats, phaseCourante, prochaineEtape, type EtatEtapeProjet } from "@/lib/referentiel/avancement"
import { contexteProjet } from "@/lib/referentiel/contexte-ia"
import { LIBELLES_COURTS } from "@/lib/referentiel/libelles"
import { profilComplet } from "@/lib/referentiel/profil"
import { suivreProjet } from "@/lib/projet-suivi"
import logoPuce from "@/public/logo-ai-puce.png"
import { initiales } from "@/lib/initiales"

// Espace projet : la méthode Archiaccess appliquée à une opération, avec
// Archiaccess AI à portée de main. À gauche les phases et leurs étapes, au
// centre l'étape ouverte (actions, livrables, vigilances, particularités de
// l'opération, fil de l'étape, échéance, responsable), à droite le
// copilote, qui reçoit en contexte le projet et l'étape ouverte. Les étapes
// viennent du référentiel (lib/referentiel) ; seuls leur avancement, leur
// échéance et leur responsable sont propres au projet (ProjetEtape).
//
// Deux vues (2026-09-30, maquette « Fil, dossier et études ») : Étapes, et
// Dossier, qui réunit tout ce qui a été joint au projet (notes, fichiers,
// réponses d'Archiaccess AI, données du SIT, liens). ?vue=dossier l'ouvre.
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


type EtapeProjet = EtatEtapeProjet & { updatedAt: string; updatedBy: { id: string; name: string } | null; responsable: { id: string; name: string } | null }

interface ConversationProjet {
  id: string
  title: string
  updatedAt: string
  etapeCode: string | null
}

interface ProjetDetail extends Rattachements {
  id: string
  nom: string
  description: string | null
  statutMoa: string | null
  montage: string | null
  typologie: string | null
  mission: string | null
  rehabilitation: boolean
  etapes: EtapeProjet[]
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
  const [conversations, setConversations] = useState<ConversationProjet[]>([])
  const [vue, setVue] = useState<"etapes" | "dossier">(params.get("vue") === "dossier" ? "dossier" : "etapes")
  const [elements, setElements] = useState<ElementProjet[]>([])
  const [personnes, setPersonnes] = useState<{ id: string; name: string }[]>([])
  const [moi, setMoi] = useState<string | null>(null)

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
        setPersonnes(d.personnes ?? [])
        setMoi(d.moi ?? null)
        // Ouvrir un projet en fait le projet suivi : il accompagne
        // l'employé sur la recherche, la méthode et Archiaccess AI.
        suivreProjet({ id: p.id, nom: p.nom, espace: p.espace })
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

  // Dossier du projet : tous les éléments joints, du plus récent au plus
  // ancien ; le fil d'une étape en est un extrait.
  useEffect(() => {
    fetch(`/api/sit/projets/${id}/elements`)
      .then((r) => r.json())
      .then((d) => d.success && setElements(d.elements))
      .catch(() => {})
  }, [id])

  // Conversations Archiaccess AI rattachées au projet, pour « Utile pour
  // cette étape » (mêmes règles d'accès côté serveur).
  useEffect(() => {
    fetch(`/api/mistral/conversations?projet=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => d.success && setConversations(d.conversations))
      .catch(() => {})
  }, [id])

  const etats = useMemo(() => indexEtats(projet?.etapes ?? []), [projet])
  const responsables = useMemo(() => new globalThis.Map((projet?.etapes ?? []).filter((e) => e.responsable).map((e) => [e.etapeCode, e.responsable!.name])), [projet])
  const filOuvert = useMemo(
    () => (codeOuvert ? elements.filter((e) => e.etapeCode === codeOuvert).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    [elements, codeOuvert],
  )
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

  // Retire un site, un acteur, un avis ou un lot du projet (le lien
  // seulement), puis relit les rattachements.
  async function retirerRattachement(type: TypeRetrait, cible: string) {
    const r = await fetch(`/api/sit/projets/${id}/${type}/${encodeURIComponent(cible)}`, { method: "DELETE" })
    const d = await r.json().catch(() => ({}))
    if (!d.success) throw new Error(d.error ?? "Retrait impossible.")
    const f = await fetch(`/api/sit/projets/${id}`).then((x) => x.json())
    if (f.success) {
      setProjet((p) =>
        p ? { ...p, sites: f.projet.sites, acteurs: f.projet.acteurs, avisMarches: f.projet.avisMarches, lots: f.projet.lots, documentSitLinks: f.projet.documentSitLinks } : p,
      )
    }
  }

  function ajouterElement(e: ElementProjet) {
    setElements((l) => [e, ...l.filter((x) => x.id !== e.id)])
  }
  function retirerElementLocal(elementId: string) {
    setElements((l) => l.filter((x) => x.id !== elementId))
  }
  function changerVue(v: "etapes" | "dossier") {
    setVue(v)
    const u = new URL(window.location.href)
    if (v === "dossier") u.searchParams.set("vue", "dossier")
    else u.searchParams.delete("vue")
    window.history.replaceState(null, "", u.toString())
  }
  function ouvrirEtape(code: string) {
    setCodeOuvert(code)
    const phase = PHASES.find((ph) => ph.etapes.some((e) => e.code === code))
    if (phase) setPhasesOuvertes((s) => new Set([...s, phase.numero]))
    changerVue("etapes")
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
  const filAriane: MailleAriane[] = [
    { libelle: retour.libelle, href: retour.href },
    { libelle: projet.nom, href: collaboratif ? `/sit/equipe/${projet.id}` : `/sit/projets/${projet.id}` },
    ...(vue === "dossier" ? [{ libelle: "Dossier" }] : etapeOuverte ? [{ libelle: `Étape ${etapeOuverte.code} ${etapeOuverte.titre}` }] : []),
  ]
  const nbMembres = projet.membres.length
  const visibilite = collaboratif ? `Visible par ${nbMembres > 1 ? `les ${nbMembres} membres` : "les membres"} du projet` : "Projet personnel : visible par vous seul"
  const nbDossier =
    elements.length + projet.sites.length + projet.acteurs.length + projet.avisMarches.length + projet.lots.length + projet.documentSitLinks.length
  const siteProjet = projet.sites[0]?.site ?? null
  const conversationsEtape = etapeOuverte ? conversations.filter((c) => c.etapeCode === etapeOuverte.code) : []
  const utile =
    siteProjet || conversationsEtape.length > 0 ? (
      <div className="liquid-glass-soft flex shrink-0 flex-col gap-1.5 rounded-xl px-3.5 py-3 text-[13px]">
        <h3 className="text-[12.5px] font-bold">Utile pour cette étape</h3>
        {siteProjet && (
          <Link href={lienDonneesSite(siteProjet.label)} className="flex items-center gap-2 hover:underline">
            <MapPin size={13} className="shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">Données du site : {siteProjet.label}</span>
            <ArrowUpRight size={13} className="shrink-0" />
          </Link>
        )}
        {conversationsEtape.length > 0 && (
          <Link
            href={`/ai?conversation=${conversationsEtape[0].id}&projet=${projet.id}&etape=${encodeURIComponent(etapeOuverte!.code)}`}
            className="flex items-center gap-2 hover:underline"
          >
            <Image src={logoPuce} alt="" width={13} height={13} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {conversationsEtape.length === 1
                ? "1 conversation Archiaccess AI sur cette étape"
                : `${conversationsEtape.length} conversations Archiaccess AI sur cette étape`}
              <span className="text-muted-foreground"> · reprendre la plus récente</span>
            </span>
            <ArrowUpRight size={13} className="shrink-0" />
          </Link>
        )}
      </div>
    ) : null

  return (
    <Cadre titre={projet.nom} sousTitre={<Link href={retour.href} className="hover:underline">{retour.libelle}</Link>} filAriane={filAriane}>
      {/* Une seule ligne sous le fil d'Ariane : équipe (espace
          collaboratif) puis profil de l'opération. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-muted-foreground">
        {collaboratif && (
          <span className="flex flex-wrap items-center gap-2 text-foreground">
            <SelecteurProjet actuel={projet.id} />
            <Equipe membres={projet.membres} />
            {projet.archivedAt && <span className="rounded-full border border-foreground/40 px-2.5 py-1 text-xs font-medium">Archivé</span>}
            {acces?.administrer && (
              <Link href={`/admin/projets?projet=${projet.id}`} className="liquid-glass-pill rounded-full px-3 py-1.5 text-[13px] font-medium">
                Gérer les accès
              </Link>
            )}
          </span>
        )}
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
        <div className="liquid-glass-inset ml-auto flex shrink-0 gap-0.5 rounded-xl p-1 max-md:w-full" role="group" aria-label="Vue du projet">
          {(["etapes", "dossier"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changerVue(v)}
              aria-pressed={vue === v}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1 text-[13px] md:flex-none ${vue === v ? "glass-on font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {v === "etapes" ? "Étapes" : "Dossier"}
              {v === "dossier" && <span className="font-mono text-xs text-muted-foreground">{nbDossier}</span>}
            </button>
          ))}
        </div>
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
        {vue === "dossier" ? (
          <Dossier
            projetId={projet.id}
            elements={elements}
            rattachements={projet}
            peutToutRetirer={!!acces && acces.niveau !== "membre"}
            moi={moi}
            visibilite={visibilite}
            onAjout={ajouterElement}
            onRetraitElement={retirerElementLocal}
            onRetraitRattachement={retirerRattachement}
            onOuvrirEtape={ouvrirEtape}
          />
        ) : (
        <>
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
                          {responsables.has(e.code) && (
                            <span title={`Responsable : ${responsables.get(e.code)}`}>
                              <Avatar nom={responsables.get(e.code)} petit />
                            </span>
                          )}
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
              utile={utile}
              personnes={personnes}
              fil={
                <FilEtape
                  projetId={projet.id}
                  etapeCode={etapeOuverte.code}
                  elements={filOuvert}
                  visibilite={visibilite}
                  onAjout={ajouterElement}
                  onRetrait={retirerElementLocal}
                />
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sélectionnez une étape.</p>
          )}
        </div>
        </>
        )}

        <PanneauIA
          key={projet.id}
          contexte={contexteProjet(projet, etapeOuverte)}
          intro={`Je connais ce projet et l'étape que vous consultez${etapeOuverte ? ` (${etapeOuverte.code} ${etapeOuverte.titre})` : ""}. Je peux préparer une trame, un courrier ou une analyse ; vous relisez et décidez.`}
          suggestions={[
            "Que dois-je vérifier en priorité sur cette étape ?",
            "Rédige un projet de courrier au maître d'ouvrage",
            "Quels textes s'appliquent ici ?",
          ]}
          demande={demandeIA}
          suiteLien={`projet=${projet.id}${etapeOuverte ? `&etape=${encodeURIComponent(etapeOuverte.code)}` : ""}`}
          projetId={projet.id}
          etapeCode={etapeOuverte?.code ?? null}
          onJoint={(pid, e) => pid === projet.id && ajouterElement(e)}
        />
      </div>
    </Cadre>
  )
}

function Cadre({
  titre,
  sousTitre,
  filAriane,
  children,
}: {
  titre: string
  sousTitre?: React.ReactNode
  filAriane?: MailleAriane[]
  children: React.ReactNode
}) {
  return (
    <main className="glass-scene flex min-h-screen w-full flex-col gap-4 p-4 pb-40 md:pb-24 lg:h-screen lg:overflow-hidden lg:pb-4">
      <SitNav titre={titre} sousTitre={sousTitre} filAriane={filAriane} />
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
