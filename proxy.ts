import { NextRequest, NextResponse } from "next/server"

// sit.archiaccess.com et ai.archiaccess.com pointent vers la même Lambda —
// sans ça, la racine "/" des deux sous-domaines affichait l'accueil
// générique (titre "Archiaccess AI") au lieu de l'app dédiée au
// sous-domaine visité. On ne réécrit que "/" : les autres chemins
// (/sit, /ai, /api/...) restent inchangés sur les deux domaines.
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

  if (host.startsWith("sit.")) {
    return NextResponse.rewrite(new URL("/sit", request.url))
  }
  if (host.startsWith("ai.")) {
    return NextResponse.rewrite(new URL("/ai", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/",
}
