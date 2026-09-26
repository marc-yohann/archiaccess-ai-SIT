"""Contrôles préalables à la simulation (SimScale) — ne modifient pas la géométrie.

PRE-01  Roulettes compatibles avec la charge de dimensionnement (750 kg)
PRE-02  Entraxe des fourreaux conservé PROVISOIRE (pas une norme)
PRE-03  Architecture d'attelage figée
PRE-04  Cohérence structurelle des 4 points de levage
PRE-05  Dimensions principales 2200 × 1100 × 1500 inchangées

Les calculs de PRE-01 et PRE-04 sont des ordres de grandeur (méthode simplifiée,
EN 1993-1-8 pour les soudures d'angle) : ils ne remplacent ni une note de calcul ni
la simulation. Aucune valeur n'est présentée comme certifiée.
"""
import math
from collections import OrderedDict
from params import P, ALL as PARAMS
from skeleton import SK as s
from geom import bbox
import checks as K

G = 9.81
FY, FU, BETA_W, GAMMA_M2 = 235.0, 360.0, 0.80, 1.25     # S235JR, EN 1993-1-8


def _rect_overlap(a, b):
    """Aire de recouvrement en plan de deux rectangles (x0, x1, y0, y1)."""
    dx = min(a[1], b[1]) - max(a[0], b[0])
    dy = min(a[3], b[3]) - max(a[2], b[2])
    return max(dx, 0) * max(dy, 0)


def _param(name):
    return next(p for p in PARAMS if p.name == name)


def design_loads(tare):
    gross = tare + P["PAYLOAD_DESIGN"]
    n = P["CASTER_DESIGN_SUPPORTS"]
    return dict(gross=gross, wheel_static=gross / n, wheel_design=gross * P["DYNAMIC_FACTOR"] / n,
                leg_kg=gross * P["DYNAMIC_FACTOR"] / 3 / math.sin(math.radians(60)))


def lifting_analysis(reg, tare, cog):
    """Géométrie et ordres de grandeur pour chaque point de levage."""
    L = design_loads(tare)
    F = L["leg_kg"] * G / 1000                          # kN, effort de calcul par brin (déjà × 1,5 dynamique)
    sf = P["SAFETY_FACTOR_MIN"]
    t, w, d = P["LUG_T"], P["LUG_W"], P["LUG_HOLE_D"]
    bs, bt = P["LUG_BASE"]
    d_pin = d - 4                                       # axe de manille supposé (jeu 4 mm) — PROVISOIRE
    cap = OrderedDict()
    cap["Cisaillement arrière du trou (2 plans)"] = 2 * t * (w / 2 - d / 2) * FY / math.sqrt(3) / 1000
    cap["Traction section nette"] = t * (w - d) * FY / 1000
    cap["Pression diamétrale (1,5 fy)"] = 1.5 * FY * d_pin * t / 1000
    a_lug = 6.0
    cap["Soudure oreille / platine (2 × a6 × 80)"] = 2 * a_lug * w * FU / (math.sqrt(3) * BETA_W * GAMMA_M2) / 1000
    a_base = 5.0
    cap["Soudure platine / cadre haut (a5 × 4 × 80)"] = a_base * 4 * bs * FU / (math.sqrt(3) * BETA_W * GAMMA_M2) / 1000
    util = OrderedDict((k, F * sf / v) for k, v in cap.items())

    rails = [bbox(reg.get(r).shape) for r in ("01-CH-AV", "01-CH-AR", "01-CH-G", "01-CH-D")]
    rails_top = max(b[5] for b in rails)
    rows = []
    geo_ok = True
    for code, G_ in (("FL", "18"), ("FR", "19"), ("RL", "20"), ("RR", "21")):
        plt, ore = reg.get(f"{G_}-PLT"), reg.get(f"{G_}-ORE")
        pb, ob = bbox(plt.shape), bbox(ore.shape)
        post = reg.get("01-MON-" + {"FL": "AVG", "FR": "AVD", "RL": "ARG", "RR": "ARD"}[code])
        mb = bbox(post.shape)
        area = sum(_rect_overlap(pb[:4], r[:4]) for r in rails)
        post_area = _rect_overlap(pb[:4], mb[:4])
        seated = abs(pb[4] - rails_top) < 0.01
        # Axe du trou (centre de l'oreille en plan) et excentricité par rapport à l'axe du montant
        hx, hy = (ob[0] + ob[1]) / 2, (ob[2] + ob[3]) / 2
        px, py = (mb[0] + mb[1]) / 2, (mb[2] + mb[3]) / 2
        ecc = math.hypot(hx - px, hy - py)
        # Orientation : la normale de la plus grande face plane doit être ⟂ à la direction du CdG
        f = max(ore.shape.Faces(), key=lambda f: f.Area())
        n = f.normalAt()
        dx, dy = cog[0] - hx, cog[1] - hy
        ang = math.degrees(math.asin(abs(n.x * dx + n.y * dy) / math.hypot(dx, dy)))
        hole_z = s.Z_ROOF_BOT + bt + P["LUG_HOLE_Z"]
        clear = hole_z - d / 2 - s.Z_BODY_TOP
        horiz = math.hypot(dx, dy)
        leg_len = horiz / math.cos(math.radians(60))
        ok = seated and area >= 0.5 * bs * bs and post_area > 0 and ecc <= 30 and ang <= 5 and clear > 0
        geo_ok &= ok
        rows.append(dict(code=code, area=area, area_pct=area / (bs * bs) * 100, post_area=post_area, ecc=ecc,
                         ang=ang, hole_z=hole_z, clear=clear, horiz=horiz, leg_len=leg_len, ok=ok))
    # CdG dans le quadrilatère des points de levage
    inside = s.XS0 < cog[0] < s.XS1 and s.YS0 < cog[1] < s.YS1
    return dict(F_kN=F, F_kg=L["leg_kg"], cap=cap, util=util, rows=rows, geo_ok=geo_ok and inside,
                cog_inside=inside, d_pin=d_pin)


