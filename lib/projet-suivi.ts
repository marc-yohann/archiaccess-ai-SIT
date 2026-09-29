"use client"

import { useEffect, useState } from "react"
import type { ProjetResume } from "@/components/projet/carte-projet"

// « Projet suivi » (jonction du SIT et d'Archiaccess AI, maquette validée
// le 2026-09-29) : choisi une fois, il suit l'employé sur la recherche, la
// méthode et Archiaccess AI. Simple préférence de ce navigateur
// (localStorage) : elle ne donne aucun droit, chaque page revérifie l'accès
// auprès du serveur (lib/projet-acces.ts) et l'oublie si le projet n'est
// plus accessible. Fichier sans dépendance serveur (voir CLAUDE.md,
// « Pièges »).

export type EspaceProjet = "PERSONNEL" | "COLLABORATIF"

export interface ProjetSuivi {
  id: string
  nom: string
  espace: EspaceProjet
}

export interface ProjetAccessible extends ProjetResume {
  espace: EspaceProjet
}

const CLE = "sit.projetSuivi"
const EVENEMENT = "sit:projet-suivi"

export function lireProjetSuivi(): ProjetSuivi | null {
  try {
    const brut = localStorage.getItem(CLE)
    if (!brut) return null
    const p = JSON.parse(brut) as Partial<ProjetSuivi>
    if (typeof p.id !== "string" || typeof p.nom !== "string") return null
    return { id: p.id, nom: p.nom, espace: p.espace === "COLLABORATIF" ? "COLLABORATIF" : "PERSONNEL" }
  } catch {
    return null
  }
}

export function suivreProjet(p: ProjetSuivi | null) {
  try {
    if (p) localStorage.setItem(CLE, JSON.stringify({ id: p.id, nom: p.nom, espace: p.espace }))
    else localStorage.removeItem(CLE)
  } catch {
    // stockage indisponible : le projet suivi ne tient que le temps de la page
  }
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: p }))
}

// Projet suivi, tenu à jour quand il change dans cette page ou dans un
// autre onglet.
export function useProjetSuivi(): ProjetSuivi | null {
  const [suivi, setSuivi] = useState<ProjetSuivi | null>(null)
  useEffect(() => {
    setSuivi(lireProjetSuivi())
    const local = (e: Event) => setSuivi((e as CustomEvent<ProjetSuivi | null>).detail ?? null)
    const autreOnglet = (e: StorageEvent) => {
      if (e.key === CLE) setSuivi(lireProjetSuivi())
    }
    window.addEventListener(EVENEMENT, local)
    window.addEventListener("storage", autreOnglet)
    return () => {
      window.removeEventListener(EVENEMENT, local)
      window.removeEventListener("storage", autreOnglet)
    }
  }, [])
  return suivi
}

// Projets accessibles des deux espaces (mêmes routes et mêmes règles
// d'accès que le reste du SIT), hors archivés, les plus récemment modifiés
// d'abord.
export async function chargerProjetsAccessibles(): Promise<ProjetAccessible[]> {
  const charger = (espace: EspaceProjet) =>
    fetch(`/api/sit/projets${espace === "COLLABORATIF" ? "?espace=collaboratif" : ""}`)
      .then((r) => r.json())
      .then((d) => (d.success ? (d.projets as ProjetResume[]).map((p) => ({ ...p, espace })) : []))
      .catch(() => [] as ProjetAccessible[])
  const [perso, equipe] = await Promise.all([charger("PERSONNEL"), charger("COLLABORATIF")])
  return [...perso, ...equipe].filter((p) => !p.archivedAt).sort((x, y) => (x.updatedAt < y.updatedAt ? 1 : -1))
}

export function lienProjet(p: Pick<ProjetSuivi, "id" | "espace">, etapeCode?: string | null) {
  const base = p.espace === "COLLABORATIF" ? `/sit/equipe/${p.id}` : `/sit/projets/${p.id}`
  return etapeCode ? `${base}?etape=${encodeURIComponent(etapeCode)}` : base
}
