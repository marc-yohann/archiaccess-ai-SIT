import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

// Geist (SIL Open Font License, app/fonts/Geist-OFL.txt), auto-hébergée
// comme les autres polices : modernisation du design du 2026-09-29,
// décidée par l'utilisateur (remplace Inter).
const geist = localFont({
  variable: "--font-geist",
  src: [
    { path: "./fonts/Geist-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Geist-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Geist-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Geist-Bold.woff2", weight: "700", style: "normal" },
  ],
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
    <html lang="fr" className={`${geist.variable} ${geistMono.variable} bg-background`}>
      <body>{children}</body>
    </html>
  )
}
