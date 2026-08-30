import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Archiaccess SIT",
  description: "Système d'Information Technique Fédéré — outil interne du bureau d'études",
}

export default function SitLayout({ children }: { children: React.ReactNode }) {
  return children
}
