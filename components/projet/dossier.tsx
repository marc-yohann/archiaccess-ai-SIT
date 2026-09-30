"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Building2, FileText, Link2, MapPin, MoreHorizontal, Paperclip, PenLine, Radar } from "lucide-react"
import { trouverEtape } from "@/lib/referentiel"
import { ChoixEtape } from "@/components/projet/choix-etape"
import { Champ, CHAMP, Dialogue } from "@/components/dialogue"
import {
  Avatar,
  ContenuElement,
  dateCourte,
  deposerFichier,
  FICHIER_MAX_OCTETS,
  lienFichier,
  publierElement,
  retirerElement,
  tailleLisible,
  type ElementProjet,
} from "@/components/projet/elements"
import { lienDonneesSite, type Rattachements, type TypeRetrait } from "@/components/projet/rattachements"
import logoPuce from "@/public/logo-ai-puce.png"

// Dossier du projet (2026-09-30, maquette validée « Fil, dossier et
// études ») : tout ce qui concerne le projet au même endroit — notes,
// fichiers, réponses d'Archiaccess AI jointes, données du SIT ajoutées
// depuis la recherche (site, entreprises, avis de marché, lots, documents)
// et liens. Filtres par type, par étape et par personne ; chaque ligne dit
// qui l'a joint et quand. Chacun retire ce qu'il a joint ; le chef de
// projet et l'administrateur peuvent tout retirer (revérifié côté serveur).

type Categorie = "notes" | "ia" | "fichiers" | "sit" | "liens"

const CATEGORIES: { id: Categorie | "tout"; libelle: string }[] = [
  { id: "tout", libelle: "Tout" },
  { id: "notes", libelle: "Notes" },
  { id: "ia", libelle: "Réponses Archiaccess AI" },
  { id: "fichiers", libelle: "Fichiers" },
  { id: "sit", libelle: "Données du SIT" },
  { id: "liens", libelle: "Liens" },
]

interface Ligne {
  cle: string
  categorie: Categorie
  type: string
  icone: React.ReactNode
  sombre: boolean
  titre: string
  detail: string
  etapeCode: string | null
  auteur: { id: string; name: string } | null
  date: string | null
  element?: ElementProjet
  actions: { libelle: string; href: string; externe?: boolean; telecharger?: boolean }[]
  retrait: (() => Promise<void>) | null
}

type Ajout = "lien" | "fichier" | "note"

