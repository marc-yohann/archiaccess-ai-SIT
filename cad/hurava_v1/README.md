# HURAVA V1 — modèle CAO paramétrique

HURAVA by ARCHIACCESS · *Built to Move.* · Bâtir. Organiser. Avancer.

Modèle B-rep (CadQuery 2.8 / OpenCASCADE), construit en code à partir d'un squelette
maître, phase par phase, avec des contrôles automatiques après chaque phase. Il est
exporté en STEP pour la simulation (SimScale), les plans et la fabrication.

**Statut : préliminaire.** Aucune simulation n'a été faite. Toute valeur marquée
`PROVISOIRE` reste **à valider**.

## Lancer le build

```sh
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python build.py          # construit, contrôle, exporte → out/  (≈ 15 s)
.venv/bin/python report.py         # génère out/report/RAPPORT_HURAVA_V1.md
# vues PNG (facultatif) : Node + Playwright
sh tools/fetch_three.sh && node tools/render.js out
```

`build.py` renvoie le code 0 uniquement si les 20 contrôles et les 5 contrôles pré-simulation passent.
`params.py` bloque toute modification des dimensions principales (2200 × 1100 × 1500) et de
l'architecture d'attelage figée. Il s'arrête dès
qu'une phase n'est pas géométriquement cohérente.

## Organisation

| Fichier | Rôle |
|---|---|
| `params.py` | Tous les paramètres, chacun avec un statut `FIGÉ`, `SPEC ≈` ou `PROVISOIRE` |
| `skeleton.py` | `00_MASTER_SKELETON` : plans et repères dérivés des paramètres |
| `components.py` | Une fonction par phase ; chaque pièce porte un identifiant, un nom, un matériau, une fonction et un sous-ensemble soudé |
| `geom.py` | Primitives (tube rectangulaire, tube rond, prismes) et registre pièces / soudures |
| `checks.py` | Interférences (volume commun B-rep), balayage d'ouverture des portes, symétrie, zones libres |
| `build.py` | Phases 1 → 14, `HURAVA_MASTER_ASSEMBLY`, exports |
| `presim.py` | Contrôles pré-simulation PRE-01…05 (roulettes, fourreaux, attelage figé, levage, dimensions) et liste des paramètres provisoires avant SimScale |
| `report.py` | Rapport Markdown |
| `tools/` | Rendu des vues depuis les GLB |

Convention d'axes : **X** = longueur (0 → 2200, de gauche à droite vu de l'avant),
**Y** = largeur (0 = face avant avec les portes, 1100 = face arrière),
**Z** = hauteur (0 = sol). La caisse va de Z 330 à Z 1830. Les faces latérales de 1100 (X = 0 et X = 2200) portent
les barres de manutention et l'attelage (un crochet de chaque côté, paramètre `HITCH_SIDES`).

## Sorties (`out/`)

- `step/HURAVA_MASTER_ASSEMBLY.step` : assemblage structuré `00_…` → `25_…`
- `step/groups/*.step` : un fichier par composant
- `glb/hurava_v1_closed.glb` : visualisation (les variantes portes à 90° et éclatée sont régénérées par le build)
- `bom/` : nomenclature, liste des pièces, achats, débit des profilés, soudures, paramètres, paramètres provisoires avant SimScale (CSV `;`, UTF-8)
- `report/RAPPORT_HURAVA_V1.md` : contrôles, masses, points à valider, préparation SimScale, vues
- `report/BUILD_LOG.md` : journal phase par phase
- `views/*.png` : vues avant, arrière, gauche, droite, dessus, dessous, iso, iso portes ouvertes, iso arrière, éclatée, détail attelage

## Remarque

La maquette 5D précédente (`docs/hurava/hurava-5d.html`) partait d'une hauteur hors
tout de 1500 mm et d'une autre architecture (porte de pignon, boucle d'attelage).
Ce modèle CAO la remplace pour la géométrie.
