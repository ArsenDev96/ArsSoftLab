"""M1.4H.2: Educational's activation layers for /lab-v2 (experimental).

Every layer is a partition or a copy of what /lab-v2 already shows (M1.4F.1's
recovered Educational, the current floor light) or of the approved artwork's
own unpowered strips; nothing is painted. Writes public/scene/v2/m14h2/ and
components/lab/educational-v2.ts only; every earlier milestone's file is read,
never written.

The station is split additively in premultiplied colour AND alpha:
    station = body + globe + orbit          (exact, per pixel)
so the component draws body normally and adds globe and orbit (plus-lighter,
inside one isolated group): resampling is linear, so the sum has no seam at
any scale, and dimming the globe lets the room show through the glass.

  educational-body.png         stone, island, church, trees, mountains, without
                               the hologram's light and the ring (normal)
  educational-globe.png        the hologram: bubbles, sky, glass bowl, and the cyan
                               light on the island's rock and the stone top
  educational-orbit.png        the amber ring
  educational-globe-light.png  the same split of the station's light layer
  educational-orbit-light.png  (plus-lighter in the scene, as M1.4F.1's)
  educational-strip-floor.png  its strips' floor light
  educational-strip-off.png    the strips unpowered (the approved darkened plate)
  educational-strip-light.png  the strips' own light, for the pulse
  educational-floor.png        Educational's warm share of the floor light
  educational-floor-cyan.png   its cyan share (the globe's reflection)
  floor-light.png              the current floor light without those shares
  educational-wave.png         sprite (alpha): how much of the globe is awake, per
                               frame, from the bubbles' own sphere geometry
  educational-crest.png        sprite (alpha): the wave's bright front
  educational-flare.png        the globe's own light, for the crest to brighten
  educational-base.png         the globe's own light at its foot, for the pulse
  educational-ring-core.png    mask (alpha) of the ring's visible pixels (the occlusion)
  educational-light.png        sprite (plus-lighter): the light running round the ring,
                               through that mask

    python scripts/m14h2-educational.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


m14f = module("m14f", "scripts/m14f-extract.py")
m14f1 = module("m14f1", "scripts/m14f1-extract.py")
W, H = m14f.W, m14f.H
V2 = ROOT / "public/scene/v2"
OUT = V2 / "m14h2"
WORK = ROOT / "docs/m1.4h2/work"
EDU = m14f1.EDUCATIONAL
smooth = m14f.smooth
yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)

# Educational's share of the floor light (scene px): its ring (x 662-1014, y 474-502) and its reflections down to
# the hub's platform (y 575). Engineering's share ends at x 632; nothing of another station is in here.
FLOOR_SHARE = (652, 474, 1026, 580)

# The glass bubbles, fitted to the plate's rim ridges (pixel indices): great bubble RMS 0.2 px over 98 % of the arc
# 150-300 deg; dome RMS 0.57 px over its left and top; the small dome's right limb RMS 0.14 px.
SPHERES = dict(great=(786.2, 352.9, 77.4), dome=(841.0, 372.8, 73.7), small=(916.0, 368.7, 41.2))
# Where the wave enters each sphere (unit vector: x right, y down, z to the viewer) and its time window (0-1):
# it climbs the great bubble from its bright foot at the left, over its top, then the dome, then the small dome:
# around the island, left to right, while the glass bowl fills from the pool up.
WAVE = dict(
    great=dict(p=(-0.62, 0.74, 0.30), t=(0.00, 0.70)),
    dome=dict(p=(-0.72, 0.58, 0.38), t=(0.26, 0.82)),
    small=dict(p=(-0.62, 0.66, 0.42), t=(0.48, 0.90)),
)
BOX = (656, 256, 356, 188)  # x, y, w, h: every hologram pixel, plus a margin
FRAMES = 22
SCALE = 0.5
# The light's sprite: frames of its box in a grid, steps (frames - 1), how far past the ring's end it runs.
LIGHT_BOX = (656, 296, 352, 150)
LIGHT_GRID = (6, 7)
LIGHT_STEPS = 41
LIGHT_TAIL = 60

# The ring, hand-traced for the homepage (scene-fx ORBIT), refined below on the plate's ridge.
TRACE = [
    (673.5, 404), (676, 395), (682.5, 387.5), (697.5, 376), (720, 362.5), (740, 355), (770, 348), (800, 342), (830, 338),
    (860, 336), (900, 333.5), (922.5, 327.5), (955, 316), (980, 310), (990, 311.5), (992, 316), (990, 330), (977.5, 352.5),
    (960, 372.5), (930, 392.5), (897.5, 407.5), (875, 422), (845, 431), (807.5, 433), (770, 430), (740, 425), (717.5, 421.5),
    (692.5, 420.5), (679, 416),
]


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def prem(a):
    return a[..., :3] * a[..., 3:] / 255


def save_prem(P, A, p):
    """Premultiplied colour (0-255) and alpha (0-1), as straight RGBA; alpha at least the brightest channel's."""
    a = np.clip(np.maximum(A, P.max(2) / 255), 0, 1)
    m14f.save_rgba(np.where(a[..., None] > 0, P / np.maximum(a, 1e-6)[..., None], 0), a, p)


