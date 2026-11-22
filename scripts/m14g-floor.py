"""M1.4G: floor lighting, reflections and grounding for /lab-v2 (experimental).
Writes public/scene/v2/m14g/ only; nothing else is touched.

  floor-light.png        plus-lighter, floor-anchored, under every station:
                           rings        the approved floor rings around the five
                                        bases, extracted from the approved artwork
                                        (line-free plate) along fitted ellipses
                           reflections  the four static stations' bright parts
                                        mirrored in the polished floor
  playground-reflection.png, playground-reflection-lit.png
                         plus-lighter: Playground's reflection (at rest; and the
                                        strips' extra light once powered); they
                                        drop with the lift (--lp) in SceneV2
  contact.png            black + alpha: a restrained contact shadow hugging each
                         recovered station's own bottom edge (Playground keeps its
                         M1.4E.1 height-responsive shadows)
  floor-mask.png         alpha: the v2 floor (no architecture, windows or
                         mountains), for the optional floor-tone correction

Rings. Each ring was fitted (--fit) by following the ridge of the line-free plate
(local brightness above a 9x9 mean) along the normals of a starting ellipse and
fitting a conic to the ridge points (4 rounds, narrowing window). Within a band
of +-3 px around the fitted ellipse the ring's light is its pixels above the
plate floor diffused in from just outside the band (max(I - B, 0)), so only the
ring (core and its own glow) is carried, never the plate's floor. Only where
the ring is visible in the approved artwork (stations, hub and foreground
excluded); Playground's from its front arc and ends only (its plate station
differs from the v2 one). Ring segments the strips light are already in the
stations' own -light layers (plate - line-free plate), so the line-free plate
is used here: no light is counted twice.

Reflections. A station's bright parts (strips, screens, holograms, neon; the
station layer weighted by luminance) are mirrored about its own bottom edge,
column by column (a point h px above the contact appears h px below it),
streaked (vertical blur), faded with distance from the base, broken up by the
v2 floor's own grain (its luminance over a local mean) and kept only where it
adds to the floor light the -light layers already carry (no doubled light).

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14g-floor.py [--fit]
"""

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("m14f", ROOT / "scripts/m14f-extract.py")
m14f = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m14f)
W, H = m14f.W, m14f.H
SRC = ROOT / "docs/m1.3k/package/01-source"
V2 = ROOT / "public/scene/v2"
OUT = V2 / "m14g"
# M1.4G.1 (the default; --m14g rebuilds the M1.4G baseline as it was): Playground's floor light follows its
# power (no strip reflection at rest; the ring dim until the energy arrives), and strip spill keeps the
# approved pixel's own hue (Creative Studio's cyan artifact). Its changed layers go to OUT1; contact.png
# and floor-mask.png are unchanged and stay in OUT.
G1 = "--m14g" not in sys.argv
OCC_K = 0.4
OUT1 = V2 / "m14g1"
WORK = ROOT / "docs/m1.4g/work"
LUM = np.array([0.299, 0.587, 0.114])

