import type { NiveauAcces } from "@/lib/projet-acces"
import { peutRetirerElement } from "@/lib/projet-acces"

// Éléments du dossier d'un projet (fil des étapes, 2026-09-30) : forme
// renvoyée au navigateur, commune aux routes de lecture et d'écriture.
// Serveur uniquement (importe lib/projet-acces).

export const SELECT_ELEMENT = {
  id: true,
  type: true,
  etapeCode: true,
  titre: true,
  texte: true,
  message: true,
  url: true,
  nomFichier: true,
  mimeType: true,
  tailleOctets: true,
  createdAt: true,
  auteurId: true,
  auteur: { select: { id: true, name: true } },
} as const

export const TEXTE_MAX = 50_000
export const TITRE_MAX = 300
// Taille maximale d'un fichier déposé : la requête passe par la fonction
// du serveur, dont la charge utile est limitée à 6 Mo.
export const FICHIER_MAX_OCTETS = 4 * 1024 * 1024

export function serialiserElement<T extends { auteurId: string | null }>(e: T, niveau: NiveauAcces, userId: string) {
  const { auteurId, ...reste } = e
  return { ...reste, peutRetirer: peutRetirerElement(niveau, userId, auteurId) }
}
