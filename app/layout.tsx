import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

// Plus Jakarta Sans (SIL Open Font License, app/fonts/PlusJakartaSans-OFL.txt),
// police variable (graisses 200 à 800) auto-hébergée comme les autres :
// direction « Verre dépoli » validée par l'utilisateur le 2026-09-29
// (remplace Geist, qui remplaçait Inter). Sous-ensemble latin, qui couvre
// le français (accents, œ, guillemets, espaces fines, €).
const jakarta = localFont({
  variable: "--font-jakarta",
  src: [{ path: "./fonts/PlusJakartaSans-Variable.woff2", weight: "200 800", style: "normal" }],
})

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [
    { path: "./fonts/GeistMono-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/GeistMono-400.woff2", weight: "400", style: "normal" },
  ],
})

export const metadata: Metadata = {
  title: "Archiaccess AI",
  description: "Système d'Information Technique Fédéré — outil interne du bureau d'études",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${jakarta.variable} ${geistMono.variable} bg-background`}>
      <body>{children}</body>
    </html>
  )
}
