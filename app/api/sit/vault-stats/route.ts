// Statistiques du coffre — affichées sur /sit avant toute recherche, pour
// que la page ne soit pas vide à l'arrivée (retour utilisateur : "le
// tableau de bord est un peu pauvre"). Montre l'activité réellement
// accumulée (recherches récentes dans DataCacheEntry, taille du coffre
// RAG) plutôt qu'un contenu statique — voir CLAUDE.md, "second brain".

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"

export interface RecentSearch {
  source: string
  cacheKey: string
  fetchedAt: string
}

export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  try {
    const prisma = await getPrisma()
    const [totalCacheEntries, totalDocuments, recentEntries] = await Promise.all([
      prisma.dataCacheEntry.count(),
      prisma.document.count(),
      prisma.dataCacheEntry.findMany({
        orderBy: { fetchedAt: "desc" },
        take: 8,
        select: { source: true, cacheKey: true, fetchedAt: true },
      }),
    ])

    const recentSearches: RecentSearch[] = recentEntries.map((e) => ({
      source: e.source,
      cacheKey: e.cacheKey,
      fetchedAt: e.fetchedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      totalCacheEntries,
      totalDocuments,
      recentSearches,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 502 },
    )
  }
}
