"""Construction des composants HURAVA V1, phase par phase (cahier des charges §24).

Chaque fonction `phase_xx(reg)` ajoute ses pièces au registre à partir du squelette
maître (SK) et des paramètres (P). Aucune cote n'est codée en dur hors paramètres,
sauf les petites cotes de détail explicitement commentées « détail ».
"""
import math
import cadquery as cq
from params import P
from skeleton import SK
from geom import (Part, box, rhs, cyl, tube, prism_yz, prism_xy, rotate_z, mirror_x,
                  C_GALVA, C_SHEET, C_FLOOR, C_DARK, C_RUBBER, C_ZINC, C_YELLOW, C_RED,
                  C_IFACE, C_LOGO, S235, S235_GALVA, V)

s = SK
MAIN = f"Tube rect. {s.mh:.0f}×{s.mw:.0f}×{s.mt:.0f}"
SEC = f"Tube carré {s.sw:.0f}×{s.sw:.0f}×{s.st:.0f}"
LOC = f"Tube carré {s.lw:.0f}×{s.lw:.0f}×{s.lt:.0f}"
GUS = f"Gousset {P['GUSSET_SIZE']:.0f}×{P['GUSSET_SIZE']:.0f}×{P['GUSSET_T']:.0f}"
CAISSE = "A — caisse mécano-soudée"


def pocket_ranges():
    c = s.X_MID
    half = P["FORK_POCKET_PITCH"] / 2
    w = P["FORK_POCKET_W"] / 2
    return [(c - half - w, c - half + w), (c + half - w, c + half + w)]


def gusset_xy(corner, dx, dy, z0):
    """Gousset triangulaire horizontal : angle droit en `corner`, côtés dirigés (dx, dy)."""
    g = P["GUSSET_SIZE"]
    x, y = corner
    pts = [(x, y), (x + dx * g, y), (x, y + dy * g)]
    return prism_xy(pts, z0, z0 + P["GUSSET_T"])


# =====================================================================================
# PHASE 2 — 01_CHASSIS (châssis + cadre principal 60×40×3)
# =====================================================================================
def phase_chassis(reg):
    G = "01_CHASSIS"
    z0, z1 = s.Z_CH_BOT, s.Z_CH_TOP
    pr = pocket_ranges()
    # Longerons AV/AR interrompus par les fourreaux (fourreaux traversants)
    cuts = [s.XS0, pr[0][0], pr[0][1], pr[1][0], pr[1][1], s.XS1]
    segs = [(cuts[0], cuts[1]), (cuts[2], cuts[3]), (cuts[4], cuts[5])]
    for side, (y0, y1) in (("AV", (s.YS0, s.YS0 + s.mw)), ("AR", (s.YS1 - s.mw, s.YS1))):
        for i, (a, b) in enumerate(segs, 1):
            reg.add(Part(f"01-LON-{side}-{i}", G, f"Longeron {side} tronçon {i}", S235_GALVA,
                         "Longeron de châssis, reprise plancher et fourreaux",
                         rhs("x", a, b, y0, y1, z0, z1, s.mt), "profilé", MAIN, b - a,
                         weldment=CAISSE))
    # Traverses d'extrémité et intermédiaires (selon Y, entre longerons)
    ty0, ty1 = s.YS0 + s.mw, s.YS1 - s.mw
    trav = [("G", s.XS0, s.XS0 + s.mw), ("D", s.XS1 - s.mw, s.XS1)]
    for i, xc in enumerate(P["CHASSIS_CROSS_X"], 1):
        trav.append((f"I{i}", xc - s.mw / 2, xc + s.mw / 2))
    for tag, a, b in trav:
        reg.add(Part(f"01-TRA-{tag}", G, "Traverse de châssis" + (" d'extrémité" if tag in "GD" else " intermédiaire"),
                     S235_GALVA, "Traverse de châssis, appui plancher / reprise roues et attelage",
                     rhs("y", a, b, ty0, ty1, z0, z1, s.mt), "profilé", MAIN, ty1 - ty0, weldment=CAISSE))
        for side in ("AV", "AR"):
            reg.weld(f"01-TRA-{tag}", f"01-LON-{side}", "angle a3 périphérique", 2 * (s.mh + s.mw))
    for i in range(2):
        for side in ("AV", "AR"):
            reg.weld(f"01-LON-{side}", f"16/17 fourreau {i + 1}", "angle a4 périphérique ×2 faces", 2 * 2 * (s.mh + s.mw))
    # Longerons d'attelage : de la traverse d'extrémité à la 1re traverse intermédiaire, dans l'axe Y_MID
    xi = P["CHASSIS_CROSS_X"]
    for side in P["HITCH_SIDES"]:
        a, b = ((s.XS0 + s.mw, xi[0] - s.mw / 2) if side == "G" else (xi[-1] + s.mw / 2, s.XS1 - s.mw))
        reg.add(Part(f"01-LAT-{side}", G, "Longeron d'attelage", S235_GALVA,
                     "Reprise de l'effort de traction du crochet latéral vers le châssis",
                     rhs("x", a, b, s.Y_MID - s.mw / 2, s.Y_MID + s.mw / 2, z0, z1, s.mt), "profilé", MAIN, b - a,
                     weldment=CAISSE))
        reg.weld(f"01-LAT-{side}", f"01-TRA-{side} + 01-TRA-I", "angle a4 périphérique ×2 extrémités",
                 2 * 2 * (s.mh + s.mw))
    # Goussets d'angle de châssis (sous plancher, plan XY)
    zg = z0
    for tag, corner, dx, dy in (("AVG", (s.XS0 + s.mw, s.YS0 + s.mw), 1, 1),
                                ("AVD", (s.XS1 - s.mw, s.YS0 + s.mw), -1, 1),
                                ("ARG", (s.XS0 + s.mw, s.YS1 - s.mw), 1, -1),
                                ("ARD", (s.XS1 - s.mw, s.YS1 - s.mw), -1, -1)):
        reg.add(Part(f"01-GOU-{tag}", G, "Gousset d'angle de châssis", S235_GALVA,
                     "Rigidification des nœuds d'angle du châssis", gusset_xy(corner, dx, dy, zg),
                     "plat", GUS, 0, weldment=CAISSE))
        reg.weld(f"01-GOU-{tag}", "longeron + traverse", "angle a3", 2 * P["GUSSET_SIZE"])

    # Cadre principal : 4 montants d'angle (40 vus de face, 60 vus de côté)
    for tag, (x0, x1), (y0, y1) in (("AVG", (s.XS0, s.XS0 + s.mw), (s.YS0, s.YS0 + s.mh)),
                                    ("AVD", (s.XS1 - s.mw, s.XS1), (s.YS0, s.YS0 + s.mh)),
                                    ("ARG", (s.XS0, s.XS0 + s.mw), (s.YS1 - s.mh, s.YS1)),
                                    ("ARD", (s.XS1 - s.mw, s.XS1), (s.YS1 - s.mh, s.YS1))):
        reg.add(Part(f"01-MON-{tag}", G, "Montant d'angle", S235_GALVA,
                     "Montant du cadre principal — chemin de charge des points de levage",
                     rhs("z", x0, x1, y0, y1, s.Z_CH_TOP, s.Z_TOPRAIL_BOT, s.mt), "profilé", MAIN,
                     s.Z_TOPRAIL_BOT - s.Z_CH_TOP, weldment=CAISSE))
        reg.weld(f"01-MON-{tag}", "châssis (nœud d'angle)", "angle a4 périphérique", 2 * (s.mh + s.mw))
        reg.weld(f"01-MON-{tag}", "cadre haut", "angle a4 périphérique", 2 * (s.mh + s.mw))
    # Cadre haut (60 vertical)
    zt0, zt1 = s.Z_TOPRAIL_BOT, s.Z_ROOF_BOT
    reg.add(Part("01-CH-AV", G, "Traverse haute avant", S235_GALVA, "Cadre haut — linteau de portes",
                 rhs("x", s.XS0, s.XS1, s.YS0, s.YS0 + s.mw, zt0, zt1, s.mt), "profilé", MAIN, s.XS1 - s.XS0,
                 weldment=CAISSE))
    reg.add(Part("01-CH-AR", G, "Traverse haute arrière", S235_GALVA, "Cadre haut arrière",
                 rhs("x", s.XS0, s.XS1, s.YS1 - s.mw, s.YS1, zt0, zt1, s.mt), "profilé", MAIN, s.XS1 - s.XS0,
                 weldment=CAISSE))
    for tag, (x0, x1) in (("G", (s.XS0, s.XS0 + s.mw)), ("D", (s.XS1 - s.mw, s.XS1))):
        reg.add(Part(f"01-CH-{tag}", G, "Traverse haute latérale", S235_GALVA, "Cadre haut latéral",
                     rhs("y", x0, x1, s.YS0 + s.mw, s.YS1 - s.mw, zt0, zt1, s.mt), "profilé", MAIN,
                     s.YS1 - s.YS0 - 2 * s.mw, weldment=CAISSE))
        for side in ("AV", "AR"):
            reg.weld(f"01-CH-{tag}", f"01-CH-{side}", "angle a3 périphérique", 2 * (s.mh + s.mw))


