# Référentiel Archiaccess — méthode AMO / OPC

Méthode de travail propre au cabinet Archiaccess pour conduire une mission
d'AMO, de conduite d'opération ou d'OPC, quel que soit l'ouvrage.

## Où est le contenu

**Source unique : `lib/referentiel/`** (données TypeScript typées, sans
dépendance serveur). Les mêmes données alimentent :

- le **PDF** de documentation et de process du cabinet,
  `docs/referentiel/Referentiel-Archiaccess-AMO-OPC.pdf` ;
- l'**espace projet** du SIT (étapes, variantes selon le profil de
  l'opération).

| Fichier | Contenu |
|---|---|
| `lib/referentiel/types.ts` | axes de variation, gabarit d'étape |
| `lib/referentiel/libelles.ts` | libellés métier des axes, acteurs, statuts |
| `lib/referentiel/principes.ts` | présentation et principes |
| `lib/referentiel/phases/phase-N.ts` | une phase et ses étapes |
| `lib/referentiel/index.ts` | liste des phases, version, filtrage des variantes |

## Régénérer le PDF

```
npm run referentiel:pdf
```

Le script (`scripts/referentiel-pdf.mjs`) transpile les données, produit
une page HTML aux couleurs et polices du SIT, et l'imprime avec Chromium
sans interface (variable `CHROME_PATH` si Chromium n'est pas à un
emplacement usuel). Régénérer et commiter le PDF à chaque modification du
contenu, en augmentant `REFERENTIEL_VERSION` pour toute modification de
fond.

## Règles de rédaction

- Contenu rédigé par Archiaccess, avec ses mots. Aucun passage d'ouvrage
  du commerce ni de norme protégée, recopié ou paraphrasé ; aucun renvoi
  du type « voir fiche X ».
- Références uniquement publiques et vérifiables : Code de la commande
  publique, CCAG 2021, codes, formulaires de la Direction des affaires
  juridiques, Cerfa. Numéros d'articles revérifiés sur Légifrance à chaque
  révision.
- « Décide » n'est jamais attribué à Archiaccess : l'outil prépare,
  l'ingénieur analyse, le maître d'ouvrage décide.
- Toute variante qu'on ne sait pas trancher sans un spécialiste porte
  `aPreciser: true`.
- Chaque étape reste `brouillon` tant qu'un senior ne l'a pas relue
  (`relu_senior`, puis `valide`).
