import { NextRequest, NextResponse } from "next/server"

// sit.archiaccess.com et ai.archiaccess.com pointent vers la même Lambda.
// Sur sit., seule la racine "/" est réécrite vers le tableau de bord ;
// tous les autres chemins passent tels quels. ai. est désormais redirigé
// en entier vers sit. (voir plus bas).
//
// CloudFront transmet la requête à la Function URL Lambda via la policy
// managée "AllViewerExceptHostHeader" : elle NE transmet PAS le header Host
// du visiteur (indispensable, sinon la Function URL renvoie 403 — elle route
// en interne par son propre nom d'hôte). Donc `host` ici vaut toujours le
// domaine de la Lambda, jamais sit./ai.archiaccess.com. Une CloudFront
// Function (viewer-request, voir infra) recopie le Host d'origine dans
// `x-app-host` avant que la origin request policy ne l'écrase — c'est ce
// header qu'on lit.
export function proxy(request: NextRequest) {
  const host = request.headers.get("x-app-host") ?? request.headers.get("host") ?? ""

  // Archiaccess AI a rejoint le SIT (décision du 2026-09-29) : un seul
  // outil, une seule adresse. ai.archiaccess.com redirige tout vers
  // sit.archiaccess.com (la racine vers l'onglet Archiaccess AI), pour que
  // les anciens liens et favoris fonctionnent et qu'il n'y ait qu'une
  // connexion (le cookie de session n'est pas partagé entre sous-domaines).
  if (host.startsWith("ai.")) {
    const { pathname, search } = request.nextUrl
    const cible = `https://${host.replace(/^ai\./, "sit.")}${pathname === "/" ? "/ai" : pathname}${search}`
    return NextResponse.redirect(cible, 308)
  }

  if (host.startsWith("sit.") && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/sit", request.url))
  }

  return NextResponse.next()
}

// Toutes les routes sauf les fichiers statiques de Next (servis par S3 via
// CloudFront en production) : la redirection d'ai.archiaccess.com doit
// couvrir chaque chemin, pas seulement la racine.
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}
