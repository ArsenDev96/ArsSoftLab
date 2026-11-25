"""M1.4J.4: Experience's strip light, split for its lift. Nothing is painted: each pair adds up to its source.

    python scripts/m14j4-experience.py      writes public/scene/v2/m14j4/*.png
    python scripts/m14i2-crop.py            then crops them (components/lab/scene-crops.ts)

M1.4F's experience-light is what the strips throw on the floor, recovered up to the platform's outline.
Raised, its brightest rows, next to the strips, would stay behind as a second strip on the floor.

    experience-light-edge    rises: the rows next to the strips (all of it to NEAR px off the platform's
                             outline, none from FAR px on)
    experience-light-spill   stays: the rest, and everything left of the strips (the floor beside the rim)

M1.4H.4's floor light (experience-floor, and M1.4H.4.1's experience-floor-lit) has a row of single
specks left of the strips along the same outline, hidden in the platform's edge only while it is down:

    experience-floor-edge                   rises: those specks (the same in both sources)
    experience-floor-rest, -floor-lit-rest  stay: everything else

Only the alpha is split (edge + spill = the source's alpha, pixel for pixel; the colours are copied).
No file of an earlier milestone is written. The recovered station itself needs nothing: no foreground
object overlaps it and it holds none.

Dependencies: numpy, Pillow (scripts/requirements.txt).
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "public", "scene", "v2")
OUT = os.path.join(SRC, "m14j4")
W, H = 1672, 941
load = lambda n: np.asarray(Image.open(os.path.join(SRC, *n.split("/"))).convert("RGBA"))


def save(name, rgb, alpha):
    o = np.dstack([rgb, alpha]).astype(np.uint8)
    o[alpha == 0] = 0
    Image.fromarray(o, "RGBA").save(os.path.join(OUT, name + ".png"), optimize=True)
    ys, xs = np.nonzero(alpha)
    print(f"{name:24s} {len(xs):6d} px, x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}")


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


os.makedirs(OUT, exist_ok=True)
st, light = load("m14f/experience.png"), load("m14f/experience-light.png")
floor, lit = load("m14h4/experience-floor.png"), load("m14h4/experience-floor-lit.png")
yy, xx = np.mgrid[0:H, 0:W]

solid = (st[..., 3] >= 128) & (yy > 690)
rim = solid & ~(np.roll(solid, 1, 0) & np.roll(solid, -1, 0) & np.roll(solid, 1, 1) & np.roll(solid, -1, 1))
rp = np.argwhere(rim & (yy > 700))
dist = np.full((H, W), 99.0)
for y, x in np.argwhere((light[..., 3] > 0) | ((floor[..., 3] > 0) & (yy > 740) & (yy < 800))):
    dist[y, x] = 0 if solid[y, x] else np.sqrt(((rp - (y, x)) ** 2).sum(1).min())

NEAR, FAR = 2.0, 8.0
#: The strips start here; what lies further left is light on the floor beside the rim (M1.4H.4.1's disc among it).
STRIPS = 1212
a = light[..., 3].astype(int)
edge = np.rint(a * (1 - smooth((dist - NEAR) / (FAR - NEAR))) * smooth((xx - STRIPS) / 4 + 0.5)).astype(int)
save("experience-light-edge", light[..., :3], edge)
save("experience-light-spill", light[..., :3], a - edge)

#: The specks: at most SPECK px off the outline, gone 2 px further.
SPECK = 1.5
a = floor[..., 3].astype(int)
edge = np.rint(a * (1 - smooth((dist - SPECK) / 2)) * (xx > STRIPS)).astype(int)
assert (floor[xx > STRIPS] == lit[xx > STRIPS]).all()
save("experience-floor-edge", floor[..., :3], edge)
save("experience-floor-rest", floor[..., :3], a - edge)
save("experience-floor-lit-rest", lit[..., :3], lit[..., 3].astype(int) - edge)
