"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Search, Send, Sparkles, Copy, Check, ExternalLink, RefreshCw, Plus, ChevronRight, Home, Layers, Map, LayoutGrid, ListChecks, PanelRightClose, PanelRightOpen } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import type { AddressResult, CommuneResult } from "@/lib/data-sources/ban"
import type { Parcel } from "@/lib/data-sources/cadastre"
import type { CommuneRisks } from "@/lib/data-sources/georisques"
import type { Mutation } from "@/lib/data-sources/dvf"
import type { Company } from "@/lib/data-sources/entreprises"
import type { UrbanZone } from "@/lib/data-sources/urbanisme"
import type { DpeRecord } from "@/lib/data-sources/dpe"
import type { BodaccAnnouncement } from "@/lib/data-sources/bodacc"
import type { CavitesResult } from "@/lib/data-sources/cavites"
import type { PollutedSitesResult } from "@/lib/data-sources/sites-pollues"
import type { Servitude } from "@/lib/data-sources/servitudes"
import type { PublicMarket } from "@/lib/data-sources/boamp"
import { departmentCodeFromCityCode } from "@/lib/insee"
import type { GroundwaterStation } from "@/lib/data-sources/nappes"
import type { HeatNetworkEligibility } from "@/lib/data-sources/chaleur-urbaine"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  // Étiquette réelle du document du corpus à l'origine de la réponse —
  // jamais affichée si on ne peut pas l'établir (voir askAboutDocument).
  citation?: string
  // Question/instantané/titre à l'origine de cette réponse — permet de la
  // régénérer sans dupliquer la bulle "question" dans le fil (voir
  // regenerate()). Absent sur les messages "user".
  forText?: string
  forSnapshot?: SitSnapshot
  forTitle?: string
  forCitation?: string
}

interface RecentSearch {
  source: string
  cacheKey: string
  fetchedAt: string
}

interface SourceCount {
  source: string
  count: number
}

interface VaultStats {
  totalCacheEntries: number
  totalDocuments: number
  recentSearches: RecentSearch[]
  recentStudies: RecentSearch[]
  sourceCounts: SourceCount[]
  documentTitles: string[]
}

const SOURCE_LABELS: Record<string, string> = {
  ban: "Adresse",
  cadastre: "Cadastre",
  georisques: "Géorisques",
  dvf: "DVF",
  entreprises: "Entreprise",
  urbanisme: "Urbanisme",
  dpe: "DPE",
  bodacc: "BODACC",
  cavites: "Cavités",
  "sites-pollues": "Sites pollués",
  servitudes: "Servitudes",
  boamp: "BOAMP",
  nappes: "Nappes phréatiques",
  "chaleur-urbaine": "Réseau de chaleur",
  commune: "Commune",
}

// Regroupées par usage d'étude plutôt que par ordre technique d'intégration
// — répond à "à quoi ça sert" plutôt qu'à "qu'est-ce que c'est". Même
// regroupement partout : Sources fédérées, résultats de recherche,
// disciplines techniques (voir TAXONOMY plus bas).
const SOURCE_GROUPS: { label: string; short: string; desc: string; sources: string[] }[] = [
  {
    label: "Foncier & urbanisme",
    short: "le foncier",
    desc: "Constructibilité, historique de vente, zonage",
    sources: ["ban", "cadastre", "urbanisme", "servitudes"],
  },
  {
    label: "Risques & sol",
    short: "les risques et sols",
    desc: "Contraintes géotechniques et environnementales à anticiper",
    sources: ["georisques", "cavites", "sites-pollues", "nappes"],
  },
  {
    label: "Marché & acteurs",
    short: "le marché",
    desc: "Qui intervient sur le secteur, solidité financière",
    sources: ["entreprises", "bodacc", "boamp"],
  },
  {
    label: "Énergie & valeur",
    short: "l'énergie et la valeur",
    desc: "Performance énergétique et valeur du bien",
    sources: ["dvf", "dpe", "chaleur-urbaine"],
  },
]

// Taxonomie des ~40 disciplines techniques Archiaccess — savoir-faire
// d'ingénierie, pas une donnée interrogeable pour la plupart. Le badge
// "Corpus" n'est jamais codé en dur : calculé à l'affichage par
// correspondance de mot-clé dans les vrais titres indexés
// (vaultStats.documentTitles), pour rester honnête si le corpus évolue
// sans qu'on ait à retoucher cette liste. "group" relie l'item à un
// groupe de sources fédérées quand une donnée réelle existe.
interface TaxonomyItem {
  name: string
  corpusKeyword?: string
  group?: string
}
interface TaxonomyCategory {
  cat: string
  items: TaxonomyItem[]
}
const TAXONOMY: TaxonomyCategory[] = [
  {
    cat: "Structure (gros œuvre)",
    items: [
      { name: "Béton armé (calcul des armatures, coffrage, ferraillage)" },
      { name: "Béton précontraint (câbles de précontrainte)" },
      { name: "Structure métallique (charpentes, poutres, poteaux acier)" },
      { name: "Structure bois (charpentes, ossatures, lamellé-collé CLT)" },
      { name: "Structure mixte (acier-béton, bois-béton)" },
      { name: "Maçonnerie (murs porteurs, voiles)" },
      { name: "Ouvrages d'art (ponts, viaducs, tunnels, passerelles)" },
      { name: "Structures spéciales (silos, réservoirs, cuves, pylônes)" },
    ],
  },
  {
    cat: "Géotechnique et sols",
    items: [
      { name: "Études de sol (missions G1 à G5)", group: "Risques & sol" },
      { name: "Fondations spéciales (pieux, puits, micropieux, jet-grouting)" },
      { name: "Soutènement (murs, parois moulées, rideaux de palplanches)" },
      { name: "Renforcement de sols (inclusions rigides, colonnes ballastées, drainage)" },
      { name: "Stabilité des pentes (glissements de terrain, affaissements)" },
      { name: "Interaction sol-structure" },
    ],
  },
  {
    cat: "Fluides et génie climatique (CVC)",
    items: [
      { name: "Chauffage (gaz, fioul, bois, pompe à chaleur)" },
      { name: "Ventilation (VMC simple/double flux, naturelle)" },
      { name: "Climatisation (gainable, split, eau glacée)" },
      { name: "Plomberie sanitaire (eau froide, eau chaude, évacuations)" },
      { name: "Fluides spéciaux (gaz médicaux, air comprimé, fluides industriels)" },
      { name: "Désenfumage (extracteurs de fumée, ventilation)", corpusKeyword: "incendie" },
      { name: "Réseaux d'incendie (sprinklers, colonnes sèches et humides)" },
      { name: "Piscines et bassins (traitement de l'eau, filtration)" },
    ],
  },
  {
    cat: "Thermique et énergétique",
    items: [
      { name: "Réglementation thermique (RE2020, RT2012)", corpusKeyword: "re2020" },
      { name: "Simulation thermique dynamique (STD)" },
      { name: "Analyse du cycle de vie (ACV, bilan carbone)" },
      { name: "Énergies renouvelables (solaire, géothermie)", group: "Énergie & valeur", corpusKeyword: "solarisation" },
      { name: "Audit énergétique (DPE)", group: "Énergie & valeur" },
      { name: "Confort d'été (surchauffes, rafraîchissement)" },
    ],
  },
  {
    cat: "Acoustique",
    items: [
      { name: "Acoustique bâtiment (isolation aérienne et d'impact)", corpusKeyword: "acoustique" },
      { name: "Acoustique environnementale (impact sonore, nuisances)" },
      { name: "Acoustique des salles (auditoriums, cinémas)" },
    ],
  },
  {
    cat: "VRD et aménagement extérieur",
    items: [
      { name: "Voirie (chaussées, trottoirs, parkings, pistes cyclables)" },
      { name: "Réseaux secs (électricité, gaz, téléphonie, fibre)" },
      { name: "Réseaux humides (eau potable, eaux usées, eaux pluviales)" },
      { name: "Assainissement (séparatif, unitaire, stations de relevage)", corpusKeyword: "assainissement" },
      { name: "Éclairage public (luminaires, implantation)" },
      { name: "Espaces verts (arrosage, drainage, plantations)" },
    ],
  },
  {
    cat: "Sécurité, accessibilité et incendie",
    items: [
      { name: "Sécurité incendie (SSI, détection, alarme, compartimentage)", corpusKeyword: "incendie" },
      { name: "Accessibilité PMR", corpusKeyword: "accessibilité" },
      { name: "Sécurité des ERP (Établissements Recevant du Public)" },
      { name: "Sûreté (contrôle d'accès, vidéosurveillance, anti-intrusion)" },
    ],
  },
  {
    cat: "Économie de la construction",
    items: [
      { name: "Métré (quantification des ouvrages)" },
      { name: "Étude de prix (chiffrage, estimation des coûts)" },
      { name: "Planification (plannings, délais)" },
    ],
  },
  {
    cat: "Environnement et développement durable",
    items: [
      { name: "HQE (Haute Qualité Environnementale)" },
      { name: "Qualité de l'air intérieur (QAI)", corpusKeyword: "aération" },
      { name: "Dépollution des sols (traitement des terres polluées)", group: "Risques & sol" },
    ],
  },
  {
    cat: "Diagnostic et pathologie",
    items: [
      { name: "Diagnostic structurel (inspection de bâtiments existants)" },
      { name: "Pathologie des matériaux (fissuration, corrosion, pourrissement)" },
      { name: "Diagnostic amiante (repérage avant travaux)", corpusKeyword: "amiante" },
      { name: "Diagnostic plomb (peintures au plomb)" },
      { name: "Diagnostic termites" },
      { name: "Diagnostic électrique" },
      { name: "Diagnostic gaz" },
    ],
  },
  {
    cat: "Spécialités de niche et ouvrages spécifiques",
    items: [
      { name: "Parasismique (conception et renforcement en zone sismique)", corpusKeyword: "parasismique" },
      { name: "Ouvrages souterrains (tunnels, métros, galeries)" },
      { name: "Ouvrages maritimes (ports, digues, barrages)" },
      { name: "Infrastructures linéaires (routes, voies ferrées, pistes aéronautiques)" },
      { name: "Génie civil nucléaire", corpusKeyword: "radioprotection" },
      { name: "Vibratoire et dynamique (trafic, machines)" },
      { name: "Pyrotechnie et explosion (dimensionnement anti-souffle)" },
      { name: "Résistance au feu (stabilité des structures sous incendie)", corpusKeyword: "incendie" },
      { name: "BIM (modélisation 3D et gestion des données)" },
      { name: "Infiltrométrie (test d'étanchéité à l'air)" },
      { name: "GTB / GTC (automatisation et pilotage)" },
      { name: "Réseaux VDI (câblage structuré, téléphonie, WiFi)" },
      { name: "Monuments historiques (réhabilitation du bâti ancien)" },
    ],
  },
]