# Rings, scene px. Engineering, Educational and Creative: fitted by ridge following (see the docstring;
# their arcs are long enough). Experience's two rings and Playground's disc edge show only short arcs, so
# they are least-squares ellipses through points measured on the plate's ridge map at 3-4x (RING_POINTS),
# with the centre held on the base's centre where the arc alone cannot fix it.
RINGS = {
    "engineering": dict(cx=426.72, cy=532.43, rx=186.38, ry=22.63, angle=-1.051),
    "educational": dict(cx=838.03, cy=484.78, rx=171.71, ry=16.82, angle=-0.353),
    "creative": dict(cx=301.75, cy=734.52, rx=248.31, ry=46.12, angle=0.421),
}
RING_POINTS = {
    # the inner lip at the base's left end (centre held on the base's, x 1434.5)
    "experience": (1434.5, [(1206.7, 711.7), (1170, 721.7), (1161.7, 730), (1163.3, 738.3), (1170, 743.3), (1186.7, 748.3), (1206.7, 751.7)]),
    # the outer ring: its left end and front (its centre free: the points span the left end to near the front's lowest)
    "experience-outer": (None, [(1071.7, 720), (1061.7, 726.7), (1058.3, 736.7), (1060, 746.7), (1066.7, 755), (1080, 761.7),
                                (1106.7, 771.7), (1140, 781.7), (1173.3, 790), (1206.7, 796.7), (1240, 801.7), (1280, 809.3),
                                (1313.3, 813.3), (1346.7, 817.7), (1396.7, 822.3)]),
    # the plinth disc's edge at the base's left end (centre held on v2 Playground's footprint, x 1217.5)
    "playground": (1217.5, [(1048.75, 522.5), (1047.5, 527.5), (1050, 531.3), (1057.5, 533.8), (1055, 520), (1062.5, 517.5)]),
}


def fit_points(cx, pts):
    """An ellipse through measured points. With cx: axis-aligned, centre x held (least squares on
    A u^2 + C y^2 + E y = 1). Without: a general conic (direct least-squares ellipse fit), so the
    ellipse may tilt with the perspective."""
    x = np.array([p[0] for p in pts]); y = np.array([p[1] for p in pts])
    if cx is not None:
        u = x - cx
        A, C, E = np.linalg.lstsq(np.stack([u * u, y * y, y], 1), np.ones_like(x), rcond=None)[0]
        cy = -E / (2 * C)
        k = 1 + E * E / (4 * C)
        return dict(cx=float(cx), cy=float(cy), rx=float(np.sqrt(k / A)), ry=float(np.sqrt(k / C)), angle=0.0)
    mx, my, sc = x.mean(), y.mean(), max(np.ptp(x), np.ptp(y))
    xs, ys = (x - mx) / sc, (y - my) / sc
    D = np.stack([xs * xs, xs * ys, ys * ys, xs, ys, np.ones_like(xs)], 1)
    S = D.T @ D
    Cm = np.zeros((6, 6)); Cm[0, 2] = Cm[2, 0] = 2; Cm[1, 1] = -1
    ev, vec = np.linalg.eig(np.linalg.solve(S, Cm))
    a, b, c, d, e, f = np.real(vec[:, np.argmax(np.real(ev))])
    M = np.array([[a, b / 2], [b / 2, c]])
    ctr = np.linalg.solve(2 * M, [-d, -e])
    fc = f + 0.5 * (d * ctr[0] + e * ctr[1])
    w, v = np.linalg.eigh(M)
    r = np.sqrt(-fc / w)
    i = int(np.argmax(r))
    ang = float(np.degrees(np.arctan2(v[1, i], v[0, i])))
    ang = (ang + 90) % 180 - 90
    return dict(cx=float(mx + ctr[0] * sc), cy=float(my + ctr[1] * sc), rx=float(r[i] * sc), ry=float(r[1 - i] * sc), angle=ang)


for _n, (_cx, _pts) in RING_POINTS.items():
    RINGS[_n] = fit_points(_cx, _pts)
