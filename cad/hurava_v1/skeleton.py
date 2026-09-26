"""00_MASTER_SKELETON — plans et points de référence dérivés des paramètres.

Aucune pièce ne doit utiliser de coordonnée « magique » : toutes les positions
sont calculées ici à partir de params.P, puis consommées par components.py.
"""
from dataclasses import dataclass, field
from params import P


@dataclass
class Skeleton:
    # Enveloppe
    L: float = P["HURAVA_LENGTH"]
    W: float = P["HURAVA_WIDTH"]
    H_BODY: float = P["HURAVA_BODY_HEIGHT"]
    # Plans verticaux d'enveloppe (faces extérieures)
    X_LEFT: float = 0.0
    X_RIGHT: float = P["HURAVA_LENGTH"]
    Y_FRONT: float = 0.0
    Y_REAR: float = P["HURAVA_WIDTH"]
    # Épaisseurs de peau (la structure est en retrait de la peau)
    t_panel: float = P["PANEL_T"]
    t_roof: float = P["ROOF_T"]
    t_floor: float = P["FLOOR_T"]
    # Profilés
    mh: float = P["MAIN_PROFILE_H"]
    mw: float = P["MAIN_PROFILE_W"]
    mt: float = P["MAIN_PROFILE_T"]
    sw: float = P["SEC_PROFILE"]
    st: float = P["SEC_PROFILE_T"]
    lw: float = P["LOCAL_PROFILE"]
    lt: float = P["LOCAL_PROFILE_T"]
    datums: dict = field(default_factory=dict)

    def __post_init__(self):
        s = self
        # Hauteurs
        s.Z_GROUND = 0.0
        s.Z_CH_TOP = P["CHASSIS_HEIGHT"]                 # dessus châssis = dessous plancher
        s.Z_CH_BOT = s.Z_CH_TOP - s.mh                    # dessous longerons (60 vertical)
        s.Z_LOWEST = P["GROUND_CLEARANCE"]                # dessous fourreaux
        s.Z_FLOOR_TOP = s.Z_CH_TOP + s.t_floor
        s.Z_BODY_TOP = s.Z_CH_TOP + s.H_BODY              # dessus toit = haut d'enveloppe
        s.Z_ROOF_BOT = s.Z_BODY_TOP - s.t_roof
        s.Z_TOPRAIL_BOT = s.Z_ROOF_BOT - s.mh             # cadre haut 60 vertical
        # Ligne intérieure de structure (retrait = épaisseur de peau)
        s.XS0 = s.X_LEFT + s.t_panel                      # face ext. structure gauche
        s.XS1 = s.X_RIGHT - s.t_panel                     # face ext. structure droite
        s.YS0 = s.Y_FRONT + s.t_panel                     # face ext. structure avant
        s.YS1 = s.Y_REAR - s.t_panel                      # face ext. structure arrière
        # Ouverture de porte (entre montants d'angle, 40 vus de face)
        s.X_OPEN0 = s.XS0 + s.mw
        s.X_OPEN1 = s.XS1 - s.mw
        s.Z_OPEN0 = s.Z_FLOOR_TOP
        s.Z_OPEN1 = s.Z_TOPRAIL_BOT
        s.X_MID = s.L / 2
        s.Y_MID = s.W / 2
        s.datums = {
            "Plan sol Z0": s.Z_GROUND,
            "Dessous fourreaux (garde au sol)": s.Z_LOWEST,
            "Dessous châssis": s.Z_CH_BOT,
            "Dessus châssis / dessous plancher": s.Z_CH_TOP,
            "Dessus plancher": s.Z_FLOOR_TOP,
            "Dessous cadre haut": s.Z_TOPRAIL_BOT,
            "Dessus toit (haut d'enveloppe)": s.Z_BODY_TOP,
            "Face latérale gauche X": s.X_LEFT,
            "Face latérale droite X": s.X_RIGHT,
            "Face avant (portes) Y": s.Y_FRONT,
            "Face arrière (attelage) Y": s.Y_REAR,
            "Plan de symétrie X": s.X_MID,
            "Ouverture porte X": (s.X_OPEN0, s.X_OPEN1),
            "Ouverture porte Z": (s.Z_OPEN0, s.Z_OPEN1),
        }

    def check(self):
        """Contrôles de cohérence du squelette (phase 1)."""
        s = self
        out = []
        out.append(("Hauteur de caisse = 1500", abs((s.Z_BODY_TOP - s.Z_CH_TOP) - 1500) < 1e-6,
                    f"{s.Z_BODY_TOP - s.Z_CH_TOP:.1f} mm"))
        out.append(("Longueur = 2200", s.X_RIGHT - s.X_LEFT == 2200, f"{s.X_RIGHT - s.X_LEFT:.0f} mm"))
        out.append(("Largeur = 1100", s.Y_REAR - s.Y_FRONT == 1100, f"{s.Y_REAR - s.Y_FRONT:.0f} mm"))
        out.append(("Garde au sol ≤ dessous châssis", s.Z_LOWEST <= s.Z_CH_BOT,
                    f"{s.Z_LOWEST:.0f} ≤ {s.Z_CH_BOT:.0f}"))
        out.append(("Dessus caisse ≈ 1830", abs(s.Z_BODY_TOP - 1830) < 1e-6, f"{s.Z_BODY_TOP:.0f} mm"))
        out.append(("Ouverture de porte positive", s.X_OPEN1 > s.X_OPEN0 and s.Z_OPEN1 > s.Z_OPEN0,
                    f"{s.X_OPEN1 - s.X_OPEN0:.0f} × {s.Z_OPEN1 - s.Z_OPEN0:.0f} mm"))
        return out


SK = Skeleton()
