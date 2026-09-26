"""HURAVA V1 — build CAO paramétrique complet.

Usage :  python build.py [--out out] [--fast]

Construit le modèle phase par phase (cahier des charges §24), contrôle chaque phase,
assemble HURAVA_MASTER_ASSEMBLY puis exporte STEP / GLB / nomenclatures / rapport.
"""
import argparse, csv, json, math, os, sys, time
from collections import OrderedDict, defaultdict
import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
from params import P, ALL as PARAMS
from skeleton import SK as s
from geom import Registry, bbox, V, rotate_z
import components as C
import checks as K
import presim as PS

GROUPS = ["00_MASTER_SKELETON", "01_CHASSIS", "02_SECONDARY_STRUCTURE", "03_FLOOR", "04_ROOF", "05_SIDE_PANELS",
          "06_REAR_PANEL", "07_FRONT_DOORS", "08_DOOR_HINGES", "09_LOCKING_SYSTEM", "10_RACK_LEFT",
          "11_RACK_RIGHT", "12_WHEELS", "13_WHEEL_SUPPORTS", "14_HANDLING_BAR_LEFT", "15_HANDLING_BAR_RIGHT",
          "16_FORK_POCKET_LEFT", "17_FORK_POCKET_RIGHT", "18_LIFTING_POINT_FL", "19_LIFTING_POINT_FR",
          "20_LIFTING_POINT_RL", "21_LIFTING_POINT_RR", "22_HITCH_HOOK", "23_ARTICULATED_TOWING_RING",
          "24_FASTENERS_HARDWARE", "25_LOGO"]

PHASES = [
    ("PHASE 1", "MASTER SKELETON", None),
    ("PHASE 2", "CHÂSSIS", C.phase_chassis),
    ("PHASE 3", "STRUCTURE", C.phase_structure),
    ("PHASE 4", "ENVELOPPE", C.phase_envelope),
    ("PHASE 5", "PORTES", C.phase_doors),
    ("PHASE 6", "RACKS", C.phase_racks),
    ("PHASE 7", "ROUES", C.phase_wheels),
    ("PHASE 8", "BARRES DE MANUTENTION", C.phase_bars),
    ("PHASE 9", "FOURREAUX", C.phase_pockets),
    ("PHASE 10", "POINTS DE LEVAGE", C.phase_lifting),
    ("PHASE 11", "ATTELAGE", C.phase_hitch),
    ("PHASE 12", "ASSEMBLY", None),
    ("PHASE 13", "DÉTAILS ESTHÉTIQUES", C.phase_logo),
    ("PHASE 14", "VALIDATION AUTOMATIQUE", None),
]

EXPLODE = {  # décalages de vue éclatée (mm)
    "01": (0, 0, 0), "02": (0, 0, 0), "03": (0, 0, 180), "04": (0, 0, 650), "05_G": (-450, 0, 0),
    "05_D": (450, 0, 0), "06": (0, 450, 0), "07": (0, -700, 0), "08": (0, -500, 0), "09": (0, -850, 0),
    "10": (-120, 0, 320), "11": (120, 0, 320), "12": (0, 0, -520), "13": (0, 0, -260), "14": (-750, 0, 0),
    "15": (750, 0, 0), "16": (0, 0, -380), "17": (0, 0, -380), "18": (0, 0, 900), "19": (0, 0, 900),
    "20": (0, 0, 900), "21": (0, 0, 900), "22_G": (-450, 0, -120), "22_D": (450, 0, -120), "23_G": (-800, 0, -120), "23_D": (800, 0, -120), "24": (0, 0, -520),
    "25": (0, 0, 0),
}


def explode_offset(p):
    g = p.group[:2]
    if g == "05":
        return EXPLODE["05_G" if p.ref.endswith("G") else "05_D"]
    if g == "25":
        return EXPLODE["07"] if p.moving else EXPLODE["06"]
    if g in ("22", "23"):
        return EXPLODE[f"{g}_{p.ref[-1]}"]
    if g == "24":
        return EXPLODE["12"]
    return EXPLODE[g]


