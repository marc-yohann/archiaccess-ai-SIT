// Liste officielle réelle des départements (geo.api.gouv.fr, vérifiée en
// direct : 101 départements — métropole + Corse 2A/2B + 5 DOM
// 971/972/973/974/976) — partagée entre les runners partitionnés par
// département (BAN, Cadastre) pour ne pas dupliquer cet appel/cache.

let departementsCache: string[] | null = null

export async function getDepartementsSorted(): Promise<string[]> {
  if (departementsCache) return departementsCache
  const res = await fetch("https://geo.api.gouv.fr/departements?fields=code&format=json", { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`API départements (geo.api.gouv.fr) a répondu ${res.status}`)
  const data = (await res.json()) as Array<{ code: string }>
  departementsCache = data.map((d) => d.code).sort()
  return departementsCache
}