// Chips de filtre du panneau "Corpus réglementaire" — même principe que
// le badge "Corpus" de TAXONOMY : jamais un id de document codé en dur,
// une étiquette de discipline associée à des mots-clés, vérifiée à
// l'affichage contre les vrais titres indexés (vaultStats.documentTitles).
// Une chip n'apparaît que si au moins un document réel correspond.
// Questions suggérées du panneau Archiaccess AI — mêmes 3 disciplines que
// l'artéfact, mais jamais liées à un id de document en dur : résolues à
// l'affichage contre les vrais titres indexés (voir suggestedQuestions()
// plus bas). N'apparaît que si un document réel correspond.
const SUGGESTED_QUESTION_TEMPLATES: { tag: string; question: string }[] = [
  { tag: "Accessibilité", question: "Quelles sont les obligations PMR pour un ERP neuf ?" },
  { tag: "Contrats", question: "Quels sont les délais de recours après réception (CCAG-Travaux) ?" },
  { tag: "Marchés publics", question: "À partir de quel seuil faut-il une procédure formalisée ?" },
]

const DOCUMENT_TAGS: { tag: string; keywords: string[] }[] = [
  { tag: "Accessibilité", keywords: ["accessibilité"] },
  { tag: "Acoustique", keywords: ["acoustique"] },
  { tag: "Amiante", keywords: ["amiante"] },
  { tag: "AMO / MOE", keywords: ["maîtrise d'œuvre", "maîtrise d'ouvrage"] },
  { tag: "Contrats", keywords: ["ccag"] },
  { tag: "Eau", keywords: ["loi sur l'eau", "iota", "assainissement non collectif"] },
  { tag: "Énergie", keywords: ["solarisation", "re2020", "réglementation environnementale"] },
  { tag: "Environnement", keywords: ["installations classées", "icpe"] },
  { tag: "Garanties", keywords: ["garanties de construction"] },
  { tag: "Hyperbare", keywords: ["hyperbare"] },
  { tag: "Incendie", keywords: ["incendie"] },
  { tag: "Marchés publics", keywords: ["passation des marchés publics"] },
  { tag: "Parasismique", keywords: ["parasismique"] },
  { tag: "Qualité d'air", keywords: ["aération"] },
  { tag: "Radon", keywords: ["radioprotection", "radon"] },
  { tag: "Réemploi", keywords: ["pemd"] },
  { tag: "SPS", keywords: ["coordination sps"] },
  { tag: "VRD", keywords: ["assainissement collectif"] },
]

// 5 portes d'entrée vers le SIT (retour : "accéder aux données en
// mettant une adresse ou une entreprise, je trouve ça pauvre" pour une
// base pluridisciplinaire). "point", "discipline", "secteur" et "lot"
// sont réellement câblés sur la vraie recherche ; "carte" reste un aperçu
// schématique honnête (voir FranceOutline plus bas) — l'intégration d'un
// vrai fond de carte (tuiles IGN) n'est pas construite.
type SearchMode = "point" | "secteur" | "carte" | "discipline" | "lot"
const SEARCH_MODE_META: { id: SearchMode; label: string; icon: typeof Search }[] = [
  { id: "point", label: "Point précis", icon: Search },
  { id: "secteur", label: "Secteur", icon: Layers },
  { id: "carte", label: "Carte", icon: Map },
  { id: "discipline", label: "Discipline", icon: LayoutGrid },
  { id: "lot", label: "Lot", icon: ListChecks },
]

function labelFromCacheKey(key: string): string {
  const raw = key.replace(/^q:/, "")
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  return `il y a ${days} j`
}

// Instantané des données actuellement chargées dans le tableau de bord —
// passé explicitement à formatContext()/sendAiMessage() plutôt que lu
// depuis le state React, pour éviter de capturer des valeurs pas encore
// à jour (setState est asynchrone : juste après un setParcels(...), le
// state "parcels" du closure courant peut encore être l'ancien).
interface SitSnapshot {
  address?: AddressResult | null
  parcels?: Parcel[] | null
  risks?: CommuneRisks | null
  mutations?: Mutation[] | null
  urbanZones?: UrbanZone[] | null
  dpeRecords?: DpeRecord[] | null
  companies?: Company[]
  bodaccBySiren?: Record<string, BodaccAnnouncement[]>
  cavites?: CavitesResult | null
  pollutedSites?: PollutedSitesResult | null
  servitudes?: Servitude[] | null
  publicMarkets?: PublicMarket[] | null
  groundwaterStations?: GroundwaterStation[] | null
  heatNetwork?: HeatNetworkEligibility | null
}

// Résultat complet pour une adresse — même 10 connecteurs que
// selectAddress() ci-dessous, factorisés dans fetchAddressBundle() pour
// être réutilisés à l'identique par le mode "Lot" (plusieurs adresses).
interface AddressBundle {
  address: AddressResult
  parcels: Parcel[]
  risks: CommuneRisks | null
  mutations: Mutation[]
  urbanZones: UrbanZone[]
  dpeRecords: DpeRecord[]
  cavites: CavitesResult | null
  pollutedSites: PollutedSitesResult | null
  servitudes: Servitude[]
  publicMarkets: PublicMarket[]
  groundwaterStations: GroundwaterStation[]
  heatNetwork: HeatNetworkEligibility | null
}

// Résultat pour le mode "Secteur" (échelle commune) — seuls les
// connecteurs qui acceptent nativement un code INSEE/département sans
// adresse précise (vérifié par appel réel avant d'écrire ce mode, voir
// conversation) : géorisques, cavités, sites pollués, nappes, BOAMP. DVF
// est exclu — pas d'endpoint par commune (seulement par section
// cadastrale, une commune peut en compter plus d'une centaine), ce que le
// panneau "Secteur" indique explicitement plutôt que de le passer sous
// silence.
interface SecteurResult {
  commune: CommuneResult
  risks: CommuneRisks | null
  cavites: CavitesResult | null
  pollutedSites: PollutedSitesResult | null
  groundwaterStations: GroundwaterStation[]
  publicMarkets: PublicMarket[]
}

interface LotRow {
  query: string
  bundle: AddressBundle | null
  error: string | null
}

function formatContext(s: SitSnapshot): string {
  const parts: string[] = []
  if (s.address) {
    parts.push(`Adresse sélectionnée : ${s.address.label} (${s.address.postcode} ${s.address.city}, code INSEE ${s.address.citycode})`)
  }
  if (s.parcels?.[0]) {
    const p = s.parcels[0]
    parts.push(`Parcelle cadastrale : section ${p.section} n°${p.numero}, ${p.contenanceM2} m², identifiant ${p.idu}`)
  }
  if (s.risks) {
    const riskLabels = s.risks.risks.map((r) => r.label).join(", ") || "aucun risque recensé"
    parts.push(
      `Risques (commune ${s.risks.commune}) : zone sismique ${s.risks.seismicZone ?? "non renseignée"}, potentiel radon ${s.risks.radonPotential ?? "non renseigné"}, risques : ${riskLabels}`,
    )
  }
  if (s.urbanZones && s.urbanZones.length > 0) {
    parts.push(`Urbanisme (PLU/POS) : ${s.urbanZones.map((z) => `${z.description} (${z.label}${z.type ? `, type ${z.type}` : ""})`).join(" ; ")}`)
  }
  if (s.mutations && s.mutations.length > 0) {
    const last = s.mutations[0]
    parts.push(
      `DVF : ${s.mutations.length} vente(s) recensée(s) sur cette section, la plus récente le ${last.date}${last.valeurFonciere ? ` pour ${last.valeurFonciere.toLocaleString("fr-FR")} €` : ""}.`,
    )
  }
  if (s.dpeRecords && s.dpeRecords.length > 0) {
    const labels = s.dpeRecords.map((d) => d.etiquetteEnergie).filter(Boolean).join(", ")
    parts.push(`DPE à proximité : ${s.dpeRecords.length} diagnostic(s) trouvé(s), étiquettes énergie : ${labels || "non renseignées"}.`)
  }
  if (s.cavites) {
    parts.push(
      s.cavites.total > 0
        ? `Cavités souterraines (commune) : ${s.cavites.total} recensée(s), ex. ${s.cavites.cavites
            .slice(0, 3)
            .map((c) => `${c.type}${c.nom ? ` "${c.nom}"` : ""}`)
            .join(", ")}.`
        : "Cavités souterraines (commune) : aucune recensée.",
    )
  }
  if (s.pollutedSites) {
    parts.push(
      s.pollutedSites.totalCasias + s.pollutedSites.totalInstructions > 0
        ? `Sites et sols pollués (SSP/CASIAS, commune) : ${s.pollutedSites.totalCasias} site(s) recensé(s), ${s.pollutedSites.totalInstructions} instruction(s) en cours.`
        : "Sites et sols pollués (SSP/CASIAS, commune) : aucun recensé.",
    )
  }
  if (s.servitudes) {
    parts.push(
      s.servitudes.length > 0
        ? `Servitudes d'utilité publique : ${s.servitudes.map((sv) => `${sv.label} (${sv.type})`).join(" ; ")}.`
        : "Servitudes d'utilité publique : aucune identifiée sur ce point.",
    )
  }
  if (s.publicMarkets && s.publicMarkets.length > 0) {
    parts.push(
      `Marchés publics récents (département) : ${s.publicMarkets
        .slice(0, 3)
        .map((m) => `${m.acheteur} — ${m.objet} (${m.datePublication})`)
        .join(" ; ")}.`,
    )
  }
  if (s.groundwaterStations) {
    parts.push(
      s.groundwaterStations.length > 0
        ? `Nappes phréatiques (stations piézométriques, commune) : ${s.groundwaterStations.length} station(s), ex. ${s.groundwaterStations
            .slice(0, 3)
            .map((g) => `${g.aquifere ?? "aquifère non renseigné"}${g.profondeurInvestigation ? ` (prof. ${g.profondeurInvestigation} m)` : ""}${g.dateFinMesure ? ` — arrêtée ${g.dateFinMesure}` : " — suivi actif"}`)
            .join(", ")}.`
        : "Nappes phréatiques : aucune station piézométrique recensée sur cette commune.",
    )
  }
  if (s.heatNetwork) {
    parts.push(
      s.heatNetwork.isEligible
        ? `Réseau de chaleur urbain : point éligible au réseau "${s.heatNetwork.networkName ?? "?"}" (à ${s.heatNetwork.distanceMeters} m, géré par ${s.heatNetwork.manager ?? "gestionnaire non renseigné"}).`
        : s.heatNetwork.futureNetwork
          ? "Réseau de chaleur urbain : pas éligible actuellement, mais un réseau est en projet à proximité."
          : "Réseau de chaleur urbain : aucun réseau existant ou en projet à proximité.",
    )
  }
  if (s.companies && s.companies.length > 0) {
    parts.push(
      `Entreprises trouvées : ${s.companies
        .map((c) => {
          const announcements = s.bodaccBySiren?.[c.siren] ?? []
          const bodacc =
            announcements.length > 0
              ? ` — BODACC : ${announcements.length} annonce(s), la plus récente : ${announcements[0].famille} le ${announcements[0].datePublication}`
              : ""
          return `${c.nom} (SIREN ${c.siren}${c.adresse ? `, ${c.adresse}` : ""}, ${c.etatAdministratif ?? "statut inconnu"})${bodacc}`
        })
        .join(" ; ")}`,
    )
  }
  return parts.join("\n")
}