class Log:
    def __init__(self):
        self.lines = []

    def __call__(self, txt=""):
        print(txt, flush=True)
        self.lines.append(txt)


def ok(b):
    return "✅ OK" if b else "❌ ÉCHEC"


def fmt_bb(b):
    return f"X {b[0]:.1f}…{b[1]:.1f} | Y {b[2]:.1f}…{b[3]:.1f} | Z {b[4]:.1f}…{b[5]:.1f}"


# =====================================================================================
def run_phase_checks(reg, new, log, name):
    """Contrôles génériques après chaque phase : validité, interférences, emprise."""
    bad = [p.ref for p in new if not p.shape.isValid()]
    log(f"- Corps créés : {len(new)} — géométrie valide : {ok(not bad)} {bad if bad else ''}")
    others = [p for p in reg.parts if p not in new]
    hits = K.interferences(new) + (K.interferences(new, others) if others else [])
    log(f"- Collisions (volume commun > {K.VOL_TOL} mm³) : {ok(not hits)}"
        + ("".join(f"\n    - {a} ∩ {b} = {v:.1f} mm³" for a, b, v in hits) if hits else ""))
    if new:
        b = K._union_bb([bbox(p.shape) for p in new])
        log(f"- Emprise : {fmt_bb(b)}")
    return not bad and not hits


def phase_specific(reg, tag, log):
    parts = reg.parts
    res = []
    if tag == "PHASE 2":
        b = K.group_bb(parts, ["01"])
        res.append(("Châssis dans l'enveloppe X/Y", b[0] >= 0 and b[1] <= s.L and b[2] >= 0 and b[3] <= s.W, fmt_bb(b)))
        res.append(("Dessus châssis = 330", abs(max(bbox(p.shape)[5] for p in parts if p.ref.startswith("01-LON")) - s.Z_CH_TOP) < 1e-6, ""))
    if tag == "PHASE 4":
        b = K.group_bb(parts, ["03", "04", "05", "06"])
        res.append(("Enveloppe 2200 × 1100 × 1500",
                    abs(b[1] - b[0] - 2200) < 0.01 and abs(b[3] - b[2] - 1100) < 0.01 and abs(b[5] - b[4] - 1500) < 0.01,
                    f"{b[1]-b[0]:.1f} × {b[3]-b[2]:.1f} × {b[5]-b[4]:.1f}"))
    if tag == "PHASE 5":
        skins = [p for p in parts if p.group.startswith("07") and "parement" in p.name]
        res.append(("2 vantaux sur la face avant (Y≈0)", len(skins) == 2 and all(bbox(p.shape)[2] >= -0.01 and bbox(p.shape)[3] <= 2.01 for p in skins), f"{len(skins)} vantaux"))
        res.append(("3 charnières par vantail", sum(1 for p in parts if p.ref.startswith("08-CHG") and p.ref.endswith("-F")) == 3 and sum(1 for p in parts if p.ref.startswith("08-CHD") and p.ref.endswith("-F")) == 3, ""))
    if tag == "PHASE 6":
        z = (s.XS0 + s.mw + P["RACK_DEPTH"] + 1, s.XS1 - s.mw - P["RACK_DEPTH"] - 1, 75, s.YS1 - s.sw - 1, s.Z_FLOOR_TOP + 1, s.Z_TOPRAIL_BOT - 1)
        fz = K.free_zone(parts, z)
        res.append(("Passage central libre", not fz, f"zone X {z[0]:.0f}…{z[1]:.0f} (largeur {z[1]-z[0]:.0f} mm) {fz}"))
    if tag == "PHASE 7":
        w = [p for p in parts if p.group.startswith("12")]
        zmin = min(bbox(p.shape)[4] for p in w)
        res.append(("4 roues au sol (Z min = 0)", len(w) == 4 and abs(zmin) < 0.01, f"{len(w)} roues, Z min {zmin:.2f}"))
    if tag == "PHASE 8":
        for p in parts:
            if p.ref.endswith("-BAR"):
                b = bbox(p.shape)
                res.append((f"{p.ref} horizontale, L = 900", abs(b[5] - b[4] - P['HANDLING_BAR_DIAMETER']) < 0.01 and abs(b[3] - b[2] - 900) < 0.01, fmt_bb(b)))
    if tag == "PHASE 9":
        f = [p for p in parts if p.ref.endswith("-FOU")]
        res.append(("2 fourreaux, dessous = garde au sol 250", len(f) == 2 and all(abs(bbox(p.shape)[4] - s.Z_LOWEST) < 0.01 for p in f), ""))
    if tag == "PHASE 10":
        o = [p for p in parts if p.ref.endswith("-ORE")]
        res.append(("4 oreilles au-dessus du toit", len(o) == 4 and all(bbox(p.shape)[4] >= s.Z_ROOF_BOT for p in o), ""))
    if tag == "PHASE 11":
        for sd in P["HITCH_SIDES"]:
            b = bbox(reg.get(f"22-CRO-{sd}").shape)
            on_face = b[1] <= s.X_LEFT + 0.01 if sd == "G" else b[0] >= s.X_RIGHT - 0.01
            res.append((f"Crochet {sd} sur la face latérale 1100", on_face and abs((b[2] + b[3]) / 2 - s.Y_MID) < 0.01, fmt_bb(b)))
    for n, r, d in res:
        log(f"- {n} : {ok(r)} {d}")
    return all(r for _, r, _ in res)


