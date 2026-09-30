import { exigerAccesProjet } from "@/lib/projet-acces"
import { getPrisma } from "@/lib/prisma"
import { getFichier } from "@/lib/storage"

// Téléchargement d'un fichier du dossier, après vérification de l'accès
// au projet (le bucket n'est jamais exposé directement).
export async function GET(request: Request, { params }: { params: Promise<{ id: string; elementId: string }> }) {
  const { id, elementId } = await params
  const garde = await exigerAccesProjet(id)
  if ("reponse" in garde) return garde.reponse
  const prisma = await getPrisma()
  const element = await prisma.projetElement.findFirst({
    where: { id: elementId, projetId: id, type: "FICHIER" },
    select: { storageKey: true, nomFichier: true, mimeType: true },
  })
  if (!element?.storageKey) return new Response("Fichier introuvable.", { status: 404 })
  const octets = await getFichier(element.storageKey)
  const nom = element.nomFichier ?? "fichier"
  return new Response(Buffer.from(octets), {
    headers: {
      "Content-Type": element.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nom.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