interface ResultItem {
  source: string
  body?: string
  empty?: string
}
interface ResultGroup {
  group: string
  items: ResultItem[]
}

// Résultats groupés par thématique (mêmes 4 groupes que "Sources
// fédérées") et rendus en phrases courtes plutôt qu'en listes de champs —
// retour utilisateur du 2026-09-03 ("je trouve ça sec"). Un connecteur
// sans résultat devient une ligne fine plutôt qu'une carte pleine
// grandeur (voir .tile-empty), pour ne pas donner le même poids visuel à
// "aucun résultat" qu'à une vraie donnée. Construit à partir du même
// SitSnapshot que formatContext(), pas de nouvelle donnée.
function resultItems(s: SitSnapshot): ResultGroup[] {
  const groups: Record<string, ResultItem[]> = {
    "Foncier & urbanisme": [],
    "Risques & sol": [],
    "Marché & acteurs": [],
    "Énergie & valeur": [],
  }

  if (s.address) {
    groups["Foncier & urbanisme"].push({ source: "Adresse", body: `Le site se situe au ${s.address.label}.` })
  }
  if (s.parcels) {
    groups["Foncier & urbanisme"].push(
      s.parcels.length > 0
        ? {
            source: "Cadastre",
            body: `La parcelle cadastrale (section ${s.parcels[0].section}, n°${s.parcels[0].numero}) s'étend sur ${s.parcels[0].contenanceM2} m².`,
          }
        : { source: "Cadastre", empty: "Aucune parcelle trouvée à proximité." },
    )
  }
  if (s.urbanZones) {
    groups["Foncier & urbanisme"].push(
      s.urbanZones.length > 0
        ? { source: "Urbanisme", body: `Zone ${s.urbanZones[0].label} : ${s.urbanZones[0].description}.` }
        : { source: "Urbanisme", empty: "Aucune zone trouvée (document non couvert par le GPU)." },
    )
  }
  if (s.servitudes) {
    groups["Foncier & urbanisme"].push(
      s.servitudes.length > 0
        ? { source: "Servitudes", body: `${s.servitudes.length} servitude(s) d'utilité publique recensée(s), dont ${s.servitudes[0].label}.` }
        : { source: "Servitudes", empty: "Aucune servitude identifiée sur ce point." },
    )
  }

  if (s.risks) {
    groups["Risques & sol"].push({
      source: "Géorisques",
      body: `Le site est en zone sismique ${s.risks.seismicZone ?? "non renseignée"}, avec un potentiel radon ${s.risks.radonPotential ?? "non renseigné"}.`,
    })
  }
  if (s.groundwaterStations) {
    groups["Risques & sol"].push(
      s.groundwaterStations.length > 0
        ? {
            source: "Nappes phréatiques",
            body: `Une nappe (${s.groundwaterStations[0].aquifere ?? "aquifère non renseigné"}) est suivie à proximité${s.groundwaterStations[0].profondeurInvestigation ? ` (prof. ${s.groundwaterStations[0].profondeurInvestigation} m)` : ""}.`,
          }
        : { source: "Nappes phréatiques", empty: "Aucune station piézométrique recensée sur cette commune." },
    )
  }
  if (s.cavites) {
    groups["Risques & sol"].push(
      s.cavites.total > 0
        ? { source: "Cavités", body: `${s.cavites.total} cavité(s) souterraine(s) recensée(s) dans la commune.` }
        : { source: "Cavités", empty: "Aucune cavité recensée pour cette commune." },
    )
  }
  if (s.pollutedSites) {
    const total = s.pollutedSites.totalCasias + s.pollutedSites.totalInstructions
    groups["Risques & sol"].push(
      total > 0
        ? { source: "Sites pollués", body: `${s.pollutedSites.totalCasias} site(s) pollué(s) répertorié(s), ${s.pollutedSites.totalInstructions} instruction(s) en cours.` }
        : { source: "Sites pollués", empty: "Aucun site pollué recensé à proximité." },
    )
  }

  if (s.companies) {
    for (const c of s.companies) {
      groups["Marché & acteurs"].push({
        source: "Entreprise",
        body: `${c.nom} (SIREN ${c.siren}) est enregistrée comme ${c.etatAdministratif ?? "statut inconnu"}.`,
      })
      const announcements = s.bodaccBySiren?.[c.siren] ?? []
      groups["Marché & acteurs"].push(
        announcements.length > 0
          ? {
              source: "BODACC",
              body: `${announcements.length} annonce(s) légale(s) pour ${c.nom}, la plus récente : ${announcements[0].famille} le ${announcements[0].datePublication}.`,
            }
          : { source: "BODACC", empty: `Aucune annonce légale récente pour ${c.nom}.` },
      )
    }
  }
  if (s.publicMarkets) {
    groups["Marché & acteurs"].push(
      s.publicMarkets.length > 0
        ? { source: "Marchés publics", body: `${s.publicMarkets[0].acheteur} a publié : ${s.publicMarkets[0].objet} (${s.publicMarkets[0].datePublication}).` }
        : { source: "Marchés publics", empty: "Aucun marché public récent trouvé dans le département." },
    )
  }

  if (s.mutations) {
    groups["Énergie & valeur"].push(
      s.mutations.length > 0
        ? { source: "DVF", body: `${s.mutations.length} mutation(s) immobilière(s) recensée(s) sur cette section.` }
        : { source: "DVF", empty: "Aucune vente répertoriée dans cette section." },
    )
  }
  if (s.dpeRecords) {
    groups["Énergie & valeur"].push(
      s.dpeRecords.length > 0
        ? { source: "DPE", body: `${s.dpeRecords.length} diagnostic(s) de performance énergétique trouvé(s) à proximité, étiquette ${s.dpeRecords[0].etiquetteEnergie ?? "?"}.` }
        : { source: "DPE", empty: "Aucun diagnostic répertorié à proximité." },
    )
  }
  if (s.heatNetwork) {
    groups["Énergie & valeur"].push({
      source: "Réseau de chaleur",
      body: s.heatNetwork.isEligible
        ? `Le site est éligible au réseau de chaleur "${s.heatNetwork.networkName ?? "?"}" (à ${s.heatNetwork.distanceMeters} m).`
        : s.heatNetwork.futureNetwork
          ? "Pas éligible actuellement, mais un réseau de chaleur est en projet à proximité."
          : "Aucun réseau de chaleur existant ou en projet à proximité.",
    })
  }

  return Object.entries(groups)
    .map(([group, items]) => ({ group, items }))
    .filter((g) => g.items.length > 0)
}

// Rendu des groupes de résultats — extrait du bloc "Point précis" pour être
// réutilisé à l'identique par "Secteur" et "Lot" (résultats groupés depuis
// resultItems(), sur un SitSnapshot différent à chaque fois, jamais de
// duplication de la logique d'affichage).
// onItemClick optionnel : quand fourni, une tuile avec résultat devient
// cliquable pour en discuter avec Archiaccess AI (même principe que les
// items de la taxonomie Discipline, jamais de citation fabriquée — la
// question posée cite le texte réel affiché sur la tuile). Retour
// utilisateur : "lorsqu'une recherche est faite on ne peut pas cliquer
// dessus".
function ResultGroups({ groups, onItemClick }: { groups: ResultGroup[]; onItemClick?: (item: ResultItem) => void }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.group} className="results-group">
          <div className="results-group-head">
            <h3 className="text-xs font-medium">{g.group}</h3>
            <span className="text-xs text-muted-foreground">
              {g.items.filter((it) => it.body).length}/{g.items.length} avec résultat
            </span>
          </div>
          <div className="results-grid">
            {g.items.map((it, i) =>
              it.body ? (
                onItemClick ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onItemClick(it)}
                    className="liquid-glass-panel rounded-2xl p-4 text-left transition-shadow hover:shadow-md"
                  >
                    <h4 className="tile-head">{it.source}</h4>
                    <p className="tile-body">{it.body}</p>
                  </button>
                ) : (
                  <div key={i} className="liquid-glass-panel rounded-2xl p-4">
                    <h4 className="tile-head">{it.source}</h4>
                    <p className="tile-body">{it.body}</p>
                  </div>
                )
              ) : (
                <div key={i} className="tile-empty">
                  <span className="empty-dot" />
                  <span className="empty-source">{it.source}</span> — {it.empty}
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </>
  )
}

// Mise en forme légère des réponses du copilote (gras **texte**, listes
// "- item") — texte échappé avant tout, pour que dangerouslySetInnerHTML
// ne puisse jamais injecter de balise venant de la réponse du modèle.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
function formatReply(text: string): string {
  const lines = text.split("\n")
  const bold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  let html = ""
  let inList = false
  for (const raw of lines) {
    const line = escapeHtml(raw.trim())
    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>"
        inList = true
      }
      html += `<li>${bold(line.slice(2))}</li>`
    } else {
      if (inList) {
        html += "</ul>"
        inList = false
      }
      if (line) html += `<p>${bold(line)}</p>`
    }
  }
  if (inList) html += "</ul>"
  return html
}

