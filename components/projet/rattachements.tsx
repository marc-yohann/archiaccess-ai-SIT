"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowUpRight, Building2, ChevronDown, FileText, MapPin, Radar } from "lucide-react"

// Ce qui est rattaché au projet (site, acteurs, marchés, documents) : plus
// un simple nombre, chaque bloc s'ouvre (maquette validée le 2026-09-29,
// « Projet relié »). « Voir les données du site » ouvre la recherche déjà
// chargée sur l'adresse du projet. Sans rattachement, le bloc le dit.

export interface SiteRattache {
  site: { id: string; label: string; city: string; postcode: string }
}
export interface ActeurRattache {
  role: string | null
  acteur: { id: string; siren: string; nom: string | null; nomCommercial: string | null }
}
export interface AvisRattache {
  avisMarche: { id: string; objet: string | null; natureAvis: string | null; acheteurNom: string | null; datePublication: string | null; urlAvis: string | null }
}
export interface LotRattache {
  lot: { id: string; numero: string; description: string | null; titulaireNom: string | null; avisMarche: AvisRattache["avisMarche"] }
}
export interface DocumentRattache {
  documentSit: { id: string; titre: string; type: string | null; sourceUrl: string | null }
}

export interface Rattachements {
  sites: SiteRattache[]
  acteurs: ActeurRattache[]
  avisMarches: AvisRattache[]
  lots: LotRattache[]
  documentSitLinks: DocumentRattache[]
}

type Bloc = "site" | "acteurs" | "marches" | "documents"

export function lienDonneesSite(label: string) {
  return `/sit/recherche?site=${encodeURIComponent(label)}`
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

const LIGNE = "flex items-start gap-3 border-t border-foreground/[0.06] py-2.5 first:border-t-0"
const LIEN = "flex shrink-0 items-center gap-1 text-[12.5px] font-semibold hover:underline"

export function BlocsRattaches({ r }: { r: Rattachements }) {
  const [ouvert, setOuvert] = useState<Bloc | null>(null)
  const nbMarches = r.avisMarches.length + r.lots.length
  const premierSite = r.sites[0]?.site

  const blocs: { id: Bloc; icone: typeof MapPin; titre: string; resume: string; vide: boolean }[] = [
    {
      id: "site",
      icone: MapPin,
      titre: "Site",
      resume: r.sites.length === 0 ? "Aucun site rattaché" : r.sites.length === 1 ? premierSite!.label : pluriel(r.sites.length, "site", "sites"),
      vide: r.sites.length === 0,
    },
    {
      id: "acteurs",
      icone: Building2,
      titre: "Acteurs",
      resume: r.acteurs.length ? pluriel(r.acteurs.length, "entreprise ou organisme", "entreprises ou organismes") : "Aucun acteur rattaché",
      vide: r.acteurs.length === 0,
    },
    {
      id: "marches",
      icone: Radar,
      titre: "Marchés",
      resume: nbMarches
        ? [r.avisMarches.length && pluriel(r.avisMarches.length, "avis", "avis"), r.lots.length && pluriel(r.lots.length, "lot", "lots")].filter(Boolean).join(" · ")
        : "Aucun marché rattaché",
      vide: nbMarches === 0,
    },
    {
      id: "documents",
      icone: FileText,
      titre: "Documents",
      resume: r.documentSitLinks.length ? pluriel(r.documentSitLinks.length, "pièce", "pièces") : "Aucun document rattaché",
      vide: r.documentSitLinks.length === 0,
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {blocs.map(({ id, icone: Icone, titre, resume, vide }) => {
          const actif = ouvert === id
          return (
            <button
              key={id}
              type="button"
              disabled={vide}
              onClick={() => setOuvert(actif ? null : id)}
              aria-expanded={vide ? undefined : actif}
              className={`flex min-w-0 items-center gap-2.5 rounded-[18px] px-3 py-2.5 text-left transition-colors ${actif ? "glass-on" : "liquid-glass-soft"} ${vide ? "cursor-default" : "hover:bg-white/80"}`}
            >
              <span className="glass-icon size-7 shrink-0 rounded-[9px]">
                <Icone size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">{titre}</span>
                <span className={`block truncate text-xs ${vide ? "text-muted-foreground/80" : "text-muted-foreground"}`}>{resume}</span>
              </span>
              {!vide && <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${actif ? "rotate-180" : ""}`} />}
            </button>
          )
        })}
      </div>

      {ouvert && (
        <div className="liquid-glass-panel custom-scrollbar max-h-60 overflow-y-auto rounded-[18px] px-4 py-1.5">
          {ouvert === "site" &&
            r.sites.map(({ site }) => (
              <div key={site.id} className={LIGNE}>
                <span className="min-w-0 flex-1 text-[13px] font-medium">{site.label}</span>
                <Link href={lienDonneesSite(site.label)} className={LIEN}>
                  Voir les données du site
                  <ArrowUpRight size={13} />
                </Link>
              </div>
            ))}
          {ouvert === "acteurs" &&
            r.acteurs.map(({ acteur }) => (
              <div key={acteur.id} className={LIGNE}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{acteur.nom ?? acteur.nomCommercial ?? "Dénomination non renseignée"}</span>
                  <span className="block font-mono text-xs text-muted-foreground">SIREN {acteur.siren}</span>
                </span>
                <Link href={`/sit/recherche?resume=${encodeURIComponent(acteur.siren)}`} className={LIEN}>
                  Voir la fiche
                  <ArrowUpRight size={13} />
                </Link>
              </div>
            ))}
          {ouvert === "marches" && (
            <>
              {r.avisMarches.map(({ avisMarche: a }) => (
                <LigneAvis key={a.id} avis={a} />
              ))}
              {r.lots.map(({ lot }) => (
                <LigneAvis key={lot.id} avis={lot.avisMarche} lot={lot} />
              ))}
            </>
          )}
          {ouvert === "documents" &&
            r.documentSitLinks.map(({ documentSit: d }) => (
              <div key={d.id} className={LIGNE}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{d.titre}</span>
                  {d.type && <span className="block text-xs text-muted-foreground">{d.type}</span>}
                </span>
                {d.sourceUrl && (
                  <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className={LIEN}>
                    Ouvrir
                    <ArrowUpRight size={13} />
                  </a>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function LigneAvis({ avis, lot }: { avis: AvisRattache["avisMarche"]; lot?: LotRattache["lot"] }) {
  const detail = [avis.natureAvis, avis.acheteurNom, avis.datePublication].filter(Boolean).join(" · ")
  return (
    <div className={LIGNE}>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">
          {lot ? `Lot ${lot.numero}${lot.description ? ` · ${lot.description}` : ""}` : avis.objet ?? "Avis sans objet renseigné"}
        </span>
        <span className="block text-xs text-muted-foreground">
          {lot ? [avis.objet, lot.titulaireNom && `Titulaire : ${lot.titulaireNom}`].filter(Boolean).join(" · ") : detail}
        </span>
      </span>
      {avis.urlAvis && (
        <a href={avis.urlAvis} target="_blank" rel="noopener noreferrer" className={LIEN}>
          Voir l'avis
          <ArrowUpRight size={13} />
        </a>
      )}
    </div>
  )
}