def presim_checks(reg, tare, cog):
    R = OrderedDict()
    L = design_loads(tare)
    # PRE-01 -----------------------------------------------------------------------
    cmu = P["CASTER_CMU"]
    n = P["CASTER_DESIGN_SUPPORTS"]
    ok1 = L["wheel_design"] <= cmu
    pl = P["CASTER_PLATE"]
    R["PRE-01"] = ("Roulettes Ø200 compatibles avec 750 kg", ok1,
                   f"({tare:.0f} + 750) kg × {P['DYNAMIC_FACTOR']} / {n} appuis = {L['wheel_design']:.0f} kg/roue ≤ CMU {cmu:.0f} kg "
                   f"(taux {L['wheel_design'] / cmu * 100:.0f} %) ; statique {L['wheel_static']:.0f} kg. Ancienne CMU 500 kg : "
                   f"taux {L['wheel_design'] / 500 * 100:.0f} % → insuffisante. Géométrie retenue : Ø{P['CASTER_D']:.0f} × {P['CASTER_W']:.0f}, "
                   f"H {P['CASTER_H']:.0f}, platine {pl[0]:.0f}×{pl[1]:.0f}×{pl[2]:.0f}, 4×M{P['CASTER_BOLT_D']:.0f}")
    # PRE-02 -----------------------------------------------------------------------
    fp = _param("FORK_POCKET_PITCH")
    pk = [bbox(p.shape) for p in reg.parts if p.ref.endswith("-FOU")]
    pitch = abs((pk[1][0] + pk[1][1]) / 2 - (pk[0][0] + pk[0][1]) / 2)
    ok2 = fp.status == "PROVISOIRE" and abs(pitch - 900) < 0.01 and "pas une norme" in fp.note
    R["PRE-02"] = ("Entraxe fourreaux 900 mm PROVISOIRE", ok2,
                   f"entraxe modélisé {pitch:.0f} mm, statut {fp.status} — valeur de travail, non déclarée standard")
    # PRE-03 -----------------------------------------------------------------------
    hs = _param("HITCH_SIDES")
    det, ok3 = [], hs.status == "FIGÉ" and _param("HITCH_ARCHITECTURE").status == "FIGÉ"
    for sd in ("G", "D"):
        cro, plt, lat = reg.get(f"22-CRO-{sd}"), reg.get(f"22-PLT-{sd}"), reg.get(f"01-LAT-{sd}")
        tra = reg.get(f"01-TRA-{sd}")
        ti = reg.get("01-TRA-I1" if sd == "G" else f"01-TRA-I{len(P['CHASSIS_CROSS_X'])}")
        b = bbox(cro.shape)
        on_face = b[1] <= s.X_LEFT + 0.01 if sd == "G" else b[0] >= s.X_RIGHT - 0.01
        chain = (plt.shape.distance(tra.shape) < 0.01 and cro.shape.distance(plt.shape) < 0.01
                 and lat.shape.distance(tra.shape) < 0.01 and lat.shape.distance(ti.shape) < 0.01)
        axis = abs((b[2] + b[3]) / 2 - s.Y_MID) < 0.01
        ok3 &= on_face and chain and axis
        det.append(f"{sd} : face latérale {'✓' if on_face else '✗'}, axe Y {(b[2] + b[3]) / 2:.0f}, "
                   f"chaîne crochet → platine → traverse → longeron → traverse I {'✓' if chain else '✗'}")
    R["PRE-03"] = ("Architecture d'attelage figée", ok3, "statut FIGÉ ; " + " ; ".join(det))
    # PRE-04 -----------------------------------------------------------------------
    lf = lifting_analysis(reg, tare, cog)
    umax = max(lf["util"].values())
    ok4 = lf["geo_ok"] and umax <= 1.0
    worst = max(lf["util"], key=lf["util"].get)
    R["PRE-04"] = ("Cohérence structurelle des 4 points de levage", ok4,
                   f"assise sur nœud cadre haut / montant ✓ ; excentricité trou / axe montant "
                   f"{max(r['ecc'] for r in lf['rows']):.1f} mm ; écart plan d'oreille / direction du CdG "
                   f"{max(r['ang'] for r in lf['rows']):.1f}° ; effort de calcul {lf['F_kg']:.0f} kg/brin ; "
                   f"taux maxi {umax * 100:.0f} % ({worst}) avec γ = {P['SAFETY_FACTOR_MIN']}")
    # PRE-05 -----------------------------------------------------------------------
    b = K.group_bb(reg.parts, ["03", "04", "05", "06"])
    dims = (b[1] - b[0], b[3] - b[2], b[5] - b[4])
    ok5 = all(abs(a - e) < 0.01 for a, e in zip(dims, (2200, 1100, 1500)))
    R["PRE-05"] = ("Dimensions principales inchangées", ok5, f"{dims[0]:.1f} × {dims[1]:.1f} × {dims[2]:.1f} mm")
    return R, lf, L


