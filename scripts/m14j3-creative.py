"""M1.4J.3: what Creative Studio's lift needs beside M1.4F's recovered station (which stays untouched).

    python scripts/m14j3-creative.py        writes public/scene/v2/m14j3/*.png
    python scripts/m14i2-crop.py            then crops them (components/lab/scene-crops.ts)

The recovered station ends where the foreground covered it, and holds a little of that foreground:
the top edge of the upper book, a corner of the second one, and part of the mug's steam (the steam
layer is the plate minus this station, so it holds the rest, and bits of the stone's upper edge).
On the floor all of it recomposes the plate. Raised, the station's part would go up with it.

    creative-fill        rises, over the station: the stone behind the books (the station's own pixels,
                         continued by at most FILL px), and the stone without the steam
    creative-fill-off    the same for the unpowered strip's end
    creative-books       stays: the books' pixels of the station
    creative-steam       stays: the steam, whole (instead of fg-steam)
    creative-light-edge / -spill    M1.4G.1's creative-light, split: the strips' own bright edge, and what lies on the floor
    creative-floor-edge / -rest     M1.4H.3's creative-floor, split: the strip's end round the right corner, and the floor

On the floor, fill + books + steam are the station + fg-steam, and each split adds up to its source
(the report says how closely). Nothing is painted; no file of an earlier milestone is written.

Dependencies: numpy, Pillow (scripts/requirements.txt).
"""
import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "public", "scene", "v2")
OUT = os.path.join(SRC, "m14j3")
W, H = 1672, 941
load = lambda n: np.asarray(Image.open(os.path.join(SRC, *n.split("/"))).convert("RGBA")).astype(float)


def save(name, rgb, alpha):
    a = np.clip(np.rint(alpha), 0, 255)
    o = np.dstack([np.clip(np.rint(rgb), 0, 255), a]).astype(np.uint8)
    o[a == 0] = 0
    Image.fromarray(o, "RGBA").save(os.path.join(OUT, name + ".png"), optimize=True)
    ys, xs = np.nonzero(a)
    print(f"{name:22s} {len(xs):6d} px, x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}")


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def blur(x, s):
    """Gaussian, per channel, on floats (edges repeated)."""
    r = int(3 * s + 1)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / s) ** 2)
    k /= k.sum()
    for ax in (0, 1):
        p = np.pad(x, [(r, r) if i == ax else (0, 0) for i in range(x.ndim)], mode="edge")
        x = sum(k[i] * np.take(p, np.arange(i, i + x.shape[ax]), axis=ax) for i in range(2 * r + 1))
    return x


os.makedirs(OUT, exist_ok=True)
st, steam, off = load("m14f/creative.png"), load("m14e/fg-steam.png"), load("m14h3/creative-strip-off.png")
light, floor = load("m14g1/creative-light.png"), load("m14h3/creative-floor.png")
yy, xx = np.mgrid[0:H, 0:W]

# ---------------------------------------------------------------- the books
#: First row of the upper book's top edge, at some columns (measured: the first row lighter than the stone above it).
EDGE = [(96, 732), (99, 733), (104, 733), (112, 734), (119, 734), (122, 735), (129, 735), (133, 736), (144, 736), (147, 737), (164, 737), (167, 738), (176, 738)]
edge_y = np.floor(np.interp(np.arange(W), [p[0] for p in EDGE], [p[1] for p in EDGE]))
upper = (xx >= 96) & (xx <= 176) & (yy >= edge_y[None, :]) & (yy < 760)
#: A corner of the second book, over the left strip's end.
CORNER = dict(x0=177, x1=183, y0=768)
corner = (xx >= CORNER["x0"]) & (xx <= CORNER["x1"]) & (yy >= CORNER["y0"]) & (yy < 785)
books = (upper | corner) & (st[..., 3] > 0)
save("creative-books", st[..., :3], st[..., 3] * books)