# =====================================================================================
# PHASE 3 — 02_SECONDARY_STRUCTURE (40×40×3)
# =====================================================================================
def phase_structure(reg):
    G = "02_SECONDARY_STRUCTURE"
    h = s.sw / 2
    # Lisses latérales (reprise des supports de barres de manutention)
    zc = P["SIDE_RAIL_Z"]
    for tag, (x0, x1) in (("G", (s.XS0, s.XS0 + s.sw)), ("D", (s.XS1 - s.sw, s.XS1))):
        y0, y1 = s.YS0 + s.mh, s.YS1 - s.mh
        reg.add(Part(f"02-LIS-{tag}", G, "Lisse latérale", S235_GALVA,
                     "Raidisseur de panneau latéral + reprise des supports de barre de manutention",
                     rhs("y", x0, x1, y0, y1, zc - h, zc + h, s.st), "profilé", SEC, y1 - y0, weldment=CAISSE))
        reg.weld(f"02-LIS-{tag}", "montants d'angle", "angle a3 ×2 extrémités", 2 * 4 * s.sw)
    # Montant arrière intermédiaire
    xc = P["REAR_MID_POST_X"]
    reg.add(Part("02-MON-AR", G, "Montant arrière intermédiaire", S235_GALVA, "Raidisseur panneau arrière",
                 rhs("z", xc - h, xc + h, s.YS1 - s.sw, s.YS1, s.Z_FLOOR_TOP, s.Z_TOPRAIL_BOT, s.st),
                 "profilé", SEC, s.Z_TOPRAIL_BOT - s.Z_FLOOR_TOP, weldment=CAISSE))
    reg.weld("02-MON-AR", "plancher + 01-CH-AR", "angle a3 ×2 extrémités", 2 * 4 * s.sw)
    # Lisse arrière (2 tronçons)
    zr = P["REAR_RAIL_Z"]
    for i, (a, b) in enumerate(((s.XS0 + s.mw, xc - h), (xc + h, s.XS1 - s.mw)), 1):
        reg.add(Part(f"02-LIS-AR-{i}", G, "Lisse arrière", S235_GALVA, "Raidisseur panneau arrière",
                     rhs("x", a, b, s.YS1 - s.sw, s.YS1, zr - h, zr + h, s.st), "profilé", SEC, b - a,
                     weldment=CAISSE))
        reg.weld(f"02-LIS-AR-{i}", "montant", "angle a3 ×2 extrémités", 2 * 4 * s.sw)
    # Traverses de toit
    for i, xb in enumerate(P["ROOF_BOW_X"], 1):
        reg.add(Part(f"02-TT-{i}", G, "Traverse de toit", S235_GALVA, "Raidisseur de toit",
                     rhs("y", xb - h, xb + h, s.YS0 + s.mw, s.YS1 - s.mw, s.Z_ROOF_BOT - s.sw, s.Z_ROOF_BOT, s.st),
                     "profilé", SEC, s.YS1 - s.YS0 - 2 * s.mw, weldment=CAISSE))
        reg.weld(f"02-TT-{i}", "01-CH-AV / 01-CH-AR", "angle a3 ×2 extrémités", 2 * 4 * s.sw)
    # Goussets de reprise d'attelage (longeron d'attelage / traverse d'extrémité)
    for side in P["HITCH_SIDES"]:
        xt, dx = (s.XS0 + s.mw, 1) if side == "G" else (s.XS1 - s.mw, -1)
        for tag, y, dy in (("1", s.Y_MID - s.mw / 2, -1), ("2", s.Y_MID + s.mw / 2, 1)):
            reg.add(Part(f"02-GOU-ATT-{side}{tag}", G, "Gousset de reprise d'attelage", S235_GALVA,
                         "Transfert de l'effort de traction de la traverse d'extrémité vers le longeron d'attelage",
                         gusset_xy((xt, y), dx, dy, s.Z_CH_BOT), "plat", GUS, 0, weldment=CAISSE))
            reg.weld(f"02-GOU-ATT-{side}{tag}", f"01-TRA-{side} + 01-LAT-{side}", "angle a3", 2 * P["GUSSET_SIZE"])


# =====================================================================================
# PHASE 4 — ENVELOPPE : 03_FLOOR, 04_ROOF, 05_SIDE_PANELS, 06_REAR_PANEL
# =====================================================================================
def bar_support_y():
    p = P["HANDLING_BAR_SUPPORT_PITCH"] / 2
    return (s.Y_MID - p, s.Y_MID + p)


