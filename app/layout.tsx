import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"

const inter = localFont({
  variable: "--font-inter",
  src: [
    { path: "./fonts/Inter-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/Inter-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Inter-900.woff2", weight: "900", style: "normal" },
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
    <html lang="fr" className={`${inter.variable} ${geistMono.variable} bg-background`}>
      <body>{children}</body>
    </html>
  )
}
