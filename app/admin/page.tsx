"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Copy, KeyRound, Search, UserPlus, Users } from "lucide-react"
import { AuthGate, BootstrapForm, useUser } from "@/components/auth-gate"
import { Avatar } from "@/components/compte"
import { CadreAdmin, Chiffre, ModuleAdmin, Pastille } from "@/components/admin/cadre-admin"

interface AdminUser {
  id: string
  email: string
  name: string
  isAdmin: boolean
  active: boolean
  mustChangePassword: boolean
  createdAt: string
}

// /admin est délibérément le SEUL endroit de l'app où la création de
// compte est possible (le tout premier compme les suivants) — voir
// components/auth-gate.tsx. Donc, avant même de passer par AuthGate (qui
// suppose qu'un compte existe déjà pour se connecter), on vérifie ici si
// aucun compte n'existe encore et on affiche directement le formulaire de
// création du premier admin dans ce cas.
export default function AdminPage() {
  const [checking, setChecking] = useState(true)
  const [bootstrapNeeded, setBootstrapNeeded] = useState(false)

  function checkBootstrap() {
    fetch("/api/auth/me", { signal: AbortSignal.timeout(10000) })
      .then((res) => res.json())
      .then((data) => setBootstrapNeeded(!data.authenticated && Boolean(data.bootstrapNeeded)))
      .catch(() => setBootstrapNeeded(false))
      .finally(() => setChecking(false))
  }

  useEffect(() => {
    checkBootstrap()
  }, [])

  if (checking) {
    return (
      <main className="glass-scene flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </main>
    )
  }

  if (bootstrapNeeded) {
    return <BootstrapForm logoSrc="/logo-sit.png" appName="Archiaccess SIT" onDone={checkBootstrap} />
  }

  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      <CadreAdmin titre="Comptes des collaborateurs" description="Seul endroit où un compte se crée. Un compte n'est jamais supprimé : on le désactive, et il peut être réactivé.">
        <AdminPanel />
      </CadreAdmin>
    </AuthGate>
  )
}

