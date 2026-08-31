import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { searchAddress } from "@/lib/data-sources/ban"
import { searchCompanies, looksLikeSirenOrSiret } from "@/lib/data-sources/entreprises"

// Recherche universelle du SIT : pas seulement une adresse — voir
// CLAUDE.md, décision utilisateur "je veux pas que ce soit l'adresse
// seulement, n'importe quelle information". Un SIREN/SIRET (détecté par
// motif) ne cherche que des entreprises ; sinon on tente adresse ET
// entreprise en parallèle, chacune peut échouer indépendamment sans faire
// échouer l'autre (Promise.allSettled) — une recherche de nom
// d'entreprise n'a par ex. aucune raison de matcher une adresse.
export async function GET(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const query = new URL(request.url).searchParams.get("q")?.trim()
  if (!query) {
    return NextResponse.json({ success: false, error: "Paramètre q manquant." }, { status: 400 })
  }

  if (looksLikeSirenOrSiret(query)) {
    try {
      const companies = await searchCompanies(query)
      return NextResponse.json({ success: true, addresses: [], companies })
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : "Erreur inconnue." },
        { status: 502 },
      )
    }
  }

  const [addressResult, companyResult] = await Promise.allSettled([searchAddress(query), searchCompanies(query)])

  const addresses = addressResult.status === "fulfilled" ? addressResult.value : []
  const companies = companyResult.status === "fulfilled" ? companyResult.value : []

  if (addressResult.status === "rejected" && companyResult.status === "rejected") {
    return NextResponse.json({ success: false, error: "Recherche impossible (adresse et entreprise)." }, { status: 502 })
  }

  return NextResponse.json({ success: true, addresses, companies })
}
