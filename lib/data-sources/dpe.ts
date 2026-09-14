// Client pour l'API ADEME — DPE (Diagnostics de Performance Énergétique)
// des logements existants. Pas de clé requise. Recherche par emprise
// géographique (bbox autour d'un point, comme le cadastre) plutôt que par
// code postal seul — un code postal peut couvrir des dizaines de milliers
// de DPE, une bbox resserrée autour de l'adresse ramène les diagnostics
// du bâtiment concerné et de ses voisins immédiats. Validé par appel réel
// avant d'écrire ce code (voir CLAUDE.md).
//
// Champs étendus Phase 5B (voir le rapport) — vérifiés réels par appel
// direct à l'API, jamais supposés :
// - identifiant_ban : même format que la colonne "id" du fichier BAN bulk
//   (lib/ingestion/sources/ban.ts) — PAS un identifiant fiable à 100 % en
//   l'état : statut_geocodage="non géocodée" ne signifie PAS que
//   l'identifiant est invalide (mesuré réellement : ~95 % des DPE
//   "non géocodés" ont pourtant un identifiant_ban correspondant à une
//   entrée BAN réelle et actuelle) — statut_geocodage s'est révélé peu
//   fiable comme indicateur de confiance ; la seule vérification fiable
//   est de confronter identifiant_ban au référentiel BAN réel lui-même.
// - annee_construction : EXISTE réellement dans la source (confirmé sur
//   342/422 DPE réels inspectés, ~81 %) — un commentaire précédent de ce
//   projet affirmant le contraire était obsolète/erroné.
// - numero_etage_appartement : souvent 0 par défaut (pas toujours une
//   vraie donnée d'étage) — jamais présenté comme un identifiant de
//   logement fiable (voir le rapport, cas des grands ensembles où
//   plusieurs dizaines de DPE réels partagent etage=0 et des surfaces
//   identiques par pur hasard de plan-type).

import { withVault } from "@/lib/data-vault"

const BASE_URL = "https://data.ademe.fr/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe/lines"

export interface DpeRecord {
  numeroDpe: string
  adresse: string
  etiquetteEnergie: string | null
  etiquetteGes: string | null
  typeBatiment: string | null
  surfaceHabitable: number | null
  dateEtablissement: string | null
  // Champs étendus Phase 5B — voir l'en-tête de ce fichier et le rapport
  // pour les limites réellement constatées de chacun.
  identifiantBan: string | null
  statutGeocodage: string | null
  codeInseeBan: string | null
  anneeConstruction: number | null
  numeroEtageAppartement: number | null
  longitude: number | null
  latitude: number | null
}

interface RawDpe {
  numero_dpe: string
  adresse_ban: string
  etiquette_dpe: string | null
  etiquette_ges: string | null
  type_batiment: string | null
  surface_habitable_logement: number | null
  date_etablissement_dpe: string | null
  identifiant_ban: string | null
  statut_geocodage: string | null
  code_insee_ban: string | null
  annee_construction: number | null
  numero_etage_appartement: number | null
  _geopoint: string | null
}

interface DpeResponse {
  results: RawDpe[]
}

function bboxAround(lon: number, lat: number, bufferMeters: number): [number, number, number, number] {
  const dLat = bufferMeters / 111_320
  const dLon = bufferMeters / (111_320 * Math.cos((lat * Math.PI) / 180))
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}

export async function getDpeRecordsNear(lon: number, lat: number, bufferMeters = 60, limit = 10): Promise<DpeRecord[]> {
  const key = `${lon.toFixed(5)},${lat.toFixed(5)},${bufferMeters},${limit}`
  return withVault("dpe", key, () => fetchDpeRecordsLive(lon, lat, bufferMeters, limit))
}

async function fetchDpeRecordsLive(lon: number, lat: number, bufferMeters: number, limit: number): Promise<DpeRecord[]> {
  const [minLon, minLat, maxLon, maxLat] = bboxAround(lon, lat, bufferMeters)
  const url = new URL(BASE_URL)
  url.searchParams.set("size", String(limit))
  url.searchParams.set("bbox", `${minLon},${minLat},${maxLon},${maxLat}`)
  url.searchParams.set(
    "select",
    "numero_dpe,adresse_ban,etiquette_dpe,etiquette_ges,type_batiment,surface_habitable_logement,date_etablissement_dpe,identifiant_ban,statut_geocodage,code_insee_ban,annee_construction,numero_etage_appartement,_geopoint",
  )

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API ADEME (DPE) a répondu ${res.status}`)
  }

  const data = (await res.json()) as DpeResponse
  return data.results.map((r) => {
    // _geopoint réel = "lat,lon" (jamais "lon,lat") — vérifié réellement,
    // voir le rapport Phase 5B.
    const [lat, lon] = r._geopoint ? r._geopoint.split(",").map(Number) : [null, null]
    return {
      numeroDpe: r.numero_dpe,
      adresse: r.adresse_ban,
      etiquetteEnergie: r.etiquette_dpe,
      etiquetteGes: r.etiquette_ges,
      typeBatiment: r.type_batiment,
      surfaceHabitable: r.surface_habitable_logement,
      dateEtablissement: r.date_etablissement_dpe,
      identifiantBan: r.identifiant_ban,
      statutGeocodage: r.statut_geocodage,
      codeInseeBan: r.code_insee_ban,
      anneeConstruction: r.annee_construction,
      numeroEtageAppartement: r.numero_etage_appartement,
      longitude: lon !== null && Number.isFinite(lon) ? lon : null,
      latitude: lat !== null && Number.isFinite(lat) ? lat : null,
    }
  })
}
