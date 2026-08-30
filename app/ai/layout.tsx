import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Archiaccess AI",
  description: "Copilote conversationnel pour les études AMO/OPC — outil interne du bureau d'études",
}

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return children
}
