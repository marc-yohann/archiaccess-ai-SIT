"use client"

import { createContext, useContext, useEffect, useState } from "react"
import Image from "next/image"

export interface CurrentUser {
  email: string
  name: string
  isAdmin: boolean
  mustChangePassword: boolean
}

const UserContext = createContext<CurrentUser | null>(null)

// Accessible dans n'importe quel enfant de AuthGate (barre latérale du
// chat, lien admin, bouton de déconnexion...) sans faire remonter l'état
// jusqu'à chaque page.
export function useUser(): CurrentUser {
  const user = useContext(UserContext)
  if (!user) throw new Error("useUser() doit être utilisé sous AuthGate, une fois authentifié.")
  return user
}

// Partagé par les trois écrans (accueil, SIT, Archiaccess AI) — évite de
// dupliquer la vérification de session et le formulaire de connexion dans
// chacun. Les deux écrans restent des routes séparées (voir app/sit et
// app/ai) : ce composant ne fait que les protéger, il ne les fusionne pas.
// logoSrc/appName personnalisent l'écran de connexion par route (voir
// CLAUDE.md — le logo doit être visible dès l'écran de mot de passe).
export function AuthGate({
  children,
  logoSrc = "/logo-ai.png",
  appName = "Archiaccess",
}: {
  children: React.ReactNode
  logoSrc?: string
  appName?: string
}) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)

  function refreshUser() {
    return fetch("/api/auth/me", { signal: AbortSignal.timeout(10000) })
      .then((res) => res.json())
      .then((data) => setUser(data.authenticated ? data.user : null))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }

  useEffect(() => {
    refreshUser()
  }, [])

  if (!ready) {
    return (
      <main className="glass-scene flex min-h-screen flex-col items-center justify-center gap-4">
        <Image src={logoSrc} alt={appName} width={64} height={64} className="rounded-2xl opacity-70" />
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    )
  }

  // Volontairement pas de détection/écran de bootstrap ici : la création du
  // tout premier compte (comme celle de tout compte employé) ne doit être
  // accessible qu'en passant délibérément par /admin, jamais en visitant
  // simplement /, /sit ou /ai — voir CLAUDE.md (retour utilisateur du
  // 2026-08-30, "la création de compte ne doit pas se faire sur
  // ai.archiaccess.com, mais moi qui crée les comptes").
  if (!user) {
    return <LoginForm logoSrc={logoSrc} appName={appName} onSuccess={refreshUser} />
  }

  if (user.mustChangePassword) {
    return <ForcedPasswordChange logoSrc={logoSrc} appName={appName} onDone={refreshUser} />
  }

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

function LoginForm({
  logoSrc,
  appName,
  onSuccess,
}: {
  logoSrc: string
  appName: string
  onSuccess: () => void
}) {
  const [email, setEmail] = useState("")
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
        body: JSON.stringify({ email, password }),
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
    <main className="glass-scene flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="liquid-glass flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl p-8">
        <Image src={logoSrc} alt={appName} width={72} height={72} className="mb-2 rounded-2xl" />
        <h1 className="text-lg font-medium">{appName}</h1>
        <p className="text-sm text-muted-foreground">Connectez-vous avec votre compte Archiaccess</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@archiaccess.com"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoFocus
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoComplete="current-password"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="chrome-black w-full rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Se connecter
        </button>
      </form>
    </main>
  )
}

// Exporté : /admin est le SEUL endroit qui affiche ce formulaire (voir
// AuthGate ci-dessus et app/admin/page.tsx) — jamais automatiquement sur
// les écrans employés.
export function BootstrapForm({
  logoSrc,
  appName,
  onDone,
}: {
  logoSrc: string
  appName: string
  onDone: () => void
}) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? "Création impossible.")
        return
      }
      onDone()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="glass-scene flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="liquid-glass flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl p-8">
        <Image src={logoSrc} alt={appName} width={72} height={72} className="mb-2 rounded-2xl" />
        <h1 className="text-lg font-medium">Premier compte administrateur</h1>
        <p className="text-center text-sm text-muted-foreground">
          Aucun compte n'existe encore sur {appName}. Créez le premier — il aura les droits administrateur pour
          créer les comptes des autres employés.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom complet"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoFocus
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom.nom@archiaccess.com"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoComplete="email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe (8 caractères min.)"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoComplete="new-password"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmer le mot de passe"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoComplete="new-password"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="chrome-black w-full rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Créer le compte
        </button>
      </form>
    </main>
  )
}

function ForcedPasswordChange({
  logoSrc,
  appName,
  onDone,
}: {
  logoSrc: string
  appName: string
  onDone: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (newPassword !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error ?? "Changement impossible.")
        return
      }
      onDone()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="glass-scene flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="liquid-glass flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl p-8">
        <Image src={logoSrc} alt={appName} width={72} height={72} className="mb-2 rounded-2xl" />
        <h1 className="text-lg font-medium">Nouveau mot de passe</h1>
        <p className="text-center text-sm text-muted-foreground">
          Première connexion : choisissez votre mot de passe définitif.
        </p>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Mot de passe temporaire"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoFocus
          autoComplete="current-password"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Nouveau mot de passe (8 caractères min.)"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoComplete="new-password"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirmer le nouveau mot de passe"
          className="liquid-glass-inset w-full rounded-xl px-3 py-2 text-sm outline-none"
          autoComplete="new-password"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="chrome-black w-full rounded-xl px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Valider
        </button>
      </form>
    </main>
  )
}