def phase_envelope(reg):
    # Plancher
    fl = box(s.XS0, s.XS1, s.YS0, s.YS1, s.Z_CH_TOP, s.Z_FLOOR_TOP)
    for (x0, x1) in ((s.XS0, s.XS0 + s.mw), (s.XS1 - s.mw, s.XS1)):
        for (y0, y1) in ((s.YS0, s.YS0 + s.mh), (s.YS1 - s.mh, s.YS1)):
            fl = fl.cut(box(x0, x1, y0, y1, s.Z_CH_TOP - 1, s.Z_FLOOR_TOP + 1))
    reg.add(Part("03-PLA", "03_FLOOR", "Plancher", S235_GALVA, "Plancher structurel, reprise charge utile",
                 fl, "tôle", f"Tôle ép. {s.t_floor:.0f}", 0, C_FLOOR, weldment=CAISSE,
                 status="PROVISOIRE (ép. 4, larmée à valider)"))
    reg.weld("03-PLA", "châssis + fourreaux", "angle a3 discontinue 50/150", 2 * (s.XS1 - s.XS0) + 5 * (s.YS1 - s.YS0),
             "longueur effective ≈ 25 %")
    # Toit
    n = P["ROOF_NOTCH"]
    rf = box(s.X_LEFT, s.X_RIGHT, s.Y_FRONT, s.Y_REAR, s.Z_ROOF_BOT, s.Z_BODY_TOP)
    for x0, x1 in ((s.X_LEFT, s.X_LEFT + n), (s.X_RIGHT - n, s.X_RIGHT)):
        for y0, y1 in ((s.Y_FRONT, s.Y_FRONT + n), (s.Y_REAR - n, s.Y_REAR)):
            rf = rf.cut(box(x0, x1, y0, y1, s.Z_ROOF_BOT - 1, s.Z_BODY_TOP + 1))
    reg.add(Part("04-TOI", "04_ROOF", "Tôle de toit", S235_GALVA, "Couverture, étanchéité",
                 rf, "tôle", f"Tôle ép. {s.t_roof:.0f}", 0, C_SHEET, weldment=CAISSE, status="PROVISOIRE (ép.)"))
    reg.weld("04-TOI", "cadre haut + traverses de toit", "bouchons Ø8 pas 150 + cordon périphérique", 2 * (2200 + 1100))
    # Panneaux latéraux (fentes de passage des supports de barre)
    sup_t, sup_h = P["HANDLING_BAR_SUPPORT"]
    zb = P["HANDLING_BAR_Z"]
    for tag, (x0, x1) in (("G", (s.X_LEFT, s.X_LEFT + s.t_panel)), ("D", (s.X_RIGHT - s.t_panel, s.X_RIGHT))):
        pn = box(x0, x1, s.Y_FRONT, s.Y_REAR, s.Z_CH_TOP, s.Z_ROOF_BOT)
        for ys in bar_support_y():
            pn = pn.cut(box(x0 - 1, x1 + 1, ys - sup_t / 2 - 1, ys + sup_t / 2 + 1, zb - sup_h / 2 - 1, zb + sup_h / 2 + 1))
        reg.add(Part(f"05-PAN-{tag}", "05_SIDE_PANELS", "Panneau latéral " + ("gauche" if tag == "G" else "droit"),
                     S235_GALVA, "Paroi latérale (face 1100) porteuse de la barre de manutention",
                     pn, "tôle", f"Tôle ép. {s.t_panel:.0f}", 0, C_SHEET, weldment=CAISSE, status="PROVISOIRE (ép.)"))
        reg.weld(f"05-PAN-{tag}", "montants + lisse + châssis", "bouchons Ø8 pas 150 + cordon périphérique",
                 2 * (1100 + 1500))
    # Panneau arrière
    reg.add(Part("06-PAN-AR", "06_REAR_PANEL", "Panneau arrière", S235_GALVA, "Paroi arrière",
                 box(s.XS0, s.XS1, s.YS1, s.Y_REAR, s.Z_CH_TOP, s.Z_ROOF_BOT), "tôle", f"Tôle ép. {s.t_panel:.0f}",
                 0, C_SHEET, weldment=CAISSE, status="PROVISOIRE (ép.)"))
    reg.weld("06-PAN-AR", "montants + lisses + châssis", "bouchons Ø8 pas 150 + cordon périphérique", 2 * (2196 + 1500))


# =====================================================================================
# PHASE 5 — PORTES : 07_FRONT_DOORS, 08_DOOR_HINGES, 09_LOCKING_SYSTEM
# =====================================================================================
def door_geometry():
    gs, gc = P["DOOR_GAP_SIDE"], P["DOOR_GAP_CENTER"]
    x0 = s.X_OPEN0 + gs
    x1 = s.X_MID - gc / 2
    z0 = s.Z_FLOOR_TOP + P["DOOR_GAP_BOTTOM"]
    z1 = s.Z_TOPRAIL_BOT - P["DOOR_GAP_TOP"]
    return x0, x1, z0, z1


def hinge_axis(side):
    ax = s.X_LEFT + P["HINGE_AXIS_X"]
    if side == "D":
        ax = s.X_RIGHT - P["HINGE_AXIS_X"]
    return ax, s.Y_FRONT + P["HINGE_AXIS_Y"]


def hinge_z():
    _, _, z0, z1 = door_geometry()
    m = P["HINGE_Z_MARGIN"]
    return (z0 + m, (z0 + z1) / 2, z1 - m)


def _leaf_left():
    """Vantail gauche fermé (repère global). Retourne dict nom→shape."""
    x0, x1, z0, z1 = door_geometry()
    t = P["DOOR_SKIN_T"]
    yk0, yk1 = s.Y_FRONT, s.Y_FRONT + t
    yf0, yf1 = yk1, yk1 + s.sw
    w = s.sw
    zm = (z0 + z1) / 2
    return {
        "Tôle de parement": (box(x0, x1, yk0, yk1, z0, z1), "tôle", f"Tôle ép. {t:.0f}", 0, C_SHEET),
        "Montant côté charnières": (rhs("z", x0, x0 + w, yf0, yf1, z0, z1, s.st), "profilé", SEC, z1 - z0, C_GALVA),
        "Montant côté battement": (rhs("z", x1 - w, x1, yf0, yf1, z0, z1, s.st), "profilé", SEC, z1 - z0, C_GALVA),
        "Traverse basse": (rhs("x", x0 + w, x1 - w, yf0, yf1, z0, z0 + w, s.st), "profilé", SEC, x1 - x0 - 2 * w, C_GALVA),
        "Traverse haute": (rhs("x", x0 + w, x1 - w, yf0, yf1, z1 - w, z1, s.st), "profilé", SEC, x1 - x0 - 2 * w, C_GALVA),
        "Traverse intermédiaire": (rhs("x", x0 + w, x1 - w, yf0, yf1, zm - w / 2, zm + w / 2, s.st), "profilé", SEC,
                                   x1 - x0 - 2 * w, C_GALVA),
    }


def _hinge_left(zh):
    """Charnière gauche à la cote zh : (partie fixe, partie mobile, axe)."""
    ax, ay = hinge_axis("G")
    ro = P["HINGE_KNUCKLE_OD"] / 2
    rb = P["HINGE_PIN_D"] / 2 + 0.5
    kl = P["HINGE_KNUCKLE_LEN"]
    x0, _, _, _ = door_geometry()
    # Partie fixe : nœud inférieur + patte soudée sur la face avant du montant d'angle
    fixed = cyl(ro, (ax, ay, zh - kl), (ax, ay, zh)).fuse(
        box(ax - 10, s.XS0 + s.mw - 2, ay, s.YS0, zh - kl, zh))
    fixed = fixed.cut(cyl(rb, (ax, ay, zh - kl - 1), (ax, ay, zh + 1)))
    # Partie mobile : nœud supérieur + penture soudée sur la tôle de parement
    strap_len = 120.0  # détail : longueur de penture sur le vantail
    mob = cyl(ro, (ax, ay, zh), (ax, ay, zh + kl)).fuse(
        box(ax, x0 + strap_len, s.Y_FRONT - 6, s.Y_FRONT, zh, zh + kl))
    mob = mob.cut(cyl(rb, (ax, ay, zh - 1), (ax, ay, zh + kl + 1)))
    # Axe Ø16 + tête
    pin = cyl(P["HINGE_PIN_D"] / 2, (ax, ay, zh - kl - 4), (ax, ay, zh + kl)).fuse(
        cyl(13, (ax, ay, zh + kl), (ax, ay, zh + kl + 4)))
    return fixed, mob, pin


