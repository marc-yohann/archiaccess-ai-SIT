"use client"

import { useEffect, useState } from "react"

// Partagé par les trois écrans (accueil, SIT, Archiaccess AI) — évite de
// dupliquer la vérification de session et le formulaire de connexion dans
// chacun. Les deux écrans restent des routes séparées (voir app/sit et
// app/ai) : ce composant ne fait que les protéger, il ne les fusionne pas.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me", { signal: AbortSignal.timeout(10000) })
      .then((res) => res.json())
      .then((data) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false))
      .finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    )
  }

  return authenticated ? <>{children}</> : <LoginForm onSuccess={() => setAuthenticated(true)} />
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? "Connexion impossible.")
        return
      }
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 rounded-xl border p-8">
        <h1 className="text-lg font-medium">Archiaccess</h1>
        <p className="text-sm text-muted-foreground">Mot de passe d'équipe AEO</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          autoFocus
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Se connecter
        </button>
      </form>
    </main>
  )
}
