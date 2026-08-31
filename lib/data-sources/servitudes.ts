// Client pour l'API GPU (Géoportail de l'Urbanisme, IGN) — servitudes
// d'utilité publique (SUP) qui s'appliquent à une parcelle (périmètres de
// monuments historiques, réseaux, captages d'eau...). Pas de clé requise.
// Même stratégie que l'urbanisme (lib/data-sources/urbanisme.ts) : un
// point suffit ici (l'API GPU accepte un Point directement pour cette
// couche, contrairement à zone-urba qui a besoin d'une petite emprise —
// vérifié en direct avant d'écrire ce code, voir CLAUDE.md).

import { withVault } from "@/lib/data-vault"

const GPU_URL = "https://apicarto.ign.fr/api/gpu/assiette-sup-s"

export interface Servitude {
  type: string // ex: "AC4" (code de la catégorie de servitude)
  label: string // ex: "Site patrimonial remarquable d'Epernay"
  natureAssiette: string | null // ex: "Périmètre du SPR"
  document: string | null
}

interface GpuFeature {
  properties: {
    suptype: string
    nomsuplitt: string | null
    typeass: string | null
    fichier: string | null
  }
}

interface GpuResponse {
  features: GpuFeature[]
}

export async function getServitudesNear(lon: number, lat: number): Promise<Servitude[]> {
  const key = `${lon.toFixed(5)},${lat.toFixed(5)}`
  return withVault("servitudes", key, () => fetchServitudesLive(lon, lat))
}

async function fetchServitudesLive(lon: number, lat: number): Promise<Servitude[]> {
  const res = await fetch(GPU_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geom: { type: "Point", coordinates: [lon, lat] } }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    throw new Error(`API GPU (servitudes) a répondu ${res.status}`)
  }

  const data = (await res.json()) as GpuResponse
  return data.features.map((f) => ({
    type: f.properties.suptype,
    label: f.properties.nomsuplitt ?? f.properties.suptype,
    natureAssiette: f.properties.typeass,
    document: f.properties.fichier,
  }))
}