def _stop_left():
    """Butée positive d'ouverture à 90° (fixée sur le montant d'angle avant)."""
    ax, ay = hinge_axis("G")
    _, _, z0, z1 = door_geometry()
    h1, h2, h3 = hinge_z()
    zc = (h2 + h3) / 2
    hh = 20.0  # détail : demi-hauteur de la butée
    # Au vantail ouvert à 90°, la face extérieure du parement est à x = ax + (Y_FRONT - ay)
    x_contact = ax + (s.Y_FRONT - ay) - 0.5          # 0,5 mm : tampon élastomère non modélisé
    body = box(ax - 10, x_contact - 3.5, ay - 40, s.YS0, zc - hh, zc + hh)
    nose = box(x_contact - 3.5, x_contact, ay - 40, ay - 5, zc - hh, zc + hh)
    return body.fuse(nose)


def phase_doors(reg):
    GD, GH, GL = "07_FRONT_DOORS", "08_DOOR_HINGES", "09_LOCKING_SYSTEM"
    xm = s.X_MID
    for side in ("G", "D"):
        mv = "DOOR_L" if side == "G" else "DOOR_R"
        wm = "B — vantail mécano-soudé " + ("gauche" if side == "G" else "droit")
        tr = (lambda sh: sh) if side == "G" else (lambda sh: mirror_x(sh, xm))
        for i, (nm, (sh, kind, sec, L, col)) in enumerate(_leaf_left().items(), 1):
            reg.add(Part(f"07-V{side}-{i}", GD, f"Vantail {side} — {nm}", S235_GALVA,
                         "Vantail de porte avant (face 2200)", tr(sh), kind, sec, L, col, moving=mv, weldment=wm))
        reg.weld(f"07-V{side}", "cadre + parement", "angle a3 cadre ; bouchons Ø8 pas 150 parement",
                 2 * 1423 * 2 + 3 * 970 * 2)
        for k, zh in enumerate(hinge_z(), 1):
            fx, mb, pin = _hinge_left(zh)
            reg.add(Part(f"08-CH{side}{k}-F", GH, "Charnière — nœud fixe + patte", S235_GALVA,
                         "Articulation de vantail, partie dormante soudée au montant", tr(fx), "pièce découpée",
                         "Nœud Ø30 + patte 20", 0, C_GALVA, weldment=CAISSE))
            reg.add(Part(f"08-CH{side}{k}-M", GH, "Charnière — nœud mobile + penture", S235_GALVA,
                         "Articulation de vantail, partie ouvrante soudée au vantail", tr(mb), "pièce découpée",
                         "Nœud Ø30 + penture 6", 0, C_GALVA, moving=mv, weldment=wm))
            reg.add(Part(f"08-AX{side}{k}", GH, "Axe de charnière Ø16", "Acier inox A2 (PROVISOIRE)",
                         "Axe d'articulation démontable", tr(pin), "quincaillerie", "Ø16 × 118", 118, C_ZINC,
                         status="PROVISOIRE (matière)"))
            reg.weld(f"08-CH{side}{k}-F", "01-MON-AV", "angle a4 3 côtés", 3 * 55)
            reg.weld(f"08-CH{side}{k}-M", f"07-V{side}", "angle a4 3 côtés", 2 * 120 + 55)
        reg.add(Part(f"08-BUT{side}", GH, "Butée d'ouverture 90°", S235_GALVA,
                     "Butée mécanique positive à 90° (tampon élastomère à ajouter)", tr(_stop_left()),
                     "pièce découpée", "Plat 40 découpé", 0, C_DARK, weldment=CAISSE))
        reg.weld(f"08-BUT{side}", "01-MON-AV", "angle a4 périphérique", 2 * (40 + 26))

    # ---- Système de verrouillage --------------------------------------------------
    x0, x1, z0, z1 = door_geometry()
    rr = P["LOCK_ROD_D"] / 2
    yi = s.Y_FRONT + P["DOOR_SKIN_T"] + s.sw          # face intérieure du vantail
    yr = yi + 3 + rr                                   # axe des tringles (3 mm de jeu)

    def rods(xr, zsplit_lo, zsplit_hi, tag, mv, wm):
        # tringle haute : de zsplit_hi jusqu'à engagement 20 mm dans la gâche haute
        reg.add(Part(f"09-TRH-{tag}", GL, "Tringle haute Ø14", S235_GALVA, "Verrouillage haut dans gâche",
                     cyl(rr, (xr, yr, zsplit_hi), (xr, yr, s.Z_TOPRAIL_BOT + 20)), "profilé", "Rond Ø14",
                     s.Z_TOPRAIL_BOT + 20 - zsplit_hi, C_ZINC, moving=mv))
        reg.add(Part(f"09-TRB-{tag}", GL, "Tringle basse Ø14", S235_GALVA, "Verrouillage bas dans gâche",
                     cyl(rr, (xr, yr, z0), (xr, yr, zsplit_lo)), "profilé", "Rond Ø14", zsplit_lo - z0, C_ZINC,
                     moving=mv))
        # Guides soudés sur le cadre du vantail (2 par tringle)
        for j, zg in enumerate((z0 + 60, zsplit_lo - 80, zsplit_hi + 80, z1 - 60), 1):
            g = box(xr - 15, xr + 15, yi, yr + rr + 4, zg - 12, zg + 12).cut(
                cyl(rr + 0.75, (xr, yr, zg - 13), (xr, yr, zg + 13)))
            reg.add(Part(f"09-GUI-{tag}{j}", GL, "Guide de tringle", S235_GALVA, "Guidage de tringle", g,
                         "pièce découpée", "Bloc 30×24 percé Ø15.5", 0, C_GALVA, moving=mv, weldment=wm))
        # Gâches renforcées (soudées sous la traverse haute et sur le plancher)
        gh = box(xr - 12, xr + 12, s.YS0 + s.mw, yr + rr + 8, s.Z_TOPRAIL_BOT - 28, s.Z_TOPRAIL_BOT).cut(
            cyl(rr + 1, (xr, yr, s.Z_TOPRAIL_BOT - 29), (xr, yr, s.Z_TOPRAIL_BOT + 1)))
        reg.add(Part(f"09-GAH-{tag}", GL, "Gâche haute renforcée", S235_GALVA, "Réception tringle haute",
                     gh, "pièce découpée", "Bloc 24 percé Ø16", 0, C_DARK, weldment=CAISSE))
        gb = box(xr - 12, xr + 12, yi, yr + rr + 8, s.Z_FLOOR_TOP, s.Z_FLOOR_TOP + 20).cut(
            cyl(rr + 1, (xr, yr, s.Z_FLOOR_TOP - 1), (xr, yr, s.Z_FLOOR_TOP + 21)))
        reg.add(Part(f"09-GAB-{tag}", GL, "Gâche basse renforcée", S235_GALVA, "Réception tringle basse",
                     gb, "pièce découpée", "Bloc 24 percé Ø16", 0, C_DARK, weldment=CAISSE))
        reg.weld(f"09-GAH-{tag}", "01-CH-AV", "angle a4 3 côtés", 3 * 24)
        reg.weld(f"09-GAB-{tag}", "03-PLA", "angle a4 3 côtés", 3 * 24)

    # Vantail gauche (semi-fixe) : 2 verrous à tringle manuels
    zl = (z0 + z1) / 2
    rods(x1 - 25, zl - 60, zl + 60, "G", "DOOR_L", "B — vantail mécano-soudé gauche")
    # Vantail droit (actif) : boîtier de crémone + poignée extérieure
    xr_d = xm + (xm - (x1 - 25))
    zc = P["HANDLING_BAR_Z"] + 100   # détail : crémone à 1100 du sol
    rods(xr_d, zc - 90, zc + 90, "D", "DOOR_R", "B — vantail mécano-soudé droit")
    case = box(xr_d - 22, xr_d + 40, yi, yi + 30, zc - 90, zc + 90)
    reg.add(Part("09-SER", GL, "Boîtier de crémone-serrure", "Acier zingué (achat)",
                 "Serrure mécanique à cylindre, entraînement des tringles", case, "acheté",
                 "Crémone 3 points à cylindre", 0, C_DARK, mass=2.2, moving="DOOR_R", status="PROVISOIRE (référence)"))
    hx = xr_d + 40 + 25       # détail : poignée décalée pour ne pas couvrir le couvre-joint
    handle = box(hx - 16, hx + 16, s.Y_FRONT - 8, s.Y_FRONT, zc - 90, zc + 90).fuse(
        box(hx - 12, hx + 12, s.Y_FRONT - 42, s.Y_FRONT - 8, zc - 10, zc + 10)).fuse(
        box(hx - 12, hx + 12, s.Y_FRONT - 42, s.Y_FRONT - 30, zc - 90, zc - 10))
    reg.add(Part("09-POI", GL, "Poignée palette extérieure cadenassable", "Acier zingué (achat)",
                 "Manœuvre de la crémone depuis l'extérieur", handle, "acheté", "Poignée palette + rosace",
                 0, C_YELLOW, mass=1.1, moving="DOOR_R", status="PROVISOIRE (référence)"))
    # Couvre-joint anti-arrachement (sur vantail actif, recouvre le vantail semi-fixe)
    cj = box(x1 - 27, xm + (xm - x1) + 32, s.Y_FRONT - 3, s.Y_FRONT, z0 + 20, z1 - 20)
    reg.add(Part("09-CJ", GL, "Couvre-joint anti-pince / anti-arrachement", S235_GALVA,
                 "Protège le battement contre l'effraction par levier", cj, "plat", "Plat 65×3", z1 - z0 - 40,
                 C_GALVA, moving="DOOR_R", weldment="B — vantail mécano-soudé droit"))
    reg.weld("09-CJ", "07-VD", "bouchons Ø8 pas 150", z1 - z0)


