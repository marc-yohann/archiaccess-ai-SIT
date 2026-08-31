"use client"

import Link from "next/link"
import Image from "next/image"
import { AuthGate, useUser } from "@/components/auth-gate"

// Accueil : deux destinations distinctes pour les employés, pas un écran
// fusionné — voir CLAUDE.md, le SIT et Archiaccess AI doivent rester
// séparés à l'usage même s'ils partagent la même base de données.
export default function Page() {
  return (
    <AuthGate logoSrc="/logo-ai.png" appName="Archiaccess">
      <Home />
    </AuthGate>
  )
}

function Home() {
  const user = useUser()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.reload()
  }

  return (
    <main className="glass-scene flex min-h-screen items-center justify-center p-4">
      <div className="liquid-glass w-full max-w-2xl rounded-3xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-ai.png" alt="Archiaccess" width={48} height={48} />
            <h1 className="text-xl font-medium">Archiaccess</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{user.name}</span>
            {user.isAdmin && (
              <Link href="/admin" className="hover:underline">
                Administration
              </Link>
            )}
            <button onClick={logout} className="hover:underline">
              Déconnexion
            </button>
          </div>
        </div>
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
  )
}
