"""Contrôles géométriques : interférences, balayage d'ouverture, symétrie, zones libres."""
import math
from geom import bbox, rotate_z, box, V
from params import P
from skeleton import SK as s

VOL_TOL = 1.0   # mm³ : en dessous, contact / tangence (soudure) et non interférence


def _bb_overlap(a, b, eps=0.01):
    return (a[0] < b[1] - eps and b[0] < a[1] - eps and a[2] < b[3] - eps and b[2] < a[3] - eps
            and a[4] < b[5] - eps and b[4] < a[5] - eps)


def common_volume(sa, sb):
    try:
        return sa.intersect(sb).Volume()
    except Exception:
        return float("nan")


def interferences(parts_a, parts_b=None, shapes=None):
    """Liste des paires en interférence (volume commun > VOL_TOL).

    `shapes` permet de substituer une géométrie (ex. vantail tourné) : dict ref→shape.
    """
    shapes = shapes or {}
    get = lambda p: shapes.get(p.ref, p.shape)
    A = [(p, get(p)) for p in parts_a]
    B = A if parts_b is None else [(p, get(p)) for p in parts_b]
    bbA = [bbox(sh) for _, sh in A]
    bbB = bbA if parts_b is None else [bbox(sh) for _, sh in B]
    hits = []
    for i, (pa, sa) in enumerate(A):
        start = i + 1 if parts_b is None else 0
        for j in range(start, len(B)):
            pb, sb = B[j]
            if pa.ref == pb.ref or not _bb_overlap(bbA[i], bbB[j]):
                continue
            v = common_volume(sa, sb)
            if not (v <= VOL_TOL):
                hits.append((pa.ref, pb.ref, v))
    return hits


def door_pose(parts, angle):
    """Géométries des pièces mobiles pour une ouverture `angle` (°), tringles rétractées."""
    from components import hinge_axis
    out = {}
    for p in parts:
        if not p.moving:
            continue
        sh = p.shape
        if p.ref.startswith("09-TRH"):
            sh = sh.translate(V(0, 0, -30))
        if p.ref.startswith("09-TRB"):
            sh = sh.translate(V(0, 0, 30))
        if p.moving == "DOOR_L":
            sh = rotate_z(sh, hinge_axis("G"), -angle)
        else:
            sh = rotate_z(sh, hinge_axis("D"), angle)
        out[p.ref] = sh
    return out


def door_sweep(parts, angles=(0, 15, 30, 45, 60, 75, 85, 90)):
    moving = [p for p in parts if p.moving]
    static = [p for p in parts if not p.moving]
    res = []
    for a in angles:
        sh = door_pose(parts, a)
        hits = interferences(moving, static, shapes=sh)
        # vantaux entre eux (le gauche ne doit pas heurter le droit)
        L = [p for p in moving if p.moving == "DOOR_L"]
        R = [p for p in moving if p.moving == "DOOR_R"]
        hits += interferences(L, R, shapes=sh)
        res.append((a, hits))
    return res


def stop_contact_gap(parts):
    """Jeu entre vantail gauche ouvert à 90° et sa butée (doit être petit et ≥ 0)."""
    sh = door_pose(parts, 90)
    skin = sh["07-VG-1"]
    stop = next(p for p in parts if p.ref == "08-BUTG").shape
    try:
        return skin.distance(stop)
    except Exception:
        return None


def over_travel_blocked(parts, angle=92):
    """À 92°, le vantail doit interférer avec la butée (preuve d'une butée positive)."""
    sh = door_pose(parts, angle)
    stop = next(p for p in parts if p.ref == "08-BUTG")
    skin = next(p for p in parts if p.ref == "07-VG-1")
    return common_volume(sh[skin.ref], stop.shape) > VOL_TOL


def symmetry(parts, left_prefix, right_prefix, x_mid=s.X_MID, tol=0.5):
    """Compare volumes et boîtes englobantes miroir de deux groupes."""
    L = [p for p in parts if p.group.startswith(left_prefix)]
    R = [p for p in parts if p.group.startswith(right_prefix)]
    vl, vr = sum(p.volume for p in L), sum(p.volume for p in R)
    bl = _union_bb([bbox(p.shape) for p in L])
    br = _union_bb([bbox(p.shape) for p in R])
    bl_m = (2 * x_mid - bl[1], 2 * x_mid - bl[0], *bl[2:])
    ok = abs(vl - vr) / max(vl, 1) < 1e-3 and all(abs(a - b) < tol for a, b in zip(bl_m, br))
    return ok, vl, vr


def _union_bb(bbs):
    return (min(b[0] for b in bbs), max(b[1] for b in bbs), min(b[2] for b in bbs), max(b[3] for b in bbs),
            min(b[4] for b in bbs), max(b[5] for b in bbs))


def group_bb(parts, prefixes):
    sel = [p for p in parts if any(p.group.startswith(x) for x in prefixes)]
    return _union_bb([bbox(p.shape) for p in sel])


def free_zone(parts, zone):
    """Pièces pénétrant la zone (x0,x1,y0,y1,z0,z1)."""
    z = box(*zone)
    zb = bbox(z)
    out = []
    for p in parts:
        if _bb_overlap(bbox(p.shape), zb) and common_volume(p.shape, z) > VOL_TOL:
            out.append(p.ref)
    return out