# How far inside a ring its plinth disc is taken (it ends at the base, which covers the rest); Experience's
# disc shows widest, lit amber at the base's left end.
DISC = {"experience": 48.0}
DISC_DEFAULT = 14.0
# v2 Playground's own footprint (M1.4E.1, scripts/m14e1-playground.py).
PG_FOOT = dict(cx=1217.5, cy=522.8, rx=157.0, ry=23.7, angle=0.0)
PG = dict(src=V2 / "stations/playground.png", strip_off=V2 / "m14e1/playground-strip-off.png", scale=0.38848, tx=818.06, ty=247.48)
STATIC = {  # station layer, its light layer
    "engineering": (V2 / "m14f1/engineering.png", V2 / "m14f1/engineering-light.png"),
    "educational": (V2 / "m14f1/educational.png", V2 / "m14f1/educational-light.png"),
    "creative": (V2 / "m14f/creative.png", V2 / "m14f/creative-light.png"),
    "experience": (V2 / "m14f/experience.png", V2 / "m14f/experience-light.png"),
}
# Reflection: strength, streak (vertical) and side softness (horizontal) radii of a 3-pass box blur (close to a
# Gaussian: sigma ~7.5 and ~2.4 px, so a straight strip's reflection has soft ends, never a rectangle),
# fade distance below the base and how far it may reach, scene px.
REFL = dict(k=1.5, streak=10, side=2, fade=46, max_drop=115, striation=0.55)
# The open v2 floor (for the optional tone correction), feathered.
FLOOR = [(70, 452), (240, 443), (330, 437), (1420, 437), (1640, 449), (1672, 453), (1672, 941), (0, 941), (0, 790), (70, 760)]


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def placed(p, scale, tx, ty):
    a = Image.open(p).convert("RGBA")
    c = Image.new("RGBA", (W, H))
    c.paste(a.resize((round(W * scale), round(H * scale)), Image.LANCZOS), (round(tx), round(ty)))
    return np.asarray(c).astype(np.float64)


def over(top, bottom):
    """Premultiplied 'over' of two straight-alpha RGBA arrays (0-255)."""
    at, ab = top[..., 3:] / 255, bottom[..., 3:] / 255
    a = at + ab * (1 - at)
    rgb = (top[..., :3] * at + bottom[..., :3] * ab * (1 - at)) / np.maximum(a, 1e-6)
    return np.concatenate([rgb, a * 255], -1)


