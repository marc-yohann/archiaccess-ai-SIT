/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@prisma/client"],
  // L'optimisation d'image de Next.js passe par une Lambda séparée
  // (image-optimization-function côté OpenNext) qui n'est pas déployée —
  // seule la Lambda principale l'est. Sans ça, next/image demande
  // /_next/image?... qui tombe sur la Lambda principale (pas de route
  // pour ça) et casse silencieusement l'affichage (logos, favicons).
  // Désactivé plutôt que de déployer une Lambda de plus pour quelques
  // logos fixes qui n'ont pas besoin de redimensionnement à la volée.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
