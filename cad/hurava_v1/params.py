"""HURAVA V1 — paramètres du modèle CAO.

Toutes les cotes sont en millimètres, masses en kg.

Statuts :
- FIGÉ        : valeur imposée par le cahier des charges HURAVA V1 (ne pas modifier
                sans décision explicite).
- SPEC ≈      : valeur donnée « environ » par le cahier des charges ; conservée telle
                quelle comme référence géométrique.
- PROVISOIRE  : valeur choisie par le modélisateur faute de donnée dans le cahier
                des charges — PROVISOIRE — À VALIDER.

Convention d'axes (cahier des charges §2) :
- X = longueur (0 → 2200, de gauche à droite vu de la face avant)
- Y = largeur  (0 = face AVANT portes, 1100 = face ARRIÈRE attelage)
- Z = hauteur  (0 = sol)
Face latérale GAUCHE = plan X = 0 ; face latérale DROITE = plan X = 2200.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Param:
    name: str
    value: object
    unit: str
    status: str
    note: str


FIGE, SPEC, PROV = "FIGÉ", "SPEC ≈", "PROVISOIRE"

_P = [
    # --- Enveloppe principale (§2) -------------------------------------------------
    Param("HURAVA_LENGTH", 2200.0, "mm", FIGE, "X, faces avant/arrière"),
    Param("HURAVA_WIDTH", 1100.0, "mm", FIGE, "Y, faces latérales"),
    Param("HURAVA_BODY_HEIGHT", 1500.0, "mm", FIGE, "hauteur de caisse, du dessus châssis au dessus toit"),
    # --- Repères de hauteur (§3) ---------------------------------------------------
    Param("CHASSIS_HEIGHT", 330.0, "mm", SPEC, "Z du dessus châssis / dessous plancher"),
    Param("GROUND_CLEARANCE", 250.0, "mm", SPEC, "Z du point structurel le plus bas (dessous fourreaux)"),
    # --- Profilés (§4) -------------------------------------------------------------
    Param("MAIN_PROFILE_H", 60.0, "mm", FIGE, "tube 60×40×3 S235JR — grande dimension"),
    Param("MAIN_PROFILE_W", 40.0, "mm", FIGE, "tube 60×40×3 S235JR — petite dimension"),
    Param("MAIN_PROFILE_T", 3.0, "mm", FIGE, "tube 60×40×3 S235JR — épaisseur"),
    Param("SEC_PROFILE", 40.0, "mm", FIGE, "tube 40×40×3 S235JR"),
    Param("SEC_PROFILE_T", 3.0, "mm", FIGE, ""),
    Param("LOCAL_PROFILE", 30.0, "mm", FIGE, "tube 30×30×2 S235JR (racks)"),
    Param("LOCAL_PROFILE_T", 2.0, "mm", FIGE, ""),
    Param("GUSSET_SIZE", 100.0, "mm", FIGE, "gousset 100×100×5"),
    Param("GUSSET_T", 5.0, "mm", FIGE, ""),
    # --- Tôles (§5) ----------------------------------------------------------------
    Param("PANEL_T", 2.0, "mm", PROV, "tôle parois latérales et arrière"),
    Param("ROOF_T", 2.0, "mm", PROV, "tôle de toit"),
    Param("FLOOR_T", 4.0, "mm", PROV, "tôle de plancher structurelle (larmée 4/6 envisageable)"),
    Param("DOOR_SKIN_T", 2.0, "mm", PROV, "tôle de parement des vantaux"),
    # --- Structure (§4) ------------------------------------------------------------
    Param("CHASSIS_CROSS_X", (290.0, 1100.0, 1910.0), "mm", PROV,
          "axes X des traverses intermédiaires de châssis (portée plancher ≤ 330)"),
    Param("ROOF_BOW_X", (733.0, 1467.0), "mm", PROV, "axes X des traverses de toit 40×40"),
    Param("SIDE_RAIL_Z", 1000.0, "mm", PROV, "axe Z de la lisse latérale 40×40 (reprise des barres)"),
    Param("REAR_RAIL_Z", 1000.0, "mm", PROV, "axe Z de la lisse arrière 40×40"),
    Param("REAR_MID_POST_X", 1100.0, "mm", PROV, "axe X du montant arrière intermédiaire 40×40"),
    # --- Portes (§6) ---------------------------------------------------------------
    Param("DOOR_COUNT", 2, "u", FIGE, "vantaux sur la face avant"),
    Param("HINGES_PER_DOOR", 3, "u", FIGE, ""),
    Param("HINGE_PIN_D", 16.0, "mm", FIGE, "axe de charnière ≈ Ø16"),
    Param("DOOR_OPEN_MAX", 90.0, "°", FIGE, "ouverture 0 → 90° avec butée positive"),
    Param("LOCK_ROD_D", 14.0, "mm", FIGE, "tringles haute et basse Ø14"),
    Param("DOOR_GAP_SIDE", 5.0, "mm", PROV, "jeu vantail / montant"),
    Param("DOOR_GAP_CENTER", 6.0, "mm", PROV, "jeu entre vantaux"),
    Param("DOOR_GAP_BOTTOM", 6.0, "mm", PROV, "jeu vantail / plancher"),
    Param("DOOR_GAP_TOP", 5.0, "mm", PROV, "jeu vantail / traverse haute"),
    Param("HINGE_AXIS_X", 30.0, "mm", PROV, "position X de l'axe de charnière depuis le bord d'enveloppe"),
    Param("HINGE_AXIS_Y", -20.0, "mm", PROV, "position Y de l'axe (devant la face avant)"),
    Param("HINGE_KNUCKLE_OD", 30.0, "mm", PROV, "nœud de charnière Ø30, alésage Ø17"),
    Param("HINGE_KNUCKLE_LEN", 55.0, "mm", PROV, "longueur d'un nœud"),
    Param("HINGE_Z_MARGIN", 150.0, "mm", PROV, "charnières haute/basse à 150 des bords du vantail"),
    Param("DOOR_STOP_Z", 0.75, "", PROV, "position relative de la butée 90° sur la hauteur du vantail"),
    # --- Barres de manutention (§7) -----------------------------------------------
    Param("HANDLING_BAR_DIAMETER", 33.7, "mm", FIGE, ""),
    Param("HANDLING_BAR_THICKNESS", 4.0, "mm", FIGE, ""),
    Param("HANDLING_BAR_LENGTH", 900.0, "mm", FIGE, ""),
    Param("HANDLING_BAR_COUNT", 2, "u", FIGE, "une par face latérale"),
    Param("HANDLING_BAR_Z", 1000.0, "mm", PROV, "hauteur d'axe (ergonomie 900–1100)"),
    Param("HANDLING_BAR_STANDOFF", 75.0, "mm", PROV, "axe de barre / face extérieure du panneau (passage de main ≈ 58)"),
    Param("HANDLING_BAR_SUPPORT_PITCH", 760.0, "mm", PROV, "entraxe des 2 supports"),
    Param("HANDLING_BAR_SUPPORT", (10.0, 60.0), "mm", PROV, "plat support ép. × hauteur"),
    # --- Racks (§12) ---------------------------------------------------------------
    Param("RACK_COUNT", 2, "u", FIGE, "gauche et droit"),
    Param("RACK_LEVELS", 3, "u", FIGE, "niveaux par rack"),
    Param("RACK_DEPTH", 450.0, "mm", PROV, "profondeur de rack selon X"),
    Param("RACK_Y_RANGE", (70.0, 1030.0), "mm", PROV, "emprise Y du rack"),
    Param("RACK_SHELF_Z", (700.0, 1100.0, 1500.0), "mm", PROV, "Z du dessus des 3 tablettes"),
    Param("RACK_SHELF_T", 2.0, "mm", PROV, "tôle de tablette"),
    # --- Roues (§8) ----------------------------------------------------------------
    Param("WHEEL_COUNT", 4, "u", FIGE, ""),
    Param("CASTER_D", 200.0, "mm", PROV, "roue Ø200, bandage caoutchouc plein sur jante acier"),
    Param("CASTER_W", 50.0, "mm", PROV, "largeur de bandage"),
    Param("CASTER_H", 245.0, "mm", PROV, "hauteur hors tout roulette (catalogue)"),
    Param("CASTER_OFFSET", 55.0, "mm", PROV, "déport de chape pivotante"),
    Param("CASTER_PLATE", (140.0, 110.0, 8.0), "mm", PROV, "platine de roulette L×l×ép."),
    Param("CASTER_BOLT_PITCH", (110.0, 80.0), "mm", PROV, "entraxe perçages platine (4×M12)"),
    Param("CASTER_AXIS_INSET", 165.0, "mm", PROV, "axe de pivot à 165 des bords (balayage dans l'enveloppe)"),
    Param("CASTER_CMU", 500.0, "kg", PROV, "charge admissible par roue"),
    Param("CASTER_MASS", 9.5, "kg", PROV, "masse catalogue d'une roulette"),
    Param("WHEEL_SUPPORT_PLATE_T", 10.0, "mm", PROV, "platine porte-roue soudée sous châssis"),
    Param("WHEEL_SPACER_T", 15.0, "mm", PROV, "cale soudée (rattrapage hauteur roulette)"),
    # --- Fourreaux (§9) ------------------------------------------------------------
    Param("FORK_POCKET_COUNT", 2, "u", FIGE, ""),
    Param("FORK_POCKET_PITCH", 900.0, "mm", PROV, "entraxe — à confirmer selon engins ciblés (pas une norme)"),
    Param("FORK_POCKET_W", 230.0, "mm", PROV, "largeur extérieure (intérieur 220)"),
    Param("FORK_POCKET_H", 80.0, "mm", PROV, "hauteur extérieure (intérieur 70)"),
    Param("FORK_POCKET_T", 5.0, "mm", PROV, "épaisseur (tube 230×80×5 ou tôle pliée)"),
    # --- Levage (§10) --------------------------------------------------------------
    Param("LIFTING_POINT_COUNT", 4, "u", FIGE, ""),
    Param("LUG_T", 15.0, "mm", PROV, "oreille de levage épaisseur"),
    Param("LUG_W", 80.0, "mm", PROV, "oreille largeur"),
    Param("LUG_HOLE_D", 32.0, "mm", PROV, "perçage manille"),
    Param("LUG_HOLE_Z", 30.0, "mm", PROV, "axe du perçage au-dessus de la platine"),
    Param("LUG_BASE", (80.0, 12.0), "mm", PROV, "platine d'oreille carré × ép."),
    Param("ROOF_NOTCH", 86.0, "mm", PROV, "dégagement de toit aux angles"),
    # --- Attelage (§11) ------------------------------------------------------------
    Param("HOOK_T", 25.0, "mm", PROV, "crochet oxycoupé ép. 25 (pièce forgée à étudier)"),
    Param("HOOK_THROAT_Z", 300.0, "mm", PROV, "Z du fond de gorge (hauteur d'attelage à confirmer)"),
    Param("HOOK_THROAT_W", 60.0, "mm", PROV, "largeur de gorge"),
    Param("HOOK_TIP_H", 55.0, "mm", PROV, "hauteur du bec au-dessus du fond de gorge"),
    Param("HOOK_TIP_W", 32.0, "mm", PROV, "épaisseur du bec selon Y"),
    Param("RING_R", 47.0, "mm", PROV, "anneau : rayon moyen (Ø int. 70)"),
    Param("RING_r", 12.0, "mm", PROV, "anneau : rayon de section (Ø24)"),
    Param("RING_PIN_D", 20.0, "mm", PROV, "axe d'articulation de l'anneau côté engin"),
    # --- Charges (§13) -------------------------------------------------------------
    Param("PAYLOAD_NOMINAL", 500.0, "kg", FIGE, ""),
    Param("PAYLOAD_DESIGN", 750.0, "kg", FIGE, ""),
    Param("DYNAMIC_FACTOR", 1.5, "", FIGE, ""),
    Param("SAFETY_FACTOR_MIN", 1.5, "", FIGE, "cible préliminaire — pas une certification"),
    # --- Matériau ------------------------------------------------------------------
    Param("STEEL_DENSITY", 7.85e-6, "kg/mm³", FIGE, "S235JR"),
]

P = {p.name: p.value for p in _P}
ALL = _P
