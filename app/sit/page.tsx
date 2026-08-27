import Link from "next/link"
import { AuthGate } from "@/components/auth-gate"

// Placeholder — le hub de données (études foncières/financières/
// réglementaires, documents indexés via pgvector) n'est pas encore
// construit. Voir CLAUDE.md, section "Prochaines étapes", point 3.
export default function SitPage() {
  return (
    <AuthGate>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-medium">Système d'Information Technique</h1>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Accueil
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          Pas encore construit — hub de données (foncier, financier, réglementaire) et études en cours arriveront ici.
        </p>
      </main>
    </AuthGate>
  )
}
