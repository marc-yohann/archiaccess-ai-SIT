"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AuthGate, useUser } from "@/components/auth-gate"

interface AdminUser {
  id: string
  email: string
  name: string
  isAdmin: boolean
  active: boolean
  mustChangePassword: boolean
  createdAt: string
}

export default function AdminPage() {
  return (
    <AuthGate logoSrc="/logo-ai.png" appName="Archiaccess">
      <AdminGuard />
    </AuthGate>
  )
}

function AdminGuard() {
  const user = useUser()
  if (!user.isAdmin) {
    return (
      <main className="glass-scene flex min-h-screen items-center justify-center p-4">
        <div className="liquid-glass w-full max-w-md rounded-3xl p-8 text-center">
          <p className="text-sm">Réservé aux administrateurs.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-muted-foreground hover:underline">
            Retour à l'accueil
          </Link>
        </div>
      </main>
    )
  }
  return <AdminPanel />
}

function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [createdInfo, setCreatedInfo] = useState<{ email: string; tempPassword: string } | null>(null)

  function loadUsers() {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUsers(data.users)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, isAdmin }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? "Création impossible.")
        return
      }
      setCreatedInfo({ email: data.user.email, tempPassword: data.tempPassword })
      setEmail("")
      setName("")
      setIsAdmin(false)
      loadUsers()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleActive(u: AdminUser) {
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    })
    loadUsers()
  }

  return (
    <main className="glass-scene flex min-h-screen justify-center p-4">
      <div className="flex w-full max-w-3xl flex-col gap-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Administration — comptes employés</h1>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Accueil
          </Link>
        </div>

        <div className="liquid-glass rounded-3xl p-6">
          <h2 className="mb-3 font-medium">Créer un compte</h2>
          <form onSubmit={createUser} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Nom</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
                required
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
              Admin
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="chrome-black rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Créer
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          {createdInfo && (
            <div className="liquid-glass-soft mt-3 rounded-xl p-3 text-sm">
              <p>
                Compte créé pour <strong>{createdInfo.email}</strong>. Mot de passe temporaire (à transmettre à
                l'employé, il devra le changer à sa première connexion) :
              </p>
              <p className="mt-1 font-mono text-base">{createdInfo.tempPassword}</p>
            </div>
          )}
        </div>

        <div className="liquid-glass rounded-3xl p-6">
          <h2 className="mb-3 font-medium">Comptes existants</h2>
          <div className="flex flex-col divide-y divide-black/10">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {u.name} {u.isAdmin && <span className="text-xs text-muted-foreground">(admin)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {u.mustChangePassword && (
                    <span className="text-xs text-muted-foreground">1ère connexion en attente</span>
                  )}
                  <span className={`text-xs ${u.active ? "text-green-700" : "text-red-600"}`}>
                    {u.active ? "Actif" : "Désactivé"}
                  </span>
                  <button onClick={() => toggleActive(u)} className="liquid-glass-soft rounded-lg px-3 py-1 text-xs">
                    {u.active ? "Désactiver" : "Réactiver"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
