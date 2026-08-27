import Link from "next/link"
import { AuthGate } from "@/components/auth-gate"

// Accueil : deux destinations distinctes pour les employés, pas un écran
// fusionné — voir CLAUDE.md, le SIT et Archiaccess AI doivent rester
// séparés à l'usage même s'ils partagent la même base de données.
export default function Page() {
  return (
    <AuthGate>
      <main className="glass-scene flex min-h-screen items-center justify-center p-4">
        <div className="liquid-glass w-full max-w-2xl rounded-3xl p-8">
          <h1 className="mb-6 text-xl font-medium">Archiaccess</h1>
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <Link href="/sit" className="liquid-glass-panel block rounded-2xl p-6 transition-shadow hover:shadow-lg">
              <h2 className="font-medium">Système d'Information Technique</h2>
              <p className="mt-1 text-sm text-muted-foreground">Études, documents, données foncières/financières/réglementaires.</p>
            </Link>
            <Link href="/ai" className="liquid-glass-panel block rounded-2xl p-6 transition-shadow hover:shadow-lg">
              <h2 className="font-medium">Archiaccess AI</h2>
              <p className="mt-1 text-sm text-muted-foreground">Copilote conversationnel pour vos études AMO/OPC.</p>
            </Link>
          </div>
        </div>
      </main>
    </AuthGate>
  )
}