def save_alpha(a, p):
    m14f.save_rgba(np.full((H, W, 3), 255.0), np.clip(a, 0, 1), p)


def bilinear(im, x, y):
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    return im[y0, x0] * (1 - fx) * (1 - fy) + im[y0, x0 + 1] * fx * (1 - fy) + im[y0 + 1, x0] * (1 - fx) * fy + im[y0 + 1, x0 + 1] * fx * fy


def gauss1(v, s):
    r = int(3 * s + 1)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / s) ** 2)
    return np.convolve(np.pad(v, r, mode="edge"), k / k.sum(), "valid")


def catmull_closed(pts, n=12):
    P = np.array(pts)
    out = []
    for i in range(len(P)):
        a, b, c, d = P[i - 1], P[i], P[(i + 1) % len(P)], P[(i + 2) % len(P)]
        for s in range(n):
            t = s / n
            out.append(0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t**3))
    return np.array(out)


def trace_ring(C):
    """The ring's centre line: the hand trace, moved onto the plate's own ridge (brightness over both flanks, within
    +-6 px along the normal) wherever the ring is visible and the ridge is clear, smoothed (sigma 4 px along it);
    the hidden spans keep the smooth continuation between their ends. Returned as an open path in the order the
    energy runs: out of the globe's foot, up the front of the island, round the right end, behind the island, out at
    the left, round the left end and back under the ivy."""
    c = catmull_closed(TRACE)
    cc = np.vstack([c, c[:1]])
    s = np.r_[0, np.cumsum(np.hypot(*np.diff(cc, axis=0).T))]
    n = int(s[-1])
    ss = np.arange(n) * s[-1] / n
    X, Y = np.interp(ss, s, cc[:, 0]), np.interp(ss, s, cc[:, 1])
    tx, ty = np.roll(X, -2) - np.roll(X, 2), np.roll(Y, -2) - np.roll(Y, 2)
    ln = np.hypot(tx, ty)
    nx, ny = -ty / ln, tx / ln
    off = np.arange(-9, 9.01, 0.25)
    prof = bilinear(C, X[:, None] + nx[:, None] * off, Y[:, None] + ny[:, None] * off) @ np.array([0.6, 0.5, -0.1])
    best, strength = np.zeros(n), np.zeros(n)
    for i in range(n):
        p = prof[i]
        r = np.full(len(off), -1e9)
        for j in range(12, len(off) - 12):
            r[j] = p[j - 2 : j + 3].mean() - max(p[j - 12 : j - 7].mean(), p[j + 8 : j + 13].mean())
        j = int(np.argmax(r))
        best[i], strength[i] = off[j], r[j]
    i = np.arange(n)
    # Visible: the left half (to where it passes behind the dome's glass), the right half from the dome's foot round
    # to the globe's foot (indices along the trace, about 1 px each).
    visible = (i <= 98) | (i >= 664) | ((i >= 252) & (i <= 530))
    good = visible & (strength > 38) & (np.abs(best) < 5.5)
    ii = i[good]
    ext_i = np.r_[ii - n, ii, ii + n]
    ext_b = np.r_[best[good], best[good], best[good]]
    d = np.interp(np.arange(-n, 2 * n), ext_i, ext_b)
    # Median (9) then Gaussian along the ring.
    med = np.array([np.median(d[max(0, k - 4) : k + 5]) for k in range(len(d))])
    d = gauss1(med, 4.0)[n : 2 * n]
    X, Y = X + nx * d, Y + ny * d
    # The path runs backwards through the trace: 500 -> 252 (front, right end, back) -> 98 (hidden) -> 0 -> 656
    # (left end, ivy). Below index 500 the hand trace leaves the painted ring, so the front's foot is followed
    # column by column on its warm ridge down into the glow (x 884 -> 822), seeded by points read at 4x.
    order = np.r_[np.arange(500, -1, -1), np.arange(n - 1, 655, -1)]
    P = np.c_[X[order], Y[order]]
    fxs = np.arange(822, int(P[0, 0]) - 3)
    seed = np.interp(fxs, [822, 827, 833, 840, 847, 855, P[0, 0]], [434.4, 433.5, 432.0, 430.4, 428.5, 426.3, P[0, 1]])
    warmth = C[..., 0] - 0.55 * C[..., 2]
    warmth = (np.roll(warmth, 1, 1) + warmth + np.roll(warmth, -1, 1)) / 3
    fy = []
    for x, y in zip(fxs, seed):
        r = np.arange(int(round(y)) - 3, int(round(y)) + 4)
        w = np.clip(warmth[r, x] - np.median(warmth[r, x]), 0, None) ** 2 * np.exp(-(((r - y) / 2.0) ** 2))
        fy.append((w * r).sum() / w.sum() if w.sum() > 50 else y)
    fy = gauss1(np.array([np.median(fy[max(0, k - 4) : k + 5]) for k in range(len(fy))]), 4.0)
    P = np.vstack([np.c_[fxs, fy], P])
    keep = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
    u = np.arange(0, keep[-1], 1.0)
    P = np.c_[np.interp(u, keep, P[:, 0]), np.interp(u, keep, P[:, 1])]
    # The left foot (x > 689 at the end of the path), read at 4x: the ridge there is broken by the steps behind it.
    foot_l = np.arange(len(P)) > len(P) - 70
    yl = np.interp(P[:, 0], [689.5, 699.5, 715.7, 727, 732], [418.25, 419.75, 420.25, 420.1, 420.1])
    k = smooth(P[:, 0], 686, 694) * foot_l
    P[:, 1] = P[:, 1] * (1 - k) + yl * k
    P = np.c_[gauss1(P[:, 0], 2.2), gauss1(P[:, 1], 2.2)]
    res = np.abs(best - d)[good]
    return P, dict(ridge_points=int(good.sum()), ridge_rms_px=round(float(np.sqrt((res**2).mean())), 2), ridge_p95_px=round(float(np.percentile(res, 95)), 2))


