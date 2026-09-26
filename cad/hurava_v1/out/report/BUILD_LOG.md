# HURAVA V1 — journal de construction CAO


## PHASE 1 — MASTER SKELETON

- Plan sol Z0 : 0.0
- Dessous fourreaux (garde au sol) : 250.0
- Dessous châssis : 270.0
- Dessus châssis / dessous plancher : 330.0
- Dessus plancher : 334.0
- Dessous cadre haut : 1768.0
- Dessus toit (haut d'enveloppe) : 1830.0
- Face latérale gauche X : 0.0
- Face latérale droite X : 2200.0
- Face avant (portes) Y : 0.0
- Face arrière (attelage) Y : 1100.0
- Plan de symétrie X : 1100.0
- Ouverture porte X : (42.0, 2158.0)
- Ouverture porte Z : (334.0, 1768.0)
- Contrôle Hauteur de caisse = 1500 : ✅ OK (1500.0 mm)
- Contrôle Longueur = 2200 : ✅ OK (2200 mm)
- Contrôle Largeur = 1100 : ✅ OK (1100 mm)
- Contrôle Garde au sol ≤ dessous châssis : ✅ OK (250 ≤ 270)
- Contrôle Dessus caisse ≈ 1830 : ✅ OK (1830 mm)
- Contrôle Ouverture de porte positive : ✅ OK (2116 × 1434 mm)

## PHASE 2 — CHÂSSIS

- Corps créés : 25 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 2.0…2198.0 | Y 2.0…1098.0 | Z 270.0…1828.0
- Châssis dans l'enveloppe X/Y : ✅ OK X 2.0…2198.0 | Y 2.0…1098.0 | Z 270.0…1828.0
- Dessus châssis = 330 : ✅ OK 
- **Phase validée** (0 s)

## PHASE 3 — STRUCTURE

- Corps créés : 11 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 2.0…2198.0 | Y 42.0…1098.0 | Z 270.0…1828.0
- **Phase validée** (0 s)

## PHASE 4 — ENVELOPPE

- Corps créés : 5 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 0.0…2200.0 | Y 0.0…1100.0 | Z 330.0…1830.0
- Enveloppe 2200 × 1100 × 1500 : ✅ OK 2200.0 × 1100.0 × 1500.0
- **Phase validée** (1 s)

## PHASE 5 — PORTES

- Corps créés : 51 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 15.0…2185.0 | Y -60.0…72.0 | Z 334.0…1788.0
- 2 vantaux sur la face avant (Y≈0) : ✅ OK 2 vantaux
- 3 charnières par vantail : ✅ OK 
- **Phase validée** (1 s)

## PHASE 6 — RACKS

- Corps créés : 38 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 42.0…2158.0 | Y 70.0…1030.0 | Z 334.0…1828.0
- Passage central libre : ✅ OK zone X 493…1707 (largeur 1214 mm) []
- **Phase validée** (2 s)

## PHASE 7 — ROUES

- Corps créés : 28 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 2.0…2198.0 | Y 2.0…1098.0 | Z 0.0…282.0
- 4 roues au sol (Z min = 0) : ✅ OK 4 roues, Z min 0.00
- **Phase validée** (3 s)

## PHASE 8 — BARRES DE MANUTENTION

- Corps créés : 6 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X -91.8…2291.8 | Y 100.0…1000.0 | Z 970.0…1030.0
- 14-BAR horizontale, L = 900 : ✅ OK X -91.8…-58.1 | Y 100.0…1000.0 | Z 983.1…1016.9
- 15-BAR horizontale, L = 900 : ✅ OK X 2258.2…2291.8 | Y 100.0…1000.0 | Z 983.1…1016.9
- **Phase validée** (3 s)

## PHASE 9 — FOURREAUX

- Corps créés : 10 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 435.0…1765.0 | Y 0.0…1100.0 | Z 250.0…330.0
- 2 fourreaux, dessous = garde au sol 250 : ✅ OK 
- **Phase validée** (3 s)

## PHASE 10 — POINTS DE LEVAGE

- Corps créés : 8 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 2.0…2198.0 | Y 2.0…1098.0 | Z 1828.0…1910.0
- 4 oreilles au-dessus du toit : ✅ OK 
- **Phase validée** (3 s)

## PHASE 11 — ATTELAGE

- Corps créés : 14 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X -421.0…2621.0 | Y 480.0…620.0 | Z 262.0…355.0
- Crochet G sur la face latérale 1100 : ✅ OK X -135.0…-13.0 | Y 537.5…562.5 | Z 262.0…355.0
- Crochet D sur la face latérale 1100 : ✅ OK X 2213.0…2335.0 | Y 537.5…562.5 | Z 262.0…355.0
- **Phase validée** (4 s)

## PHASE 12 — ASSEMBLY

- 196 corps répartis en 24 composants

## PHASE 13 — DÉTAILS ESTHÉTIQUES

- Corps créés : 2 — géométrie valide : ✅ OK 
- Collisions (volume commun > 1.0 mm³) : ✅ OK
- Emprise : X 393.1…1398.2 | Y -0.3…1100.3 | Z 1416.6…1646.1
- **Phase validée** (5 s)

## PHASE 14 — VALIDATION AUTOMATIQUE


## PHASE 14 — VALIDATION AUTOMATIQUE

| Contrôle | Intitulé | Résultat | Détail |
|---|---|---|---|
| CHECK 01 | Dimensions principales 2200 × 1100 × 1500 | ✅ OK | enveloppe de caisse 2200.0 × 1100.0 × 1500.0 mm (Z 330→1830) |
| CHECK 02 | 2 portes sur la face avant 2200 | ✅ OK | 2 vantaux, plan Y = 0…2 |
| CHECK 03 | 2 barres sur les faces latérales 1100 | ✅ OK | 14-BAR: X -91.8…-58.1; 15-BAR: X 2258.2…2291.8 |
| CHECK 04 | Barres Ø33,7 × 4 × 900 | ✅ OK | volume 335899 mm³ / théorique 335899 mm³ |
| CHECK 05 | 4 roues | ✅ OK | 4 roulettes Ø200 |
| CHECK 06 | 2 fourreaux sous le châssis | ✅ OK | entraxe 900 mm, Z 250…330 |
| CHECK 07 | 4 points de levage au-dessus | ✅ OK | Z max 1910 mm |
| CHECK 08 | Attelage sur les faces latérales 1100 | ✅ OK | G : X -135…-13, axe Y 550 ; D : X 2213…2335, axe Y 550 ; aucun crochet en face arrière |
| CHECK 09 | Crochet vers le haut + anneau articulé | ✅ OK | bec +55 mm — G : libre au repos ✅ OK, traction 40 mm bloquée ✅ OK, soulevé 30 mm retenu ✅ OK, dégagé seulement au-dessus du bec ✅ OK | D : libre au repos ✅ OK, traction 40 mm bloquée ✅ OK, soulevé 30 mm retenu ✅ OK, dégagé seulement au-dessus du bec ✅ OK |
| CHECK 10 | 2 racks internes | ✅ OK | 19 + 19 corps |
| CHECK 11 | 3 niveaux par rack | ✅ OK | niveaux [3, 3] |
| CHECK 12 | Passage central libre | ✅ OK | largeur libre 1216 mm × hauteur 1434 mm [] |
| CHECK 13 | Aucun moteur / électronique / hydraulique | ✅ OK | aucun composant motorisé, électrique ou hydraulique |
| CHECK 14 | Aucune barre sur la face avant | ✅ OK | barres et supports compris dans Y 0…1100, hors faces avant/arrière |
| CHECK 15 | Aucun attelage à boule | ✅ OK | aucune surface sphérique dans 22/23 |
| CHECK 16 | Aucune troisième porte | ✅ OK |  |
| CHECK 17 | Symétrie gauche / droite | ✅ OK | Racks ✅ OK; Barres ✅ OK; Fourreaux ✅ OK; Levage AV ✅ OK; Levage AR ✅ OK; Attelage ✅ OK |
| CHECK 18 | Absence d'interférences | ✅ OK | 198 corps, 0 interférence(s) [] (1 s) |
| CHECK 19 | Portes ouvrables 0 → 90° | ✅ OK | balayage 0°, 15°, 30°, 45°, 60°, 75°, 85°, 90° sans collision ✅ OK ; jeu butée à 90° = 0.50 mm ; dépassement 92° bloqué par la butée ✅ OK |
| CHECK 20 | Modèle assemblable | ✅ OK | 198 corps valides ✅ OK ; chaque corps soudé, boulonné ou guidé (jeu ≤ 1 mm) sur un autre ; corps isolés : aucun |

## Masse estimative

- Masse à vide estimée : **677.9 kg**
- Centre de gravité à vide : X 1100 · Y 519 · Z 857 mm
  - 01_CHASSIS : 94.6 kg
  - 02_SECONDARY_STRUCTURE : 26.9 kg
  - 03_FLOOR : 75.3 kg
  - 04_ROOF : 37.5 kg
  - 05_SIDE_PANELS : 51.7 kg
  - 06_REAR_PANEL : 51.6 kg
  - 07_FRONT_DOORS : 87.0 kg
  - 08_DOOR_HINGES : 7.3 kg
  - 09_LOCKING_SYSTEM : 9.5 kg
  - 10_RACK_LEFT : 44.3 kg
  - 11_RACK_RIGHT : 44.3 kg
  - 12_WHEELS : 38.0 kg
  - 13_WHEEL_SUPPORTS : 39.6 kg
  - 14_HANDLING_BAR_LEFT : 3.3 kg
  - 15_HANDLING_BAR_RIGHT : 3.3 kg
  - 16_FORK_POCKET_LEFT : 26.7 kg
  - 17_FORK_POCKET_RIGHT : 26.7 kg
  - 18_LIFTING_POINT_FL : 1.1 kg
  - 19_LIFTING_POINT_FR : 1.1 kg
  - 20_LIFTING_POINT_RL : 1.1 kg
  - 21_LIFTING_POINT_RR : 1.1 kg
  - 22_HITCH_HOOK : 4.7 kg
  - 24_FASTENERS_HARDWARE : 1.2 kg
  - 25_LOGO : 0.1 kg

## Exports

- step/HURAVA_MASTER_ASSEMBLY.step (portes fermées, interface engin incluse)
- step/groups/*.step (un fichier par composant 01…25)
- glb/hurava_v1_closed.glb, hurava_v1_open90.glb, hurava_v1_exploded.glb (visualisation)
- bom/BOM_HURAVA_V1.csv, PIECES, ACHATS, DEBIT_PROFILES, SOUDURES, PARAMETRES
