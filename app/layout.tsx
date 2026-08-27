import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Archiaccess AI",
  description: "Système d'Information Technique Fédéré — outil interne du bureau d'études",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
