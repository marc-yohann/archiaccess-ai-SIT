"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { AuthGate, useUser } from "@/components/auth-gate"
import { SitNav } from "@/components/sit-nav"

// Administration de l'espace collaboratif (2026-09-28) : l'administrateur
// crée les projets d'équipe (création guidée /sit/projets/nouveau
// ?espace=collaboratif), choisit qui y a accès et avec quel rôle, et
// archive un projet terminé. Les droits sont revérifiés côté serveur
// (lib/projet-acces.ts, /api/sit/projets/[id]/membres).

type Role = "MEMBRE" | "CHEF_DE_PROJET"

interface Membre {
  role: Role
  user: { id: string; name: string }
}

interface ProjetCollab {
  id: string
  nom: string
  archivedAt: string | null
  membres: Membre[]
}

interface Compte {
  id: string
  name: string
  email: string
  active: boolean
}

const ROLES: Record<Role, string> = { MEMBRE: "Membre", CHEF_DE_PROJET: "Chef de projet" }

function GestionProjets() {
  const user = useUser()
  const router = useRouter()
  const params = useSearchParams()
  const [projets, setProjets] = useState<ProjetCollab[] | null>(null)
  const [comptes, setComptes] = useState<Compte[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [ajout, setAjout] = useState<{ userId: string; role: Role }>({ userId: "", role: "MEMBRE" })
  const [enCours, setEnCours] = useState(false)
  const selection = params.get("projet")

  const charger = useCallback(async () => {
    const d = await fetch("/api/sit/projets?espace=collaboratif").then((r) => r.json())
    if (!d.success) return setErreur(d.error ?? "Chargement impossible.")
    setProjets(d.projets)
  }, [])

  useEffect(() => {
    if (!user.isAdmin) return
    void charger()
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => d.success && setComptes(d.users))
      .catch(() => {})
  }, [user.isAdmin, charger])

  const projet = useMemo(() => projets?.find((p) => p.id === selection) ?? null, [projets, selection])
  const disponibles = useMemo(
    () => comptes.filter((c) => c.active && !projet?.membres.some((m) => m.user.id === c.id)),
    [comptes, projet],
  )

  if (!user.isAdmin) {
    return (
      <Cadre>
        <p className="text-sm">Réservé aux administrateurs.</p>
      </Cadre>
    )
  }

  async function action(url: string, init: RequestInit) {
    setEnCours(true)
    setErreur(null)
    try {
      const d = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init }).then((r) => r.json())
      if (!d.success) throw new Error(d.error ?? "Action impossible.")
      await charger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Action impossible.")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <Cadre>
      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="liquid-glass-panel flex flex-col gap-2.5 rounded-2xl p-4 lg:w-[26rem] lg:shrink-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Projets collaboratifs</h2>
            <Link href="/sit/projets/nouveau?espace=collaboratif" className="chrome-black flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-white">
              <Plus size={14} />
              Nouveau
            </Link>
          </div>
          {projets === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
          {projets?.length === 0 && <p className="text-sm text-muted-foreground">Aucun projet collaboratif pour l'instant.</p>}
          {projets?.map((p) => {
            const chef = p.membres.find((m) => m.role === "CHEF_DE_PROJET")
            const actif = p.id === selection
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => router.replace(`/admin/projets?projet=${p.id}`)}
                aria-pressed={actif}
                className={`liquid-glass-soft flex flex-col gap-0.5 rounded-xl px-3.5 py-3 text-left ${actif ? "outline outline-2 -outline-offset-1 outline-foreground" : ""}`}
              >
                <span className="text-sm font-semibold">{p.nom}</span>
                <span className="text-xs text-muted-foreground">
                  {p.membres.length} membre{p.membres.length > 1 ? "s" : ""}
                  {chef ? ` · Chef de projet : ${chef.user.name}` : ""}
                  {p.archivedAt ? " · Archivé" : ""}
                </span>
              </button>
            )
          })}
        </section>

        <section className="liquid-glass-panel flex min-w-0 flex-1 flex-col gap-4 rounded-2xl p-5">
          {!projet && <p className="text-sm text-muted-foreground">Choisissez un projet pour gérer ses accès, ou créez-en un.</p>}
          {projet && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Projet collaboratif</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">{projet.nom}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/sit/equipe/${projet.id}`} className="liquid-glass-pill rounded-xl px-3.5 py-2 text-[13px]">
                    Ouvrir le projet
                  </Link>
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => void action(`/api/sit/projets/${projet.id}`, { method: "PATCH", body: JSON.stringify({ archive: !projet.archivedAt }) })}
                    className="liquid-glass-pill rounded-xl px-3.5 py-2 text-[13px] disabled:opacity-50"
                  >
                    {projet.archivedAt ? "Désarchiver" : "Archiver"}
                  </button>
                </div>
              </div>
              {projet.archivedAt && (
                <p className="text-sm text-muted-foreground">Archivé : le projet n'apparaît plus dans l'espace collaboratif des membres.</p>
              )}

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold">Qui a accès</h3>
                <span className="text-xs text-muted-foreground">Seuls ces collaborateurs voient le projet dans leur espace collaboratif.</span>
              </div>

              <div className="flex flex-col gap-2">
                {projet.membres.length === 0 && <p className="text-sm text-muted-foreground">Personne pour l'instant.</p>}
                {projet.membres.map((m) => (
                  <div key={m.user.id} className="liquid-glass-soft flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-2.5">
                    <span className="min-w-0 flex-1 text-sm font-medium">{m.user.name}</span>
                    <label className="sr-only" htmlFor={`role-${m.user.id}`}>
                      Rôle de {m.user.name}
                    </label>
                    <select
                      id={`role-${m.user.id}`}
                      value={m.role}
                      disabled={enCours}
                      onChange={(e) =>
                        void action(`/api/sit/projets/${projet.id}/membres/${m.user.id}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) })
                      }
                      className="liquid-glass-inset rounded-lg px-2 py-1.5 text-sm outline-none"
                    >
                      {Object.entries(ROLES).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => void action(`/api/sit/projets/${projet.id}/membres/${m.user.id}`, { method: "DELETE" })}
                      className="liquid-glass-pill rounded-lg px-3 py-1.5 text-[13px] disabled:opacity-50"
                    >
                      Retirer l'accès
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!ajout.userId) return
                  void action(`/api/sit/projets/${projet.id}/membres`, { method: "POST", body: JSON.stringify(ajout) }).then(() =>
                    setAjout({ userId: "", role: "MEMBRE" }),
                  )
                }}
                className="liquid-glass-inset flex flex-col gap-3 rounded-xl p-3.5 sm:flex-row sm:items-end"
              >
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Donner accès à un collaborateur</span>
                  <select
                    value={ajout.userId}
                    onChange={(e) => setAjout((a) => ({ ...a, userId: e.target.value }))}
                    className="rounded-lg bg-white/60 px-2.5 py-2 text-sm outline-none"
                  >
                    <option value="">{disponibles.length ? "Choisir un compte actif…" : "Tous les comptes actifs ont déjà accès"}</option>
                    {disponibles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 sm:w-44">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Rôle</span>
                  <select
                    value={ajout.role}
                    onChange={(e) => setAjout((a) => ({ ...a, role: e.target.value as Role }))}
                    className="rounded-lg bg-white/60 px-2.5 py-2 text-sm outline-none"
                  >
                    {Object.entries(ROLES).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={enCours || !ajout.userId} className="chrome-black rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                  Donner accès
                </button>
              </form>

              <div className="grid gap-2 text-[13px] sm:grid-cols-2">
                <div className="liquid-glass-soft rounded-xl px-3.5 py-3">
                  <b className="font-semibold">Membre</b>
                  <p className="mt-0.5 text-muted-foreground">Fait avancer les étapes, fixe les échéances et écrit les notes.</p>
                </div>
                <div className="liquid-glass-soft rounded-xl px-3.5 py-3">
                  <b className="font-semibold">Chef de projet</b>
                  <p className="mt-0.5 text-muted-foreground">Comme un membre, et modifie le profil de l'opération.</p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Cadre>
  )
}

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <main className="glass-scene flex min-h-screen w-full flex-col gap-4 p-4 pb-28 md:pb-10">
      <SitNav titre="Projets collaboratifs et accès" sousTitre={<Link href="/admin" className="hover:underline">Administration</Link>} />
      {children}
    </main>
  )
}

export default function AdminProjetsPage() {
  return (
    <AuthGate logoSrc="/logo-sit.png" appName="Archiaccess SIT">
      {/* useSearchParams (?projet=) exige un ancêtre Suspense au build. */}
      <Suspense fallback={null}>
        <GestionProjets />
      </Suspense>
    </AuthGate>
  )
}
