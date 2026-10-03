// Initiales affichées dans les pastilles (compte, membres, auteurs,
// responsables) : première lettre du premier et du dernier mot. Pur, sans
// dépendance serveur, partagé par tous les composants.
export function initiales(nom: string | null | undefined): string {
  const mots = (nom ?? "").trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return "?"
  const premier = mots[0][0] ?? ""
  const dernier = mots.length > 1 ? (mots[mots.length - 1][0] ?? "") : ""
  return (premier + dernier).toUpperCase()
}