# =====================================================================================
def final_validation(reg, log):
    parts = reg.parts
    R = OrderedDict()
    g = lambda pre: [p for p in parts if p.group.startswith(pre)]

    # CHECK 01
    b = K.group_bb(parts, ["03", "04", "05", "06"])
    dims = (b[1] - b[0], b[3] - b[2], b[5] - b[4])
    R["CHECK 01"] = ("Dimensions principales 2200 × 1100 × 1500", all(abs(a - e) < 0.01 for a, e in zip(dims, (2200, 1100, 1500))),
                     f"enveloppe de caisse {dims[0]:.1f} × {dims[1]:.1f} × {dims[2]:.1f} mm (Z {b[4]:.0f}→{b[5]:.0f})")
    # CHECK 02
    skins = [p for p in g("07") if "parement" in p.name]
    R["CHECK 02"] = ("2 portes sur la face avant 2200", len(skins) == 2 and all(bbox(p.shape)[3] <= 2.01 for p in skins),
                     f"{len(skins)} vantaux, plan Y = 0…2")
    # CHECK 03
    bars = [p for p in parts if p.ref.endswith("-BAR")]
    bl = [bbox(p.shape) for p in bars]
    c3 = len(bars) == 2 and any(x[1] < s.X_LEFT for x in bl) and any(x[0] > s.X_RIGHT for x in bl)
    R["CHECK 03"] = ("2 barres sur les faces latérales 1100", c3, "; ".join(f"{p.ref}: X {x[0]:.1f}…{x[1]:.1f}" for p, x in zip(bars, bl)))
    # CHECK 04
    D, t, L = P["HANDLING_BAR_DIAMETER"], P["HANDLING_BAR_THICKNESS"], P["HANDLING_BAR_LENGTH"]
    vth = math.pi / 4 * (D ** 2 - (D - 2 * t) ** 2) * L
    c4 = all(abs(x[1] - x[0] - D) < 0.01 and abs(x[3] - x[2] - L) < 0.01 and abs(p.volume - vth) / vth < 1e-3 for p, x in zip(bars, bl))
    R["CHECK 04"] = ("Barres Ø33,7 × 4 × 900", c4, f"volume {bars[0].volume:.0f} mm³ / théorique {vth:.0f} mm³")
    # CHECK 05
    wh = g("12")
    R["CHECK 05"] = ("4 roues", len(wh) == 4, f"{len(wh)} roulettes Ø{P['CASTER_D']:.0f}")
    # CHECK 06
    fo = [p for p in parts if p.ref.endswith("-FOU")]
    fb = [bbox(p.shape) for p in fo]
    c6 = len(fo) == 2 and all(x[5] <= s.Z_CH_TOP + 0.01 and abs(x[3] - x[2] - s.W) < 0.01 for x in fb)
    R["CHECK 06"] = ("2 fourreaux sous le châssis", c6, f"entraxe {abs((fb[1][0]+fb[1][1])/2-(fb[0][0]+fb[0][1])/2):.0f} mm, Z {fb[0][4]:.0f}…{fb[0][5]:.0f}")
    # CHECK 07
    lug = [p for p in parts if p.ref.endswith("-ORE")]
    R["CHECK 07"] = ("4 points de levage au-dessus", len(lug) == 4 and all(bbox(p.shape)[4] >= s.Z_ROOF_BOT for p in lug),
                     f"Z max {max(bbox(p.shape)[5] for p in lug):.0f} mm")
    # CHECK 08 — attelage sur les faces latérales 1100 (décision utilisateur, remplace la face arrière du CdC §11)
    sides = P["HITCH_SIDES"]
    hks = {sd: reg.get(f"22-CRO-{sd}") for sd in sides}
    c8, d8 = True, []
    for sd, hk in hks.items():
        hb = bbox(hk.shape)
        on = hb[1] <= s.X_LEFT + 0.01 if sd == "G" else hb[0] >= s.X_RIGHT - 0.01
        c8 &= on and abs((hb[2] + hb[3]) / 2 - s.Y_MID) < 0.01
        d8.append(f"{sd} : X {hb[0]:.0f}…{hb[1]:.0f}, axe Y {(hb[2] + hb[3]) / 2:.0f}")
    rear_hooks = [p.ref for p in g("22") if bbox(p.shape)[3] > s.Y_REAR + 0.01]
    R["CHECK 08"] = ("Attelage sur les faces latérales 1100", c8 and not rear_hooks, " ; ".join(d8) + " ; aucun crochet en face arrière")
    # CHECK 09 — crochet ouvert vers le haut + anneau articulé, retenue géométrique (chaque côté)
    pts, h = C.hook_profile()
    tip_up = h["zt"] > h["zf"]
    spheres = [p.ref for p in g("22") + g("23") for f in p.shape.Faces() if f.geomType() == "SPHERE"]
    c9, d9 = tip_up and not spheres, []
    for sd, hk in hks.items():
        ring = reg.get(f"23-ANN-{sd}")
        n = -1 if sd == "G" else 1                               # direction de traction (vers l'engin)
        no_clash = K.common_volume(ring.shape, hk.shape) <= K.VOL_TOL
        pulled = K.common_volume(ring.shape.translate(V(n * 40, 0, 0)), hk.shape) > K.VOL_TOL
        lifted_small = K.common_volume(ring.shape.translate(V(n * 40, 0, 30)), hk.shape) > K.VOL_TOL
        lifted_big = K.common_volume(ring.shape.translate(V(n * 40, 0, P["HOOK_TIP_H"] + 5)), hk.shape) <= K.VOL_TOL
        c9 &= no_clash and pulled and lifted_small and lifted_big
        d9.append(f"{sd} : libre au repos {ok(no_clash)}, traction 40 mm bloquée {ok(pulled)}, soulevé 30 mm retenu {ok(lifted_small)}, "
                  f"dégagé seulement au-dessus du bec {ok(lifted_big)}")
    R["CHECK 09"] = ("Crochet vers le haut + anneau articulé", c9, f"bec +{P['HOOK_TIP_H']:.0f} mm — " + " | ".join(d9))
    # CHECK 10 / 11
    R["CHECK 10"] = ("2 racks internes", bool(g("10")) and bool(g("11")), f"{len(g('10'))} + {len(g('11'))} corps")
    nl = [sum(1 for p in g(x) if p.name == "Tablette tôle") for x in ("10", "11")]
    R["CHECK 11"] = ("3 niveaux par rack", nl == [3, 3], f"niveaux {nl}")
    # CHECK 12
    z = (s.XS0 + s.mw + P["RACK_DEPTH"] + 1, s.XS1 - s.mw - P["RACK_DEPTH"] - 1, 75, s.YS1 - s.sw - 1, s.Z_FLOOR_TOP + 1, s.Z_TOPRAIL_BOT - 1)
    fz = K.free_zone(parts, z)
    R["CHECK 12"] = ("Passage central libre", not fz, f"largeur libre {z[1]-z[0]+2:.0f} mm × hauteur {s.Z_TOPRAIL_BOT - s.Z_FLOOR_TOP:.0f} mm {fz}")
    # CHECK 13
    kw = ("moteur", "batterie", "électron", "electron", "hydraul", "led", "capteur", "vérin")
    hits = [p.ref for p in parts if any(k in (p.name + p.material + p.function).lower() for k in kw)]
    R["CHECK 13"] = ("Aucun moteur / électronique / hydraulique", not hits, str(hits) if hits else "aucun composant motorisé, électrique ou hydraulique")
    # CHECK 14
    front_bars = [p.ref for p in g("14") + g("15") if bbox(p.shape)[2] < s.Y_FRONT or bbox(p.shape)[3] > s.Y_REAR]
    R["CHECK 14"] = ("Aucune barre sur la face avant", not front_bars, str(front_bars) if front_bars else "barres et supports compris dans Y 0…1100, hors faces avant/arrière")
    # CHECK 15
    R["CHECK 15"] = ("Aucun attelage à boule", not spheres, "aucune surface sphérique dans 22/23")
    # CHECK 16
    R["CHECK 16"] = ("Aucune troisième porte", len(skins) == 2 and not any("porte" in p.name.lower() for p in parts if p.group[:2] in ("05", "06")), "")
    # CHECK 17
    sym = [("Racks", "10", "11"), ("Barres", "14", "15"), ("Fourreaux", "16", "17"), ("Levage AV", "18", "19"), ("Levage AR", "20", "21")]
    sr = [(n, K.symmetry(parts, a, b)) for n, a, b in sym]
    if set(P["HITCH_SIDES"]) == {"G", "D"}:
        sr.append(("Attelage", K.symmetry_refs(parts, ["22-PLT-G", "22-CRO-G", "01-LAT-G"], ["22-PLT-D", "22-CRO-D", "01-LAT-D"])))
    vg = sum(p.volume for p in g("07") if p.moving == "DOOR_L")
    R["CHECK 17"] = ("Symétrie gauche / droite", all(r[0] for _, r in sr), "; ".join(f"{n} {ok(r[0])}" for n, r in sr))
    # CHECK 18
    t0 = time.time()
    clash = K.interferences(parts)
    R["CHECK 18"] = ("Absence d'interférences", not clash, f"{len(parts)} corps, {len(clash)} interférence(s) {clash[:6]} ({time.time()-t0:.0f} s)")
    # CHECK 19
    sw = K.door_sweep(parts)
    sweep_ok = all(not hts for _, hts in sw)
    blocked = K.over_travel_blocked(parts)
    gap = K.stop_contact_gap(parts)
    R["CHECK 19"] = ("Portes ouvrables 0 → 90°", sweep_ok and blocked,
                     f"balayage {', '.join(f'{a}°' for a, _ in sw)} sans collision {ok(sweep_ok)} ; jeu butée à 90° = {gap:.2f} mm ; "
                     f"dépassement 92° bloqué par la butée {ok(blocked)}"
                     + ("".join(f" | {a}°: {hts}" for a, hts in sw if hts)))
    # CHECK 20 — assemblabilité : corps valides + chaque corps en contact avec au moins un autre
    invalid = [p.ref for p in parts if not p.shape.isValid()]
    floating = connectivity(parts)
    R["CHECK 20"] = ("Modèle assemblable", not invalid and not floating,
                     f"{len(parts)} corps valides {ok(not invalid)} ; chaque corps soudé, boulonné ou guidé (jeu ≤ 1 mm) sur un autre ; corps isolés : {floating if floating else 'aucun'}")
    return R