// Tableau de bord du SIT : recherche universelle (adresse OU entreprise —
// voir CLAUDE.md, "je veux pas que ce soit l'adresse seulement"), tous
// les résultats affichés simultanément en tuiles denses plutôt qu'un
// formulaire séquentiel, avec un panneau Archiaccess AI intégré qui
// résume automatiquement les données chargées et répond aux questions
// dessus (contexte transmis à /api/mistral/chat).
export default function SitPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      {/* useSearchParams() (voir ?resume= plus bas) exige un ancêtre
          Suspense côté build Next.js. */}
      <Suspense fallback={null}>
        <Dashboard />
      </Suspense>
    </AuthGate>
  )
}

// Nombre maximum d'adresses acceptées par "Lot" en une recherche — plafond
// délibéré pour rester dans le temps d'une requête Lambda (chaque adresse
// déclenche les 10 mêmes appels que "Point précis") et ne pas multiplier
// sans limite les appels aux API publiques externes.
const LOT_MAX = 10

// Les 10 mêmes connecteurs que "Point précis", factorisés pour être
// réutilisés à l'identique par le mode "Lot" (une adresse à la fois,
// jamais de logique dupliquée) — voir selectAddress() et searchLot().
async function fetchAddressBundle(addr: AddressResult): Promise<AddressBundle> {
  const [lon, lat] = addr.coordinates
  const codeDepartement = departmentCodeFromCityCode(addr.citycode)
  const [parcelsRes, risksRes, urbanismeRes, dpeRes, cavitesRes, sitesPolluesRes, servitudesRes, boampRes, nappesRes, chaleurRes] =
    await Promise.all([
      fetch(`/api/sit/parcels?lon=${lon}&lat=${lat}`).then((r) => r.json()),
      fetch(`/api/sit/risks?codeInsee=${addr.citycode}`).then((r) => r.json()),
      fetch(`/api/sit/urbanisme?lon=${lon}&lat=${lat}`).then((r) => r.json()),
      fetch(`/api/sit/dpe?lon=${lon}&lat=${lat}`).then((r) => r.json()),
      fetch(`/api/sit/cavites?codeInsee=${addr.citycode}`).then((r) => r.json()),
      fetch(`/api/sit/sites-pollues?codeInsee=${addr.citycode}`).then((r) => r.json()),
      fetch(`/api/sit/servitudes?lon=${lon}&lat=${lat}`).then((r) => r.json()),
      fetch(`/api/sit/boamp?codeDepartement=${codeDepartement}`).then((r) => r.json()),
      fetch(`/api/sit/nappes?codeInsee=${addr.citycode}`).then((r) => r.json()),
      fetch(`/api/sit/chaleur-urbaine?lon=${lon}&lat=${lat}`).then((r) => r.json()),
    ])

  const parcels: Parcel[] = parcelsRes.success ? parcelsRes.parcels : []
  const risks: CommuneRisks | null = risksRes.success ? risksRes.risks : null
  const urbanZones: UrbanZone[] = urbanismeRes.success ? urbanismeRes.zones : []
  const dpeRecords: DpeRecord[] = dpeRes.success ? dpeRes.records : []
  const cavites: CavitesResult | null = cavitesRes.success ? { total: cavitesRes.total, cavites: cavitesRes.cavites } : null
  const pollutedSites: PollutedSitesResult | null = sitesPolluesRes.success
    ? { totalCasias: sitesPolluesRes.totalCasias, totalInstructions: sitesPolluesRes.totalInstructions, sites: sitesPolluesRes.sites }
    : null
  const servitudes: Servitude[] = servitudesRes.success ? servitudesRes.servitudes : []
  const publicMarkets: PublicMarket[] = boampRes.success ? boampRes.markets : []
  const groundwaterStations: GroundwaterStation[] = nappesRes.success ? nappesRes.stations : []
  const heatNetwork: HeatNetworkEligibility | null = chaleurRes.success ? chaleurRes.eligibility : null

  let mutations: Mutation[] = []
  if (parcels[0]) {
    const dvfRes = await fetch(
      `/api/sit/dvf?codeCommune=${parcels[0].codeInsee}&sectionPrefixe=${parcels[0].sectionPrefixe}`,
    ).then((r) => r.json())
    if (dvfRes.success) mutations = dvfRes.mutations
  }

  return { address: addr, parcels, risks, mutations, urbanZones, dpeRecords, cavites, pollutedSites, servitudes, publicMarkets, groundwaterStations, heatNetwork }
}

