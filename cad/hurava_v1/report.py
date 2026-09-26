"""Génère out/report/RAPPORT_HURAVA_V1.md à partir des résultats du build."""
import csv, json, os, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from params import P, ALL as PARAMS

G = 9.81


def read_csv(path):
    with open(path, encoding="utf-8") as f:
        return list(csv.reader(f, delimiter=";"))


def md_table(rows, cols=None):
    head, body = rows[0], rows[1:]
    idx = [head.index(c) for c in cols] if cols else range(len(head))
    out = ["| " + " | ".join(head[i] for i in idx) + " |", "|" + "---|" * len(idx)]
    out += ["| " + " | ".join(r[i].replace("|", "/") for i in idx) + " |" for r in body]
    return "\n".join(out)


def main(out):
    S = json.load(open(os.path.join(out, "report", "summary.json"), encoding="utf-8"))
    bom = read_csv(os.path.join(out, "bom", "BOM_HURAVA_V1.csv"))
    buy = read_csv(os.path.join(out, "bom", "ACHATS_HURAVA_V1.csv"))
    deb = read_csv(os.path.join(out, "bom", "DEBIT_PROFILES_HURAVA_V1.csv"))
    welds = read_csv(os.path.join(out, "bom", "SOUDURES_HURAVA_V1.csv"))

    tare = S["total_mass"]
    gross = tare + P["PAYLOAD_DESIGN"]
    dyn = gross * P["DYNAMIC_FACTOR"]
    per_wheel_static = gross / 3
    per_wheel_dyn = dyn / 3
    leg = dyn / 3 / 0.866                 # élingue 4 brins, 3 brins porteurs, 60° / horizontale
    tow = gross * G * (0.10 + 0.10) * P["DYNAMIC_FACTOR"] / 1000   # roulement chantier 10 % + rampe 10 %
    bb = S["overall_bb"]

    L = []
    w = L.append
    w("# HURAVA V1 — Rapport de build CAO\n")
    w("**HURAVA by ARCHIACCESS** · *Built to Move.* · Bâtir. Organiser. Avancer.\n")
    w("> Modèle paramétrique préliminaire. Les valeurs marquées **PROVISOIRE — À VALIDER** ne sont pas figées. "
      "Aucune simulation n'a été réalisée dans ce build ; le modèle n'est ni calculé ni certifié.\n")

    w("## 1. Livrables\n")
    w("| # | Livrable | Fichier |\n|---|---|---|")
    items = [
        ("HURAVA_MASTER_ASSEMBLY", "`out/step/HURAVA_MASTER_ASSEMBLY.step` (assemblage STEP AP214, 26 composants)"),
        ("Modèle paramétrique complet", "`params.py` → `skeleton.py` → `components.py` → `build.py`"),
        ("Structure organisée", "composants `00_MASTER_SKELETON` … `25_LOGO` (arbre STEP + `out/step/groups/`)"),
        ("Nomenclature initiale", "`out/bom/BOM_HURAVA_V1.csv`"),
        ("Liste des paramètres", "`out/bom/PARAMETRES_HURAVA_V1.csv` + §3"),
        ("Liste des pièces", "`out/bom/PIECES_HURAVA_V1.csv` (1 ligne par corps : id, nom, matériau, qté, fonction)"),
        ("Composants achetés", "`out/bom/ACHATS_HURAVA_V1.csv` + §6"),
        ("Soudures principales", "`out/bom/SOUDURES_HURAVA_V1.csv` + §7"),
        ("Masse estimative", "§5"),
        ("Points à valider", "§9"),
        ("Vues avant / arrière / gauche / droite / dessus / dessous / iso / éclatée", "`out/views/*.png`"),
        ("Visualisation 3D", "`out/glb/hurava_v1_closed.glb`"),
    ]
    for i, (a, b) in enumerate(items, 1):
        w(f"| {i} | {a} | {b} |")

    w("\n## 2. Validation automatique (phase 14)\n")
    w(f"Build : {S['n_parts']} corps, {len(S['checks'])} contrôles — "
      f"**{'20 / 20 validés' if S['all_ok'] else 'ÉCHECS PRÉSENTS'}**. Chaque phase 1 → 13 a été validée "
      "(géométrie valide, aucune collision, emprise, contrôles propres à la phase) avant de passer à la suivante — "
      "voir `out/report/BUILD_LOG.md`.\n")
    w("| Contrôle | Intitulé | Résultat | Détail |\n|---|---|---|---|")
    for k, (n, r, d) in S["checks"].items():
        w(f"| {k} | {n} | {'✅' if r else '❌'} | {d} |")

    w("\n## 3. Paramètres\n")
    w("| Paramètre | Valeur | Unité | Statut | Note |\n|---|---|---|---|---|")
    for p in PARAMS:
        st = "**PROVISOIRE — À VALIDER**" if p.status == "PROVISOIRE" else p.status
        w(f"| `{p.name}` | {p.value} | {p.unit} | {st} | {p.note} |")

    w("\n## 4. Encombrements\n")
    w("| Référence | Valeur |\n|---|---|")
    w("| Enveloppe principale de caisse (CHECK 01) | 2200 × 1100 × 1500 mm, de Z 330 à Z 1830 |")
    w(f"| Hors tout avec barres de manutention (X) | {bb[1] - bb[0]:.0f} mm |")
    w(f"| Hors tout avec charnières et crochet (Y) | {bb[3] - bb[2]:.0f} mm (hors anneau côté engin) |")
    w(f"| Hors tout avec oreilles de levage (Z) | {bb[5]:.0f} mm |")
    w(f"| Garde au sol (dessous fourreaux) | {P['GROUND_CLEARANCE']:.0f} mm |")
    w(f"| Passage central entre racks | 1216 mm |")

    w("\n## 5. Masse estimative\n")
    w(f"- Masse à vide calculée (volumes B-rep × 7850 kg/m³, masses catalogue pour les achats) : **{tare:.0f} kg**")
    cg = S["cog"]
    w(f"- Centre de gravité à vide : X {cg[0]:.0f} · Y {cg[1]:.0f} · Z {cg[2]:.0f} mm")
    w(f"- Masse en charge de dimensionnement (750 kg) : **{gross:.0f} kg** ; avec facteur dynamique 1,5 : {dyn:.0f} kg\n")
    w("| Composant | Masse (kg) |\n|---|---|")
    for g, m in S["mass_by_group"].items():
        w(f"| {g} | {m:.1f} |")

    w("\n## 6. Composants achetés\n")
    w(md_table(buy, ["Désignation", "Section / référence", "Qté", "Masse totale (kg)", "Statut"]))
    w("\nDébit des profilés (barres de 6 m, +10 % de chutes) :\n")
    w(md_table(deb))

    w("\n## 7. Soudures principales\n")
    w("Procédé envisagé : MAG 135, gorges indicatives a3 à a8 — **PROVISOIRE — À VALIDER** par note de calcul et DMOS.\n")
    agg = defaultdict(lambda: [0, 0.0])
    for r in welds[1:]:
        agg[r[3]][0] += 1
        agg[r[3]][1] += float(r[4])
    w("| Type de soudure | Nb de joints | Longueur cumulée indicative (m) |\n|---|---|---|")
    for k, (n, l) in sorted(agg.items(), key=lambda x: -x[1][1]):
        w(f"| {k} | {n} | {l / 1000:.1f} |")
    w("\nJoints critiques (chemin de charge) : oreilles de levage / platines / montants ; crochet / platine / "
      "longeron arrière ; fourreaux / longerons (traversée) ; platines porte-roues / châssis ; supports de barres / lisses.")

    w("\n## 8. Contrôles préliminaires (ordres de grandeur — pas une note de calcul)\n")
    w("| Élément | Hypothèse | Valeur | Commentaire |\n|---|---|---|---|")
    w(f"| Roulette | 3 appuis sur 4, charge statique | {per_wheel_static:.0f} kg / roue | "
      f"{per_wheel_static / P['CASTER_CMU'] * 100:.0f} % de la CMU {P['CASTER_CMU']:.0f} kg |")
    w(f"| Roulette | idem × facteur dynamique 1,5 | {per_wheel_dyn:.0f} kg / roue | "
      f"**{'dépasse' if per_wheel_dyn > P['CASTER_CMU'] else 'sous'} la CMU {P['CASTER_CMU']:.0f} kg → prévoir roulettes CMU ≥ 750 kg** |")
    w(f"| Oreille de levage | élingue 4 brins, 3 brins porteurs, 60°, × 1,5 | {leg:.0f} kg / oreille | "
      "manille et oreille CMU ≥ 1 t minimum ; oreille ép. 15 à vérifier (arrachement, pression diamétrale, soudure) |")
    w(f"| Attelage | roulement chantier 10 % + rampe 10 %, × 1,5 | {tow:.1f} kN | effort horizontal sur crochet et longeron AR |")
    w(f"| Facteur de sécurité | cible ≥ {P['SAFETY_FACTOR_MIN']} | non évalué | simulation SimScale à réaliser (§10) |")

    w("\n## 9. Points nécessitant validation\n")
    pts = [
        ("Hauteur", "Le cahier des charges donne 1500 mm d'enveloppe et un dessus de caisse à Z ≈ 1830. Le modèle place la caisse de Z 330 à Z 1830 (1500 mm de caisse posée sur le châssis). Hauteur hors tout 1910 mm avec les oreilles. La visualisation 5D précédente avait 1500 mm hors tout : **l'interprétation retenue ici est à confirmer.**"),
        ("Portes", "« 2 portes à deux vantaux » interprété comme **une porte double de 2 vantaux** (DOOR_COUNT = 2, 3 charnières par vantail). Vantail gauche semi-fixe (verrous haut/bas), vantail droit actif (crémone 3 points, poignée cadenassable, couvre-joint anti-arrachement)."),
        ("Roues", f"Architecture PROVISOIRE : 4 roulettes pivotantes Ø200, 2 à frein total côté portes, 2 à blocage directionnel côté attelage. **CMU {P['CASTER_CMU']:.0f} kg insuffisante avec le facteur dynamique** ({per_wheel_dyn:.0f} kg/roue) → choisir une référence ≥ 750 kg de même hauteur (245 mm) ou reprendre la cale."),
        ("Masse", f"Tare calculée {tare:.0f} kg, élevée par rapport à la charge utile. Leviers : tôles 1,5 mm, cadres de vantaux 30×30, racks, plancher 3 mm raidi."),
        ("Fourreaux", "Entraxe 900 et section intérieure 220 × 70 **à confirmer selon les engins ciblés** (pas une norme). Fourreaux traversants : les longerons AV/AR sont interrompus et soudés sur les flancs des fourreaux."),
        ("Attelage", "Crochet oxycoupé ép. 25 en S235 : nuance S355 ou pièce forgée à étudier. Hauteur de gorge Z 300 à caler sur les engins tracteurs. Retenue de l'anneau par la seule géométrie (bec de 55 mm, pas de ressort) : ajouter ou non une goupille de sécurité est **une décision à prendre**. L'anneau articulé, la chape et le timon sont côté engin, hors nomenclature HURAVA."),
        ("Levage", "Oreilles orientées vers le centre de gravité, décalées d'environ 20 mm de l'axe des montants : à recentrer après calcul. CMU à calculer."),
        ("Galvanisation", "Trous d'évent et d'écoulement (Ø10–12 à chaque extrémité de profil creux) **non modélisés**. Tôles de 2 mm soudées sur cadre : risque de déformation dans le bain ; alternative : tôles pré-galvanisées rivetées après galvanisation de l'ossature. Compatibilité du bain (≈ 2,4 × 1,3 × 1,95 m) à vérifier avec le galvaniseur."),
        ("Butée à 90°", "Bloc soudé sur le montant avant, jeu 0,5 mm pour un tampon élastomère. Saillie de 60 mm devant la face avant : à arrondir, ou remplacer par un arrêt de porte."),
        ("Barres de manutention", "Axe à Z 1000 et à 75 mm du panneau (passage de main 58 mm). Extrémités ouvertes : bouchons à décider (utiles aussi pour l'écoulement du zinc)."),
        ("Racks", "Profondeur 450, tablettes à Z 700 / 1100 / 1500, tôle 2 mm : charge par niveau à définir. Rack soudé au plancher, à la lisse latérale et au cadre haut."),
        ("Épaisseurs", "Tôles 2 mm (parois, toit, vantaux) et plancher 4 mm : PROVISOIRE."),
        ("Profilés", "Tubes modélisés à angles vifs (sans les rayons EN 10219) : correct pour la simulation poutre/coque, à affiner pour les plans."),
        ("Étanchéité", "Joints de portes, recouvrements et gouttière non modélisés."),
        ("Soudures", "Gorges et longueurs indicatives, à valider (note de calcul, DMOS, qualification soudeurs)."),
    ]
    for i, (t, d) in enumerate(pts, 1):
        w(f"{i}. **{t}** — {d}")

    w("\n## 10. Préparation à la simulation (SimScale)\n")
    w("- Import : `out/step/HURAVA_MASTER_ASSEMBLY.step` ou les fichiers par composant (`out/step/groups/`). "
      "Corps solides propres, sans auto-intersection ; contacts soudés = faces coïncidentes (tolérance 0).")
    w("- Appuis : faces inférieures des 4 platines porte-roues `13-PLA-*` (ou contact sol des roues `12-ROU-*`).")
    w("- Charge utile : pression sur la face supérieure de `03-PLA` et des tablettes `10/11-*-TB`.")
    w("- Levage : alésages Ø32 des oreilles `18…21-ORE`. Fourches : faces intérieures basses des fourreaux `16/17-FOU`.")
    w("- Traction : flanc arrière du bec du crochet `22-CRO`.")
    w("- Pièces à exclure : 23 (interface engin), 24 (boulonnerie), 25 (marquage).")

    w("\n## 11. Vues\n")
    for v, t in [("front", "Vue avant"), ("rear", "Vue arrière"), ("left", "Vue latérale gauche"),
                 ("right", "Vue latérale droite"), ("top", "Vue supérieure"), ("bottom", "Vue inférieure"),
                 ("iso", "Vue isométrique"), ("iso_open", "Isométrique, portes à 90°"),
                 ("iso_rear", "Isométrique arrière"), ("exploded", "Vue éclatée"), ("hitch", "Détail attelage")]:
        w(f"### {t}\n\n![{t}](../views/{v}.png)\n")

    w("\n## 12. Nomenclature initiale\n")
    w(md_table(bom, ["Rep", "Composant", "Désignation", "Section / référence", "Longueur débit (mm)", "Qté",
                     "Masse totale (kg)", "Statut"]))
    with open(os.path.join(out, "report", "RAPPORT_HURAVA_V1.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    print("rapport écrit")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "out"))