def connectivity(parts, tol=1.0):
    """Chaque corps doit toucher un autre corps, ou y être guidé avec un jeu fonctionnel ≤ tol (mm)."""
    bbs = [bbox(p.shape) for p in parts]
    iso = []
    for i, p in enumerate(parts):
        b = bbs[i]
        found = False
        for j, q in enumerate(parts):
            if i == j:
                continue
            c = bbs[j]
            if (b[0] <= c[1] + tol and c[0] <= b[1] + tol and b[2] <= c[3] + tol and c[2] <= b[3] + tol
                    and b[4] <= c[5] + tol and c[4] <= b[5] + tol):
                try:
                    if p.shape.distance(q.shape) <= tol:
                        found = True
                        break
                except Exception:
                    pass
        if not found:
            iso.append(p.ref)
    return iso


# =====================================================================================
def mass_properties(parts):
    tot, mx, my, mz = 0.0, 0.0, 0.0, 0.0
    by = defaultdict(float)
    for p in parts:
        if not p.in_bom:
            continue
        m = p.kg
        if p.mass is None:
            c = cq.Shape.centerOfMass(p.shape)
        else:
            b = p.shape.BoundingBox()
            c = V((b.xmin + b.xmax) / 2, (b.ymin + b.ymax) / 2, (b.zmin + b.zmax) / 2)
        tot += m; mx += m * c.x; my += m * c.y; mz += m * c.z
        by[p.group] += m
    return tot, (mx / tot, my / tot, mz / tot), by