function Dashboard() {
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")
  const [addresses, setAddresses] = useState<AddressResult[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [bodaccBySiren, setBodaccBySiren] = useState<Record<string, BodaccAnnouncement[]>>({})

  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null)
  const [parcels, setParcels] = useState<Parcel[] | null>(null)
  const [risks, setRisks] = useState<CommuneRisks | null>(null)
  const [mutations, setMutations] = useState<Mutation[] | null>(null)
  const [urbanZones, setUrbanZones] = useState<UrbanZone[] | null>(null)
  const [dpeRecords, setDpeRecords] = useState<DpeRecord[] | null>(null)
  const [cavites, setCavites] = useState<CavitesResult | null>(null)
  const [pollutedSites, setPollutedSites] = useState<PollutedSitesResult | null>(null)
  const [servitudes, setServitudes] = useState<Servitude[] | null>(null)
  const [publicMarkets, setPublicMarkets] = useState<PublicMarket[] | null>(null)
  const [groundwaterStations, setGroundwaterStations] = useState<GroundwaterStation[] | null>(null)
  const [heatNetwork, setHeatNetwork] = useState<HeatNetworkEligibility | null>(null)

  // Reprise depuis /ai : une conversation démarrée ici est titrée "SIT ·
  // <adresse/entreprise>" (voir sendAiMessage) ; /ai propose un lien
  // "Reprendre dans le SIT" vers /sit?resume=<même texte> pour relancer
  // la même recherche sans que l'employé ait à la retaper.
  const searchParams = useSearchParams()
  useEffect(() => {
    const resume = searchParams.get("resume")
    if (!resume) return
    setQuery(resume)
    void search({ preventDefault: () => {} } as React.FormEvent, resume)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Chargement d'une adresse sélectionnée : le temps que les ~10 appels
  // parallèles de selectAddress() répondent, avant que les tuiles de
  // résultats ne s'affichent (voir resultItems()) — pas de squelette
  // pour une recherche entreprise seule (résultat synchrone).
  const [resultsLoading, setResultsLoading] = useState(false)

  const [docFilter, setDocFilter] = useState("")
  const [docTagFilter, setDocTagFilter] = useState<string | null>(null)

  // Panneau Archiaccess AI redimensionnable/repliable (retour : "rend le
  // chat AI modulaire") — largeur ajustable par glisser sur le bord
  // gauche (desktop uniquement), replié = simple bande verticale.
  const [aiWidth, setAiWidth] = useState(384)
  const [aiCollapsed, setAiCollapsed] = useState(false)

  function startAiResize(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = aiWidth
    function onMove(ev: MouseEvent) {
      setAiWidth(Math.min(640, Math.max(280, startWidth + (startX - ev.clientX))))
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }

  const [searchMode, setSearchMode] = useState<SearchMode>("point")
  const [discGroupIndex, setDiscGroupIndex] = useState(0)
  const [discQuery, setDiscQuery] = useState("")
  const [openTaxoCats, setOpenTaxoCats] = useState<number[]>([])
  const [secteurQuery, setSecteurQuery] = useState("")
  const [isSecteurSearching, setIsSecteurSearching] = useState(false)
  const [secteurResult, setSecteurResult] = useState<SecteurResult | null>(null)
  const [secteurError, setSecteurError] = useState("")
  const [lotInput, setLotInput] = useState("")
  const [isLotSearching, setIsLotSearching] = useState(false)
  const [lotResults, setLotResults] = useState<LotRow[] | null>(null)

  // Horloge de la ligne de statut — pur affichage du temps, forcé sur
  // Europe/Paris (cohérent avec des données françaises), aucune donnée
  // d'usage.
  const [clock, setClock] = useState("")
  useEffect(() => {
    function tick() {
      const now = new Date()
      const datePart = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" })
        .format(now)
        .replace(".", "")
        .toUpperCase()
      const timePart = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now)
      const tzPart = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", timeZoneName: "short" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")?.value ?? "CET"
      setClock(`${datePart} — ${timePart} ${tzPart}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null)
  useEffect(() => {
    fetch("/api/sit/vault-stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setVaultStats({
            totalCacheEntries: data.totalCacheEntries,
            totalDocuments: data.totalDocuments,
            recentSearches: data.recentSearches,
            recentStudies: data.recentStudies,
            sourceCounts: data.sourceCounts,
            documentTitles: data.documentTitles,
          })
        }
      })
      .catch(() => {})
  }, [])

  const [aiConversationId, setAiConversationId] = useState<string>()
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([])
  const [aiInput, setAiInput] = useState("")
  const [isAiSending, setIsAiSending] = useState(false)
  const [copiedMsgIndex, setCopiedMsgIndex] = useState<number | null>(null)

  async function fetchAiReply(text: string, snapshot: SitSnapshot, title?: string) {
    const res = await fetch("/api/mistral/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: aiConversationId, message: text, context: formatContext(snapshot), title }),
    })
    return res.json()
  }

  async function sendAiMessage(text: string, snapshot: SitSnapshot, title?: string, citation?: string) {
    if (!text.trim() || isAiSending) return
    setAiMessages((prev) => [...prev, { role: "user", content: text }])
    setIsAiSending(true)
    try {
      const data = await fetchAiReply(text, snapshot, title)
      if (data.success) {
        setAiConversationId(data.conversationId)
        setAiMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply, citation, forText: text, forSnapshot: snapshot, forTitle: title, forCitation: citation },
        ])
      } else {
        setAiMessages((prev) => [...prev, { role: "assistant", content: `Erreur : ${data.error}` }])
      }
    } finally {
      setIsAiSending(false)
    }
  }

  // Régénère une réponse assistant sans dupliquer la bulle "question" —
  // renvoie exactement la même question/instantané, remplace juste le
  // contenu de la bulle assistant existante.
  async function regenerate(index: number) {
    const msg = aiMessages[index]
    if (msg.role !== "assistant" || !msg.forText || !msg.forSnapshot || isAiSending) return
    setIsAiSending(true)
    try {
      const data = await fetchAiReply(msg.forText, msg.forSnapshot, msg.forTitle)
      setAiMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, content: data.success ? data.reply : `Erreur : ${data.error}` } : m)),
      )
    } finally {
      setIsAiSending(false)
    }
  }

  function resetConversation() {
    setAiConversationId(undefined)
    setAiMessages([])
  }

  async function copyMessage(index: number, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMsgIndex(index)
      setTimeout(() => setCopiedMsgIndex((cur) => (cur === index ? null : cur)), 1400)
    } catch {
      // Presse-papiers indisponible — pas grave, l'employé peut copier
      // le texte manuellement.
    }
  }

  // Pose une question au copilote à propos d'un texte réel du corpus —
  // seule situation où une citation est affichée (titre réel du document
  // cliqué), jamais fabriquée pour une question libre tapée à la main.
  function askAboutDocument(title: string) {
    void sendAiMessage(`Que dit ce texte : ${title} ?`, currentSnapshot(), undefined, title)
  }

  // Instantané courant, réutilisé par submitAiInput() et par les actions
  // "Copier" / "Ouvrir dans Archiaccess AI" (voir aside plus bas) — même
  // construction que celle déjà utilisée pour le contexte envoyé au
  // copilote, pour ne pas dupliquer la liste des champs à deux endroits.
  function currentSnapshot(): SitSnapshot {
    return {
      address: selectedAddress,
      parcels,
      risks,
      mutations,
      urbanZones,
      dpeRecords,
      companies,
      bodaccBySiren,
      cavites,
      pollutedSites,
      servitudes,
      publicMarkets,
      groundwaterStations,
      heatNetwork,
    }
  }

  async function submitAiInput(e: React.FormEvent) {
    e.preventDefault()
    const text = aiInput.trim()
    if (!text) return
    setAiInput("")
    await sendAiMessage(text, currentSnapshot())
  }

  const [copyFeedback, setCopyFeedback] = useState(false)
  async function copyFindings() {
    const summary = formatContext(currentSnapshot())
    if (!summary.trim()) return
    try {
      await navigator.clipboard.writeText(summary)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1600)
    } catch {
      // Presse-papiers indisponible (permissions navigateur) — rien de
      // grave, l'employé peut toujours utiliser "Ouvrir dans Archiaccess AI".
    }
  }

  async function loadBodacc(currentCompanies: Company[]): Promise<Record<string, BodaccAnnouncement[]>> {
    if (currentCompanies.length === 0) return {}
    const entries = await Promise.all(
      currentCompanies.map(async (c) => {
        const res = await fetch(`/api/sit/bodacc?siren=${c.siren}`).then((r) => r.json())
        return [c.siren, res.success ? (res.announcements as BodaccAnnouncement[]) : []] as const
      }),
    )
    return Object.fromEntries(entries)
  }

  async function search(e: React.FormEvent, prefill?: string) {
    e.preventDefault()
    const q = (prefill ?? query).trim()
    if (!q || isSearching) return
    setIsSearching(true)
    setError("")
    setSelectedAddress(null)
    setParcels(null)
    setRisks(null)
    setMutations(null)
    setUrbanZones(null)
    setDpeRecords(null)
    setBodaccBySiren({})
    setCavites(null)
    setPollutedSites(null)
    setServitudes(null)
    setPublicMarkets(null)
    setGroundwaterStations(null)
    setHeatNetwork(null)
    setResultsLoading(false)
    setAiConversationId(undefined)
    setAiMessages([])
    try {
      const res = await fetch(`/api/sit/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? "Recherche impossible.")
        setAddresses([])
        setCompanies([])
        return
      }
      const foundAddresses: AddressResult[] = data.addresses
      const foundCompanies: Company[] = data.companies
      setAddresses(foundAddresses)
      setCompanies(foundCompanies)

      if (foundAddresses.length === 0 && foundCompanies.length === 0) {
        setError("Aucun résultat pour cette recherche.")
        return
      }

      const bodacc = await loadBodacc(foundCompanies)
      setBodaccBySiren(bodacc)

      if (foundAddresses.length === 0 && foundCompanies.length > 0) {
        // Que des entreprises : rien à sélectionner, on peut résumer tout de suite.
        void sendAiMessage(
          "Fais un résumé synthétique des informations ci-dessus, pertinent pour une étude AMO/OPC (par exemple pour vérifier un partenaire de groupement). Sois concis (5-8 lignes maximum).",
          { companies: foundCompanies, bodaccBySiren: bodacc },
          `SIT · ${foundCompanies[0].nom}`,
        )
      }
    } finally {
      setIsSearching(false)
    }
  }

  async function selectAddress(addr: AddressResult) {
    setResultsLoading(true)
    setSelectedAddress(addr)
    setParcels(null)
    setRisks(null)
    setMutations(null)
    setUrbanZones(null)
    setDpeRecords(null)
    setCavites(null)
    setPollutedSites(null)
    setServitudes(null)
    setPublicMarkets(null)
    setGroundwaterStations(null)
    setHeatNetwork(null)

    const bundle = await fetchAddressBundle(addr)
    setParcels(bundle.parcels)
    setRisks(bundle.risks)
    setUrbanZones(bundle.urbanZones)
    setDpeRecords(bundle.dpeRecords)
    setCavites(bundle.cavites)
    setPollutedSites(bundle.pollutedSites)
    setServitudes(bundle.servitudes)
    setPublicMarkets(bundle.publicMarkets)
    setGroundwaterStations(bundle.groundwaterStations)
    setHeatNetwork(bundle.heatNetwork)
    setMutations(bundle.mutations)
    setResultsLoading(false)

    void sendAiMessage(
      "Fais un résumé synthétique des informations ci-dessus (adresse, cadastre, urbanisme, risques, DVF, DPE, cavités, sites pollués, servitudes, marchés publics, nappes phréatiques, réseau de chaleur), pertinent pour une étude technique AMO/OPC. Sois concis (5-8 lignes maximum), et signale si une donnée importante manque.",
      {
        address: addr,
        parcels: bundle.parcels,
        risks: bundle.risks,
        mutations: bundle.mutations,
        urbanZones: bundle.urbanZones,
        dpeRecords: bundle.dpeRecords,
        companies,
        bodaccBySiren,
        cavites: bundle.cavites,
        pollutedSites: bundle.pollutedSites,
        servitudes: bundle.servitudes,
        publicMarkets: bundle.publicMarkets,
        groundwaterStations: bundle.groundwaterStations,
        heatNetwork: bundle.heatNetwork,
      },
      `SIT · ${addr.label}`,
    )
  }

  // Recherche à l'échelle d'une commune ("Secteur") — résout le nom de
  // commune en code INSEE (BAN, type=municipality), puis interroge les
  // seuls connecteurs qui acceptent nativement ce code sans adresse
  // précise (voir SecteurResult plus haut : DVF exclu, expliqué dans le
  // panneau).
  async function searchSecteur(e: React.FormEvent, prefill?: string) {
    e.preventDefault()
    const q = (prefill ?? secteurQuery).trim()
    if (!q || isSecteurSearching) return
    setIsSecteurSearching(true)
    setSecteurError("")
    setSecteurResult(null)
    try {
      const res = await fetch(`/api/sit/commune?q=${encodeURIComponent(q)}`).then((r) => r.json())
      if (!res.success || res.communes.length === 0) {
        setSecteurError(res.error ?? "Aucune commune trouvée pour cette recherche.")
        return
      }
      const commune: CommuneResult = res.communes[0]
      const codeDepartement = departmentCodeFromCityCode(commune.citycode)
      const [risksRes, cavitesRes, sitesPolluesRes, nappesRes, boampRes] = await Promise.all([
        fetch(`/api/sit/risks?codeInsee=${commune.citycode}`).then((r) => r.json()),
        fetch(`/api/sit/cavites?codeInsee=${commune.citycode}`).then((r) => r.json()),
        fetch(`/api/sit/sites-pollues?codeInsee=${commune.citycode}`).then((r) => r.json()),
        fetch(`/api/sit/nappes?codeInsee=${commune.citycode}`).then((r) => r.json()),
        fetch(`/api/sit/boamp?codeDepartement=${codeDepartement}`).then((r) => r.json()),
      ])
      const result: SecteurResult = {
        commune,
        risks: risksRes.success ? risksRes.risks : null,
        cavites: cavitesRes.success ? { total: cavitesRes.total, cavites: cavitesRes.cavites } : null,
        pollutedSites: sitesPolluesRes.success
          ? { totalCasias: sitesPolluesRes.totalCasias, totalInstructions: sitesPolluesRes.totalInstructions, sites: sitesPolluesRes.sites }
          : null,
        groundwaterStations: nappesRes.success ? nappesRes.stations : [],
        publicMarkets: boampRes.success ? boampRes.markets : [],
      }
      setSecteurResult(result)
      void sendAiMessage(
        "Fais un résumé synthétique des informations ci-dessus à l'échelle de cette commune (risques, cavités, sites pollués, nappes phréatiques, marchés publics du département), pertinent pour une étude AMO/OPC. Sois concis (5-8 lignes maximum).",
        {
          risks: result.risks,
          cavites: result.cavites,
          pollutedSites: result.pollutedSites,
          groundwaterStations: result.groundwaterStations,
          publicMarkets: result.publicMarkets,
        },
        `SIT secteur · ${commune.city}`,
      )
    } finally {
      setIsSecteurSearching(false)
    }
  }

  // Recherche sur plusieurs adresses ("Lot") — même bundle par adresse que
  // "Point précis" (fetchAddressBundle), simplement répété pour chaque
  // ligne saisie. Plafonné à LOT_MAX pour rester dans le temps d'une
  // requête Lambda et ne pas multiplier les appels aux API publiques sans
  // limite.
  async function searchLot(e: React.FormEvent) {
    e.preventDefault()
    if (isLotSearching) return
    const queries = lotInput
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, LOT_MAX)
    if (queries.length === 0) return
    setIsLotSearching(true)
    setLotResults(null)
    try {
      const rows = await Promise.all(
        queries.map(async (q): Promise<LotRow> => {
          try {
            const res = await fetch(`/api/sit/search?q=${encodeURIComponent(q)}`).then((r) => r.json())
            const addr: AddressResult | undefined = res.success ? res.addresses[0] : undefined
            if (!addr) return { query: q, bundle: null, error: "Aucune adresse trouvée." }
            const bundle = await fetchAddressBundle(addr)
            return { query: q, bundle, error: null }
          } catch {
            return { query: q, bundle: null, error: "Recherche impossible." }
          }
        }),
      )
      setLotResults(rows)
    } finally {
      setIsLotSearching(false)
    }
  }

  const hasTiles = selectedAddress || companies.length > 0
  // Panneaux d'accueil masqués dès le lancement d'une recherche (pas
  // seulement une fois les résultats arrivés) — retour utilisateur du
  // 2026-09-02 : "les données de la recherche ne s'affichent pas dans
  // l'accueil, non ?".
  const showLanding = !hasTiles && !resultsLoading && addresses.length === 0 && companies.length === 0
  const recentStudies = vaultStats?.recentStudies ?? []

  // Questions suggérées : résolues contre les vrais titres indexés, pas
  // fabriquées — une question ne s'affiche que si un document réel existe.
  const suggestedQuestions = SUGGESTED_QUESTION_TEMPLATES.map((t) => {
    const dt = DOCUMENT_TAGS.find((d) => d.tag === t.tag)
    const title = dt ? vaultStats?.documentTitles.find((ti) => dt.keywords.some((k) => ti.toLowerCase().includes(k.toLowerCase()))) : undefined
    return title ? { tag: t.tag, question: t.question, title } : null
  }).filter((x): x is { tag: string; question: string; title: string } => x !== null)

  return (
    <main className="glass-scene flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      <div className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-sit.png" alt="Archiaccess SIT" width={40} height={40} />
            <h1 className="text-lg font-medium">Système d'Information Technique</h1>
          </div>
          {/* Bouton pilule en verre chromé, cohérent avec le reste de
              l'app — un lien texte simple détonnait à côté des boutons
              en verre utilisés partout ailleurs (retour utilisateur,
              jamais porté depuis l'artéfact). */}
          <Link
            href="/"
            className="liquid-glass-pill flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium"
          >
            <Home size={13} />
            Accueil
          </Link>
        </div>

        {/* 5 portes d'entrée vers le SIT — voir SEARCH_MODE_META. Point
            précis, Discipline, Secteur et Lot sont réellement câblés ;
            Carte reste un aperçu schématique honnête (voir FranceOutline) :
            jamais un bouton qui a l'air de marcher mais ne fait rien. */}
        {/* .liquid-glass-panel plutôt que .liquid-glass : retour utilisateur
            "toujours pareil" — cette barre ne s'affichait pas (DOM/CSS
            pourtant corrects, confirmé par inspection). Seuls deux
            endroits de la page utilisaient .liquid-glass (base, blur plus
            fort) au lieu de .liquid-glass-panel — tout le reste (ticker,
            statut, corpus, sources...) qui utilise .liquid-glass-panel
            s'affiche sans problème pour cet utilisateur. Probable
            incompatibilité backdrop-filter/GPU côté navigateur avec le
            blur plus intense de .liquid-glass — .liquid-glass-panel est
            visuellement très proche et déjà éprouvé sur cette page. */}
        {/* .liquid-glass-deep (relief renforcé, déjà dans le système,
            jusque-là jamais utilisé) plutôt que .liquid-glass-panel :
            retour utilisateur — la barre n'avait pas assez de présence
            visuelle pour être vue/utilisée sur son écran. Fond plus
            opaque, contour plus marqué, mêmes couleurs du système. */}
        <div className="liquid-glass liquid-glass-deep rounded-2xl">
          <div className="mode-tabs">
            {SEARCH_MODE_META.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSearchMode(m.id)}
                className={`mode-tab${searchMode === m.id ? " active" : ""}`}
              >
                <m.icon size={14} />
                {m.label}
              </button>
            ))}
          </div>

          {searchMode === "point" && (
            <div className="mode-panel">
              <p className="mode-desc">Une adresse, une entreprise ou un SIREN/SIRET précis.</p>
              <form onSubmit={search} className="mode-row box">
                <Search size={16} style={{ marginLeft: ".5rem", flexShrink: 0, color: "var(--muted-foreground)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Adresse, entreprise, SIREN/SIRET…"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="chrome-black shrink-0 rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
                  style={{ margin: ".25rem" }}
                >
                  {isSearching ? "…" : "Rechercher"}
                </button>
              </form>
            </div>
          )}

          {searchMode === "discipline" && (
            <div className="mode-panel">
              <p className="mode-desc">
                Partir d'un objectif d'étude plutôt que d'une adresse — chaque discipline demande l'échelle qui lui
                correspond.
              </p>
              <p className="mb-1.5 text-[0.66rem] font-medium uppercase tracking-wide text-muted-foreground/80">Données du SIT</p>
              <div className="disc-grid">
                {SOURCE_GROUPS.map((g, i) => (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => setDiscGroupIndex(i)}
                    className={`disc-card liquid-glass-soft rounded-2xl${discGroupIndex === i ? " active" : ""}`}
                  >
                    <div className="name">{g.label}</div>
                    <div className="hint">{g.desc}</div>
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  void search(e, discQuery)
                  setDiscQuery("")
                }}
                className="mode-row box"
              >
                <input
                  value={discQuery}
                  onChange={(e) => setDiscQuery(e.target.value)}
                  placeholder="Adresse ou parcelle…"
                  autoComplete="off"
                  style={{ marginLeft: ".375rem" }}
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="chrome-black shrink-0 rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
                  style={{ margin: ".25rem" }}
                >
                  Étudier {SOURCE_GROUPS[discGroupIndex].short}
                </button>
              </form>

              {/* Taxonomie des ~40 disciplines techniques Archiaccess — portée
                  ici depuis son ancien emplacement (panneau permanent à côté
                  de "Aperçu carte") pour rester contextuelle à l'onglet
                  Discipline plutôt que visible en permanence hors sujet
                  (retour de comparaison avec l'exploration de référence).
                  Contenu et logique inchangés (badges Corpus/Données
                  SIT/Connaissances générales calculés à l'affichage). */}
              <p className="mb-1.5 mt-4 text-[0.66rem] font-medium uppercase tracking-wide text-muted-foreground/80">
                Disciplines techniques Archiaccess
              </p>
              <p className="mode-desc">
                La plupart sont du savoir-faire d'ingénierie, pas des données interrogeables — chaque discipline
                indique honnêtement ce qui est réellement disponible.
              </p>
              <div className="taxo custom-scrollbar">
                {TAXONOMY.map((c, ci) => {
                  const open = openTaxoCats.includes(ci)
                  return (
                    <div key={c.cat} className={`taxo-cat${open ? " open" : ""}`}>
                      <button
                        type="button"
                        className="taxo-cat-btn"
                        onClick={() => setOpenTaxoCats((prev) => (prev.includes(ci) ? prev.filter((x) => x !== ci) : [...prev, ci]))}
                      >
                        <span>{c.cat}</span>
                        <ChevronRight size={12} className="taxo-chevron" />
                      </button>
                      <ul className="taxo-items">
                        {c.items.map((item) => {
                          const corpusTitle = item.corpusKeyword
                            ? vaultStats?.documentTitles.find((t) => t.toLowerCase().includes(item.corpusKeyword!.toLowerCase()))
                            : undefined
                          return (
                            <li
                              key={item.name}
                              onClick={() => {
                                if (corpusTitle) {
                                  askAboutDocument(corpusTitle)
                                } else if (item.group) {
                                  document.getElementById(`src-group-${item.group}`)?.scrollIntoView({ block: "center", behavior: "smooth" })
                                } else {
                                  void sendAiMessage(
                                    `Que peux-tu me dire sur "${item.name}" ?`,
                                    currentSnapshot(),
                                    undefined,
                                  )
                                }
                              }}
                            >
                              <span className="item-name">{item.name}</span>
                              {corpusTitle ? (
                                <span className="taxo-badge corpus">Corpus</span>
                              ) : item.group ? (
                                <span className="taxo-badge sit">Données SIT</span>
                              ) : (
                                <span className="taxo-badge general">Connaissances générales</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {searchMode === "carte" && (
            <div className="mode-panel">
              <p className="mode-desc">
                Sélectionner directement une zone sur la carte plutôt que taper une adresse — carte de France,
                cohérente avec les sources connectées (BAN, IGN, Géorisques, DVF…).
              </p>
              <div className="map-box">
                <FranceOutline />
              </div>
              <p className="mt-2 text-[0.68rem] text-muted-foreground/80">
                Aperçu schématique (contour approximatif) — l'intégration d'un vrai fond de carte (tuiles IGN) n'est
                pas encore construite.
              </p>
            </div>
          )}

          {searchMode === "secteur" && (
            <div className="mode-panel">
              <p className="mode-desc">
                Explorer une commune entière — pour les sources qui travaillent déjà à cette échelle (risques,
                cavités, sites pollués, nappes phréatiques, marchés publics du département), sans passer par une
                adresse précise.
              </p>
              <form onSubmit={searchSecteur} className="mode-row box">
                <input
                  value={secteurQuery}
                  onChange={(e) => setSecteurQuery(e.target.value)}
                  placeholder="Nom de commune…"
                  autoComplete="off"
                  style={{ marginLeft: ".5rem" }}
                />
                <button
                  type="submit"
                  disabled={isSecteurSearching}
                  className="chrome-black shrink-0 rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
                  style={{ margin: ".25rem" }}
                >
                  {isSecteurSearching ? "…" : "Étudier la commune"}
                </button>
              </form>
              {/* DVF exclu délibérément — pas d'endpoint par commune (voir
                  SecteurResult) : dit explicitement plutôt que passé sous
                  silence, pour ne pas laisser croire à une couverture qui
                  n'existe pas. */}
              <p className="mt-2 text-[0.68rem] text-muted-foreground/80">
                DVF n'est pas couvert ici — l'API n'a pas d'accès par commune entière (seulement par section
                cadastrale, une commune peut en compter plus d'une centaine), interroger toutes les sections
                dépasserait le temps d'une recherche. Reste disponible adresse par adresse via "Point précis".
              </p>
              {secteurError && <p className="mt-2 text-xs text-red-600">{secteurError}</p>}
            </div>
          )}

          {searchMode === "lot" && (
            <div className="mode-panel">
              <p className="mode-desc">
                Analyser plusieurs adresses ou parcelles à la fois — une étude porte rarement sur un seul site. Une
                adresse par ligne, {LOT_MAX} maximum.
              </p>
              <form onSubmit={searchLot} className="flex flex-col gap-2">
                <textarea
                  value={lotInput}
                  onChange={(e) => setLotInput(e.target.value)}
                  placeholder={"Une adresse par ligne…\nex : 51 rue de Vesle, Reims"}
                  rows={4}
                  autoComplete="off"
                  className="w-full resize-y rounded-xl border p-2.5 text-sm outline-none placeholder:text-muted-foreground"
                  style={{ borderColor: "color-mix(in oklch, var(--border) 100%, transparent 30%)" }}
                />
                <button
                  type="submit"
                  disabled={isLotSearching}
                  className="chrome-black shrink-0 self-end rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {isLotSearching ? "…" : "Étudier le lot"}
                </button>
              </form>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Bandeau d'activité — chrome persistant, avant et après recherche,
            pour que le SIT se ressente comme un système vivant plutôt que
            comme un formulaire (retour utilisateur du 2026-09-01). Fondu
            aux bords + séparateur "•" (retour du 2026-09-02 : coupe nette
            à mi-mot). Contenu inchangé : activité réelle du coffre — pas
            de réinterprétation "signaux externes" (nouveaux marchés BOAMP
            pertinents, alertes BODACC sur partenaires connus), qui
            demanderait une détection de nouveauté/pertinence côté
            backend non construite.
            overflow-visible (pas -hidden) sur CE conteneur : même bug que
            la barre de recherche (voir commit précédent) — un enfant
            direct d'un .liquid-glass-panel devient position:relative (règle
            partagée du verre liquide) et un Chromium avec overflow:hidden +
            isolation:isolate sur le parent ignore alors sa hauteur, qui
            retombe à padding seul. Le masquage horizontal réel du
            défilement (le survol qui doit rester coupé) est fait par le
            wrapper interne juste en dessous, qui garde overflow-hidden —
            diagnostiqué et vérifié en Chromium avant ce changement, voir
            conversation. */}
        <div className="liquid-glass-panel ticker-fade overflow-visible rounded-2xl px-4 py-2.5">
          {vaultStats && vaultStats.recentSearches.length > 0 ? (
            <div className="overflow-hidden">
              <div className="ticker-track flex w-max items-center gap-8 whitespace-nowrap">
                {[...vaultStats.recentSearches, ...vaultStats.recentSearches].map((s, i) => (
                  <span key={i} className="ticker-item flex shrink-0 items-center gap-1.5 text-xs">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                    <span className="font-medium text-foreground">{SOURCE_LABELS[s.source] ?? s.source}</span>
                    {/* Le contenu de la cacheKey n'est un texte humain lisible
                        que pour ban/entreprises (ce que l'employé a tapé) —
                        pour les autres connecteurs c'est un code technique
                        (INSEE, coordonnées, préfixe de section…) qui n'a rien
                        à faire sous les yeux de l'utilisateur final. */}
                    {(s.source === "ban" || s.source === "entreprises") && (
                      <span className="text-muted-foreground">{labelFromCacheKey(s.cacheKey)}</span>
                    )}
                    <span className="text-muted-foreground/60">· {timeAgo(s.fetchedAt)}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {vaultStats ? "Aucune activité pour l'instant — lancez une recherche pour commencer à alimenter le coffre." : "Chargement de l'activité du coffre…"}
            </p>
          )}
        </div>

        {/* overflow-visible : même bug/même correctif que le bandeau
            d'activité ci-dessus — sans clipping horizontal à préserver ici,
            rien d'autre à garder intact. */}
        <div className="liquid-glass-panel overflow-visible flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="status-dot" />
            <h2 className="text-xs font-medium text-muted-foreground">Système d'Information Technique Fédéré — actif</h2>
          </div>
          <span className="status-clock font-mono">{clock}</span>
        </div>

        {showLanding && (
          <div className="space-y-4">
            {recentStudies.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Reprendre une étude récente</p>
                <div className="flex flex-wrap gap-2">
                  {recentStudies.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setQuery(labelFromCacheKey(s.cacheKey))
                        void search({ preventDefault: () => {} } as React.FormEvent, labelFromCacheKey(s.cacheKey))
                      }}
                      className="resume-chip liquid-glass-soft rounded-2xl"
                    >
                      <span className="chip-dot" />
                      <span>{labelFromCacheKey(s.cacheKey)}</span>
                      <span className="chip-time">{timeAgo(s.fetchedAt)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="liquid-glass-panel rounded-2xl p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-medium text-muted-foreground">Corpus réglementaire</h2>
                </div>
                <div className="mb-2 flex items-center gap-2 border-b border-border/40 pb-2 text-muted-foreground">
                  <Search size={13} />
                  <input
                    value={docFilter}
                    onChange={(e) => {
                      setDocFilter(e.target.value)
                      if (e.target.value.trim()) setDocTagFilter(null)
                    }}
                    placeholder="Filtrer par discipline ou mot-clé…"
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  />
                </div>
                {(() => {
                  const titles = vaultStats?.documentTitles ?? []
                  const availableTags = DOCUMENT_TAGS.filter((dt) =>
                    titles.some((t) => dt.keywords.some((k) => t.toLowerCase().includes(k.toLowerCase()))),
                  )
                  return availableTags.length > 0 ? (
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDocTagFilter(null)}
                        className={`tag-chip${docTagFilter === null ? " active" : ""}`}
                        style={{ fontWeight: 600 }}
                      >
                        Tous
                      </button>
                      {availableTags.map((dt) => (
                        <button
                          key={dt.tag}
                          type="button"
                          onClick={() => {
                            setDocTagFilter(dt.tag)
                            setDocFilter("")
                          }}
                          className={`tag-chip${docTagFilter === dt.tag ? " active" : ""}`}
                        >
                          {dt.tag}
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
                {vaultStats && vaultStats.documentTitles.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun document indexé pour l'instant.</p>
                )}
                <ul className="custom-scrollbar max-h-72 divide-y divide-border/40 overflow-y-auto text-xs">
                  {(vaultStats?.documentTitles ?? [])
                    .filter((t) => {
                      if (docTagFilter) {
                        const dt = DOCUMENT_TAGS.find((d) => d.tag === docTagFilter)
                        return dt ? dt.keywords.some((k) => t.toLowerCase().includes(k.toLowerCase())) : true
                      }
                      return t.toLowerCase().includes(docFilter.trim().toLowerCase())
                    })
                    .map((title, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => askAboutDocument(title)}
                          className="-mx-1.5 flex w-full items-baseline gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-black/5"
                        >
                          <span className="shrink-0 font-mono text-muted-foreground/60">{String(i + 1).padStart(2, "0")}</span>
                          <span className="truncate text-foreground" title={title}>
                            {title}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
                <p className="coverage-note mt-2.5 border-t border-border/40 pt-2.5 text-[0.68rem] leading-relaxed text-muted-foreground">
                  Domaine public uniquement — Eurocodes, DTU et normes EN (structures, thermique, acoustique de salle…) sont
                  protégés AFNOR/CEN et non indexables ici ; le copilote s'appuie sur ses connaissances générales pour ces
                  sujets.
                </p>
              </div>

              <div className="liquid-glass-panel rounded-2xl p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-medium text-muted-foreground">Sources fédérées</h2>
                  <span className="font-mono text-xs text-muted-foreground">
                    {vaultStats?.sourceCounts.filter((s) => s.count > 0).length ?? 0}/{vaultStats?.sourceCounts.length ?? 14} actives
                  </span>
                </div>
                {!vaultStats && <p className="text-xs text-muted-foreground">Chargement…</p>}
                <div className="space-y-3 text-xs">
                  {SOURCE_GROUPS.map((g) => {
                    const counts = g.sources.map((src) => vaultStats?.sourceCounts.find((s) => s.source === src)?.count ?? 0)
                    const active = counts.filter((c) => c > 0).length
                    return (
                      <div key={g.label} id={`src-group-${g.label}`}>
                        <div className="mb-0.5 flex items-center justify-between text-[0.66rem] font-medium uppercase tracking-wide text-muted-foreground/80">
                          <span>{g.label}</span>
                          <span className="font-mono">
                            {active}/{g.sources.length}
                          </span>
                        </div>
                        <p className="mb-1 text-[0.68rem] text-muted-foreground/75">{g.desc}</p>
                        <ul className="divide-y divide-border/40">
                          {g.sources.map((src, i) => (
                            <li key={src} className="flex items-center justify-between gap-2 py-1.5">
                              <span className="flex items-center gap-2 truncate">
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${counts[i] > 0 ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                                />
                                <span className="truncate text-foreground">{SOURCE_LABELS[src] ?? src}</span>
                              </span>
                              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{counts[i]}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* La taxonomie des disciplines techniques vivait ici — déplacée
                dans l'onglet "Discipline" de la barre de recherche pour
                rester contextuelle plutôt que visible en permanence hors
                sujet (voir ce bloc dans SEARCH_MODE "discipline" ci-dessus). */}
            <div className="liquid-glass-panel rounded-2xl p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-medium text-muted-foreground">Aperçu carte</h2>
                <button type="button" onClick={() => setSearchMode("carte")} className="text-xs text-muted-foreground hover:underline">
                  Voir la carte →
                </button>
              </div>
              <button type="button" onClick={() => setSearchMode("carte")} className="map-box map-box-mini block w-full cursor-pointer">
                <FranceOutline />
              </button>
            </div>
          </div>
        )}

        {addresses.length > 0 && !selectedAddress && (
          <div className="liquid-glass-panel rounded-2xl p-4">
            <h2 className="mb-2 text-xs font-medium text-muted-foreground">Adresses trouvées — sélectionnez-en une</h2>
            <div className="space-y-2">
              {addresses.map((a) => (
                <button
                  key={`${a.citycode}-${a.label}`}
                  onClick={() => selectAddress(a)}
                  className="liquid-glass-soft block w-full rounded-xl p-3 text-left text-sm transition-shadow hover:shadow-md"
                >
                  <p className="font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.context}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {resultsLoading && (
          <div>
            {SOURCE_GROUPS.map((g) => (
              <div key={g.label} className="skel-group">
                <div className="skel-group-head" />
                <div className="skel-grid">
                  <div className="skel-tile">
                    <div className="skel-line w60" />
                    <div className="skel-line w90" />
                  </div>
                  <div className="skel-tile">
                    <div className="skel-line w60" />
                    <div className="skel-line w90" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasTiles && !resultsLoading && (
          <div>
            <ResultGroups
              groups={resultItems(currentSnapshot())}
              onItemClick={(it) => void sendAiMessage(`Peux-tu m'en dire plus sur "${it.source}" : ${it.body}`, currentSnapshot())}
            />
          </div>
        )}

        {secteurResult && (
          <div className="space-y-3">
            <div className="liquid-glass-panel rounded-2xl p-4">
              <h2 className="text-sm font-medium">{secteurResult.commune.city}</h2>
              <p className="text-xs text-muted-foreground">
                {secteurResult.commune.postcode}
                {secteurResult.commune.population ? ` · ${secteurResult.commune.population.toLocaleString("fr-FR")} habitants` : ""}
              </p>
            </div>
            {(() => {
              const snapshot: SitSnapshot = {
                risks: secteurResult.risks,
                cavites: secteurResult.cavites,
                pollutedSites: secteurResult.pollutedSites,
                groundwaterStations: secteurResult.groundwaterStations,
                publicMarkets: secteurResult.publicMarkets,
              }
              return (
                <ResultGroups
                  groups={resultItems(snapshot)}
                  onItemClick={(it) => void sendAiMessage(`Peux-tu m'en dire plus sur "${it.source}" (${secteurResult.commune.city}) : ${it.body}`, snapshot)}
                />
              )
            })()}
          </div>
        )}

        {lotResults && (
          <div className="space-y-4">
            {lotResults.map((row, i) => (
              <div key={i} className="liquid-glass-panel rounded-2xl p-4">
                {row.bundle ? (
                  <>
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-sm font-medium">{row.bundle.address.label}</h2>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchMode("point")
                          void selectAddress(row.bundle!.address)
                        }}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Ouvrir dans Point précis →
                      </button>
                    </div>
                    {(() => {
                      const bundle = row.bundle!
                      const snapshot: SitSnapshot = {
                        parcels: bundle.parcels,
                        risks: bundle.risks,
                        mutations: bundle.mutations,
                        urbanZones: bundle.urbanZones,
                        dpeRecords: bundle.dpeRecords,
                        cavites: bundle.cavites,
                        pollutedSites: bundle.pollutedSites,
                        servitudes: bundle.servitudes,
                        publicMarkets: bundle.publicMarkets,
                        groundwaterStations: bundle.groundwaterStations,
                        heatNetwork: bundle.heatNetwork,
                      }
                      return (
                        <ResultGroups
                          groups={resultItems(snapshot)}
                          onItemClick={(it) =>
                            void sendAiMessage(`Peux-tu m'en dire plus sur "${it.source}" (${bundle.address.label}) : ${it.body}`, snapshot)
                          }
                        />
                      )
                    })()}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{row.query}</span> — {row.error ?? "Aucun résultat."}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <DocumentUpload />
      </div>

      <aside
        className={
          aiCollapsed
            ? "liquid-glass-panel relative flex h-14 w-full shrink-0 flex-col overflow-hidden p-3 lg:h-screen lg:w-14"
            : "liquid-glass-panel relative flex h-[45vh] w-full shrink-0 flex-col p-4 lg:h-screen lg:w-[var(--ai-width)]"
        }
        style={!aiCollapsed ? ({ "--ai-width": `${aiWidth}px` } as React.CSSProperties) : undefined}
      >
        {/* Poignée de redimensionnement — bord gauche, desktop uniquement
            (retour : "rend le chat AI modulaire"). */}
        {!aiCollapsed && (
          <div
            onMouseDown={startAiResize}
            className="absolute -left-1.5 top-0 hidden h-full w-3 cursor-col-resize lg:block"
            title="Glisser pour redimensionner"
          />
        )}
        {aiCollapsed ? (
          <button
            type="button"
            onClick={() => setAiCollapsed(false)}
            className="flex h-full w-full items-center justify-center gap-2 text-muted-foreground lg:flex-col"
            title="Afficher le panneau Archiaccess AI"
          >
            <Sparkles size={16} />
            <span className="text-sm font-medium lg:hidden">Archiaccess AI</span>
          </button>
        ) : (
          <>
        {/* flex-wrap : sur téléphone, le titre + jusqu'à 4 boutons (Copier,
            Ouvrir dans AI, Nouvelle conversation, replier) ne tiennent pas
            sur une seule ligne — débordait du panneau plutôt que de passer
            à la ligne (mesuré en Chromium à 390px de large). */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Sparkles size={16} />
          <h2 className="text-sm font-medium">Archiaccess AI</h2>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            {hasTiles && (
              <>
                <button
                  type="button"
                  onClick={copyFindings}
                  className="liquid-glass-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground"
                  title="Copier ce qui a été trouvé, à coller dans n'importe quelle conversation Archiaccess AI"
                >
                  {copyFeedback ? <Check size={12} /> : <Copy size={12} />}
                  {copyFeedback ? "Copié" : "Copier"}
                </button>
                <Link
                  href={`/ai?prefill=${encodeURIComponent(formatContext(currentSnapshot()))}`}
                  className="liquid-glass-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground"
                  title="Ouvrir une conversation Archiaccess AI avec ces données déjà préremplies"
                >
                  <ExternalLink size={12} />
                  Ouvrir dans AI
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={resetConversation}
              disabled={aiMessages.length === 0}
              className="liquid-glass-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground disabled:opacity-40"
              title="Vider ce panneau et repartir de zéro"
            >
              <Plus size={12} />
              Nouvelle conversation
            </button>
            <button
              type="button"
              onClick={() => setAiCollapsed(true)}
              className="liquid-glass-btn rounded-lg p-1.5 text-muted-foreground"
              title="Replier le panneau"
            >
              <PanelRightClose size={14} />
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Résume automatiquement les données chargées et répond à vos questions dessus. Ce panneau se limite à cette
          recherche — utilisez « Copier » ou « Ouvrir dans AI » pour reprendre ces données dans une conversation
          Archiaccess AI complète.
        </p>
        <div className={`custom-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto ${aiMessages.length === 0 ? "justify-center" : ""}`}>
          {aiMessages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">Lancez une recherche pour obtenir un premier résumé.</p>
          )}
          {aiMessages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="text-right">
                <span className="chrome-black inline-block max-w-[90%] rounded-2xl px-3 py-2 text-xs text-white">{m.content}</span>
              </div>
            ) : (
              <div key={i} className="text-left">
                <span className="liquid-glass-soft relative inline-block max-w-[90%] rounded-2xl px-3 py-2 text-xs">
                  <span className="ai-msg-assistant" dangerouslySetInnerHTML={{ __html: formatReply(m.content) }} />
                  {m.citation && (
                    <span className="mt-1.5 flex items-center gap-1.5 border-t border-border/40 pt-1.5 text-[0.68rem] text-muted-foreground">
                      <span className="doc-tag">Corpus</span>
                      <span className="truncate">{m.citation}</span>
                    </span>
                  )}
                  <span className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => copyMessage(i, m.content)}
                      title="Copier la réponse"
                      className="rounded-md p-1 text-muted-foreground/70 hover:bg-black/5 hover:text-foreground"
                    >
                      {copiedMsgIndex === i ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                    {m.forText && (
                      <button
                        type="button"
                        onClick={() => regenerate(i)}
                        title="Régénérer la réponse"
                        disabled={isAiSending}
                        className="rounded-md p-1 text-muted-foreground/70 hover:bg-black/5 hover:text-foreground disabled:opacity-40"
                      >
                        <RefreshCw size={11} />
                      </button>
                    )}
                  </span>
                </span>
              </div>
            ),
          )}
          {isAiSending && (
            <div className="text-left">
              <span className="liquid-glass-soft inline-flex items-center gap-1 rounded-2xl px-3 py-2.5">
                <span className="think-dot" />
                <span className="think-dot" />
                <span className="think-dot" />
              </span>
            </div>
          )}
        </div>
        {suggestedQuestions.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Questions suggérées, à partir du corpus</p>
            <div className="flex flex-col gap-1.5">
              {suggestedQuestions.map((s) => (
                <button
                  key={s.tag}
                  type="button"
                  onClick={() => sendAiMessage(s.question, currentSnapshot(), undefined, s.title)}
                  className="liquid-glass-soft flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs"
                >
                  <span className="doc-tag">{s.tag}</span>
                  <span>{s.question}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={submitAiInput} className="mt-3 flex gap-2">
          <input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Une question sur ces données…"
            className="liquid-glass-inset flex-1 rounded-xl px-3 py-2 text-xs outline-none"
          />
          <button
            type="submit"
            disabled={isAiSending}
            className="chrome-black shrink-0 rounded-xl px-3 py-2 text-white disabled:opacity-50"
            aria-label="Envoyer"
          >
            <Send size={14} />
          </button>
        </form>
          </>
        )}
      </aside>
    </main>
  )
}


// Contour schématique de la France — pas un vrai fond de carte (aucune
// tuile IGN chargée), voir la note affichée à côté dans l'onglet Carte.
// Contour schématique de la France métropolitaine ("l'Hexagone") — l'ancien
// tracé était un polygone arbitraire sans rapport avec la vraie forme
// (retour utilisateur : "ce n'est pas la France"). Simplifié à une
// vingtaine de points repérables (pointe bretonne à l'ouest, presqu'île du
// Cotentin au nord-ouest, bulge alsacien au nord-est, arc méditerranéen et
// pyrénéen au sud) — reste un aperçu schématique, pas un tracé
// cartographique précis (voir le texte "contour approximatif" affiché
// sous la carte).
function FranceOutline() {
  return (
    <svg className="map-france" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <path d="M48 6 L58 10 L68 18 L66 30 L72 40 L68 50 L66 62 L55 68 L45 66 L38 62 L28 58 L22 66 L18 76 L14 66 L10 56 L8 46 L4 42 L10 36 L14 30 L10 24 L16 20 L24 14 L36 8 Z" />
    </svg>
  )
}

function DocumentUpload() {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim() || isSaving) return
    setIsSaving(true)
    setFeedback("")
    try {
      const res = await fetch("/api/sit/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceType: "etude", content }),
      })
      const data = await res.json()
      if (data.success) {
        setFeedback("Étude indexée — le copilote Archiaccess AI peut s'en servir de contexte.")
        setTitle("")
        setContent("")
      } else {
        setFeedback(`Erreur : ${data.error}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="liquid-glass-panel rounded-3xl p-6">
      <h2 className="mb-1 text-sm font-medium text-muted-foreground">Ajouter une étude (Markdown)</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Indexée pour que le copilote Archiaccess AI puisse s'en servir comme contexte (recherche par similarité, pgvector).
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de l'étude"
          className="liquid-glass-inset rounded-xl px-3 py-2 text-sm outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Contenu en Markdown…"
          rows={6}
          className="liquid-glass-inset custom-scrollbar rounded-xl px-3 py-2 text-sm outline-none"
        />
        <div className="flex items-center justify-between">
          {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="chrome-black ml-auto rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isSaving ? "Indexation…" : "Ajouter au SIT"}
          </button>
        </div>
      </form>
    </div>
  )
}