# =====================================================================================
# PHASE 6 — RACKS 10_RACK_LEFT / 11_RACK_RIGHT
# =====================================================================================
def _rack_left():
    xa = s.XS0 + s.mw                      # contre la lisse et le cadre haut latéraux
    xb = xa + P["RACK_DEPTH"]
    ya, yb = P["RACK_Y_RANGE"]
    w, t = s.lw, s.lt
    tsh = P["RACK_SHELF_T"]
    out = []
    posts = [(xa, ya), (xb - w, ya), (xa, yb - w), (xb - w, yb - w)]
    for i, (x, y) in enumerate(posts, 1):
        out.append((f"MT{i}", "Montant de rack", rhs("z", x, x + w, y, y + w, s.Z_FLOOR_TOP, s.Z_ROOF_BOT, t),
                    "profilé", LOC, s.Z_ROOF_BOT - s.Z_FLOOR_TOP, C_GALVA))
    for k, zt in enumerate(P["RACK_SHELF_Z"], 1):
        zb0, zb1 = zt - tsh - w, zt - tsh
        out.append((f"N{k}-L1", "Longeron de tablette", rhs("y", xa, xa + w, ya + w, yb - w, zb0, zb1, t),
                    "profilé", LOC, yb - ya - 2 * w, C_GALVA))
        out.append((f"N{k}-L2", "Longeron de tablette", rhs("y", xb - w, xb, ya + w, yb - w, zb0, zb1, t),
                    "profilé", LOC, yb - ya - 2 * w, C_GALVA))
        out.append((f"N{k}-T1", "Traverse de tablette", rhs("x", xa + w, xb - w, ya, ya + w, zb0, zb1, t),
                    "profilé", LOC, xb - xa - 2 * w, C_GALVA))
        out.append((f"N{k}-T2", "Traverse de tablette", rhs("x", xa + w, xb - w, yb - w, yb, zb0, zb1, t),
                    "profilé", LOC, xb - xa - 2 * w, C_GALVA))
        pl = box(xa, xb, ya, yb, zt - tsh, zt)
        for (x, y) in posts:
            pl = pl.cut(box(x - 0.5, x + w + 0.5, y - 0.5, y + w + 0.5, zt - tsh - 1, zt + 1))
        out.append((f"N{k}-TB", "Tablette tôle", pl, "tôle", f"Tôle ép. {tsh:.0f}", 0, C_SHEET))
    return out


def phase_racks(reg):
    for side, G in (("G", "10_RACK_LEFT"), ("D", "11_RACK_RIGHT")):
        for tag, nm, sh, kind, sec, L, col in _rack_left():
            if side == "D":
                sh = mirror_x(sh, s.X_MID)
            reg.add(Part(f"{G[:2]}-R{side}-{tag}", G, nm, S235_GALVA,
                         f"Rack intérieur {'gauche' if side == 'G' else 'droit'} — 3 niveaux", sh, kind, sec, L, col,
                         weldment=CAISSE, status="PROVISOIRE (profondeur, cotes de niveaux)"))
        reg.weld(f"{G[:2]}-R{side}", "plancher, lisse latérale, cadre haut", "angle a3", 4 * 4 * 30 + 4 * 2 * 30)
        reg.weld(f"{G[:2]}-R{side}", "niveaux", "angle a2,5", 3 * (4 * 4 * 30))


# =====================================================================================
# PHASE 7 — ROUES 12_WHEELS + 13_WHEEL_SUPPORTS (+ boulonnerie 24)
# =====================================================================================
def caster_positions():
    i = P["CASTER_AXIS_INSET"]
    return {"AVG": (s.X_LEFT + i, s.Y_FRONT + i), "AVD": (s.X_RIGHT - i, s.Y_FRONT + i),
            "ARG": (s.X_LEFT + i, s.Y_REAR - i), "ARD": (s.X_RIGHT - i, s.Y_REAR - i)}


def _bolt_xy(ax, ay):
    bx, by = P["CASTER_BOLT_PITCH"]
    return [(ax + dx * bx / 2, ay + dy * by / 2) for dx in (-1, 1) for dy in (-1, 1)]