# ---------------------------------------------------------------- the stone behind the books
FILL = 16
#: The station's own left side: one plain column of stone further right, for the few with a leaf in them.
LEAF = 114
fill = st[..., :3].copy()
fill_a = np.zeros((H, W))
side = st[:, 178:182, :3].mean(1)  # the stone right of the books, row by row
for x in range(97, 178):
    sx = x if x > LEAF else 2 * LEAF + 1 - x
    e = int(edge_y[min(x, 176)])
    s = int(edge_y[min(sx, 176)]) - 2  # the last plain row of stone above the book
    w = smooth((x - 150) / 27)
    for k in range(FILL):
        y = e + k
        fill[y, x] = (1 - w) * st[s - k, sx, :3] + w * side[y]  # the stone above, mirrored; towards the visible side, that side's own rows
        fill_a[y, x] = st[s - k, x, 3]  # (soft at its left end)
# The seam between the books and the stone beside them (the station's edge is soft there): its own columns, to the foot.
for x in range(174, 179):
    for y in range(int(edge_y[176]), 779):
        soft = st[y, x, 3] < 255 or (x < 178 and y >= 739)
        if soft and y < CORNER["y0"]:
            fill[y, x] = side[y]
            fill_a[y, x] = 255
# The left strip's end, behind the second book: the strip's own next columns, mirrored.
A = 186
end_x = range(174, CORNER["x1"] + 2)  # (and the strip's own soft first column)
for x in end_x:
    q = A + (CORNER["x1"] + 1 - x)
    for y in range(CORNER["y0"] - 1, 780):
        fill[y, x], fill_a[y, x] = st[y, q, :3], st[y, q, 3]