def arc(P):
    return np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]


def ring_fields(P, vis, reach=14):
    """Distance to the ring's path, and its nearest point's visibility and index (only within `reach` px)."""
    d = np.full((H, W), 99.0)
    v = np.zeros((H, W))
    idx = np.zeros((H, W), int)
    for i, ((x, y), w) in enumerate(zip(P, vis)):
        x0, x1, y0, y1 = int(x) - reach, int(x) + reach + 2, int(y) - reach, int(y) + reach + 2
        dd = np.hypot(xx[y0:y1, x0:x1] - x, yy[y0:y1, x0:x1] - y)
        m = dd < d[y0:y1, x0:x1]
        d[y0:y1, x0:x1][m] = dd[m]
        v[y0:y1, x0:x1][m] = w
        idx[y0:y1, x0:x1][m] = i
    return d, v, idx


def wave_frames():
    """Per-pixel wave timing from the bubbles' geometry. Each pixel inside a bubble sees its front and its back
    surface; a surface point lights when the wave, spreading over the sphere from its entry point, reaches it
    (its geodesic distance). Pixels near the limb follow their own sphere (the rims), the rest mixes every surface
    it looks through; outside every bubble (the glow, the bowl) the nearest limb or the height above the foot."""
    x0, y0, w, h = BOX
    X, Y = xx[y0 : y0 + h, x0 : x0 + w], yy[y0 : y0 + h, x0 : x0 + w]
    terms = []  # (weight, phase)
    for k, (cx, cy, r) in SPHERES.items():
        p = np.array(WAVE[k]["p"])
        p = p / np.linalg.norm(p)
        t0, t1 = WAVE[k]["t"]
        dx, dy = (X - cx) / r, (Y - cy) / r
        rho = np.hypot(dx, dy)
        q = np.maximum(rho, 1)  # outside: the nearest limb point
        ux, uy = dx / q, dy / q
        uz = np.sqrt(np.clip(1 - ux**2 - uy**2, 0, 1))
        fres = (1 - uz) ** 2
        near = np.where(rho <= 1, 1.0, np.exp(-(((rho - 1) * r) / 14.0) ** 2))
        for sgn, base in ((1, 0.42), (-1, 0.26)):  # front, back surface
            g = np.arccos(np.clip(ux * p[0] + uy * p[1] + sgn * uz * p[2], -1, 1)) / np.pi
            terms.append((near * (base + 1.6 * fres), t0 + (t1 - t0) * g))
    # The foot (the pool, the bowl) lights first, from the bottom up; right of the island the bowl's lip follows it.
    foot = smooth(Y, 384, 428)
    low = 0.04 + 0.14 * np.clip((436 - Y) / 56, 0, 1)
    rise = low + 0.58 * np.clip((380 - Y) / 115, 0, 1)
    terms.append((4.0 * foot, low))
    right = smooth(X, 950, 978) * smooth(Y, 340, 366)
    terms.append((2.5 * right, 0.10 + 0.62 * np.clip((428 - Y) / 78, 0, 1)))
    terms.append((np.full_like(X, 0.05), rise))
    tot = sum(t[0] for t in terms)
    edge = 0.10
    wave, crest = [], []
    for k in range(FRAMES + 1):
        t = k / FRAMES
        r = sum(wt * smooth(t - ph, 0.0, edge) for wt, ph in terms) / tot
        b = sum(wt * np.where(t < ph, np.exp(-(((ph - t) / 0.035) ** 2)), np.exp(-(((t - ph) / 0.085) ** 2))) for wt, ph in terms) / tot
        fade = np.clip(min(1, k / 2, (FRAMES - k) / 3), 0, 1)
        wave.append(np.zeros_like(X) if k == 0 else np.ones_like(X) if k == FRAMES else r)
        crest.append(b * fade)
    return wave, crest