def ell_dist(e):
    """Approximate signed distance (px) to an ellipse: (q - 1) / |grad q| / ... (first order)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    a = np.radians(e["angle"])
    ca, sa = np.cos(a), np.sin(a)
    dx, dy = xx - e["cx"], yy - e["cy"]
    u, v = dx * ca + dy * sa, -dx * sa + dy * ca
    q = (u / e["rx"]) ** 2 + (v / e["ry"]) ** 2
    g = 2 * np.hypot(u / e["rx"] ** 2, v / e["ry"] ** 2)
    return (q - 1) / np.maximum(g, 1e-6), v


def box1(a, rx, ry):
    """Separable box blur (radius rx horizontally, ry vertically), edge-padded."""
    def ax(a, r, axis):
        if r <= 0:
            return a
        p = np.pad(a, [(r, r) if i == axis else (0, 0) for i in range(a.ndim)], mode="edge")
        c = np.cumsum(p, axis=axis)
        c = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
        n = 2 * r + 1
        return (np.take(c, range(n, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - n), axis=axis)) / n
    return ax(ax(a, rx, 1), ry, 0)


# ---------------------------------------------------------------- rings
def route_mask(r=7):
    """Pixels within r px of any connection route (the lit plate has them baked in)."""
    import re
    txt = (ROOT / "components/lab/charge-routes.ts").read_text(encoding="utf-8")
    routes = [v["route"] for v in json.loads(txt[txt.index("= {") + 2: txt.rindex("}") + 1]).values()]
    pg = (ROOT / "components/lab/playground-route.ts").read_text(encoding="utf-8")
    pgr = json.loads(re.search(r"PLAYGROUND_ROUTE[^=]*= (\[\[.*?\]\]);", pg).group(1))
    # /lab-v2's Playground line runs 62 px past the route's end, towards the station (M1.4E.3, PG_V2_EXT).
    (ax, ay), (bx, by) = pgr[-2], pgr[-1]
    n = np.hypot(bx - ax, by - ay)
    routes.append(pgr + [[bx + (bx - ax) / n * 62, by + (by - ay) / n * 62]])
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for rt in routes:
        d.line([tuple(p) for p in rt], fill=255, width=2 * r)
        for p in (rt[0], rt[-1]):
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)
    return np.asarray(im) > 0


# Playground's drawn ring: a thin crisp core and a short glow, in the warm silver of the extracted ring lips
# (Engineering, Creative, Experience: R:G:B = 1 : 0.68-0.71 : 0.43-0.49 where brightest), at about
# their strength (8-bit light added).
PG_RING = dict(rgb=(1.0, 0.69, 0.46), core=30.0, core_w=0.75, glow=7.0, glow_w=2.2)
# M1.4G.1: before the energy arrives the ring is unlit metal: a fainter, neutral warm-grey line (the approved
# rings away from the strips); the amber is added on arrival (playground-ring-lit.png).
PG_RING_REST = dict(rgb=(1.0, 0.9, 0.8), core=13.0, core_w=0.75, glow=2.5, glow_w=2.2)


AMBER = np.array(PG_RING["rgb"]) / (np.array(PG_RING["rgb"]) @ LUM)  # unit luminance


def playground_ring(d, p=None):
    p = p or PG_RING
    i = p["core"] * np.exp(-((d / p["core_w"]) ** 2)) + p["glow"] * np.exp(-np.abs(d) / p["glow_w"])
    i = np.where(np.abs(d) < 10, i, 0)
    return i[..., None] * np.array(p["rgb"])


def ring_light(clean, occ, plate=None, near_line=None):
    total = np.zeros((H, W, 3))
    band_all = np.zeros((H, W))
    rep = {}
    for name, e in RINGS.items():
        d, v = ell_dist(e)
        ad = np.abs(d)
        # the ring (+-3 px) and the plinth disc inside it, up to the base (DISC px): its lit top, as approved
        dd = DISC.get(name, DISC_DEFAULT)
        band = np.where(d < 0, 1 - m14f.smooth(-d, dd - 1.5, dd), 1 - m14f.smooth(d, 2.0, 3.2))
        if name == "playground":
            # v2 Playground is not the plate's station, so its ring can't be cut from the plate (the plate's
            # base and lit strip ends lie in the band): it is drawn on the measured disc edge instead.
            ring = playground_ring(d)
            if not G1:
                total = np.maximum(total, ring)
            rep[name] = dict(e, drawn=True, peak=round(float(ring.max()), 1))
            continue
        vis = ~occ
        band = band * vis
        known = d > 4.0
        x0, x1 = int(e["cx"] - e["rx"] - 12), int(e["cx"] + e["rx"] + 12)
        y0, y1 = int(e["cy"] - e["ry"] - 12), int(e["cy"] + e["ry"] + 12)
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        sub = (slice(y0, y1), slice(x0, x1))
        src = np.where(near_line[..., None], clean, plate)[sub]  # lit segments as approved, never a connection
        B = m14f.diffuse(src, known[sub], (1, 2, 3, 5, 8, 12, 18, 27, 40, 60))
        L = np.clip(src - B, 0, None) * band[sub][..., None]
        # The difference against the plate's warm floor comes out cool; the lips themselves are amber where
        # lit (measured R:G:B 1 : 0.68-0.71 : 0.43-0.49): keep the extracted brightness, in that colour.
        L = (L @ LUM)[..., None] * AMBER
        total[sub] = np.maximum(total[sub], L)
        band_all[sub] = np.maximum(band_all[sub], band[sub])
        rep[name] = dict(e, visible_px=int((band > 0.5).sum()), mean_light=round(float(L.max(2)[band[sub] > 0.5].mean()), 2) if (band[sub] > 0.5).any() else 0)
    return total, band_all, rep


# ---------------------------------------------------------------- reflections
def contact_line(a, x_range=None):
    """Per column, the lowest opaque pixel (the station's bottom edge); -1 where none."""
    op = a > 0.5
    has = op.any(0)
    yb = np.where(has, H - 1 - np.argmax(op[::-1], 0), -1)
    if x_range:
        yb[: x_range[0]] = -1
        yb[x_range[1]:] = -1
    return yb


def reflection(layer, yb, gloss):
    """Bright parts of a station mirrored about its bottom edge, streaked, faded, broken by the floor's grain."""
    a = layer[..., 3] / 255
    rgb = layer[..., :3]
    lum = rgb @ LUM
    src = rgb * (a * m14f.smooth(lum, 110, 230))[..., None]
    out = np.zeros((H, W, 3))
    ys = np.arange(H)
    for x in np.nonzero(yb >= 0)[0]:
        y0 = yb[x]
        h = ys - y0  # distance below the contact
        ok = (h > 0) & (h <= REFL["max_drop"])
        sy = y0 - h[ok]
        good = sy >= 0
        col = np.zeros((H, 3))
        idx = np.nonzero(ok)[0][good]
        col[idx] = src[sy[good], x]
        col[idx] *= np.exp(-h[idx] / REFL["fade"])[:, None]
        out[:, x] = col
    for _ in range(3):
        out = box1(out, REFL["side"], REFL["streak"])
    return out * (gloss * STRIATION[None, :])[..., None] * REFL["k"]


def _striation():
    """The polished floor's anisotropy: reflections break into vertical streaks. A fixed-seed column
    modulation (mean 1, std REFL['striation'], correlated over ~3-5 px), so the result is deterministic."""
    n = np.random.default_rng(14).normal(size=W + 16)
    for _ in range(2):
        n = np.convolve(n, np.ones(5) / 5, mode="same")
    n = (n - n.mean()) / n.std()
    return np.clip(1 + REFL["striation"] * n[8:-8], 0.25, 1.9)


STRIATION = _striation()


def beyond(light, existing):
    """The part of a light beyond what is already there, in its own hue: scaled down by the share of its
    luminance the existing light already supplies. (M1.4G subtracted channel by channel, which left the
    blue of a warm-white reflection over amber light: cyan streaks below Creative Studio's strip end.)"""
    le, ll = existing @ LUM, light @ LUM
    return light * np.clip(1 - le / np.maximum(ll, 1e-3), 0, 1)[..., None]


def hue_of(light, plate):
    """Light (a difference of the two plates) in the approved pixel's own hue, at its own luminance. Where the
    approved pixel is clipped near white and the line-free one a darkened amber, the raw difference is cyan
    (e.g. 255,252,228 - 138,96,68 = 117,156,160 at Creative Studio's strip end): not the artwork's colour."""
    pl = plate @ LUM
    return (light @ LUM)[..., None] * plate / np.maximum(pl, 1)[..., None]


def dilate(m, r):
    o = m.copy()
    for _ in range(r):
        o = o | np.roll(o, 1, 0) | np.roll(o, -1, 0) | np.roll(o, 1, 1) | np.roll(o, -1, 1)
    return o


def contact_shadow(a, yb):
    """A thin contact shadow under the bottom edge: dense at the edge, gone within ~10 px."""
    op = a > 0.5
    below = np.zeros((H, W), bool)
    ys = np.arange(H)[:, None]
    below = (ys > yb[None, :]) & (yb[None, :] >= 0)
    dist = np.full((H, W), 99.0)
    cur = op.copy()
    for r in range(1, 13):
        nxt = dilate(cur, 1)
        dist[nxt & ~cur] = r
        cur = nxt
    s = 0.34 * np.exp(-(dist - 1) / 2.2) + 0.12 * np.exp(-(dist - 1) / 6.0)
    s = np.where(below & ~op & (dist < 13), s, 0)
    return s


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    clean = m14f.load(SRC / "environment-lines-removed.png")
    env = m14f.load(m14f.ENV)
    occ = np.zeros((H, W))
    for p in list(V2.glob("m14f/creative.png")) + list(V2.glob("m14f/experience.png")) + [V2 / "m14f1/engineering.png", V2 / "m14f1/educational.png", V2 / "m14e/hub.png", V2 / "m14e/fg-table.png", V2 / "m14e/fg-plant.png"]:
        occ = np.maximum(occ, rgba(p)[..., 3] / 255)
    occ = occ > 0.3

    if "--fit" in sys.argv:
        print("refit: see the module docstring; parameters above are the result")

    plate = m14f.load(SRC / "lab-plate.png")
    near_line = route_mask()
    rings, band, rep = ring_light(clean, occ, plate, near_line)

    # The v2 floor's grain: luminance over its local mean (keeps tile seams and texture in the reflections).
    el = env @ LUM
    gloss = np.clip(el / np.maximum(box1(el, 6, 6), 1), 0.45, 1.9) ** 1.3

    existing = np.zeros((H, W, 3))
    for _, lp in STATIC.values():
        L = rgba(lp)
        existing += L[..., :3] * (L[..., 3:] / 255)
    refl = np.zeros((H, W, 3))
    contact = np.zeros((H, W))
    station_any = occ.copy()
    for name, (sp, _) in STATIC.items():
        lay = rgba(sp)
        a = lay[..., 3] / 255
        yb = contact_line(a)
        r = reflection(lay, yb, gloss)
        refl = np.maximum(refl, r)
        contact = np.maximum(contact, contact_shadow(a, yb))
        rep.setdefault("reflection", {})[name] = round(float(r.max(2).sum() / 255), 1)
    refl = (beyond(refl, existing) if G1 else np.clip(refl - existing, 0, None)) * (~station_any)[..., None]

    # Playground: the v2 station (with its unpowered strips at rest), and the strips' extra light once powered.
    pg = placed(PG["src"], PG["scale"], PG["tx"], PG["ty"])
    off = placed(PG["strip_off"], PG["scale"], PG["tx"], PG["ty"])
    pg_rest = over(off, pg)
    yb = contact_line(pg[..., 3] / 255)
    if G1:
        # The strips' whole area (the unpowered overlay's footprint, which also covers their glow on the
        # stone, +8 px) is left out of the reflection at rest, so the floor under the dark strip stays dark;
        # its reflection comes only from the powered station, in the -lit layer, with the strips.
        strip = dilate(off[..., 3] > 10, 8)
        rest_src, lit_src = pg_rest.copy(), pg.copy()
        rest_src[..., 3] *= ~strip
        lit_src[..., 3] *= strip
        r_rest = reflection(rest_src, yb, gloss)
        r_lit = reflection(lit_src, yb, gloss)
    else:
        r_rest = reflection(pg_rest, yb, gloss)
        r_lit = np.clip(reflection(pg, yb, gloss) - r_rest, 0, None)
    pg_a = pg[..., 3] / 255 > 0.5
    r_rest *= (~pg_a)[..., None]
    r_lit *= (~pg_a)[..., None]

    rings = beyond(rings, existing) if G1 else np.clip(rings - existing, 0, None)
    # The strips' approved light on the floor beyond the M1.4F / M1.4F.1 light boxes (e.g. Experience's lit
    # disc at its left end): lit plate minus line-free plate, within 45 px of a recovered base, never on a
    # connection, the hub or Playground (its strips are off at rest), minus what is already carried.
    stations = np.zeros((H, W), bool)
    for sp, _ in STATIC.values():
        stations |= rgba(sp)[..., 3] > 127
    hub = dilate(rgba(V2 / "m14e/hub.png")[..., 3] > 30, 12)
    near = dilate(stations, 45) & ~occ & ~near_line & ~hub
    near[430:640, 1000:1430] = False
    spill = np.clip(plate - clean, 0, None) * near[..., None]
    spill = np.clip(spill - existing, 0, None)
    if G1:
        spill = hue_of(spill, plate)  # what remains, in the approved pixel's hue
    rep["strip_spill_px"] = int((spill.max(2) > 2).sum())
    rings = rings + spill
    # Nothing under the connections' cores (they are drawn above, unchanged; this keeps them exactly as they
    # were, dim or charged): the light is cleared within 2.5 px of every route, feathered over 1 px.
    core = box1(route_mask(3).astype(np.float64), 1, 1)
    keep = (1 - core)[..., None]
    rings, refl = rings * keep, refl * keep
    r_rest, r_lit = r_rest * keep, r_lit * keep
    light = np.clip(rings + refl, 0, 255)

    def save_light(rgb, p):
        la = rgb.max(2) / 255
        m14f.save_rgba(np.where(la[..., None] > 0, rgb / np.maximum(la, 1e-6)[..., None], 0), la, p)

    dst = OUT1 if G1 else OUT
    dst.mkdir(parents=True, exist_ok=True)
    save_light(light, dst / "floor-light.png")
    save_light(r_rest, dst / "playground-reflection.png")
    save_light(r_lit, dst / "playground-reflection-lit.png")
    if G1:
        d, _ = ell_dist(RINGS["playground"])
        ring_rest = playground_ring(d, PG_RING_REST)
        ring_lit = np.clip(playground_ring(d) - ring_rest, 0, None)
        # Playground's reflection occlusion: in the polished floor the area just in front of the base reflects
        # the (dark) station body, not the room's lamps behind it, so the v2 floor's own warm lamp reflection
        # there is dimmed by the station's mirrored silhouette (softened and faded like the reflections,
        # at most OCC_K); the floor's texture stays (a uniform darkening). The powered strip's reflection adds
        # the warmth back on arrival. It drops with the lift, like the reflection.
        sil = pg.copy()
        sil[..., :3] = 255
        occl = reflection(sil, yb, np.ones((H, W))) / (255 * REFL["k"])
        occl = np.clip(occl.max(2) / np.maximum(STRIATION[None, :], 1e-3), 0, 1)  # the silhouette, without streaks
        occl = OCC_K * occl * (~pg_a)
        m14f.save_rgba(np.zeros((H, W, 3)), occl, OUT1 / "playground-occlusion.png")
        rep["playground_occlusion_max"] = round(float(occl.max()), 3)
        save_light(ring_rest * keep, OUT1 / "playground-ring.png")
        save_light(ring_lit * keep, OUT1 / "playground-ring-lit.png")
        # Creative Studio's own floor light (M1.4F, untouched): the same cyan difference at its strip's right
        # end; a copy with only those pixels (blue above red) given the approved pixel's hue.
        cl = rgba(V2 / "m14f/creative-light.png")
        cll = cl[..., :3] * cl[..., 3:] / 255
        bad = (cll[..., 2] - cll[..., 0]) > 2
        fixed = np.where(bad[..., None], hue_of(cll, plate), cll)
        save_light(fixed, OUT1 / "creative-light.png")
        rep["creative_light_pixels_rehued"] = int(bad.sum())
    m14f.save_rgba(np.zeros((H, W, 3)), np.clip(contact, 0, 1), OUT / "contact.png")
    fm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(fm).polygon(FLOOR, fill=255)
    fm = np.asarray(fm).astype(np.float64) / 255
    fm = box1(fm, 10, 10)
    m14f.save_rgba(np.zeros((H, W, 3)), fm, OUT / "floor-mask.png")

    rep["files"] = {f"{p.parent.name}/{p.name}": p.stat().st_size for p in sorted(list(OUT.glob("*.png")) + list(OUT1.glob("*.png")))}
    (WORK / "floor.json").write_text(json.dumps(rep, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(rep, indent=1))
    # Check: the layers over the v2 room (no stations), and with the stations.
    comp = np.clip(env * (1 - contact[..., None]) + light + r_rest, 0, 255)
    Image.fromarray(comp.astype(np.uint8)).save(WORK / "check-floor.png")


if __name__ == "__main__":
    main()
