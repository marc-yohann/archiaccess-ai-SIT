// Client pour l'API ADEME — DPE (Diagnostics de Performance Énergétique)
// des logements existants. Pas de clé requise. Recherche par emprise
// géographique (bbox autour d'un point, comme le cadastre) plutôt que par
// code postal seul — un code postal peut couvrir des dizaines de milliers
// de DPE, une bbox resserrée autour de l'adresse ramène les diagnostics
// du bâtiment concerné et de ses voisins immédiats. Validé par appel réel
// avant d'écrire ce code (voir CLAUDE.md).

const BASE_URL = "https://data.ademe.fr/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe/lines"

export interface DpeRecord {
  numeroDpe: string
  adresse: string
  etiquetteEnergie: string | null
  etiquetteGes: string | null
  typeBatiment: string | null
  surfaceHabitable: number | null
  dateEtablissement: string | null
}

interface RawDpe {
  numero_dpe: string
  adresse_ban: string
  etiquette_dpe: string | null
  etiquette_ges: string | null
  type_batiment: string | null
  surface_habitable_logement: number | null
  date_etablissement_dpe: string | null
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
  const [minLon, minLat, maxLon, maxLat] = bboxAround(lon, lat, bufferMeters)
  const url = new URL(BASE_URL)
  url.searchParams.set("size", String(limit))
  url.searchParams.set("bbox", `${minLon},${minLat},${maxLon},${maxLat}`)
  url.searchParams.set(
    "select",
    "numero_dpe,adresse_ban,etiquette_dpe,etiquette_ges,type_batiment,surface_habitable_logement,date_etablissement_dpe",
  )

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    throw new Error(`API ADEME (DPE) a répondu ${res.status}`)
  }

  const data = (await res.json()) as DpeResponse
  return data.results.map((r) => ({
    numeroDpe: r.numero_dpe,
    adresse: r.adresse_ban,
    etiquetteEnergie: r.etiquette_dpe,
    etiquetteGes: r.etiquette_ges,
    typeBatiment: r.type_batiment,
    surfaceHabitable: r.surface_habitable_logement,
    dateEtablissement: r.date_etablissement_dpe,
  }))
}