# ---------------------------------------------------------------------------------
# Paramètres PROVISOIRES à valider avant export SimScale
# ---------------------------------------------------------------------------------
# A = bloquant (modifie rigidité, résistance, appuis ou charges du modèle de calcul)
# B = à valider mais sans effet sur la simulation structurelle globale
SIMSCALE = {
    "PANEL_T": ("A", "Rigidité des parois, contreventement de la caisse"),
    "ROOF_T": ("A", "Rigidité du toit, diaphragme horizontal"),
    "FLOOR_T": ("A", "Plancher porteur de la charge utile"),
    "DOOR_SKIN_T": ("B", "Masse des vantaux ; hors chemin de charge principal"),
    "CHASSIS_CROSS_X": ("A", "Portées du plancher et appuis du châssis"),
    "ROOF_BOW_X": ("A", "Raidissage du toit"),
    "SIDE_RAIL_Z": ("A", "Position de la reprise des barres de manutention"),
    "REAR_RAIL_Z": ("A", "Raidissage de la paroi arrière"),
    "REAR_MID_POST_X": ("A", "Raidissage de la paroi arrière"),
    "DOOR_GAP_SIDE": ("B", "Jeux de fonctionnement"), "DOOR_GAP_CENTER": ("B", "Jeux de fonctionnement"),
    "DOOR_GAP_BOTTOM": ("B", "Jeux de fonctionnement"), "DOOR_GAP_TOP": ("B", "Jeux de fonctionnement"),
    "HINGE_AXIS_X": ("B", "Cinématique de porte"), "HINGE_AXIS_Y": ("B", "Cinématique de porte"),
    "HINGE_KNUCKLE_OD": ("B", "Détail de charnière"), "HINGE_KNUCKLE_LEN": ("B", "Détail de charnière"),
    "HINGE_Z_MARGIN": ("B", "Détail de charnière"), "DOOR_STOP_Z": ("B", "Position de butée"),
    "HANDLING_BAR_Z": ("A", "Point d'application de l'effort de poussée manuelle"),
    "HANDLING_BAR_STANDOFF": ("A", "Bras de levier de l'effort de poussée sur les supports"),
    "HANDLING_BAR_SUPPORT_PITCH": ("A", "Portée de la barre entre supports"),
    "HANDLING_BAR_SUPPORT": ("A", "Section des supports de barre"),
    "RACK_DEPTH": ("A", "Géométrie et masse des racks, position des charges de tablettes"),
    "RACK_Y_RANGE": ("A", "Portée des tablettes"),
    "RACK_SHELF_Z": ("A", "Hauteur des charges de tablettes (CdG chargé)"),
    "RACK_SHELF_T": ("A", "Tablettes porteuses"),
    "CASTER_D": ("B", "Appui ponctuel en simulation"), "CASTER_W": ("B", "Appui ponctuel en simulation"),
    "CASTER_H": ("A", "Chaîne de cotes cale / platine ; à figer avec la référence"),
    "CASTER_OFFSET": ("B", "Cinématique de pivot"),
    "CASTER_PLATE": ("A", "Zone d'appui des roues sur la platine porte-roue"),
    "CASTER_BOLT_PITCH": ("A", "Zone d'appui et perçages de la platine porte-roue"),
    "CASTER_BOLT_D": ("B", "Assemblage démontable"),
    "CASTER_AXIS_INSET": ("A", "Position des appuis (conditions aux limites)"),
    "CASTER_CMU": ("A", "Critère de vérification des roues (référence catalogue à choisir)"),
    "CASTER_DESIGN_SUPPORTS": ("A", "Hypothèse d'appui (3 roues porteuses) des cas de charge roulage"),
    "CASTER_MASS": ("B", "Masse ajoutée"),
    "WHEEL_SUPPORT_PLATE_T": ("A", "Rigidité de la platine porte-roue"),
    "WHEEL_SPACER_T": ("A", "Dépend de CASTER_H"),
    "FORK_POCKET_PITCH": ("A", "Appuis du cas de charge « levage par fourches » — pas une norme"),
    "FORK_POCKET_W": ("A", "Section des fourreaux"), "FORK_POCKET_H": ("A", "Section des fourreaux"),
    "FORK_POCKET_T": ("A", "Section des fourreaux"),
    "LUG_T": ("A", "Oreille de levage"), "LUG_W": ("A", "Oreille de levage"), "LUG_HOLE_D": ("A", "Oreille / manille"),
    "LUG_HOLE_Z": ("A", "Bras de levier sur la platine"), "LUG_BASE": ("A", "Assise sur le cadre haut"),
    "ROOF_NOTCH": ("B", "Découpe de toit aux angles"),
    "HOOK_T": ("A", "Section du crochet"), "HOOK_THROAT_Z": ("A", "Hauteur d'application de la traction"),
    "HOOK_THROAT_W": ("B", "Forme de gorge"), "HOOK_TIP_H": ("B", "Retenue géométrique de l'anneau"),
    "HOOK_TIP_W": ("A", "Section du bec (effort de traction)"),
    "RING_R": ("B", "Interface engin, hors modèle de calcul"), "RING_r": ("B", "Interface engin, hors modèle de calcul"),
    "RING_PIN_D": ("B", "Interface engin, hors modèle de calcul"),
}

