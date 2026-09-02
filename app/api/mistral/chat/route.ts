import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, getSessionUser } from "@/lib/session"
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

## Identité
Tu es Archiaccess AI, un point final. Si on te demande quel modèle tu es, quelle IA t'a développé, ou tout détail technique sur l'infrastructure derrière toi (fournisseur, nom de modèle, version) : réponds simplement que tu es Archiaccess AI, l'assistant interne d'Archiaccess, sans citer de fournisseur ni de nom de modèle technique. Une phrase suffit, pas de justification ni de détail technique superflu.

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
  const user = await getSessionUser(token)
  if (!user) {
    return NextResponse.json({ success: false, error: "Non authentifié." }, { status: 401 })
  }

  const { conversationId, message, context, title } = (await request.json()) as {
    conversationId?: string
    message?: string
    // Données actuellement affichées dans le SIT (adresse/cadastre/risques/
    // DVF/entreprise sélectionnés) — envoyé par le panneau IA intégré à
    // /sit pour que le copilote réponde avec ce contexte en tête, sans
    // que l'employé ait à tout recopier. Absent depuis /ai (comportement
    // inchangé là-bas).
    context?: string
    // Titre explicite pour une NOUVELLE conversation (ignoré si la
    // conversation existe déjà). Le panneau IA de /sit envoie l'adresse
    // ou l'entreprise réellement étudiée (préfixée "SIT · "), plutôt que
    // de laisser le titre par défaut reprendre le prompt de résumé
    // automatique — illisible dans la liste de conversations de /ai.
    // Absent depuis /ai, comportement inchangé là-bas.
    title?: string
  }
  if (!message?.trim()) {
    return NextResponse.json({ success: false, error: "Message vide." }, { status: 400 })
  }

  const prisma = await getPrisma()

  // findUnique scopé par userId (pas juste l'id) : un employé ne doit pas
  // pouvoir continuer la conversation d'un autre en devinant/rejouant un id.
  const conversation = conversationId
    ? await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: { messages: true },
      })
    : await prisma.conversation.create({
        data: { userId: user.id, title: (title?.trim() || message.trim()).slice(0, 80) },
        include: { messages: true },
      })

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

  const sitContextMessage: MistralMessage | undefined = context?.trim()
    ? { role: "system", content: `Données actuellement affichées dans le SIT :\n\n${context.trim()}` }
    : undefined

  const history: MistralMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(sitContextMessage ? [sitContextMessage] : []),
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
  // Touche updatedAt pour que la conversation remonte en tête de liste
  // dans la barre latérale (voir GET /api/mistral/conversations).
  await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } })

  return NextResponse.json({ success: true, conversationId: conversation.id, reply })
}