def _caster(ax, ay, trail, braked):
    D, Wd, H, off = P["CASTER_D"], P["CASTER_W"], P["CASTER_H"], P["CASTER_OFFSET"]
    pl, pw, pt = P["CASTER_PLATE"]
    r = D / 2
    top = box(ax - pl / 2, ax + pl / 2, ay - pw / 2, ay + pw / 2, H - pt, H)
    for (x, y) in _bolt_xy(ax, ay):
        top = top.cut(cyl(6.5, (x, y, H - pt - 1), (x, y, H + 1)))
    parts = [top, cyl(48, (ax, ay, H - pt - 25), (ax, ay, H - pt))]                  # couronne de pivot
    wx = ax + trail * off
    for sy in (-1, 1):
        y0 = ay + sy * (Wd / 2 + 4)
        parts.append(box(min(ax, wx) - 25, max(ax, wx) + 25, y0, y0 + sy * 8, r - 15, H - pt - 25))  # flasque
    parts.append(cyl(r, (wx, ay - Wd / 2, r), (wx, ay + Wd / 2, r)))                      # bandage + jante
    parts.append(cyl(10, (wx, ay - Wd / 2 - 14, r), (wx, ay + Wd / 2 + 14, r)))          # axe de roue
    if braked:
        parts.append(box(wx - trail * 20, wx - trail * 70, ay - 12, ay + 12, r + 60, r + 72))   # pédale
    sh = parts[0]
    for p in parts[1:]:
        sh = sh.fuse(p)
    return sh


def phase_wheels(reg):
    Gw, Gs, Gf = "12_WHEELS", "13_WHEEL_SUPPORTS", "24_FASTENERS_HARDWARE"
    H = P["CASTER_H"]
    tp, tsp = P["WHEEL_SUPPORT_PLATE_T"], P["WHEEL_SPACER_T"]
    assert abs(H + tsp + tp - s.Z_CH_BOT) < 1e-6, "chaîne de cotes roue / châssis incohérente"
    xi1 = P["CHASSIS_CROSS_X"][0] + s.mw / 2
    for tag, (ax, ay) in caster_positions().items():
        right = tag.endswith("D")
        rear = tag.startswith("AR")
        trail = -1 if right else 1                      # déport vers l'intérieur
        braked = not rear                               # PROVISOIRE : freins côté portes
        # Platine porte-roue : du nœud d'angle jusqu'à la 1re traverse intermédiaire
        px0, px1 = (s.XS0, xi1) if not right else (s.L - xi1, s.XS1)
        py0, py1 = (s.YS0, 2 * ay - s.YS0) if not rear else (2 * ay - s.YS1, s.YS1)
        plate = box(px0, px1, py0, py1, s.Z_CH_BOT - tp, s.Z_CH_BOT)
        spacer = box(ax - 75, ax + 75, ay - 60, ay + 60, H, H + tsp)
        for (x, y) in _bolt_xy(ax, ay):
            plate = plate.cut(cyl(6.5, (x, y, s.Z_CH_BOT - tp - 1), (x, y, s.Z_CH_BOT + 1)))
            spacer = spacer.cut(cyl(6.5, (x, y, H - 1), (x, y, H + tsp + 1)))
        reg.add(Part(f"13-PLA-{tag}", Gs, "Platine porte-roue", S235_GALVA,
                     "Support de roulette soudé sous longeron, traverse d'extrémité et traverse intermédiaire",
                     plate, "plat", f"Tôle ép. {tp:.0f}", 0, C_GALVA, weldment=CAISSE))
        reg.add(Part(f"13-CAL-{tag}", Gs, "Cale de roulette", S235_GALVA, "Rattrapage de hauteur roulette",
                     spacer, "plat", f"Plat ép. {tsp:.0f}", 0, C_GALVA, weldment=CAISSE,
                     status="PROVISOIRE (dépend de la roulette retenue)"))
        reg.weld(f"13-PLA-{tag}", "longeron + traverses", "angle a4 3 côtés", (px1 - px0) + 2 * (py1 - py0))
        reg.weld(f"13-CAL-{tag}", f"13-PLA-{tag}", "angle a4 périphérique", 2 * (150 + 120))
        nm = "Roulette pivotante Ø200 à frein total + blocage directionnel" if braked else "Roulette pivotante Ø200 à blocage directionnel"
        reg.add(Part(f"12-ROU-{tag}", Gw, nm, "Acier zingué / caoutchouc plein (achat)",
                     "Roulage chantier, orientation" + (", immobilisation" if braked else ", marche en ligne"),
                     _caster(ax, ay, trail, braked), "acheté",
                     f"Ø{P['CASTER_D']:.0f}×{P['CASTER_W']:.0f} H{H:.0f} CMU {P['CASTER_CMU']:.0f} kg",
                     0, C_RUBBER, mass=P["CASTER_MASS"], status="PROVISOIRE (référence catalogue)"))
        for k, (x, y) in enumerate(_bolt_xy(ax, ay), 1):
            b = cyl(6, (x, y, H - P["CASTER_PLATE"][2] - 8), (x, y, s.Z_CH_BOT + 12))
            b = b.fuse(cyl(9.5, (x, y, H - P["CASTER_PLATE"][2] - 8), (x, y, H - P["CASTER_PLATE"][2])))
            b = b.fuse(cyl(9.5, (x, y, s.Z_CH_BOT), (x, y, s.Z_CH_BOT + 10)))
            reg.add(Part(f"24-VIS-{tag}{k}", Gf, "Vis H M12×50 cl. 8.8 + écrou frein + rondelle",
                         "Acier cl. 8.8 zingué", "Fixation démontable de roulette", b, "quincaillerie",
                         "M12×50", 0, C_ZINC, mass=0.075))


# =====================================================================================
# PHASE 8 — BARRES DE MANUTENTION 14 / 15
# =====================================================================================
def phase_bars(reg):
    D, t, L = P["HANDLING_BAR_DIAMETER"], P["HANDLING_BAR_THICKNESS"], P["HANDLING_BAR_LENGTH"]
    zb, so = P["HANDLING_BAR_Z"], P["HANDLING_BAR_STANDOFF"]
    st, sh = P["HANDLING_BAR_SUPPORT"]
    for side, G in (("G", "14_HANDLING_BAR_LEFT"), ("D", "15_HANDLING_BAR_RIGHT")):
        sign = -1 if side == "G" else 1
        xface = s.X_LEFT if side == "G" else s.X_RIGHT
        xs = s.XS0 if side == "G" else s.XS1            # face ext. de la lisse (derrière la tôle)
        xa = xface + sign * so
        y0, y1 = s.Y_MID - L / 2, s.Y_MID + L / 2
        bar = tube(D / 2, t, (xa, y0, zb), (xa, y1, zb))
        reg.add(Part(f"{G[:2]}-BAR", G, "Barre de manutention", S235_GALVA,
                     "Pousser / tirer / orienter HURAVA à la main", bar, "profilé",
                     f"Tube rond Ø{D}×{t}", L, C_YELLOW, weldment=CAISSE))
        for k, ys in enumerate(bar_support_y(), 1):
            sp = box(xa, xs, ys - st / 2, ys + st / 2, zb - sh / 2, zb + sh / 2).cut(
                cyl(D / 2, (xa, ys - st, zb), (xa, ys + st, zb)))
            reg.add(Part(f"{G[:2]}-SUP{k}", G, "Support de barre", S235_GALVA,
                         "Liaison barre / lisse latérale au travers du panneau", sp, "plat",
                         f"Plat {sh:.0f}×{st:.0f}", abs(xs - xa), C_GALVA, weldment=CAISSE))
            reg.weld(f"{G[:2]}-SUP{k}", "02-LIS", "angle a4 périphérique", 2 * (st + sh))
            reg.weld(f"{G[:2]}-SUP{k}", f"{G[:2]}-BAR", "angle a4 périphérique (gueule de loup)", 2 * sh + 2 * st)