def build_assembly(parts, shapes=None, offset=None, name="HURAVA_MASTER_ASSEMBLY", include_iface=True):
    shapes = shapes or {}
    top = cq.Assembly(name=name)
    top.add(cq.Assembly(name="00_MASTER_SKELETON"))
    for G in GROUPS[1:]:
        sub = cq.Assembly(name=G)
        n = 0
        for p in parts:
            if p.group != G or (not include_iface and not p.in_bom):
                continue
            sh = shapes.get(p.ref, p.shape)
            if offset:
                sh = sh.translate(V(*offset(p)))
            sub.add(sh, name=p.ref, color=cq.Color(*p.color))
            n += 1
        if n:
            top.add(sub, name=G)
    return top


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(header)
        w.writerows(rows)


def bom_rows(parts):
    agg = OrderedDict()
    for p in parts:
        if not p.in_bom:
            continue
        k = p.bom_key()
        if k not in agg:
            agg[k] = [p, 0, 0.0, []]
        agg[k][1] += 1
        agg[k][2] += p.kg
        agg[k][3].append(p.ref)
    rows = []
    for i, ((grp, name, sec, L, mat), (p, q, kg, refs)) in enumerate(agg.items(), 1):
        rows.append([f"{i:03d}", grp, name, sec, f"{L:.0f}" if L else "", mat, p.kind, q, f"{kg / q:.2f}", f"{kg:.2f}",
                     p.function, p.weldment, p.status, " ".join(refs)])
    return rows