# Données d'entrée de simulation non portées par un paramètre géométrique
SIMSCALE_INPUTS = [
    ("Répartition de la charge utile", "750 kg : part sur le plancher / part sur les 6 tablettes, et charge maximale par tablette"),
    ("Effort de traction", "valeur d'essai au crochet (ordre de grandeur actuel ≈ 4 kN × 1,5) et angle de traction"),
    ("Effort de poussée manuelle", "effort horizontal sur une barre de manutention (valeur ergonomique à fixer)"),
    ("Configuration de levage", "élingue 4 brins, angle minimal (60° retenu), 3 brins porteurs"),
    ("Levage par fourches", "longueur d'engagement et position des fourches dans les fourreaux"),
    ("Matériau", "S235JR : E = 210 GPa, ν = 0,3, fy = 235 MPa ; coefficient de sécurité cible 1,5"),
    ("Modélisation des soudures", "liaison collée (bonded) aux faces coïncidentes ou coques + poutres"),
    ("Trous d'évent de galvanisation", "non modélisés — sans effet global, à ajouter avant plans"),
]


def provisional_rows():
    rows = []
    for p in PARAMS:
        if p.status != "PROVISOIRE":
            continue
        cat, why = SIMSCALE.get(p.name, ("A", "Non classé — à examiner"))
        rows.append([p.name, p.value, p.unit, "Bloquant SimScale" if cat == "A" else "Non bloquant", why, p.note])
    rows.sort(key=lambda r: (r[3] != "Bloquant SimScale", r[0]))
    return rows
