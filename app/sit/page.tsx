"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, Plus, Search } from "lucide-react"
import { AuthGate, useUser } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"
import { PanneauIA } from "@/components/panneau-ia"
import { CarteProjet, type ProjetResume } from "@/components/projet/carte-projet"
import { trouverEtape } from "@/lib/referentiel"
import { dateCourte, estTraitee, joursRestants } from "@/lib/referentiel/avancement"
import { contexteTableauDeBord } from "@/lib/referentiel/contexte-ia"
import { ETAPE_STATUTS_LIBELLES, profilComplet } from "@/lib/referentiel/profil"

// Tableau de bord du SIT (accueil, réorientation du 2026-09-27) : les
// opérations suivies d'abord, la recherche de données ensuite
// (/sit/recherche). Tout ce qui s'affiche vient de données réelles : les
// projets et leurs étapes renseignées, les avis de marché ingérés. Aucun
// chiffre ni échéance n'est déduit ou inventé.

interface AvisVeille {
  id: string
  objet: string | null
  acheteurNom: string | null
  codeDepartement: string | null
  datePublication: string | null
  dateLimiteReponse: string | null
  urlAvis: string | null
}

const HORIZON_JOURS = 14
const SANS_ACTIVITE_JOURS = 30

function TableauDeBord() {
  const user = useUser()
  const router = useRouter()
  const [projets, setProjets] = useState<ProjetResume[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [veille, setVeille] = useState<{ jours: number; avis: AvisVeille[] } | null>(null)
  const [recherche, setRecherche] = useState("")

  useEffect(() => {
    fetch("/api/sit/projets")
      .then((r) => r.json())
      .then((d) => (d.success ? setProjets(d.projets) : setErreur(d.error ?? "Chargement impossible.")))
      .catch(() => setErreur("Chargement impossible."))
    fetch("/api/sit/veille-amo-opc")
      .then((r) => r.json())
      .then((d) => d.success && setVeille({ jours: d.jours, avis: d.avis }))
      .catch(() => setVeille({ jours: 7, avis: [] }))
  }, [])

  const aTraiter = useMemo(() => {
    if (!projets) return []
    return projets
      .flatMap((p) =>
        p.etapes
          .filter((e) => e.echeance && !estTraitee(e.statut) && joursRestants(e.echeance) <= HORIZON_JOURS)
          .map((e) => ({ projet: p, etat: e, etape: trouverEtape(e.etapeCode) })),
      )
      .filter((x) => x.etape)
      .sort((a, b) => (a.etat.echeance! < b.etat.echeance! ? -1 : 1))
  }, [projets])

  const vigilance = useMemo(() => {
    if (!projets) return []
    const points: { cle: string; projet: ProjetResume; texte: string; fort: boolean }[] = []
    for (const p of projets) {
      for (const e of p.etapes) {
        if (!e.echeance || estTraitee(e.statut)) continue
        const j = joursRestants(e.echeance)
        if (j < 0) points.push({ cle: `${p.id}-${e.etapeCode}`, projet: p, texte: `étape ${e.etapeCode} en retard de ${-j} jour${j === -1 ? "" : "s"}.`, fort: true })
      }
      if (!profilComplet(p)) points.push({ cle: `${p.id}-profil`, projet: p, texte: "profil de l'opération à compléter.", fort: false })
      const inactif = -joursRestants(p.updatedAt)
      if (inactif >= SANS_ACTIVITE_JOURS) points.push({ cle: `${p.id}-inactif`, projet: p, texte: `aucune mise à jour depuis ${inactif} jours.`, fort: false })
    }
    return points.sort((a, b) => Number(b.fort) - Number(a.fort))
  }, [projets])

  const prenom = user.name.split(" ")[0]
  const aujourdhui = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })

  return (
    <main className="glass-scene flex min-h-screen w-full flex-col gap-4 p-4 pb-40 md:pb-24 lg:h-screen lg:flex-row lg:overflow-hidden lg:pb-4">
      <div className="custom-scrollbar flex min-w-0 flex-1 flex-col gap-5 px-1 pb-4 lg:overflow-y-auto">
        <SitNav titre="Archiaccess SIT" />

        <section className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12.5px] font-medium text-muted-foreground">{aujourdhui}</p>
            <h2 className="mt-1.5 text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-[30px]">Bonjour {prenom}, voici vos opérations.</h2>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (recherche.trim()) router.push(`/sit/recherche?resume=${encodeURIComponent(recherche.trim())}`)
              }}
              className="liquid-glass-soft flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 sm:w-72"
            >
              <Search size={15} className="shrink-0 text-muted-foreground" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Adresse, entreprise, marché…"
                aria-label="Recherche de données"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </form>
            <Link href="/sit/projets/nouveau" className="chrome-black flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-white">
              <Plus size={14} />
              Nouveau projet
            </Link>
          </div>
        </section>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        {projets === null && !erreur && <p className="text-sm text-muted-foreground">Chargement…</p>}

        {projets?.length === 0 && (
          <div className="liquid-glass-panel rounded-2xl p-6">
            <p className="font-medium">Aucune opération suivie pour l'instant.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez un projet : la méthode Archiaccess s'adapte à son maître d'ouvrage, à son montage et à son ouvrage.
            </p>
            <Link href="/sit/projets/nouveau" className="chrome-black mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white">
              <Plus size={14} />
              Créer le premier projet
            </Link>
          </div>
        )}

        {projets && projets.length > 0 && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projets.slice(0, 6).map((p) => (
                <CarteProjet key={p.id} projet={p} />
              ))}
            </section>
            {projets.length > 6 && (
              <Link href="/sit/projets" className="text-sm text-muted-foreground hover:underline">
                Voir les {projets.length} projets →
              </Link>
            )}
          </>
        )}

        <section className="grid items-start gap-4 xl:grid-cols-5">
          <div className="liquid-glass-panel flex min-w-0 flex-col gap-2.5 rounded-[1.25rem] p-5 xl:col-span-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="text-[15px] font-semibold tracking-tight">À traiter</h2>
              <span className="text-xs text-muted-foreground">Échéances des {HORIZON_JOURS} prochains jours et retards</span>
            </div>
            {aTraiter.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune échéance proche. Les échéances se fixent depuis chaque étape, dans l'espace projet.
              </p>
            )}
            {aTraiter.map(({ projet, etat, etape }) => {
              const d = dateCourte(etat.echeance!)
              const retard = joursRestants(etat.echeance!) < 0
              return (
                <Link
                  key={`${projet.id}-${etat.etapeCode}`}
                  href={`/sit/projets/${projet.id}?etape=${etat.etapeCode}`}
                  className="liquid-glass-soft flex items-center gap-4 rounded-xl px-3 py-2.5 transition-shadow hover:shadow-md"
                >
                  <div className="w-11 shrink-0 text-center">
                    <div className="text-lg font-semibold leading-tight">{d.jour}</div>
                    <div className="text-[10px] text-muted-foreground">{d.mois}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {etape!.code} {etape!.titre}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {projet.nom}
                      {etat.note ? ` · ${etat.note}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] ${retard ? "chrome-black text-white" : "liquid-glass-pill"}`}>
                    {retard ? "En retard" : ETAPE_STATUTS_LIBELLES[etat.statut]}
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
            <div className="liquid-glass-panel flex flex-col gap-2.5 rounded-[1.25rem] p-5">
              <h2 className="text-[15px] font-semibold tracking-tight">Points de vigilance</h2>
              {vigilance.length === 0 && <p className="text-sm text-muted-foreground">Rien à signaler.</p>}
              {vigilance.slice(0, 6).map((v) => (
                <Link key={v.cle} href={`/sit/projets/${v.projet.id}`} className="flex items-start gap-2.5 text-[13px] hover:underline">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${v.fort ? "bg-foreground" : "border-[1.5px] border-foreground"}`}
                    aria-hidden="true"
                  />
                  <span>
                    <b className="font-semibold">{v.projet.nom}</b> — {v.texte}
                  </span>
                </Link>
              ))}
            </div>

            <div className="liquid-glass-panel flex flex-col gap-2.5 rounded-[1.25rem] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-[15px] font-semibold tracking-tight">Veille marchés AMO / OPC</h2>
                <span className="text-xs text-muted-foreground">Publiés depuis {veille?.jours ?? 7} jours</span>
              </div>
              {veille === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
              {veille?.avis.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun avis d'AMO, de conduite d'opération ou d'OPC publié sur la période.</p>
              )}
              {veille?.avis.map((a) => (
                <div key={a.id} className="liquid-glass-soft rounded-xl px-3 py-2">
                  <p className="line-clamp-2 text-[13px] font-medium">{a.objet ?? "Objet non communiqué"}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">
                      {[a.acheteurNom, a.codeDepartement && `département ${a.codeDepartement}`, a.dateLimiteReponse && `réponse avant le ${new Date(a.dateLimiteReponse).toLocaleDateString("fr-FR")}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {a.urlAvis && (
                      <a href={a.urlAvis} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir l'avis" className="shrink-0 hover:text-foreground">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <PanneauIA
          titreConversation="SIT · Tableau de bord"
          contexte={contexteTableauDeBord(projets ?? [])}
          intro={
            projets && projets.length
              ? `${projets.length} opération${projets.length > 1 ? "s" : ""} suivie${projets.length > 1 ? "s" : ""}. Je peux faire le point sur les échéances, préparer un ordre du jour ou rédiger une relance ; les décisions restent les vôtres.`
              : "Je peux vous aider à cadrer une nouvelle opération ou répondre à une question réglementaire."
          }
          suggestions={["Fais le point sur mes échéances de la semaine", "Quelles opérations demandent mon attention en priorité ?", "Rédige un ordre du jour de réunion de chantier"]}
        />
    </main>
  )
}

export default function SitPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <TableauDeBord />
    </AuthGate>
  )
}
