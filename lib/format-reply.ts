// Mise en forme légère des réponses du copilote (gras "**...**", listes
// "- ...") en HTML sûr — partagé entre le panneau IA intégré à /sit et le
// chat plein écran /ai, qui appellent tous les deux /api/mistral/chat et
// affichent le même type de texte. Fonction pure sans dépendance serveur
// (voir CLAUDE.md, piège "utilitaire pur mélangé à du code serveur").

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function formatReply(text: string): string {
  const lines = text.split("\n")
  const bold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  let html = ""
  let inList = false
  for (const raw of lines) {
    const line = escapeHtml(raw.trim())
    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>"
        inList = true
      }
      html += `<li>${bold(line.slice(2))}</li>`
    } else {
      if (inList) {
        html += "</ul>"
        inList = false
      }
      if (line) html += `<p>${bold(line)}</p>`
    }
  }
  if (inList) html += "</ul>"
  return html
}