function AdminPanel() {
  const moi = useUser()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [createdInfo, setCreatedInfo] = useState<{ email: string; tempPassword: string } | null>(null)
  const [copie, setCopie] = useState(false)
  const [filtre, setFiltre] = useState("")
  const [enCours, setEnCours] = useState<string | null>(null)

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
      setCopie(false)
      setEmail("")
      setName("")
      setIsAdmin(false)
      loadUsers()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleActive(u: AdminUser) {
    setEnCours(u.id)
    try {
      await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      })
      loadUsers()
    } finally {
      setEnCours(null)
    }
  }

  async function copierMotDePasse() {
    if (!createdInfo) return
    try {
      await navigator.clipboard.writeText(createdInfo.tempPassword)
      setCopie(true)
    } catch {
      // presse-papiers indisponible : le mot de passe reste affiché
    }
  }

  // Chiffres calculés sur la liste réellement chargée.
  const chiffres = useMemo(() => {
    const liste = users ?? []
    return {
      actifs: liste.filter((u) => u.active).length,
      admins: liste.filter((u) => u.active && u.isAdmin).length,
      attente: liste.filter((u) => u.active && u.mustChangePassword).length,
      desactives: liste.filter((u) => !u.active).length,
    }
  }, [users])

  const affiches = useMemo(() => {
    const q = filtre.trim().toLowerCase()
    const liste = [...(users ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "fr"))
    return q ? liste.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : liste
  }, [users, filtre])

  const champ = "liquid-glass-inset w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/15"

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Chiffre valeur={users ? chiffres.actifs : "–"} libelle="Comptes actifs" accent />
        <Chiffre valeur={users ? chiffres.admins : "–"} libelle="Administrateurs" />
        <Chiffre valeur={users ? chiffres.attente : "–"} libelle="Première connexion en attente" />
        <Chiffre valeur={users ? chiffres.desactives : "–"} libelle="Comptes désactivés" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <ModuleAdmin icone={UserPlus} titre="Créer un compte">
          <form onSubmit={createUser} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-muted-foreground">Nom et prénom</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={champ} autoComplete="off" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-muted-foreground">Adresse e-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={champ} autoComplete="off" required />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-muted-foreground">Rôle</span>
              <div className="liquid-glass-inset flex gap-0.5 rounded-xl p-[3px]" role="radiogroup" aria-label="Rôle du compte">
                {[
                  [false, "Collaborateur"],
                  [true, "Administrateur"],
                ].map(([valeur, libelle]) => (
                  <button
                    key={String(valeur)}
                    type="button"
                    role="radio"
                    aria-checked={isAdmin === valeur}
                    onClick={() => setIsAdmin(valeur as boolean)}
                    className={`flex-1 rounded-[9px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${isAdmin === valeur ? "glass-on" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {libelle as string}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {isAdmin ? "Gère les comptes, les projets collaboratifs et leurs accès." : "Travaille sur ses projets et ceux de l'équipe auxquels il a accès."}
              </span>
            </div>
            <button type="submit" disabled={isSubmitting} className="chrome-black mt-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {isSubmitting ? "Création…" : "Créer le compte"}
            </button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>

          {createdInfo && (
            <div className="flex flex-col gap-2 rounded-[18px] border border-white/80 bg-white/75 p-3.5 text-[13px] shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
              <p className="flex items-center gap-2 font-semibold">
                <KeyRound size={15} />
                Compte créé pour {createdInfo.email}
              </p>
              <p className="text-muted-foreground">Mot de passe temporaire, à transmettre au collaborateur. Il le changera à sa première connexion ; il ne sera plus affiché ensuite.</p>
              <div className="flex items-center gap-2">
                <code className="liquid-glass-inset min-w-0 flex-1 truncate rounded-lg px-3 py-2 font-mono text-[15px]">{createdInfo.tempPassword}</code>
                <button
                  type="button"
                  onClick={() => void copierMotDePasse()}
                  className="liquid-glass-btn flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
                >
                  {copie ? <Check size={13} /> : <Copy size={13} />}
                  {copie ? "Copié" : "Copier"}
                </button>
              </div>
            </div>
          )}
        </ModuleAdmin>

        <ModuleAdmin icone={Users} titre="Comptes existants" aside={users ? `${users.length} compte${users.length > 1 ? "s" : ""}` : undefined}>
          <label className="liquid-glass-inset flex items-center gap-2 rounded-xl px-3 py-2">
            <Search size={15} className="shrink-0 text-muted-foreground" />
            <span className="sr-only">Rechercher un compte</span>
            <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Rechercher par nom ou e-mail…" className="w-full bg-transparent text-sm outline-none" />
          </label>
          {users === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {users && affiches.length === 0 && <p className="text-sm text-muted-foreground">Aucun compte ne correspond.</p>}
          <div className="flex flex-col">
            {affiches.map((u) => (
              <div key={u.id} className={`flex flex-wrap items-center gap-3 border-t border-foreground/[0.06] py-3 first:border-t-0 ${u.active ? "" : "opacity-60"}`}>
                <Avatar nom={u.name} taille={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                    <span className="truncate">{u.name}</span>
                    {u.email === moi.email && <span className="text-xs font-normal text-muted-foreground">(vous)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {u.isAdmin && <Pastille ton="sombre">Administrateur</Pastille>}
                  {u.active && u.mustChangePassword && <Pastille>Première connexion en attente</Pastille>}
                  {!u.active && <Pastille ton="alerte">Désactivé</Pastille>}
                  <span className="text-xs text-muted-foreground">depuis le {new Date(u.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {u.email !== moi.email && (
                  <button
                    type="button"
                    onClick={() => void toggleActive(u)}
                    disabled={enCours === u.id}
                    className={`shrink-0 rounded-[10px] px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${u.active ? "liquid-glass-btn" : "chrome-black text-white"}`}
                  >
                    {u.active ? "Désactiver" : "Réactiver"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </ModuleAdmin>
      </div>
    </>
  )
}
