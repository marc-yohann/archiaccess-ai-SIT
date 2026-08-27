import Link from "next/link"
import { AuthGate } from "@/components/auth-gate"

// Accueil : deux destinations distinctes pour les employés, pas un écran
// fusionné — voir CLAUDE.md, le SIT et Archiaccess AI doivent rester
// séparés à l'usage même s'ils partagent la même base de données.
export default function Page() {
  return (
    <AuthGate>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-4">
        <h1 className="text-lg font-medium">Archiaccess</h1>
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Link href="/sit" className="rounded-xl border p-6 hover:bg-gray-50">
            <h2 className="font-medium">Système d'Information Technique</h2>
            <p className="mt-1 text-sm text-muted-foreground">Études, documents, données foncières/financières/réglementaires.</p>
          </Link>
          <Link href="/ai" className="rounded-xl border p-6 hover:bg-gray-50">
            <h2 className="font-medium">Archiaccess AI</h2>
            <p className="mt-1 text-sm text-muted-foreground">Copilote conversationnel pour vos études AMO/OPC.</p>
          </Link>
        </div>
      </main>
    </AuthGate>
  )
}