export function Dossier({
  projetId,
  elements,
  rattachements,
  peutToutRetirer,
  moi,
  visibilite,
  onAjout,
  onRetraitElement,
  onRetraitRattachement,
  onOuvrirEtape,
}: {
  projetId: string
  elements: ElementProjet[]
  rattachements: Rattachements
  // Propriétaire, chef de projet ou administrateur.
  peutToutRetirer: boolean
  moi: string | null
  visibilite: string
  onAjout: (e: ElementProjet) => void
  onRetraitElement: (id: string) => void
  onRetraitRattachement: (type: TypeRetrait, id: string) => Promise<void>
  onOuvrirEtape: (code: string) => void
}) {
  const [categorie, setCategorie] = useState<Categorie | "tout">("tout")
  const [etape, setEtape] = useState("")
  const [auteur, setAuteur] = useState("")
  const [ajout, setAjout] = useState<Ajout | null>(null)
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const lignes = useMemo(() => {
    const l: Ligne[] = []
    const retirable = (auteurId: string | undefined | null) => peutToutRetirer || (!!moi && auteurId === moi)
    const rattache = (type: TypeRetrait, id: string, auteurId: string | undefined | null) =>
      retirable(auteurId) ? () => onRetraitRattachement(type, id) : null
    for (const e of elements) {
      const base = { etapeCode: e.etapeCode, auteur: e.auteur, date: e.createdAt, element: e, retrait: e.peutRetirer ? async () => {
        await retirerElement(projetId, e.id)
        onRetraitElement(e.id)
      } : null }
      if (e.type === "NOTE") {
        const premiere = (e.texte ?? "").split("\n").find((x) => x.trim()) ?? ""
        l.push({ ...base, cle: e.id, categorie: "notes", type: "Note", icone: <PenLine size={12} />, sombre: true, titre: premiere.length > 90 ? `${premiere.slice(0, 90)}…` : premiere, detail: "Rédigée dans l'outil", actions: [] })
      } else if (e.type === "REPONSE_IA") {
        l.push({ ...base, cle: e.id, categorie: "ia", type: "Archiaccess AI", icone: <Image src={logoPuce} alt="" width={12} height={12} className="invert" />, sombre: true, titre: e.titre ?? "Réponse jointe", detail: e.message ? `« ${e.message} »` : "Réponse jointe depuis une conversation", actions: [] })
      } else if (e.type === "FICHIER") {
        l.push({ ...base, cle: e.id, categorie: "fichiers", type: "Fichier", icone: <FileText size={12} />, sombre: false, titre: e.nomFichier ?? "Fichier", detail: [tailleLisible(e.tailleOctets), e.texte].filter(Boolean).join(" · "), actions: [{ libelle: "Télécharger", href: lienFichier(projetId, e.id), telecharger: true }] })
      } else {
        l.push({ ...base, cle: e.id, categorie: "liens", type: "Lien", icone: <Link2 size={12} />, sombre: false, titre: e.titre ?? e.url ?? "Lien", detail: e.texte ?? "Lien externe", actions: e.url ? [{ libelle: "Ouvrir le lien", href: e.url, externe: true }] : [] })
      }
    }
    for (const s of rattachements.sites) {
      l.push({ cle: `site:${s.site.id}`, categorie: "sit", type: "Site", icone: <MapPin size={12} />, sombre: false, titre: s.site.label, detail: "Ajouté depuis la recherche", etapeCode: null, auteur: s.ajoutePar ?? null, date: s.createdAt ?? null, actions: [{ libelle: "Voir les données du site", href: lienDonneesSite(s.site.label) }], retrait: rattache("sites", s.site.id, s.ajoutePar?.id) })
    }
    for (const a of rattachements.acteurs) {
      l.push({ cle: `acteur:${a.acteur.id}`, categorie: "sit", type: "Entreprise", icone: <Building2 size={12} />, sombre: false, titre: a.acteur.nom ?? a.acteur.nomCommercial ?? "Dénomination non renseignée", detail: `SIREN ${a.acteur.siren}`, etapeCode: null, auteur: a.ajoutePar ?? null, date: a.createdAt ?? null, actions: [{ libelle: "Voir la fiche", href: `/sit/recherche?resume=${encodeURIComponent(a.acteur.siren)}` }], retrait: rattache("acteurs", a.acteur.id, a.ajoutePar?.id) })
    }
    for (const m of rattachements.avisMarches) {
      const a = m.avisMarche
      l.push({ cle: `avis:${a.id}`, categorie: "sit", type: "Marché", icone: <Radar size={12} />, sombre: false, titre: a.objet ?? "Avis sans objet renseigné", detail: [a.natureAvis, a.acheteurNom].filter(Boolean).join(" · ") || "Avis de marché", etapeCode: null, auteur: m.ajoutePar ?? null, date: m.createdAt ?? null, actions: a.urlAvis ? [{ libelle: "Voir l'avis", href: a.urlAvis, externe: true }] : [], retrait: rattache("avis-marches", a.id, m.ajoutePar?.id) })
    }
    for (const x of rattachements.lots) {
      const lot = x.lot
      l.push({ cle: `lot:${lot.id}`, categorie: "sit", type: "Lot", icone: <Radar size={12} />, sombre: false, titre: `Lot ${lot.numero}${lot.description ? ` · ${lot.description}` : ""}`, detail: [lot.avisMarche.objet, lot.titulaireNom && `Titulaire : ${lot.titulaireNom}`].filter(Boolean).join(" · "), etapeCode: null, auteur: x.ajoutePar ?? null, date: x.createdAt ?? null, actions: lot.avisMarche.urlAvis ? [{ libelle: "Voir l'avis", href: lot.avisMarche.urlAvis, externe: true }] : [], retrait: rattache("lots", lot.id, x.ajoutePar?.id) })
    }
    for (const d of rattachements.documentSitLinks) {
      l.push({ cle: `doc:${d.documentSit.id}`, categorie: "sit", type: "Document", icone: <FileText size={12} />, sombre: false, titre: d.documentSit.titre, detail: d.documentSit.type ?? "Document", etapeCode: null, auteur: null, date: d.createdAt ?? null, actions: d.documentSit.sourceUrl ? [{ libelle: "Ouvrir", href: d.documentSit.sourceUrl, externe: true }] : [], retrait: null })
    }
    return l.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  }, [elements, rattachements, peutToutRetirer, moi, projetId, onRetraitElement, onRetraitRattachement])

  const comptes = useMemo(() => {
    const c: Record<string, number> = { tout: lignes.length }
    for (const x of lignes) c[x.categorie] = (c[x.categorie] ?? 0) + 1
    return c
  }, [lignes])
  const etapesPresentes = useMemo(() => [...new Set(lignes.map((x) => x.etapeCode).filter((c): c is string => !!c))], [lignes])
  const auteurs = useMemo(() => {
    const m = new globalThis.Map<string, string>()
    for (const x of lignes) if (x.auteur) m.set(x.auteur.id, x.auteur.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"))
  }, [lignes])

  const visibles = lignes.filter(
    (x) =>
      (categorie === "tout" || x.categorie === categorie) &&
      (!etape || (etape === "projet" ? !x.etapeCode : x.etapeCode === etape)) &&
      (!auteur || x.auteur?.id === auteur),
  )

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row">
      <aside className="liquid-glass-panel flex shrink-0 flex-col gap-4 rounded-[22px] p-3.5 lg:w-60">
        <div className="flex flex-col gap-0.5">
          <h3 className="px-2.5 pb-1.5 text-xs font-bold text-muted-foreground">Type</h3>
          <div className="custom-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategorie(c.id)}
                aria-pressed={categorie === c.id}
                className={`flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[13px] ${categorie === c.id ? "glass-on font-semibold" : "hover:bg-white/50"}`}
              >
                <span>{c.libelle}</span>
                <span className="font-mono text-xs text-muted-foreground">{comptes[c.id] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            Étape
            <select value={etape} onChange={(e) => setEtape(e.target.value)} className="liquid-glass-inset rounded-xl px-2.5 py-2 text-[13px] font-normal text-foreground outline-none">
              <option value="">Toutes les étapes</option>
              <option value="projet">Projet (sans étape)</option>
              {etapesPresentes.sort((a, b) => a.localeCompare(b, "fr", { numeric: true })).map((c) => (
                <option key={c} value={c}>
                  {c} {trouverEtape(c)?.titre ?? ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            Joint par
            <select value={auteur} onChange={(e) => setAuteur(e.target.value)} className="liquid-glass-inset rounded-xl px-2.5 py-2 text-[13px] font-normal text-foreground outline-none">
              <option value="">Tout le monde</option>
              {auteurs.map(([id, nom]) => (
                <option key={id} value={id}>
                  {nom}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="liquid-glass-soft mt-auto hidden rounded-xl px-3 py-2.5 text-xs leading-relaxed lg:block">
          Chacun retire ce qu'il a joint. Le chef de projet et l'administrateur peuvent tout retirer.
        </p>
      </aside>

      <section className="liquid-glass-panel custom-scrollbar flex min-w-0 flex-col gap-2 rounded-[22px] p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" aria-label="Dossier du projet">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-bold">Dossier du projet</h3>
            <p className="text-xs text-muted-foreground">{visibilite}</p>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
            <button type="button" onClick={() => setAjout("lien")} className="liquid-glass-pill flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold">
              <Link2 size={14} />
              <span className="sm:hidden">Lien</span>
              <span className="hidden sm:inline">Ajouter un lien</span>
            </button>
            <button type="button" onClick={() => setAjout("fichier")} className="liquid-glass-pill flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold">
              <Paperclip size={14} />
              <span className="sm:hidden">Fichier</span>
              <span className="hidden sm:inline">Déposer un fichier</span>
            </button>
            <button type="button" onClick={() => setAjout("note")} className="chrome-black flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-medium text-white">
              <PenLine size={14} />
              <span className="sm:hidden">Note</span>
              <span className="hidden sm:inline">Rédiger une note</span>
            </button>
          </div>
        </div>
        {erreur && <p className="text-xs text-red-600">{erreur}</p>}

        <div className="hidden grid-cols-[8.5rem_minmax(0,1fr)_3.5rem_9.5rem_5.5rem_2rem] gap-3 px-2.5 text-[11.5px] font-bold text-muted-foreground md:grid">
          <span>Type</span>
          <span>Élément</span>
          <span>Étape</span>
          <span>Joint par</span>
          <span>Date</span>
          <span />
        </div>
        {visibles.length === 0 && (
          <p className="px-2.5 py-6 text-center text-[13px] text-muted-foreground">
            {lignes.length === 0
              ? "Le dossier est vide. Notes, fichiers, liens, réponses d'Archiaccess AI jointes et données ajoutées depuis la recherche apparaîtront ici."
              : "Rien ne correspond à ces filtres."}
          </p>
        )}
        <ul className="flex shrink-0 flex-col gap-1.5">
          {visibles.map((x) => {
            const depliable = x.element && (x.element.type === "NOTE" || x.element.type === "REPONSE_IA")
            const deplie = ouverte === x.cle
            return (
              <li key={x.cle} className="liquid-glass-soft rounded-[14px]">
                <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-3 gap-y-1.5 px-2.5 py-2 text-[13px] md:grid-cols-[8.5rem_minmax(0,1fr)_3.5rem_9.5rem_5.5rem_2rem]">
                  <span className="col-start-1 row-start-1 md:col-auto md:row-auto">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${x.sombre ? "chrome-black text-white" : "border border-foreground/12 bg-white"}`}>
                      {x.icone}
                      {x.type}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={!depliable}
                    onClick={() => setOuverte(deplie ? null : x.cle)}
                    aria-expanded={depliable ? deplie : undefined}
                    className="col-span-2 row-start-2 min-w-0 text-left disabled:cursor-default md:col-span-1 md:row-auto"
                  >
                    <b className={`block truncate font-semibold ${depliable ? "hover:underline" : ""}`}>{x.titre || "Sans titre"}</b>
                    <span className="block truncate text-xs text-muted-foreground">{x.detail}</span>
                  </button>
                  <span className="col-span-2 row-start-3 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground md:contents md:text-[13px]">
                    <span className={x.etapeCode ? "font-mono md:text-foreground" : "md:text-muted-foreground"}>
                      {x.etapeCode ? (
                        <button type="button" onClick={() => onOuvrirEtape(x.etapeCode!)} className="hover:underline" title={trouverEtape(x.etapeCode)?.titre}>
                          <span className="md:hidden">Étape </span>
                          {x.etapeCode}
                        </button>
                      ) : (
                        "Projet"
                      )}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 md:text-foreground">
                      <span className="md:hidden">·</span>
                      {x.auteur ? (
                        <>
                          <span className="hidden md:inline-flex">
                            <Avatar nom={x.auteur.name} petit />
                          </span>
                          <span className="truncate">{x.auteur.name}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Non renseigné</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="md:hidden">· </span>
                      {x.date ? dateCourte(x.date) : ""}
                    </span>
                  </span>
                  <span className="col-start-2 row-start-1 flex justify-end md:col-auto md:row-auto">
                    <MenuLigne
                      ligne={x}
                      onRetirer={
                        x.retrait
                          ? async () => {
                              setErreur(null)
                              try {
                                await x.retrait!()
                              } catch (e) {
                                setErreur(e instanceof Error ? e.message : "Retrait impossible.")
                              }
                            }
                          : null
                      }
                    />
                  </span>
                </div>
                {deplie && x.element && (
                  <div className="flex flex-col gap-1.5 border-t border-foreground/[0.06] px-3 py-3 text-[13px] leading-relaxed md:pl-[9.75rem]">
                    <ContenuElement projetId={projetId} e={x.element} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="liquid-glass-soft mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed lg:hidden">
          Chacun retire ce qu'il a joint. Le chef de projet et l'administrateur peuvent tout retirer.
        </p>
      </section>

      {ajout && (
        <DialogueAjout
          type={ajout}
          projetId={projetId}
          etapeParDefaut={etape && etape !== "projet" ? etape : ""}
          onFermer={() => setAjout(null)}
          onAjout={(e) => {
            onAjout(e)
            setAjout(null)
          }}
        />
      )}
    </div>
  )
}

function MenuLigne({ ligne, onRetirer }: { ligne: Ligne; onRetirer: (() => Promise<void>) | null }) {
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ouvert) return
    const fermer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener("mousedown", fermer)
    return () => document.removeEventListener("mousedown", fermer)
  }, [ouvert])
  if (!ligne.actions.length && !onRetirer) return <span />
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="true"
        aria-label={`Actions sur « ${ligne.titre} »`}
        className="rounded-lg p-1 text-muted-foreground hover:bg-white/70 hover:text-foreground"
      >
        <MoreHorizontal size={16} />
      </button>
      {ouvert && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-2xl border border-white/70 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl">
          {ligne.actions.map((a) => (
            <a
              key={a.libelle}
              href={a.href}
              {...(a.externe ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={() => setOuvert(false)}
              className="block rounded-xl px-2.5 py-2 text-[13px] hover:bg-foreground/[0.05]"
            >
              {a.libelle}
            </a>
          ))}
          {onRetirer && (
            <button
              type="button"
              disabled={enCours}
              onClick={() => {
                setEnCours(true)
                void onRetirer().finally(() => {
                  setEnCours(false)
                  setOuvert(false)
                })
              }}
              className="block w-full rounded-xl px-2.5 py-2 text-left text-[13px] text-destructive hover:bg-foreground/[0.05] disabled:opacity-50"
            >
              {enCours ? "Retrait…" : ligne.categorie === "sit" ? "Retirer du projet" : "Retirer du dossier"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function DialogueAjout({
  type,
  projetId,
  etapeParDefaut,
  onFermer,
  onAjout,
}: {
  type: Ajout
  projetId: string
  etapeParDefaut: string
  onFermer: () => void
  onAjout: (e: ElementProjet) => void
}) {
  const [etape, setEtape] = useState(etapeParDefaut)
  const [titre, setTitre] = useState("")
  const [url, setUrl] = useState("")
  const [texte, setTexte] = useState("")
  const [fichier, setFichier] = useState<File | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const titres: Record<Ajout, string> = { lien: "Ajouter un lien", fichier: "Déposer un fichier", note: "Rédiger une note" }
  const pret = type === "lien" ? !!url.trim() : type === "fichier" ? !!fichier : !!texte.trim()

  async function valider(ev: React.FormEvent) {
    ev.preventDefault()
    if (!pret || enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      const etapeCode = etape || null
      if (type === "fichier") onAjout(await deposerFichier(projetId, fichier!, etapeCode, texte))
      else if (type === "lien") onAjout(await publierElement(projetId, { type: "LIEN", etapeCode, titre, url: url.trim(), texte }))
      else onAjout(await publierElement(projetId, { type: "NOTE", etapeCode, texte }))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.")
      setEnCours(false)
    }
  }

  return (
    <Dialogue titre={titres[type]} sousTitre="Visible dans le dossier du projet et, si vous choisissez une étape, dans son fil." onFermer={onFermer}>
      <form onSubmit={valider} className="flex flex-col gap-3.5">
        {type === "lien" && (
          <>
            <Champ libelle="Adresse">
              <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={CHAMP} />
            </Champ>
            <Champ libelle="Titre (facultatif)">
              <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. : espace de partage de la maîtrise d'œuvre" className={CHAMP} />
            </Champ>
          </>
        )}
        {type === "fichier" && (
          <Champ libelle="Fichier" aide="4 Mo au maximum.">
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFichier(f)
                setErreur(f && f.size > FICHIER_MAX_OCTETS ? "Fichier trop volumineux (4 Mo au maximum)." : null)
              }}
              className={`${CHAMP} file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/[0.06] file:px-2.5 file:py-1 file:text-[12.5px] file:font-semibold`}
            />
          </Champ>
        )}
        <Champ libelle="Étape">
          <ChoixEtape valeur={etape} onChange={setEtape} />
        </Champ>
        <Champ libelle={type === "note" ? "Note" : "Commentaire (facultatif)"}>
          <textarea data-autofocus={type === "note" ? "" : undefined} value={texte} onChange={(e) => setTexte(e.target.value)} rows={type === "note" ? 6 : 3} className={`${CHAMP} resize-y`} placeholder={type === "note" ? "Décisions, points ouverts, informations utiles…" : ""} />
        </Champ>
        <p className="text-[12.5px] text-muted-foreground">Votre nom et la date sont affichés avec l'élément.</p>
        {erreur && <p className="text-xs text-red-600">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFermer} className="liquid-glass-pill rounded-xl px-4 py-2 text-[13px] font-semibold">
            Annuler
          </button>
          <button type="submit" disabled={!pret || enCours || (fichier?.size ?? 0) > FICHIER_MAX_OCTETS} className="chrome-black rounded-xl px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40">
            {enCours ? "Envoi…" : type === "note" ? "Publier" : "Ajouter"}
          </button>
        </div>
      </form>
    </Dialogue>
  )
}
