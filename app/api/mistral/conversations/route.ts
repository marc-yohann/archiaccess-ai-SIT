import { NextResponse } from "next/server"
import { exigerSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { idsProjetsAccessibles } from "@/lib/conversation-projet"

// Historique des conversations de l'utilisateur connecté, pour la barre
// latérale de /ai — jamais celles d'un autre employé (scopé par userId).
// Chaque conversation porte son projet (rangement par projet) seulement si
// l'utilisateur y a encore accès. ?projet=<id> : les conversations de ce
// projet (panneau Archiaccess AI de l'espace projet).
export async function GET(request: Request) {
  const garde = await exigerSession()
  if ("reponse" in garde) return garde.reponse
  const { user } = garde

  const prisma = await getPrisma()
  const accessibles = await idsProjetsAccessibles(user)
  const filtreProjet = new URL(request.url).searchParams.get("projet")
  if (filtreProjet && !accessibles.has(filtreProjet)) {
    return NextResponse.json({ success: true, conversations: [] })
  }
  const lignes = await prisma.conversation.findMany({
    where: { userId: user.id, ...(filtreProjet ? { projetId: filtreProjet } : {}) },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      etapeCode: true,
      projet: { select: { id: true, nom: true, espace: true } },
    },
  })
  const conversations = lignes.map(({ projet, etapeCode, ...c }) => {
    const visible = projet && accessibles.has(projet.id) ? projet : null
    return { ...c, projet: visible, etapeCode: visible ? etapeCode : null }
  })

  return NextResponse.json({ success: true, conversations })
}
