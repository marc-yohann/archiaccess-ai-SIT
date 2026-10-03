// Données fixes et utilitaires purs de la page de recherche (audit du
// 2026-10-03) : libellés et groupes des sources fédérées, taxonomie des
// disciplines, étiquettes du corpus, questions suggérées. Sortis de
// page.tsx pour l'alléger ; aucun état, aucune dépendance serveur.

export const SOURCE_LABELS: Record<string, string> = {
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
export const SOURCE_GROUPS: { label: string; short: string; desc: string; sources: string[] }[] = [
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
export interface TaxonomyItem {
  name: string
  corpusKeyword?: string
  group?: string
}
export interface TaxonomyCategory {
  cat: string
  items: TaxonomyItem[]
}
export const TAXONOMY: TaxonomyCategory[] = [
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

// Étiquettes de discipline associées à des mots-clés — jamais un id de
// document codé en dur, vérifiées à l'affichage contre les vrais titres
// indexés (vaultStats.documentTitles). Servent aux questions suggérées.
// Questions suggérées du panneau Archiaccess AI — mêmes 3 disciplines que
// l'artéfact, mais jamais liées à un id de document en dur : résolues à
// l'affichage contre les vrais titres indexés (voir suggestedQuestions()
// plus bas). N'apparaît que si un document réel correspond.
export const SUGGESTED_QUESTION_TEMPLATES: { tag: string; question: string }[] = [
  { tag: "Accessibilité", question: "Quelles sont les obligations PMR pour un ERP neuf ?" },
  { tag: "Contrats", question: "Quels sont les délais de recours après réception (CCAG-Travaux) ?" },
  { tag: "Marchés publics", question: "À partir de quel seuil faut-il une procédure formalisée ?" },
]

export const DOCUMENT_TAGS: { tag: string; keywords: string[] }[] = [
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

export function labelFromCacheKey(key: string): string {
  const raw = key.replace(/^q:/, "")
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  return `il y a ${days} j`
}
