"use client"

import { Suspense } from "react"
import { AuthGate } from "@/components/auth-gate"
import { VueProjet } from "@/components/projet/vue-projet"

// Espace collaboratif — un projet d'équipe (voir components/projet/vue-projet.tsx).
export default function ProjetEquipePage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      {/* useSearchParams (?etape=) exige un ancêtre Suspense au build. */}
      <Suspense fallback={null}>
        <VueProjet espace="collaboratif" />
      </Suspense>
    </AuthGate>
  )
}