def save_sprite(frames, p):
    w, h = int(BOX[2] * SCALE), int(BOX[3] * SCALE)
    a = np.concatenate([np.asarray(Image.fromarray((np.clip(f, 0, 1) * 255).round().astype(np.uint8)).resize((w, h), Image.BOX)) for f in frames], 1)
    o = np.full((*a.shape, 4), 255, np.uint8)
    o[..., 3] = a
    Image.fromarray(o).save(p, optimize=True)
    return o.shape[:2]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    st = rgba(V2 / "m14f1/educational.png")
    li = rgba(V2 / "m14f1/educational-light.png")
    fl = rgba(V2 / "m14h1/floor-light.png")
    env = rgba(V2 / "environment/lab-background.png")[..., :3]
    plate = m14f.load(m14f.SRC_DIR / "lab-plate.png")
    clean = m14f.load(m14f.SRC_DIR / "environment-lines-removed.png")
    A = st[..., 3] / 255
    P = prem(st)
    L = prem(li)
    hard = m14f.union_mask(EDU["hard"])
    island = m14f.polygon_mask(EDU["hard"][1])
    rep = {}
    zero = np.zeros((H, W))

    # --- the ring: its path, and what hides it.
    path, rep["ring"] = trace_ring(clean)
    s = arc(path)
    total = float(s[-1])
    # Visibility along the path. Hidden: behind the dome's glass, the mountains and the church (from the dome's foot
    # at the right, x 903, to where it comes out of the glass at the left, x 757), and the two feet (into the glow and
    # the ivy). Behind the great bubble's glass (x 757-709, on the way out) it is seen through glass.
    at = lambda x, y: int(np.argmin(np.hypot(path[:, 0] - x, path[:, 1] - y)))
    iback, iout, iglass = at(903, 337.5), at(757, 345.5), at(709, 369)
    vis = np.ones(len(path))
    vis *= 1 - smooth(s, s[iback] - 14, s[iback] + 2) * (1 - smooth(s, s[iout] - 3, s[iout] + 16))
    vis *= 1 - 0.25 * smooth(s, s[iout], s[iout] + 8) * (1 - smooth(s, s[iglass] - 4, s[iglass] + 4))
    vis *= smooth(s, 0, 10) * (1 - smooth(s, total - 22, total - 2))
    rep["ring"].update(length_px=round(total, 1), hidden_px=[round(float(s[iback]), 1), round(float(s[iout]), 1)])
    d, v, near = ring_fields(path, vis)
    # The back half is never drawn over the island, the mountains or the church.
    iright = int(np.argmax(path[:, 0]))
    front_d, _, _ = ring_fields(path[: iright + 1], vis[: iright + 1])
    over_island = np.where((island > 0.4) & (front_d > 8), 0.0, 1.0)
    # The ring's own light: its amber (or white) excess over what lies beside it.
    Pbg = m14f.diffuse(P, d > 7.5, (1, 2, 3, 5, 8, 12))
    Abg = m14f.diffuse(A[..., None], d > 7.5, (1, 2, 3, 5, 8, 12))[..., 0]
    warm = smooth(P[..., 0] - P[..., 2], -30, 25)  # amber to warm white; a blue rim it crosses stays the globe's
    reach = np.where(hard > 0.05, 1 - smooth(d, 2.0, 3.4), 1 - smooth(d, 4.5, 7.0))  # narrow over the opaque artwork
    band = reach * (v > 0.02) * over_island * warm
    Eo = np.clip(P - Pbg, 0, None) * band[..., None]
    Ao = np.clip(A - Abg, 0, None) * band
    # The wide glow at the ring's two ends is the ring's too (amber soft pixels over the room).
    ends = smooth(P[..., 0] - P[..., 2], 25, 60) * (d < 13) * (hard < 0.05) * (v > 0.02) * (Abg < 0.35)
    Eo = np.maximum(Eo, P * ends[..., None])
    Ao = np.maximum(Ao, A * ends)
    peak = np.clip(Eo @ np.array([0.45, 0.45, 0.1]) / 110, 0, 1)

    # --- the hologram: every blue soft pixel, and the cyan light on the opaque rock and stone.
    Pr, Ar = P - Eo, A - Ao
    R, G, B = Pr[..., 0], Pr[..., 1], Pr[..., 2]
    soft = 1 - smooth(hard, 0.25, 0.75)
    blue = smooth(B - R, -8, 22)
    # Sky that M1.4F.1's hard outlines took in (slivers beside the church's drum, between the shrubs at the left, and
    # a pixel or two along the left mountains' ridge; Ararat's snow is left whole) is the hologram's too: otherwise it would stay lit in standby.
    inbox = lambda x0, y0, x1, y1: (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
    sky = smooth(B - R, 6, 34) * inbox(838, 296, 916, 341)
    sky = np.maximum(sky, smooth(B - np.maximum(R, 0.82 * G), 6, 36) * inbox(700, 355, 765, 400))
    S = m14f.diffuse(Pr, (soft > 0.95) & (A > 0.95), (1, 2, 3, 5, 8))
    deep = m14f.box((hard > 0.99).astype(np.float64), 5) > 0.999
    M = m14f.diffuse(Pr, deep, (1, 2, 3, 5, 8, 12))
    edge = (m14f.box((soft > 0.95).astype(np.float64), 4) > 0.02) & (hard > 0.25) & inbox(745, 296, 838, 378)
    SM = S - M
    key = ((Pr - M) * SM).sum(2) / np.maximum((SM**2).sum(2), 1)
    sky = np.maximum(sky, smooth(key, 0.35, 0.9) * edge * (np.sqrt((SM**2).sum(2)) > 24))
    # The pale haze between the church and Ararat, and the small dome's rim where it runs over the outline.
    Y_ = Pr @ np.array([0.299, 0.587, 0.114])
    sky = np.maximum(sky, smooth(Y_, 128, 168) * smooth(B - R, -6, 8) * inbox(884, 326, 930, 354) * (1 - smooth(xx, 916, 926)))
    sx, sy, sr = SPHERES["small"]
    rim = 1 - smooth(np.abs(np.hypot(xx - sx, yy - sy) - sr), 0.9, 2.1)
    sky = np.maximum(sky, rim * smooth(B - R, -4, 12) * inbox(936, 330, 975, 376))
    soft = np.maximum(soft, sky * (hard > 0))
    rep["sky inside the hard outlines (px)"] = int(((sky > 0.2) & (hard > 0.5)).sum())
    wg = soft * blue * (yy < 440)
    Pg = Pr * wg[..., None]
    Ag = Ar * wg
    # Cyan on opaque pixels: what exceeds the rock's own colour (about neutral), only where it is clearly cyan.
    foot = (xx > 795) & (xx < 950) & (yy > 372) & (yy < 440)
    wc = smooth(B - np.maximum(R, 0.82 * G), 14, 52) * hard * foot
    cb = m14f.box(wc, 2)
    core = cb > 0.45
    base_r = np.where(core, np.minimum(R, 62), R)
    est = np.stack([base_r, np.minimum(G, base_r * 1.02 + 8), np.minimum(B, base_r * 1.06 + 12)], 2)
    wcc = np.maximum(wc, np.where(core, cb, 0) * smooth(B, 120, 190)) * (hard > 0.5) * (1 - soft)
    # In the pool itself, white-hot pixels and the ring's fringe beside the cyan are its light too.
    pool = smooth(m14f.box(wc, 5), 0.12, 0.35) * smooth(yy, 409, 417) * foot * (hard > 0.5) * smooth(Y_, 62, 110)
    est = np.where((pool > wcc)[..., None], np.minimum(Pr, np.array([70.0, 74.0, 78.0])), est)
    wcc = np.maximum(wcc, pool)
    Ec = np.clip(Pr - est, 0, None) * wcc[..., None]
    Pg = np.minimum(Pg + Ec, np.maximum(Pr, 0))
    body_P = Pr - Pg
    body_A = Ar - Ag
    save_prem(body_P, body_A, OUT / "educational-body.png")
    save_prem(Pg, Ag, OUT / "educational-globe.png")
    save_prem(Eo, Ao, OUT / "educational-orbit.png")
    rep["partition (px): globe soft, cyan on rock, orbit"] = [int((wg * A > 0.01).sum()), int((Ec.max(2) > 2).sum()), int((Eo.max(2) > 2).sum())]
    isl = (hard > 0.98) & ~foot & (d > 8) & (sky < 0.02)
    rep["landscape, church, stone (opaque, off the foot and ring): px changed by the split"] = int((np.abs(body_P - P).max(2)[isl] > 0.01).sum())

    # --- the light layer, split the same way: strips' floor light (y >= 476), the ring's, the globe's (the rest).
    Ls = L * (yy >= 476)[..., None]
    Lo = L * (smooth(L[..., 0] - L[..., 2], 0, 12) * (d < 14) * (yy < 476))[..., None]
    Lg = L - Ls - Lo
    save_prem(Lg, zero, OUT / "educational-globe-light.png")
    save_prem(Lo, zero, OUT / "educational-orbit-light.png")
    save_prem(Ls, zero, OUT / "educational-strip-floor.png")

    # --- the strips, unpowered (M1.4F.1's own rule for where the station took the lit plate), and their light.
    region = np.maximum(hard, m14f.union_mask([q["poly"] for q in EDU["soft"]]))
    lx0, ly0, lx1, ly1 = EDU["line_box"]
    in_line = (xx >= lx0) & (xx < lx1) & (yy >= ly0) & (yy < ly1)
    strip = (np.abs(plate - clean).sum(2) > 6) & (region > 0) & ~in_line & (A > 0)
    off_a = A * strip
    m14f.save_rgba(clean, off_a, OUT / "educational-strip-off.png")
    save_prem(np.clip(plate - clean, 0, None) * off_a[..., None], zero, OUT / "educational-strip-light.png")
    ys_, xs_ = np.nonzero(strip)
    rep["strip pixels"] = dict(px=int(strip.sum()), bbox=[int(xs_.min()), int(ys_.min()), int(xs_.max()), int(ys_.max())])
    rep["station == lit plate on the strip pixels (max diff)"] = float(np.abs(st[..., :3] - plate)[strip & (A > 0.999)].max())

    # --- the floor: Educational's share, warm (the strips) and cyan (the globe); byte-identical elsewhere.
    fx0, fy0, fx1, fy1 = FLOOR_SHARE
    Rm = m14f.box((((xx >= fx0) & (xx < fx1) & (yy >= fy0) & (yy < fy1))).astype(np.float64), 2)
    FL = prem(fl)
    share = FL * Rm[..., None]
    cyan = smooth(share[..., 2] - share[..., 0], -2, 8)[..., None]
    save_prem(share * (1 - cyan), zero, OUT / "educational-floor.png")
    save_prem(share * cyan, zero, OUT / "educational-floor-cyan.png")
    rest = FL - share
    ra = np.clip(rest, 0, 255).max(2) / 255
    rr = np.zeros((H, W, 4))
    rr[..., :3] = np.where(ra[..., None] > 0, np.clip(rest, 0, 255) / np.maximum(ra, 1e-6)[..., None], 0)
    rr[..., 3] = ra * 255
    rr = np.clip(np.round(rr), 0, 255)
    rr[ra * 255 < 0.5] = 0
    rr[Rm == 0] = fl[Rm == 0]
    Image.fromarray(rr.astype(np.uint8)).save(OUT / "floor-light.png", optimize=True)
    rep["floor light: pixels outside Educational's share changed"] = int((np.abs(rr - fl).max(2)[Rm == 0] > 0).sum())
    rep["floor light share (px > 2): warm, cyan"] = [int(((share * (1 - cyan)).max(2) > 2).sum()), int(((share * cyan).max(2) > 2).sum())]

    # --- the wave: frames from the sphere geometry; the light it brightens is the hologram's own.
    wave, crest = wave_frames()
    rep["sprite"] = dict(frames=FRAMES + 1, shape=list(save_sprite(wave, OUT / "educational-wave.png")))
    save_sprite(crest, OUT / "educational-crest.png")
    holo = Pg + Lg
    cx, cy, r = SPHERES["great"]
    rho = np.hypot(xx - cx, yy - cy) / r
    uz = np.sqrt(np.clip(1 - rho**2, 0, 1))
    # The great bubble's shell: a faint blue, strongest towards its limb, only inside its fitted circle and only
    # where the hologram (not the island) is: the surface the crest runs over between the rim and the map lines.
    shell = np.where(rho < 0.995, 0.10 + 0.5 * (1 - uz) ** 2, 0) * soft * (1 - smooth(yy, 392, 412))
    cx2, cy2, r2 = SPHERES["dome"]
    rho2 = np.hypot(xx - cx2, yy - cy2) / r2
    uz2 = np.sqrt(np.clip(1 - rho2**2, 0, 1))
    shell2 = np.where(rho2 < 0.97, 0.5 * (1 - uz2) ** 2, 0) * soft * smooth(A, 0.6, 0.95) * (yy < 350) * (xx < 905)
    flare = holo * 0.95 + (np.maximum(shell, shell2))[..., None] * np.array([46.0, 150.0, 235.0])
    # Hardly on the pale haze between the church and Ararat (it would clip).
    haze = m14f.box(inbox(884, 330, 932, 358).astype(np.float64), 6)
    flare = flare * (1 - 0.88 * haze)[..., None]
    inside = np.maximum(np.maximum(smooth(Ag, 0.02, 0.25), smooth(Lg.max(2), 1, 10)), (rho < 0.995) * soft)
    save_prem(np.clip(flare * inside[..., None], 0, 255), zero, OUT / "educational-flare.png")
    save_prem(np.clip(holo * (smooth(yy, 392, 424) * (yy < 440))[..., None], 0, 255), zero, OUT / "educational-base.png")

    # --- the highlight's masks: the ring's visible pixels. Core: a narrow band weighted by the ring's own light;
    # halo: a soft wider band. Both follow the path's visibility and never cross the island from behind.
    core_m = np.clip(1.25 * np.exp(-((d / 1.9) ** 2)) * v * over_island * (0.35 + 0.65 * m14f.box(peak, 1)), 0, 1)
    halo_m = 0.9 * np.exp(-((d / 5.2) ** 2)) * v * over_island
    save_alpha(core_m, OUT / "educational-ring-core.png")
    # The light: at frame k its head is at h = k / steps * (length + tail). Along the ring (b px behind the head): a
    # white-hot point, a warm body and a long amber tail; ahead of it, a short round falloff. Across: the core mask,
    # and round the head a restrained glow (the halo mask).
    lx, ly, lw, lh = LIGHT_BOX
    cut = (slice(ly, ly + lh), slice(lx, lx + lw))
    sf, dc, cm, hm = s[near][cut], d[cut], core_m[cut], halo_m[cut]
    amber, hot = np.array([255.0, 172.0, 80.0]), np.array([255.0, 248.0, 232.0])
    sheet = np.zeros((lh * LIGHT_GRID[1], lw * LIGHT_GRID[0], 3))
    for f in range(1, LIGHT_STEPS):
        h = f / LIGHT_STEPS * (total + LIGHT_TAIL)
        back = h - sf
        ahead = np.where(back < 0, np.exp(-((back / 3.0) ** 2)), 1.0)
        b_ = np.clip(back, 0, None)
        point = ahead * np.exp(-((b_ / 15.0) ** 1.4))
        body = ahead * np.exp(-((b_ / 46.0) ** 1.3))
        tail = ahead * np.clip(1 - b_ / 170, 0, 1) ** 1.7
        glow = np.where(back < 0, np.exp(-((back / 6.0) ** 2)), np.exp(-b_ / 20.0))
        rgb = cm[..., None] * (0.50 * tail[..., None] * amber + 0.55 * body[..., None] * (0.55 * amber + 0.45 * hot) + 0.95 * point[..., None] * hot)
        rgb = rgb + (hm * glow * 0.42)[..., None] * (0.75 * amber + 0.25 * hot)
        r_, c_ = divmod(f, LIGHT_GRID[0])
        sheet[r_ * lh : (r_ + 1) * lh, c_ * lw : (c_ + 1) * lw] = np.clip(rgb * np.where(dc < 14, 1, 0)[..., None], 0, 255)
    la = sheet.max(2) / 255
    o_ = np.dstack([np.where(la[..., None] > 0, sheet / np.maximum(la, 1e-6)[..., None], 0), la * 255])
    o_[la * 255 < 0.5] = 0
    Image.fromarray(np.clip(np.round(o_), 0, 255).astype(np.uint8)).save(OUT / "educational-light.png", optimize=True)
    (OUT / "educational-ring-halo.png").unlink(missing_ok=True)

    # --- check: powered, the layers recompose the station exactly (one isolated group: premultiplied sums).
    b, g, o = (rgba(OUT / f"educational-{k}.png") for k in ("body", "globe", "orbit"))
    SP = np.clip(prem(b) + prem(g) + prem(o), 0, 255)
    SA = np.clip((b[..., 3] + g[..., 3] + o[..., 3]) / 255, 0, 1)
    lights = sum(prem(rgba(OUT / f"educational-{k}.png")) for k in ("globe-light", "orbit-light", "strip-floor"))
    floor = sum(prem(rgba(OUT / k)) for k in ("educational-floor.png", "educational-floor-cyan.png", "floor-light.png"))
    now = (env + FL) * (1 - A[..., None]) + P + L
    pw = (env + floor) * (1 - SA[..., None]) + SP + lights
    dd = np.abs(np.clip(pw, 0, 255) - np.clip(now, 0, 255)).max(2)
    rep["powered recomposition vs current (max-channel, 8-bit)"] = dict(mean=round(float(dd.mean()), 4), max=round(float(dd.max()), 2), px_over_2=int((dd > 2).sum()))

    # --- geometry for the component (CSS / SVG px: pixel index + 0.5).
    # Knots every ~11 px (cubic Beziers through them, Catmull-Rom tangents): a light path for the browser to stroke.
    nk = int(round(total / 11)) + 1
    u = np.linspace(0, total, nk)
    kx, ky = np.interp(u, s, path[:, 0]) + 0.5, np.interp(u, s, path[:, 1]) + 0.5
    K = np.c_[kx, ky]
    T = np.vstack([[K[1] - K[0]], (K[2:] - K[:-2]) / 2, [K[-1] - K[-2]]])
    c1, c2 = K[:-1] + T[:-1] / 3, K[1:] - T[1:] / 3
    dstr = f"M{K[0, 0]:.2f} {K[0, 1]:.2f}C" + " ".join(f"{p[0]:.2f} {p[1]:.2f} {q[0]:.2f} {q[1]:.2f} {e[0]:.2f} {e[1]:.2f}" for p, q, e in zip(c1, c2, K[1:]))
    w_ = np.linspace(0, 1, 40)[:, None]
    dense = np.vstack([(1 - w_) ** 3 * K[i] + 3 * (1 - w_) ** 2 * w_ * c1[i] + 3 * (1 - w_) * w_**2 * c2[i] + w_**3 * K[i + 1] for i in range(nk - 1)])
    plen = float(arc(dense)[-1])
    off_path = [float(np.hypot(dense[:, 0] - 0.5 - x, dense[:, 1] - 0.5 - y).min()) for x, y in path[::3]]
    rep["ring"]["bezier knots, max distance from the traced path (px)"] = [nk, round(max(off_path), 2)]
    box_json = json.dumps(dict(x=BOX[0], y=BOX[1], w=BOX[2], h=BOX[3]))
    ts = (
        "// Generated by scripts/m14h2-educational.py (M1.4H.2): do not edit.\n"
        'import type { SceneRect } from "@/lib/scene";\n\n'
        "/** The amber ring, scene px, traced on the plate's own ridge: out of the globe's foot, up the front of the\n"
        "    island, round the right end, behind the island (hidden there), out at the left, round the left end and\n"
        "    under the ivy. */\n"
        f'export const EDU_RING_PATH =\n  "{dstr}";\n'
        f"export const EDU_RING_LENGTH = {plen:.2f};\n\n"
        "/** Box of the globe wave's sprite frames (scene px), and how many steps it takes (frames - 1). */\n"
        f"export const EDU_WAVE_BOX: SceneRect = {box_json};\n"
        f"export const EDU_WAVE_STEPS = {FRAMES};\n\n"
        "/** Box of the ring light's sprite frames (scene px), its grid (columns, rows), steps, and its run past the ring's end. */\n"
        f"export const EDU_LIGHT_BOX: SceneRect = {json.dumps(dict(x=lx, y=ly, w=lw, h=lh))};\n"
        f"export const EDU_LIGHT_GRID = {json.dumps(list(LIGHT_GRID))} as const;\n"
        f"export const EDU_LIGHT_STEPS = {LIGHT_STEPS};\n"
        f"export const EDU_LIGHT_TAIL = {LIGHT_TAIL};\n"
    )
    (ROOT / "components/lab/educational-v2.ts").write_text(ts, encoding="utf-8")

    # --- verification sheets: the traced ring on the artwork at 4x; the split; the wave's frames.
    bx = (655, 255, 1015, 515)
    k = 4
    comp = np.clip(env * (1 - A[..., None]) + P + L, 0, 255)
    up = lambda a: Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).crop(bx).resize(((bx[2] - bx[0]) * k, (bx[3] - bx[1]) * k), Image.LANCZOS)
    im = up(comp)
    dr = ImageDraw.Draw(im)
    for (x, y), w in zip(path, vis):
        q = ((x + 0.5 - bx[0]) * k, (y + 0.5 - bx[1]) * k)
        dr.ellipse([q[0] - 1, q[1] - 1, q[0] + 1, q[1] + 1], fill=(0, 255, 0) if w > 0.99 else (255, int(255 * w), 255))
    for cx, cy, r in SPHERES.values():
        q = ((cx + 0.5 - bx[0]) * k, (cy + 0.5 - bx[1]) * k)
        dr.ellipse([q[0] - r * k, q[1] - r * k, q[0] + r * k, q[1] + r * k], outline=(255, 60, 160))
    im.save(WORK / "geometry-4x.png")
    for name, arr in (("body", prem(b)), ("globe", prem(g)), ("orbit", prem(o) * 1.5), ("lights", lights * 2), ("flare", prem(rgba(OUT / "educational-flare.png"))), ("base", prem(rgba(OUT / "educational-base.png")))):
        up(arr).save(WORK / f"split-{name}-4x.png")
    up(np.dstack([core_m * 255] * 3)).save(WORK / "ring-core-4x.png")
    up(np.dstack([halo_m * 255] * 3)).save(WORK / "ring-halo-4x.png")
    lv = 0.42
    sb = (env + floor) * (1 - np.clip(body_A + lv * Ag + 0.55 * Ao, 0, 1))[..., None] + body_P + lv * (Pg + Lg) + 0.55 * (Eo + Lo)
    up(sb).save(WORK / "standby-4x.png")
    fr = [Image.fromarray((np.clip(np.hstack([wave[i], crest[i]]), 0, 1) * 255).astype(np.uint8)) for i in (3, 6, 9, 12, 15, 18)]
    sheet = Image.new("L", (fr[0].width, fr[0].height * len(fr)))
    for i, f in enumerate(fr):
        sheet.paste(f, (0, i * f.height))
    sheet.save(WORK / "wave-frames.png")
    (WORK / "assets.json").write_text(json.dumps(rep, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
