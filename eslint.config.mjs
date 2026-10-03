// Configuration ESLint (audit du 2026-10-03) : règles de Next.js (React,
// hooks, Core Web Vitals, TypeScript). Le code généré par Prisma et les
// sorties de build ne sont pas analysés.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Textes de l'interface en français : apostrophes et guillemets
      // typographiques sont voulus dans le JSX.
      "react/no-unescaped-entities": "off",
      // Règles pensées pour le compilateur React, pas encore utilisé ici :
      // signalées sans bloquer (motifs volontaires : référence « dernière
      // valeur » mise à jour au rendu, fonctions déclarées après l'effet).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    ignores: [".next/**", ".open-next/**", "node_modules/**", "lib/generated/**", "next-env.d.ts"],
  },
]

export default config