# Where the fill meets the station unchanged, its own pixels one further, so nothing of the book is filtered in.
grow = np.asarray(Image.fromarray((fill_a > 0).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0
ring = grow & (fill_a == 0) & (xx > 98) & (st[..., 3] == 255) & ~books
fill[ring] = st[ring][:, :3]
fill_a[ring] = 255

offx, offx_a = off[..., :3].copy(), np.zeros((H, W))
for x in end_x:
    q = A + (CORNER["x1"] + 1 - x)
    for y in range(CORNER["y0"] - 2, 780):
        offx[y, x], offx_a[y, x] = off[y, q, :3], off[y, q, 3]
save("creative-fill-off", offx, offx_a)

# ---------------------------------------------------------------- the stone and the steam
ZX0, ZX1 = 242, 330
whole = np.minimum(255, st[..., :3] + steam[..., :3] * steam[..., 3:] / 255)  # on the floor: the plate
opaque = st[..., 3] == 255
#: The stone's upper edge here (its ridge is in the steam layer, and belongs to the stone).
RIDGE = [(242, 720.5), (262, 720.5), (279, 721), (283, 719.5), (292, 717), (300, 716), (318, 714.5), (330, 713.5)]
ridge = np.interp(np.arange(W), [p[0] for p in RIDGE], [p[1] for p in RIDGE])
foot = np.array([np.nonzero(opaque[600:, x])[0].max() + 600 if opaque[600:, x].any() else 0 for x in range(W)])
zone = (xx >= ZX0) & (xx < ZX1) & (yy < foot[None, :] + 1) & opaque & (yy > 700)


def profile(x0, x1):
    """The stone beside the steam, row by row: its mean, without the groove's highlight."""
    p = whole[:, x0:x1].mean(1)
    q = np.stack([p[np.clip(np.arange(H) + d, 0, H - 1)] for d in range(-4, 5)])
    return blur(np.median(q, axis=0), 1.5)


# The sides' profiles, followed along the stone (both its upper edge and its foot rise to the right).
L, R = profile(232, 243), profile(331, 345)
t = smooth((np.arange(W) - ZX0) / (ZX1 - ZX0))
base = np.zeros((H, W, 3))
for x in range(ZX0, ZX1):
    top, bot = ridge[x] + 2, foot[x]
    v = (np.arange(H) - top) / (bot - top)
    row = lambda p, a, b: np.stack([np.interp(a + v * (b - a), np.arange(H), p[:, c]) for c in range(3)], 1)
    base[:, x] = (1 - t[x]) * row(L, 722, foot[238]) + t[x] * row(R, 715, foot[338])
# Grain the plate does not show here would come back as its negative in the steam: only the plate's own.
fine = np.clip(whole - blur(whole, 1.2), -5, 4)
clean = np.minimum(whole, np.maximum(0, base + fine))
# Full strength inside; nothing at the sides, above the ridge, or where there is no steam.
# At the top it comes in slowly, so the steam thins out where the raised stone carries its own haze.
w = smooth((xx - ZX0) / 8) * smooth((ZX1 - 1 - xx) / 8) * smooth((yy - ridge[None, :] - 1.5) / 36) * zone
# At the foot it eases towards the steam over the floor (weaker there); the stone keeps that little.
w = w * (1 - 0.4 * smooth((yy - foot[None, :] + 14) / 13))
stone = whole - w[..., None] * (whole - clean)
changed = zone & ((np.abs(stone - st[..., :3]).max(-1) > 0.5) | (np.abs(whole - st[..., :3]).max(-1) > 0.5))
grow = np.asarray(Image.fromarray(changed.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0
keep = grow & opaque
stone8 = np.rint(stone)
fill[keep] = stone8[keep]
fill_a[keep] = 255
# The stone's soft last row, without the steam.
for x in range(ZX0 + 4, ZX1 - 4):
    for y in range(foot[x] + 1, foot[x] + 3):
        if 0 < st[y, x, 3] < 255:
            fill[y, x], fill_a[y, x] = base[foot[x], x], st[y, x, 3]
save("creative-fill", fill, fill_a)
# The steam is what is left; off the stone, M1.4E's own.
pm = steam[..., :3] * steam[..., 3:] / 255
new = np.where(keep[..., None], whole - stone8, pm)
# The station's dark foot line has no steam of its own: across it, the steam above runs into the steam below.
for x in range(ZX0, ZX1):
    f = foot[x]
    a, b = new[f - 4 : f - 2, x].mean(0), new[f + 3 : f + 5, x].mean(0)
    for k in range(-2, 3):
        g = (k + 3) / 6
        new[f + k, x] = np.maximum(new[f + k, x], (1 - g) * a + g * b)
new = np.clip(np.rint(new), 0, 255)
save("creative-steam", new, (new.max(-1) > 0) * 255.0)
left = np.abs((np.where(keep[..., None], stone8, st[..., :3]) + new) - np.where(opaque[..., None], whole, st[..., :3] + pm)).max(-1)
left[~(opaque | (pm.max(-1) > 0))] = 0
print(f"stone + steam against station + fg-steam: max {left.max():.0f}, {int((left > 2).sum())} px above 2 (the foot line)")

# ---------------------------------------------------------------- the strips' light
solid = (st[..., 3] >= 128) & ~books
pts = np.argwhere(solid & (yy > 715))
yx = np.argwhere((light[..., 3] > 0) | ((floor[..., 3] > 0) & (yy > 715) & (yy < 800)))
dist = np.full((H, W), 99.0)
rim = solid & ~(np.roll(solid, 1, 0) & np.roll(solid, -1, 0) & np.roll(solid, 1, 1) & np.roll(solid, -1, 1))
rp = np.argwhere(rim & (yy > 715))
for y, x in yx:
    dist[y, x] = np.sqrt(((rp - (y, x)) ** 2).sum(1).min())


def split(name, img, weight, a="edge", b="spill"):
    e = np.rint(img[..., 3] * weight)
    save(f"{name}-{a}", img[..., :3], e)
    save(f"{name}-{b}", img[..., :3], img[..., 3] - e)


NEAR, FAR = 4.0, 10.0
wl = 1 - smooth((dist - NEAR) / (FAR - NEAR))
ext = light.copy()
for x in range(174, 185):
    ext[:, x] = light[:, 187]  # behind the second book: the strip's own light a little further right
we = wl.copy()
we[:, 174:185] = wl[:, 187:188]
e = np.rint(ext[..., 3] * we)
save("creative-light-edge", ext[..., :3], e)
save("creative-light-spill", light[..., :3], light[..., 3] - np.rint(light[..., 3] * wl))
# The strip's end round the right corner: a short hook just outside the stone.
d = np.hypot(xx - 505.5, yy - 733)
wf = (1 - smooth((d - 8) / 4)) * (yy < 737) * (xx >= 500)
# And what is left of the strips along the stone's outline (the floor light was recovered up to it).
wf = np.maximum(wf, (1 - smooth((dist - 1.5) / 2)) * (xx < 500) * (xx > 176))
split("creative-floor", floor, wf, "edge", "rest")
