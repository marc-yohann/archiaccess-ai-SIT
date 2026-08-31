// Utilitaires purs sur les codes INSEE — aucune dépendance serveur (pas
// de Prisma/withVault), pour rester importable depuis un composant client
// (ex: app/sit/page.tsx) sans embarquer le client Postgres dans le bundle
// navigateur.

// Code département à partir d'un code INSEE commune — les DOM ont un
// code commune à 5 chiffres commençant par le département sur 3 chiffres
// (ex: 97411), la métropole sur 2 chiffres (ex: 51454 -> 51). La Corse
// (2A/2B) reste couverte par les deux premiers chiffres ("20").
export function departmentCodeFromCityCode(codeInsee: string): string {
  return codeInsee.startsWith("97") ? codeInsee.slice(0, 3) : codeInsee.slice(0, 2)
}