# =====================================================================================
# PHASE 9 — FOURREAUX 16 / 17
# =====================================================================================
def phase_pockets(reg):
    t, H = P["FORK_POCKET_T"], P["FORK_POCKET_H"]
    z0 = s.Z_CH_TOP - H
    assert abs(z0 - s.Z_LOWEST) < 1e-6, "garde au sol ≠ dessous fourreaux"
    for i, ((x0, x1), G) in enumerate(zip(pocket_ranges(), ("16_FORK_POCKET_LEFT", "17_FORK_POCKET_RIGHT")), 1):
        reg.add(Part(f"{G[:2]}-FOU", G, "Fourreau de fourches", S235_GALVA,
                     "Manutention par chariot élévateur, ouvert AV et AR", rhs("y", x0, x1, s.Y_FRONT, s.Y_REAR, z0,
                                                                              s.Z_CH_TOP, t), "profilé",
                     f"Tube rect. {P['FORK_POCKET_W']:.0f}×{H:.0f}×{t:.0f}", s.W, C_GALVA, weldment=CAISSE,
                     status="PROVISOIRE (section, entraxe)"))
        reg.weld(f"{G[:2]}-FOU", "03-PLA", "angle a4 discontinue 50/100 ×2", 2 * s.W, "longueur effective ≈ 33 %")
        # Goussets fourreau / longerons (4 par fourreau)
        for yl, dy in ((s.YS0 + s.mw, 1), (s.YS1 - s.mw, -1)):
            for xc, dx in ((x0, -1), (x1, 1)):
                tag = f"{'AV' if dy > 0 else 'AR'}{'G' if dx < 0 else 'D'}"
                reg.add(Part(f"{G[:2]}-GOU-{tag}", G, "Gousset fourreau / longeron", S235_GALVA,
                             "Renfort d'encastrement du fourreau", gusset_xy((xc, yl), dx, dy, s.Z_CH_BOT), "plat",
                             GUS, 0, weldment=CAISSE))
                reg.weld(f"{G[:2]}-GOU-{tag}", "fourreau + longeron", "angle a3", 2 * P["GUSSET_SIZE"])


# =====================================================================================
# PHASE 10 — POINTS DE LEVAGE 18–21
# =====================================================================================
def _lug(cx, cy, angle):
    lt, lw = P["LUG_T"], P["LUG_W"]
    bs, bt = P["LUG_BASE"]
    zb = s.Z_ROOF_BOT + bt
    zc = zb + P["LUG_HOLE_Z"]
    # Profil dans le plan (u, z) puis extrusion selon l'épaisseur
    prof = (cq.Workplane("XZ", origin=(0, lt / 2, 0))
            .moveTo(-lw / 2, zb).lineTo(lw / 2, zb).lineTo(lw / 2, zc)
            .threePointArc((0, zc + lw / 2), (-lw / 2, zc)).close().extrude(lt).val())
    prof = prof.cut(cyl(P["LUG_HOLE_D"] / 2, (0, -lt, zc), (0, lt, zc)))
    prof = prof.rotate(V(0, 0, 0), V(0, 0, 1), angle).translate(V(cx, cy, 0))
    return prof


def phase_lifting(reg):
    bs, bt = P["LUG_BASE"]
    names = {"FL": ("18_LIFTING_POINT_FL", "AVG"), "FR": ("19_LIFTING_POINT_FR", "AVD"),
             "RL": ("20_LIFTING_POINT_RL", "ARG"), "RR": ("21_LIFTING_POINT_RR", "ARD")}
    for code, (G, tag) in names.items():
        right, rear = code[1] == "R", code[0] == "R"
        x0 = s.XS1 - bs if right else s.XS0
        y0 = s.YS1 - bs if rear else s.YS0
        cx, cy = x0 + bs / 2, y0 + bs / 2
        ang = math.degrees(math.atan2(s.Y_MID - cy, s.X_MID - cx))    # plan de l'oreille orienté vers le CdG
        reg.add(Part(f"{G[:2]}-PLT", G, "Platine d'oreille de levage", S235_GALVA,
                     "Répartition de l'effort de levage sur le nœud cadre haut / montant",
                     box(x0, x0 + bs, y0, y0 + bs, s.Z_ROOF_BOT, s.Z_ROOF_BOT + bt), "plat",
                     f"Plat {bs:.0f}×{bs:.0f}×{bt:.0f}", 0, C_GALVA, weldment=CAISSE))
        reg.add(Part(f"{G[:2]}-ORE", G, "Oreille de levage", S235_GALVA,
                     "Point d'élingage (manille)", _lug(cx, cy, ang), "pièce découpée",
                     f"Tôle ép. {P['LUG_T']:.0f} oxycoupée", 0, C_YELLOW, weldment=CAISSE,
                     status="PROVISOIRE (CMU à calculer)"))
        reg.weld(f"{G[:2]}-PLT", f"01-CH + 01-MON-{tag}", "angle a5 périphérique", 4 * bs)
        reg.weld(f"{G[:2]}-ORE", f"{G[:2]}-PLT", "angle a6 double (pleine pénétration à étudier)",
                 2 * (P["LUG_W"] + P["LUG_T"]))


# =====================================================================================
# PHASE 11 — ATTELAGE 22 (crochet HURAVA) + 23 (anneau articulé côté engin)
# =====================================================================================
def hook_profile():
    yb = s.YS1 + 15.0                 # détail : platine d'attelage ép. 15
    tw = P["HOOK_THROAT_W"]
    zf = P["HOOK_THROAT_Z"]
    zt = zf + P["HOOK_TIP_H"]
    y_back = yb + 30                  # détail : épaisseur du dos du crochet
    y_tip0 = y_back + tw
    y_tip1 = y_tip0 + P["HOOK_TIP_W"]
    zb = zf - 38                      # détail : hauteur de la semelle
    pts = [(yb, zb), (y_tip1, zb), (y_tip1, zt - 12), (y_tip1 - 12, zt), (y_tip0 + 7, zt),
           (y_tip0, zt - 7), (y_tip0, zf), (y_back, zf), (y_back, zf + 25), (yb, zf + 25)]
    return pts, dict(yb=yb, y_back=y_back, y_tip0=y_tip0, y_tip1=y_tip1, zf=zf, zt=zt, zb=zb)


def hitch_transform(side):
    """Passe du repère local de construction (face Y = W, centrée X_MID) à la face latérale `side`.

    Local : sortie de face vers +Y, centre en (X_MID, Y_REAR). Monde : face latérale gauche
    (X = 0, sortie vers -X) ou droite (X = L, sortie vers +X), centrée en Y_MID.
    """
    def f(sh):
        if side == "D":
            return sh.rotate(V(0, 0, 0), V(0, 0, 1), -90).translate(V(s.X_RIGHT - s.Y_REAR, s.Y_MID + s.X_MID, 0))
        return sh.rotate(V(0, 0, 0), V(0, 0, 1), 90).translate(V(s.X_LEFT + s.Y_REAR, s.Y_MID - s.X_MID, 0))
    return f


