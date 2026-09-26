"""Primitives géométriques et registre des pièces / soudures."""
from dataclasses import dataclass, field
import cadquery as cq
from params import P

V = cq.Vector
RHO = P["STEEL_DENSITY"]

# Couleurs (rendu uniquement)
C_GALVA = (0.74, 0.77, 0.79)
C_SHEET = (0.82, 0.85, 0.86)
C_FLOOR = (0.66, 0.69, 0.70)
C_DARK = (0.18, 0.19, 0.20)
C_RUBBER = (0.08, 0.08, 0.09)
C_ZINC = (0.62, 0.66, 0.70)
C_YELLOW = (0.93, 0.70, 0.08)
C_RED = (0.72, 0.18, 0.14)
C_IFACE = (0.95, 0.45, 0.10)
C_LOGO = (0.10, 0.11, 0.12)

S235_GALVA = "S235JR galvanisé à chaud"
S235 = "S235JR"


@dataclass
class Part:
    ref: str                 # identifiant unique de corps
    group: str               # composant 00…25
    name: str                # désignation
    material: str
    function: str
    shape: cq.Shape
    kind: str                # profilé | tôle | plat | pièce découpée | acheté | quincaillerie | marquage | interface
    section: str = ""
    length: float = 0.0      # longueur de débit (profilés/tubes)
    color: tuple = C_GALVA
    mass: float | None = None   # masse imposée (achetés) sinon calculée
    in_bom: bool = True
    moving: str | None = None   # 'DOOR_L' | 'DOOR_R' | None
    weldment: str = ""          # sous-ensemble mécano-soudé (pour la galvanisation)
    status: str = ""            # PROVISOIRE… le cas échéant

    @property
    def volume(self):
        return self.shape.Volume()

    @property
    def kg(self):
        return self.mass if self.mass is not None else self.volume * RHO

    def bom_key(self):
        L = round(self.length) if self.length else 0
        return (self.group, self.name, self.section, L, self.material)


@dataclass
class Weld:
    wid: str
    a: str
    b: str
    kind: str
    length: float
    note: str = ""


@dataclass
class Registry:
    parts: list = field(default_factory=list)
    welds: list = field(default_factory=list)
    log: list = field(default_factory=list)

    def add(self, part: Part):
        assert all(p.ref != part.ref for p in self.parts), f"référence en double {part.ref}"
        self.parts.append(part)
        return part

    def weld(self, a, b, kind, length, note=""):
        self.welds.append(Weld(f"W{len(self.welds) + 1:03d}", a, b, kind, length, note))

    def by_group(self, prefix):
        return [p for p in self.parts if p.group.startswith(prefix)]

    def get(self, ref):
        return next(p for p in self.parts if p.ref == ref)


# ---------------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------------
def box(x0, x1, y0, y1, z0, z1):
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1)); z0, z1 = sorted((z0, z1))
    return cq.Solid.makeBox(x1 - x0, y1 - y0, z1 - z0, V(x0, y0, z0))


def rhs(axis, x0, x1, y0, y1, z0, z1, t):
    """Tube rectangulaire creux dont l'enveloppe est la boîte donnée, axe 'x'|'y'|'z'."""
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1)); z0, z1 = sorted((z0, z1))
    outer = box(x0, x1, y0, y1, z0, z1)
    e = 1.0
    if axis == "x":
        inner = box(x0 - e, x1 + e, y0 + t, y1 - t, z0 + t, z1 - t)
    elif axis == "y":
        inner = box(x0 + t, x1 - t, y0 - e, y1 + e, z0 + t, z1 - t)
    else:
        inner = box(x0 + t, x1 - t, y0 + t, y1 - t, z0 - e, z1 + e)
    return outer.cut(inner)


def cyl(r, p0, p1):
    p0, p1 = V(*p0), V(*p1)
    d = p1 - p0
    return cq.Solid.makeCylinder(r, d.Length, p0, d.normalized())


def tube(r_out, t, p0, p1):
    s = cyl(r_out, p0, p1)
    if t and t < r_out:
        p0v, p1v = V(*p0), V(*p1)
        d = (p1v - p0v).normalized()
        s = s.cut(cyl(r_out - t, tuple(p0v - d), tuple(p1v + d)))
    return s


def prism_yz(points, x0, x1):
    """Extrusion selon X d'un profil fermé défini dans le plan (Y, Z)."""
    wp = cq.Workplane("YZ", origin=(x0, 0, 0)).polyline(points).close().extrude(x1 - x0)
    return wp.val()


def prism_xy(points, z0, z1):
    wp = cq.Workplane("XY", origin=(0, 0, z0)).polyline(points).close().extrude(z1 - z0)
    return wp.val()


def rotate_z(shape, center, angle_deg):
    return shape.rotate(V(center[0], center[1], 0), V(center[0], center[1], 1), angle_deg)


def mirror_x(shape, x_mid):
    """Symétrie par rapport au plan X = x_mid."""
    return shape.mirror("YZ", V(x_mid, 0, 0))


def bbox(shape):
    b = shape.BoundingBox()
    return (b.xmin, b.xmax, b.ymin, b.ymax, b.zmin, b.zmax)