# =====================================================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "out"))
    a = ap.parse_args()
    out = a.out
    for d in ("step", "step/groups", "glb", "bom", "report"):
        os.makedirs(os.path.join(out, d), exist_ok=True)
    log = Log()
    reg = Registry()
    t0 = time.time()
    log("# HURAVA V1 — journal de construction CAO\n")
    phase_ok = {}
    for tag, title, fn in PHASES:
        log(f"\n## {tag} — {title}\n")
        if tag == "PHASE 1":
            for k, v in s.datums.items():
                log(f"- {k} : {v}")
            res = s.check()
            for n, r, d in res:
                log(f"- Contrôle {n} : {ok(r)} ({d})")
            phase_ok[tag] = all(r for _, r, _ in res)
            if not phase_ok[tag]:
                log("ARRÊT : squelette incohérent"); sys.exit(1)
            continue
        if tag == "PHASE 12":
            log(f"- {len(reg.parts)} corps répartis en {len({p.group for p in reg.parts})} composants")
            phase_ok[tag] = True
            continue
        if tag == "PHASE 14":
            continue
        n0 = len(reg.parts)
        fn(reg)
        new = reg.parts[n0:]
        a1 = run_phase_checks(reg, new, log, title)
        a2 = phase_specific(reg, tag, log)
        phase_ok[tag] = a1 and a2
        log(f"- **Phase {'validée' if phase_ok[tag] else 'NON validée'}** ({time.time() - t0:.0f} s)")
        if not phase_ok[tag]:
            log("ARRÊT : la phase n'est pas géométriquement cohérente."); sys.exit(1)

    # ---- PHASE 14 --------------------------------------------------------------------
    log("\n## PHASE 14 — VALIDATION AUTOMATIQUE\n")
    R = final_validation(reg, log)
    log("| Contrôle | Intitulé | Résultat | Détail |\n|---|---|---|---|")
    for k, (n, r, d) in R.items():
        log(f"| {k} | {n} | {ok(r)} | {d} |")
    all_ok = all(r for _, r, _ in R.values())

    # ---- Masses ----------------------------------------------------------------------
    tot, cog, by = mass_properties(reg.parts)
    log(f"\n## Masse estimative\n\n- Masse à vide estimée : **{tot:.1f} kg**")
    log(f"- Centre de gravité à vide : X {cog[0]:.0f} · Y {cog[1]:.0f} · Z {cog[2]:.0f} mm")
    for G in GROUPS:
        if by.get(G):
            log(f"  - {G} : {by[G]:.1f} kg")

    # ---- Contrôles pré-simulation ------------------------------------------------------
    log("\n## Contrôles pré-simulation (PRE-01 … PRE-05)\n")
    PRE, LIFT, LOADS = PS.presim_checks(reg, tot, cog)
    log("| Contrôle | Intitulé | Résultat | Détail |\n|---|---|---|---|")
    for k, (n, r, d) in PRE.items():
        log(f"| {k} | {n} | {ok(r)} | {d} |")
    all_ok = all_ok and all(r for _, r, _ in PRE.values())

    # ---- Exports -----------------------------------------------------------------------
    log("\n## Exports\n")
    assy = build_assembly(reg.parts)
    assy.export(os.path.join(out, "step", "HURAVA_MASTER_ASSEMBLY.step"))
    log("- step/HURAVA_MASTER_ASSEMBLY.step (portes fermées, interface engin incluse)")
    for G in GROUPS[1:]:
        sel = [p for p in reg.parts if p.group == G]
        if sel:
            cq.exporters.export(cq.Compound.makeCompound([p.shape for p in sel]), os.path.join(out, "step", "groups", f"{G}.step"))
    log("- step/groups/*.step (un fichier par composant 01…25)")
    tol = dict(tolerance=0.4, angularTolerance=0.25)
    build_assembly(reg.parts).export(os.path.join(out, "glb", "hurava_v1_closed.glb"), **tol)
    open_sh = K.door_pose(reg.parts, 90)
    build_assembly(reg.parts, shapes=open_sh).export(os.path.join(out, "glb", "hurava_v1_open90.glb"), **tol)
    build_assembly(reg.parts, offset=explode_offset).export(os.path.join(out, "glb", "hurava_v1_exploded.glb"), **tol)
    log("- glb/hurava_v1_closed.glb, hurava_v1_open90.glb, hurava_v1_exploded.glb (visualisation)")

    # ---- Nomenclatures ---------------------------------------------------------------
    H = ["Rep", "Composant", "Désignation", "Section / référence", "Longueur débit (mm)", "Matériau", "Type", "Qté",
         "Masse unit. (kg)", "Masse totale (kg)", "Fonction", "Sous-ensemble soudé", "Statut", "Corps"]
    rows = bom_rows(reg.parts)
    write_csv(os.path.join(out, "bom", "BOM_HURAVA_V1.csv"), H, rows)
    write_csv(os.path.join(out, "bom", "PIECES_HURAVA_V1.csv"),
              ["Identifiant", "Composant", "Nom", "Matériau", "Qté", "Fonction", "Type", "Section", "Longueur (mm)",
               "Masse (kg)", "Mobile", "Sous-ensemble soudé", "Statut", "Dans BOM"],
              [[p.ref, p.group, p.name, p.material, 1, p.function, p.kind, p.section, f"{p.length:.0f}" if p.length else "",
                f"{p.kg:.3f}", p.moving or "", p.weldment, p.status, "oui" if p.in_bom else "non (interface)"] for p in reg.parts])
    buy = [r for r in rows if r[6] in ("acheté", "quincaillerie", "marquage")]
    write_csv(os.path.join(out, "bom", "ACHATS_HURAVA_V1.csv"), H, buy)
    prof = defaultdict(float)
    for p in reg.parts:
        if p.in_bom and p.kind == "profilé":
            prof[p.section] += p.length
    write_csv(os.path.join(out, "bom", "DEBIT_PROFILES_HURAVA_V1.csv"), ["Section", "Longueur totale (m)", "Barres de 6 m (≈, +10 % chutes)"],
              [[k, f"{v / 1000:.2f}", math.ceil(v * 1.1 / 6000)] for k, v in sorted(prof.items())])
    write_csv(os.path.join(out, "bom", "SOUDURES_HURAVA_V1.csv"), ["Id", "Pièce A", "Pièce B", "Type", "Longueur (mm)", "Note"],
              [[w.wid, w.a, w.b, w.kind, f"{w.length:.0f}", w.note] for w in reg.welds])
    with open(os.path.join(out, "bom", "PARAMETRES_HURAVA_V1.csv"), "w", encoding="utf-8", newline="") as f:
        wr = csv.writer(f, delimiter=";")
        wr.writerow(["Paramètre", "Valeur", "Unité", "Statut", "Note"])
        for p in PARAMS:
            wr.writerow([p.name, p.value, p.unit, p.status + (" — À VALIDER" if p.status == "PROVISOIRE" else ""), p.note])
    write_csv(os.path.join(out, "bom", "PROVISOIRES_AVANT_SIMSCALE.csv"),
              ["Paramètre", "Valeur", "Unité", "Catégorie", "Effet sur la simulation", "Note"], PS.provisional_rows())
    log("- bom/BOM_HURAVA_V1.csv, PIECES, ACHATS, DEBIT_PROFILES, SOUDURES, PARAMETRES, PROVISOIRES_AVANT_SIMSCALE")

    summary = dict(total_mass=tot, cog=cog, mass_by_group=dict(by), n_parts=len(reg.parts), n_bom=len(rows),
                   welds=len(reg.welds), weld_length=sum(w.length for w in reg.welds), checks={k: [n, r, d] for k, (n, r, d) in R.items()},
                   presim={k: [n, r, d] for k, (n, r, d) in PRE.items()}, lifting=LIFT, loads=LOADS,
                   phases=phase_ok, all_ok=all_ok, build_s=time.time() - t0,
                   overall_bb=K._union_bb([bbox(p.shape) for p in reg.parts if p.in_bom]),
                   bom=[dict(zip(H, r)) for r in rows], profiles={k: v for k, v in prof.items()})
    with open(os.path.join(out, "report", "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=1, default=str)
    with open(os.path.join(out, "report", "BUILD_LOG.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(log.lines) + "\n")
    log(f"\nTerminé en {time.time() - t0:.0f} s — validation globale : {ok(all_ok)}")
    return 0 if all_ok else 2


if __name__ == "__main__":
    sys.exit(main())
