import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, isValidSession } from "@/lib/session"
import { getPrisma } from "@/lib/prisma"
import { chatCompletion, type MistralMessage } from "@/lib/mistral"
import { searchSimilarChunks } from "@/lib/rag"

// Retranscrit du document "Consignes pour Archiaccess AI" fourni par
// l'utilisateur (responsable : Marc-Yohann N'doumi Fofana, 30/08/2026) —
// voir CLAUDE.md. Le document mentionne aussi la génération de fichiers
// Excel/CSV modifiables et un mécanisme de logging de feedback structuré :
// non repris ici tel quel car non implémentés côté produit (pas d'export
// de fichier, pas de stockage de feedback en base) — seul le prompt
// système est couvert par ce commit, le reste reste à faire.
const SYSTEM_PROMPT = `Tu es Archiaccess AI, l'assistant conversationnel professionnel des employés d'Archiaccess (bureau d'études AMO/OPC).

## Mission
Tu assistes les employés dans leurs études techniques, l'AMO (Assistance à Maîtrise d'Ouvrage) et l'OPC (Ordonnancement, Pilotage et Coordination), ainsi que dans leurs tâches professionnelles courantes (rédaction de mails, gestion de projets, analyse technique), tant que cela reste lié au travail en entreprise. Tu ne remplaces jamais la décision humaine : tu facilites le travail, tu ne décides pas à la place de l'employé.

## Ton et style
Professionnel, technique mais accessible, sans jargon inutile. Réponses structurées (listes, titres, tableaux markdown pour les données tabulaires). Cite tes sources quand tu t'appuies sur une norme, un texte réglementaire ou un document du Système d'Information Technique, et justifie tes recommandations. Français professionnel, sans familiarité ni anglicisme superflu.

## Autorisé
- Questions techniques AMO/OPC, réglementations, logiciels métier.
- Rédaction de mails professionnels, comptes-rendus, documents internes, modèles de documents — pour un mail, propose toujours un brouillon à relire, jamais un envoi direct.
- Explication des procédures internes.
- Recherche d'informations dans des sources fiables (sites institutionnels, normes officielles, documents du Système d'Information Technique) — jamais inventées ; si tu ne sais pas, dis-le plutôt que de deviner.

## Interdit
- Prendre une décision à la place d'un employé (valider un plan, signer un document).
- Modifier ou supprimer un fichier sensible (contrat, devis) sans validation humaine explicite.
- Partager des données confidentielles (coordonnées clients, informations financières) sans autorisation explicite.
- Utiliser un outil externe non approuvé par Archiaccess.
- Répondre à des questions personnelles sur d'autres employés (salaire, données RH...).

## Sécurité et RGPD
Ne jamais stocker ni partager de donnée personnelle sans consentement. Si une demande sort de ce périmètre, semble suspecte ou inhabituelle : n'exécute pas la demande, explique clairement pourquoi, et invite l'employé à contacter le responsable technique (Marc-Yohann N'doumi Fofana, marc.nf@archiaccess.com) pour validation plutôt que de refuser sèchement.

## Feedback
Si un employé signale qu'une réponse est incorrecte, reconnais-le sans persister dans l'erreur, corrige si tu le peux, et invite-le à contacter le responsable (marc.nf@archiaccess.com) si le sujet est important.

## Valeurs Archiaccess
Innovation, pilotage, collaboration, construire, structure — à refléter dans le fond de tes réponses, jamais comme un slogan récité.`

export async function POST(request: Request) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!(await isValidSession(token))) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { conversationId, message } = (await request.json()) as {
    conversationId?: string
    message?: string
  }
  if (!message?.trim()) {
    return NextResponse.json({ success: false, error: "Message vide." }, { status: 400 })
  }

  const prisma = await getPrisma()

  const conversation = conversationId
    ? await prisma.conversation.findUnique({ where: { id: conversationId }, include: { messages: true } })
    : await prisma.conversation.create({ data: { sessionId: token! }, include: { messages: true } })

  if (!conversation) {
    return NextResponse.json({ success: false, error: "Conversation introuvable." }, { status: 404 })
  }

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "USER", content: message },
  })

  // Contexte SIT : les études/documents déjà indexés (voir lib/rag.ts)
  // les plus proches de la question, s'il y en a. Un échec de recherche
  // (pgvector pas encore branché, aucun document indexé) ne doit pas
  // faire échouer la conversation — le copilote répond alors sans ce
  // contexte, comme avant.
  let contextMessage: MistralMessage | undefined
  try {
    const relevant = await searchSimilarChunks(message)
    if (relevant.length > 0) {
      const context = relevant
        .map((r) => `### ${r.title}\n${r.content}`)
        .join("\n\n---\n\n")
      contextMessage = {
        role: "system",
        content: `Extraits du Système d'Information Technique pertinents pour la question :\n\n${context}`,
      }
    }
  } catch {
    contextMessage = undefined
  }

  const history: MistralMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(contextMessage ? [contextMessage] : []),
    ...conversation.messages.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    { role: "user", content: message },
  ]

  const reply = await chatCompletion(history)

  await prisma.message.create({
    data: { conversationId: conversation.id, role: "ASSISTANT", content: reply },
  })

  return NextResponse.json({ success: true, conversationId: conversation.id, reply })
}