def _hitch_local():
    """Crochet + anneau construits dans le repère local (face Y = W)."""
    xm = s.X_MID
    pts, h = hook_profile()
    ht = P["HOOK_T"]
    out = {}
    out["PLT"] = box(xm - 70, xm + 70, s.YS1, h["yb"], s.Z_CH_BOT, s.Z_CH_TOP - 1)
    out["CRO"] = prism_yz(pts, xm - ht / 2, xm + ht / 2)
    R, r = P["RING_R"], P["RING_r"]
    zc = h["zf"] + r                                   # l'anneau repose sur le fond de gorge
    yc = h["y_back"] + 5 + r + R                       # brin intérieur dans la gorge, bec dans l'œil
    ring = cq.Solid.makeTorus(R, r, V(xm, yc, zc), V(0, 0, 1))
    y_out = yc + R + r
    shank = box(xm - 10, xm + 10, yc + R, y_out + 40, zc - 10, zc + 10)
    ye = y_out + 40 + 15
    eye = cyl(25, (xm - 10, ye, zc), (xm + 10, ye, zc)).fuse(box(xm - 10, xm + 10, y_out + 30, ye, zc - 12, zc + 12))
    rp = P["RING_PIN_D"] / 2
    out["ANN"] = ring.fuse(shank).fuse(eye.cut(cyl(rp + 0.5, (xm - 11, ye, zc), (xm + 11, ye, zc))))
    for sx in (-1, 1):
        out[f"CHA{'1' if sx < 0 else '2'}"] = box(xm + sx * 11, xm + sx * 23, ye - 30, ye + 45, zc - 30, zc + 30).cut(
            cyl(rp + 0.5, (xm + sx * 10, ye, zc), (xm + sx * 24, ye, zc)))
    out["AXE"] = cyl(rp, (xm - 27, ye, zc), (xm + 27, ye, zc))
    out["TIM"] = rhs("y", xm - 40, xm + 40, ye + 61, ye + 200, zc - 40, zc + 40, 5).fuse(
        box(xm - 30, xm + 30, ye + 45, ye + 61, zc - 30, zc + 30))
    return out


def phase_hitch(reg):
    """Attelage sur les faces latérales de 1100 (traction selon X, dans l'axe de la longueur)."""
    G, GR = "22_HITCH_HOOK", "23_ARTICULATED_TOWING_RING"
    ht = P["HOOK_T"]
    loc = _hitch_local()
    for side in P["HITCH_SIDES"]:
        tr = hitch_transform(side)
        cote = "gauche" if side == "G" else "droite"
        reg.add(Part(f"22-PLT-{side}", G, "Platine d'attelage", S235_GALVA,
                     f"Liaison crochet / traverse d'extrémité {cote}, dans l'axe du longeron d'attelage",
                     tr(loc["PLT"]), "plat", "Plat 140×59×15", 0, C_GALVA, weldment=CAISSE))
        reg.add(Part(f"22-CRO-{side}", G, "Crochet d'attelage ouvert vers le haut (sans ressort)", S235_GALVA,
                     f"Face latérale {cote} : réception de l'anneau articulé de l'engin — retenue par gravité (bec de 55)",
                     tr(loc["CRO"]), "pièce découpée", f"Tôle ép. {ht:.0f} oxycoupée", 0, C_RED, weldment=CAISSE,
                     status="PROVISOIRE (nuance S355 ou pièce forgée à étudier, hauteur d'attelage)"))
        reg.weld(f"22-PLT-{side}", f"01-TRA-{side} + 01-LAT-{side}", "angle a6 périphérique", 2 * (140 + 59))
        reg.weld(f"22-CRO-{side}", f"22-PLT-{side}", "angle a8 double + chanfrein (pleine pénétration à étudier)",
                 2 * 63 + 2 * ht)
        # Anneau articulé côté engin — interface, hors nomenclature HURAVA
        reg.add(Part(f"23-ANN-{side}", GR, "Anneau de traction articulé (côté engin)", "Acier forgé (interface engin)",
                     "Entre dans le crochet HURAVA ; articulation autour de l'axe transversal", tr(loc["ANN"]),
                     "interface", f"Anneau Ø{2 * (P['RING_R'] - P['RING_r']):.0f} int., section Ø{2 * P['RING_r']:.0f}",
                     0, C_IFACE, in_bom=False, status="Interface engin — hors périmètre HURAVA"))
        for k in ("CHA1", "CHA2"):
            reg.add(Part(f"23-{k}-{side}", GR, "Flasque de chape (côté engin)", "Interface engin",
                         "Chape d'articulation de l'anneau", tr(loc[k]), "interface", "", 0, C_DARK, in_bom=False))
        reg.add(Part(f"23-AXE-{side}", GR, "Axe d'articulation Ø20 (côté engin)", "Interface engin",
                     "Articulation de l'anneau", tr(loc["AXE"]), "interface", "", 0, C_ZINC, in_bom=False))
        reg.add(Part(f"23-TIM-{side}", GR, "Timon / traverse de l'engin (représentation)", "Interface engin",
                     "Repère de position de l'engin tracteur", tr(loc["TIM"]), "interface", "", 0, C_DARK,
                     in_bom=False))


# =====================================================================================
# PHASE 13 — DÉTAILS : 25_LOGO
# =====================================================================================
def phase_logo(reg):
    G = "25_LOGO"
    # Arrière : lisible depuis l'arrière (normale +Y, sens de lecture vers -X)
    pr = cq.Plane(origin=(s.X_MID, s.Y_REAR, 1560), xDir=(-1, 0, 0), normal=(0, 1, 0))
    t1 = cq.Workplane(pr).text("HURAVA", 150, 0.3, halign="center", valign="center", kind="bold").val()
    pr2 = cq.Plane(origin=(s.X_MID, s.Y_REAR, 1440), xDir=(-1, 0, 0), normal=(0, 1, 0))
    t2 = cq.Workplane(pr2).text("by ARCHIACCESS", 50, 0.3, halign="center", valign="center").val()
    reg.add(Part("25-LOG-AR", G, "Marquage HURAVA by ARCHIACCESS — face arrière", "Adhésif polymère 0,3",
                 "Identification produit", t1.fuse(t2), "marquage", "Film adhésif découpé", 0, C_LOGO, mass=0.05))
    # Avant : sur le vantail gauche, discret
    x0, x1, z0, z1 = door_geometry()
    pf = cq.Plane(origin=((x0 + x1) / 2, s.Y_FRONT, z1 - 160), xDir=(1, 0, 0), normal=(0, -1, 0))
    t3 = cq.Workplane(pf).text("HURAVA", 90, 0.3, halign="center", valign="center", kind="bold").val()
    reg.add(Part("25-LOG-AV", G, "Marquage HURAVA — vantail gauche", "Adhésif polymère 0,3",
                 "Identification produit", t3, "marquage", "Film adhésif découpé", 0, C_LOGO, mass=0.02,
                 moving="DOOR_L"))
