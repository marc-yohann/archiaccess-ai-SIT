// Utilitaire partagé par les routes app/api/sit/documents-sit/* (Phase
// 11) — pas dans un fichier route.ts : Next.js n'autorise que les
// handlers HTTP reconnus comme export depuis un route.ts.

// BigInt n'est pas sérialisable par JSON.stringify nativement — converti
// explicitement en string pour la réponse HTTP (tailleOctets seulement).
export function serializeDocumentSit<T extends { tailleOctets: bigint | null }>(document: T) {
  return { ...document, tailleOctets: document.tailleOctets !== null ? document.tailleOctets.toString() : null }
}
