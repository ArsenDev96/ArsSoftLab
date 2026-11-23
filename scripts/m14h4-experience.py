"""M1.4H.4: Experience's activation layers for /lab-v2 (experimental).

Every layer is a copy of, or light taken from, what /lab-v2 already shows
(M1.4F's recovered Experience and its light layer, the current floor light);
nothing is painted. The station image itself (m14f/experience.png) is always
drawn, unmodified: standby is an overlay on the painted route (and on the stone
and ridge wires its light falls on) that the travelling energy removes, so the
stable state is the approved image. Writes public/scene/v2/m14h4/ and
components/lab/experience-v2.ts only.

  experience-standby.png      the route subdued, and the light it throws on the
                              terrain around it taken back: its own pixels
  experience-reveal.png       sprite (alpha): how much of that overlay is left, per
                              frame: the route's and the terrain's timing
  experience-light.png        sprite (plus-lighter): the light that travels: the
                              route's start, the energy's head, the terrain and
                              flags it passes, the destination. Their own pixels
  experience-strip-off.png    the strips unpowered (the approved darkened plate's light)
  experience-strip-light.png  the strips' own light, in the approved hue, for the pulse
  experience-floor.png        Experience's share of the floor light that follows the
                              strips (ring, spill, strip reflections)
  experience-floor-lit.png    the same for the powered fronts, with the bright floor disc left of the platform
                              (M1.4G's ring spill) held back: a reflection, not a separate oval
  experience-floor-top.png    its share that mirrors the lit landscape
  floor-light.png             the current floor light without those shares

    python scripts/m14h4-experience.py
"""

import heapq
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
W, H = m14f.W, m14f.H
V2 = ROOT / "public/scene/v2"
OUT = V2 / "m14h4"
WORK = ROOT / "docs/m1.4h4/work"
smooth = m14f.smooth
LUM = np.array([0.299, 0.587, 0.114])
yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
XC, YC = xx + 0.5, yy + 0.5  # pixel centres, in scene px

# The painted route, traced on the artwork at 10x (scene px): its centreline from the paving's front edge, where it
# starts, to where it narrows into the ridge wires, and its half width there.
ROUTE = [
    (1410.0, 705.2, 8.0), (1422.0, 702.2, 7.0), (1436.0, 698.4, 6.0), (1448.0, 693.8, 5.8), (1457.0, 689.8, 6.6),
    (1461.5, 685.4, 8.0), (1457.0, 681.0, 6.2), (1449.0, 677.4, 5.0), (1441.0, 674.0, 5.2), (1436.2, 671.0, 6.4),
    (1440.5, 668.7, 4.0), (1450.0, 666.8, 2.4), (1465.0, 665.0, 2.0), (1479.0, 663.4, 2.0), (1487.0, 661.9, 3.0),
    (1491.2, 660.0, 6.0), (1487.8, 657.6, 6.0), (1495.0, 655.4, 2.8), (1508.0, 653.2, 1.9), (1520.0, 650.0, 2.2),
    (1528.0, 647.6, 3.6), (1532.0, 645.5, 6.2), (1528.5, 643.0, 3.4), (1521.0, 640.6, 2.2), (1510.0, 637.6, 1.9),
    (1500.0, 635.9, 1.7), (1490.0, 634.4, 1.4), (1479.0, 632.4, 1.4), (1471.0, 630.4, 1.8), (1466.2, 628.2, 4.2),
    (1469.5, 626.0, 2.0), (1477.0, 622.7, 1.5), (1485.0, 619.6, 1.5), (1490.4, 617.4, 1.7), (1493.0, 615.7, 2.0),
    (1490.4, 613.9, 1.4), (1486.0, 612.1, 1.1), (1481.5, 611.0, 0.9), (1478.4, 610.2, 0.8),
]
# The two flags and their poles (scene px).
FLAGS = [
    [[(1505.6, 538), (1508.4, 538), (1508.4, 590), (1505.0, 590)], [(1507, 539), (1522.5, 541), (1522.5, 556), (1507, 556)]],
    [[(1549.8, 585), (1552.4, 585), (1552.4, 640), (1549.6, 640)], [(1551.5, 586), (1566, 587), (1566, 600), (1551.5, 600)]],
]

BOX = (1386, 530, 184, 192)  # everything that changes on the station's top
STEPS = 71
GRID = (9, 8)
# As EXP_TIMING in components/lab/ExperienceV2.tsx: the sprites' clock (ms after the energy's arrival).
T0, T1 = 30, 980
START = (30, 150, 320)  # the start's pulse: from, peak, to
TRAVEL = (120, 750)
DEST = (712, 790, 930)
TRAIL = 0.13
FLAG_AT = [(820, 60, 110), (None, 45, 130)]  # the upper flag with the destination, the lower as the head passes it
# Experience's share of the floor light (scene px): nothing of another station is in here.
FLOOR_SHARE = (1032, 655, 1672, 912)
FLOOR_STANDBY = 0.2  # as in components/lab/ExperienceV2.tsx: the fronts add the other 80%
# The disc left of the platform: the powered share of its light, next to the base and at its far edge (the standby's
# share, which it keeps: it doesn't light up there), and for the thin ring line around it.
DISC = dict(near=0.46, far=FLOOR_STANDBY, ring=0.42)
TOP_Y = 826  # below it the share mirrors what stands on the platform, above it the strips and ring


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def prem(a):
    return a[..., :3] * a[..., 3:] / 255


def save_add(P, p):
    """A light layer (plus-lighter): alpha is its brightest channel."""
    P = np.clip(P, 0, 255)
    a = P.max(2) / 255
    m14f.save_rgba(np.where(a[..., None] > 0, P / np.maximum(a, 1e-6)[..., None], 0), a, p)


def hue_of(light, ref):
    """`light`'s brightness in `ref`'s hue (as M1.4G.1: a clipped plate makes the difference of two plates cyan)."""
    return ref / np.maximum(ref.max(2), 1)[..., None] * light.max(2)[..., None]


def gauss(a, s):
    r = int(3 * s + 1)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / s) ** 2)
    k /= k.sum()
    p = np.pad(a, r, mode="edge")
    p = np.apply_along_axis(lambda v: np.convolve(v, k, "valid"), 0, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, "valid"), 1, p)


def spline(kn, step=0.25):
    """Centripetal Catmull-Rom through the knots (x, y, half width), resampled evenly by arc length."""
    P = np.array(kn)
    P = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1 : i + 3]
        d = lambda a, b: max(np.hypot(*(b - a)[:2]) ** 0.5, 1e-6)
        t0, t1 = 0.0, d(p0, p1)
        t2 = t1 + d(p1, p2)
        t3 = t2 + d(p2, p3)
        t = np.linspace(t1, t2, 60, endpoint=False)[:, None]
        A1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
        A2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
        A3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
        B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2
        B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3
        out.append((t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2)
    C = np.vstack(out + [P[-2][None]])
    s = np.r_[0, np.cumsum(np.hypot(*np.diff(C[:, :2], axis=0).T))]
    u = np.arange(0, s[-1] + 1e-9, step)
    return u, np.c_[[np.interp(u, s, C[:, j]) for j in range(3)]].T


def grid_sheet(frames, grid, channels):
    h, w = frames[0].shape[:2]
    o = np.zeros((h * grid[1], w * grid[0]) + ((channels,) if channels > 1 else ()))
    for k, f in enumerate(frames):
        r, c = divmod(k, grid[0])
        o[r * h : (r + 1) * h, c * w : (c + 1) * w] = f
    return o


def save_alpha_sheet(a, p):
    o = np.full((*a.shape, 4), 255, np.uint8)
    o[..., 3] = np.clip(np.round(a * 255), 0, 255)
    Image.fromarray(o).save(p, optimize=True)


def pulse(t, at):
    """0 at at[0], 1 at at[1], 0 at at[2], smooth."""
    return float(smooth(np.float64(t), at[0], at[1]) * (1 - smooth(np.float64(t), at[1], at[2])))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    st = rgba(V2 / "m14f/experience.png")
    fl = rgba(V2 / "m14h3/floor-light.png")
    env = rgba(V2 / "environment/lab-background.png")[..., :3]
    plate = m14f.load(m14f.SRC_DIR / "lab-plate.png")
    clean = m14f.load(m14f.SRC_DIR / "environment-lines-removed.png")
    A = st[..., 3] / 255
    I = st[..., :3]
    Y = I @ LUM
    R_, G_, B_ = I[..., 0], I[..., 1], I[..., 2]
    rep = {}

    bx, by, bw, bh = BOX
    cut = (slice(by, by + bh), slice(bx, bx + bw))
    X, Yc = XC[cut], YC[cut]
    Ic, Yl, Ac = I[cut], Y[cut], A[cut]
    Rc, Gc, Bc = R_[cut], G_[cut], B_[cut]

    # --- the route: each pixel's nearest point on the traced centreline (its arc length s), and how much of it is route.
    u, C = spline(ROUTE)
    total = float(u[-1])
    cx, cy, hw = C[:, 0], C[:, 1], C[:, 2]
    d2 = (X[..., None] - cx) ** 2 + (Yc[..., None] - cy) ** 2
    # which part of the route a pixel belongs to: distance in half widths, so a wide leg keeps its own pixels
    near = np.argmin(np.sqrt(d2) - hw, -1)
    dist = np.sqrt(np.take_along_axis(d2, near[..., None], -1)[..., 0])
    S = u[near]
    over = dist - hw[near]
    # the paving's front edge is a straight slab edge: a half-plane rather than the trace's round end
    below = Yc - (704.6 + (X - 1396) * 0.1)  # px in front of that edge
    front_edge = smooth(below, 0.9, -0.5)
    bright = smooth(Gc, 118, 172) * smooth(Rc, 175, 225)
    M = bright * smooth(-over, -2.4, 0.2)
    M = M * np.where(S < 14, front_edge, 1)
    # the slab's left corner reaches further than the trace's half width
    corner = (Yc > 701.0) & (below < 0.8) & (X > 1395) & (X < 1411)
    M = np.where(corner, np.maximum(M, smooth(Gc, 165, 205)), M)
    M = np.clip(M, 0, 1) * smooth(Ac, 0.9, 1.0)
    S = np.where(corner, np.minimum(S, 3.0), S)
    rep["route"] = dict(start=[round(cx[0], 1), round(cy[0], 1)], end=[round(cx[-1], 1), round(cy[-1], 1)], length_px=round(total, 1),
                        width_start_end=[round(2 * hw[0], 1), round(2 * hw[-1], 1)], pixels=int((M > 0.5).sum()),
                        highest_point=[float(round(v, 1)) for v in C[np.argmin(cy), :2]])

    # --- pace: perspective. The path narrows as it recedes; the energy covers the near, larger paving faster in px
    # (speed ~ the local scale ^ 0.45), eased slightly at both ends.
    scale = np.interp(cy, [608, 640, 665, 706], [0.22, 0.34, 0.55, 1.0])
    w_ = scale ** -0.45
    sig = np.r_[0, np.cumsum(0.5 * (w_[1:] + w_[:-1]))]
    sig /= sig[-1]

    def front(ms):
        """Arc length the energy has reached at `ms` after the arrival."""
        t = np.clip((ms - TRAVEL[0]) / (TRAVEL[1] - TRAVEL[0]), 0, 1)
        e = 0.82 * t + 0.18 * t * t * (3 - 2 * t)
        return float(np.interp(e, sig, u))

    rep["arc length reached (share) at +ms"] = {str(ms): round(front(ms) / total, 3) for ms in (120, 200, 280, 360, 440, 520, 600, 680, 750)}
    quarter = {}
    for share in (0.25, 0.5, 0.75):
        ms = np.linspace(*TRAVEL, 2000)
        f = np.array([front(m) for m in ms]) / total
        quarter[str(share)] = round(float(ms[np.argmin(np.abs(f - share))]))
    rep["route lit by length at +ms"] = quarter

    # --- the light the route throws on the terrain: per pixel, the share that comes from each part of the route.
    step = 4
    qs, qd2 = u[::step], d2[..., ::step]
    qscale = scale[::step]
    # reach scales with the route's own perspective scale: a wide glow at the front, a tight one near the peaks
    reach = 5.0 + 13.0 * qscale
    K = qscale * (np.exp(-qd2 / (2 * (0.34 * reach) ** 2)) + 0.30 * np.exp(-np.sqrt(qd2) / reach))
    Ksum = K.sum(-1)
    Kcum = np.cumsum(K, -1) / np.maximum(Ksum, 1e-9)[..., None]
    dmin = np.sqrt(d2.min(-1))
    sc_near = scale[np.argmin(d2, -1)]
    glow = np.exp(-np.maximum(dmin - 1.0, 0) / (4.0 + 11.0 * sc_near))
    warm = smooth(Rc - Bc, 34, 110)
    green = smooth(Gc - np.maximum(Rc * 0.82, Bc), -4, 8)  # the plant keeps its own light
    wire = smooth(Rc - Bc, 55, 120) * smooth(Yl, 95, 170) * (Yc < 634) * (Yc > 565.5)  # (above: the code panel)
    flagm = [np.maximum.reduce([m14f.polygon_mask(p)[cut] for p in f]) for f in FLAGS]
    no_flag = 1 - np.clip(np.maximum(flagm[0], flagm[1]) * (Yc < 634), 0, 1)
    spill = np.clip(glow * warm * (1 - green), 0, 1)
    solid = smooth(Ac, 0.985, 1.0)

    # --- standby: the route's own pixels, dimmed and a little redder; the terrain without (most of) the route's light.
    tint = np.array([0.94, 1.0, 1.04])
    # The route (and the anti-aliased edge around it, so no bright rim is left): its brightness compressed into a dim
    # ember, in the amber of its own paving.
    rim = smooth(-over, -3.4, -0.6) * smooth(Yl, 70, 118) * smooth(Rc - Bc, 40, 90) * np.where(S < 14, smooth(below, 1.6, 0.0), 1)
    rim = np.where(corner, np.maximum(rim, smooth(Yl, 75, 118) * smooth(below, 1.0, 0.0)), rim)
    band = np.maximum(M, rim) * np.where(S > total - 3, smooth(over, 1.0, -0.5), 1)
    detail = (Y - gauss(Y, 2.2))[cut]  # its luminous edges and paving stay readable
    ember = np.where(Yl > 46, 46 + 0.30 * (Yl - 46), Yl) + 0.34 * np.clip(detail, -40, 60) * M
    amber = np.array([255.0, 152.0, 62.0])
    hue = Ic / np.maximum(Yl, 1)[..., None]
    mix = (0.30 + 0.45 * (1 - M))[..., None]  # (the edge keeps more of its own hue)
    hue = mix * hue + (1 - mix) * amber / (amber @ LUM)
    ember_c = hue * ember[..., None]
    k_spill = (0.46 * spill) * no_flag
    k_wire = 0.20 * wire * np.exp(-dmin / 34) * (1 - M) * no_flag
    k = np.maximum(k_spill, k_wire) * solid
    # fades out before the box's own edges
    edge = smooth(np.minimum.reduce([X - bx, bx + bw - X, Yc - by, by + bh - Yc]), 1, 9)
    k = k * edge
    off = Ic * (1 - np.clip(k[..., None] * tint, 0, 1))
    band = band * solid * edge
    off = off * (1 - band[..., None]) + np.minimum(ember_c, Ic) * band[..., None]
    # Drawn as the least opaque overlay that darkens the station to this (over I: I (1 - a) + c a = off, with c >= 0): the
    # approved pixels stay under it. An opaque copy, behind its mask, is resampled a little differently from the station
    # (the camera's scale isn't 1), and thin dimmed wires would brighten the dark pixels beside them.
    off = np.where((Ac > 0.999)[..., None], off, Ic)
    cover = np.where(np.abs(off - Ic).max(2) > 0.5, 1 - np.min(np.where(Ic < 4, 1, off / np.maximum(Ic, 1)), -1), 0)
    cover = np.ceil(np.clip(cover, 0, 1) * 255) / 255
    over_c = np.where(cover[..., None] > 0, (off - Ic * (1 - cover[..., None])) / np.maximum(cover, 1e-3)[..., None], 0)
    full_off, full_cov = np.zeros((H, W, 3)), np.zeros((H, W))
    full_off[cut], full_cov[cut] = over_c, cover
    m14f.save_rgba(np.clip(full_off, 0, 255), full_cov, OUT / "experience-standby.png")
    onr = M > 0.5
    rep["route luminance: approved, standby, ratio"] = [round(float(Yl[onr].mean()), 1), round(float((off @ LUM)[onr].mean()), 1), round(float((off @ LUM)[onr].mean() / Yl[onr].mean()), 3)]
    rep["station alpha where the overlay is (min)"] = round(float(Ac[cover > 0].min()), 3)

    # --- reveal: route pixels as the front reaches their arc length (a soft edge that shrinks with the perspective);
    # terrain by the share of the route that already lights it.
    soft = 2.2 + 4.5 * scale[near]
    Sf = S + 0.30 * dist**2 / np.maximum(hw[near], 1)  # the front is a little rounded: its sides follow its middle
    ms_of = [T0 + (T1 - T0) * k_ / STEPS for k_ in range(STEPS + 1)]
    # Behind the head the trail keeps TRAIL of the overlay until the destination is reached; then the whole settles.
    left = []
    for k_, ms in enumerate(ms_of):
        f = front(ms)
        on = f > 0
        rv = smooth(f - Sf, -soft * 0.35, soft * 0.65) if on else np.zeros_like(S)
        if f >= total:
            rv = np.ones_like(S)
        rv = rv * (1 - TRAIL * smooth(f - S, 6, 34) * (1 - float(smooth(np.float64(ms), TRAVEL[1] - 30, 930))))
        j = np.clip(np.interp(f, qs, np.arange(len(qs))), 0, len(qs) - 1)
        j0 = int(j)
        fr = Kcum[..., j0] * (1 - (j - j0)) + Kcum[..., min(j0 + 1, len(qs) - 1)] * (j - j0)
        fr = fr if on else np.zeros_like(fr)
        if f >= total:
            fr = np.ones_like(fr)
        l_ = M * (1 - rv) + (1 - M) * (1 - np.clip(fr, 0, 1))
        left.append(np.ones_like(l_) if k_ == 0 else np.zeros_like(l_) if k_ == STEPS else l_ * (cover > 0))
    left[0] = left[0] * (cover > 0)
    # the frame at rest must hide nothing less than the whole overlay
    save_alpha_sheet(grid_sheet([np.where(cover > 0, f, 0) for f in left], GRID, 1), OUT / "experience-reveal.png")

    # --- the travelling light. `lift`: what each pixel may gain: its own colour, brighter, never past a warm white.
    cap = np.array([255.0, 240.0, 188.0])
    # Along the artwork's own ramp (amber paving, gold edges, warm white core): green and blue together, so brighter never
    # means yellower. `g`: share of what is left up to the cap `c`.
    ramp = np.array([0.35, 0.82, 1.0])
    room = lambda c: np.clip(np.min((np.maximum(c, 1) - Ic)[..., 1:] / ramp[1:], -1), 0, None)
    lift = lambda g, c=cap: np.minimum((g * np.minimum(room(c), 70) * smooth(Yl, 30, 150))[..., None] * ramp, np.maximum(255 - Ic, 0) * np.array([1, 9, 9]))
    # dark stone and dim wires: more of their own colour, the hue exactly kept (nothing once a channel is full)
    def stone(g, shown):
        return shown * np.minimum(g, np.clip(np.min(np.array([250.0, 214.0, 140.0]) / np.maximum(shown, 1) - 1, -1), 0, None))[..., None]

    rock = warm * (1 - green) * smooth(Yl, 18, 70) * no_flag
    L_route = lift(0.75)
    head_i = lambda f: int(np.clip(round(f / 0.25), 0, len(u) - 1))
    # the start's pulse: the paving's first pixels and the warm stone just in front of it
    toe = smooth(below, -0.2, 1.2) * smooth(Yc, 715.5, 709.0) * smooth(X, 1395, 1400) * smooth(X, 1428, 1421) * smooth(Rc - Bc, 60, 130) * smooth(Yl, 70, 130)
    start_m = np.clip(M * smooth(S, 15, 2) + 0.75 * toe, 0, 1)
    # the destination: the route's last stretch, then the ridge wires that meet it (shortest path along bright wires)
    tail = M * smooth(S, total - 26, total - 4)
    spot = np.exp(-(((X - cx[-1]) ** 2 + (Yc - cy[-1]) ** 2) / 9.0**2)) * rock * (1 - M) * smooth(Yl, 125, 95)
    v = 0.05 + smooth(Yl, 85, 190) * warm
    g = np.full(S.shape, np.inf)
    ex, ey = int(cx[-1] - bx), int(cy[-1] - by)
    heap = [(0.0, ey, ex)]
    g[ey, ex] = 0
    nb = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]
    while heap:
        c, y, x = heapq.heappop(heap)
        if c > g[y, x]:
            continue
        for dy, dx, w in nb:
            y2, x2 = y + dy, x + dx
            if not (0 <= y2 < bh and 0 <= x2 < bw):
                continue
            n = c + w * 2 / (v[y, x] + v[y2, x2])
            if n < g[y2, x2] and n < 140:
                g[y2, x2] = n
                heapq.heappush(heap, (n, y2, x2))
    wires = wire * (1 - M) * no_flag * smooth(Yc, 634, 622) * np.isfinite(g)
    g = np.where(np.isfinite(g), g, 999.0)
    dest_w = wires * np.exp(-g / 32)
    fl_w = [m * smooth(Rc - Bc, 40, 110) * smooth(Yl, 70, 130) * (Yc < (592 if i == 0 else 641)) for i, m in enumerate(flagm)]
    flag_s = float(u[np.argmin((cx - 1538) ** 2 + (cy - 645) ** 2)])  # the bend nearest the lower flag
    ms = np.linspace(*TRAVEL, 4000)
    flag_ms = float(ms[np.argmin(np.abs(np.array([front(m) for m in ms]) - flag_s))])
    rep["the head passes the lower flag at +ms"] = round(flag_ms)
    rep["px: start, destination tail, destination wires, flags"] = [int((m > 0.1).sum()) for m in (start_m, tail, dest_w, *fl_w)]
    fx = []
    parts = {"head": [], "terrain": []}
    for k_, ms in enumerate(ms_of):
        o = np.zeros((bh, bw, 3))
        f = front(ms)
        # Where the overlay still lies, a pixel's own warm light; where it is gone, only what it may still gain (its red is
        # already full there: on the dim overlay that difference alone would look cyan).
        lit = (1 - left[k_]) if k_ else np.zeros_like(S)
        under = off * (1 - lit)[..., None] + Ic * lit[..., None]  # what is shown at this moment
        own = lambda g_, gain, c=cap: lift(g_, c) * (lit**2)[..., None] + Ic * (gain * (1 - lit))[..., None] * np.array([1.0, 0.86, 0.62])
        # the head: on from the start, easing out as it arrives
        amp = smooth(np.float64(ms), TRAVEL[0] - 10, TRAVEL[0] + 50) * (1 - smooth(np.float64(ms), TRAVEL[1] - 10, TRAVEL[1] + 90))
        if amp > 0:
            hi = head_i(f)
            sc = scale[hi]
            back = f - Sf
            run = np.where(back < 0, np.exp(-((back / (1.2 + 2.4 * sc)) ** 2)), np.exp(-back / (9 + 13 * sc)))
            o += L_route * (amp * 1.0 * M * run * lit**3)[..., None]
            dh = np.hypot(X - cx[hi], Yc - cy[hi])
            # the terrain next to it: its ridges and stone, by their own pixels; behind the head more than ahead of it
            r_ = 6.5 + 11.0 * sc
            loc = np.exp(-((dh / r_) ** 2))
            near_w = np.clip(rock * glow**0.5 + 0.35 * wire, 0, 1) * (1 - M) + 0.45 * M * (1 - lit)
            o += stone(1.1, under) * (amp * 0.8 * loc * near_w)[..., None]
        ps = pulse(ms, START)
        if ps > 0:
            o += own(0.6, 0.40) * (0.8 * ps * start_m)[..., None]
        pd = pulse(ms, DEST)
        if pd > 0:
            o += own(1.0, 0.35, np.array([255.0, 248.0, 214.0])) * (pd * np.clip(tail * 1.2, 0, 1))[..., None]
            o += stone(0.9, under) * (0.7 * pd * spot)[..., None]
        tw = DEST[0] + 20 + g * 1.5
        o += own(0.7, 0.2, np.array([255.0, 222.0, 164.0])) * (0.85 * dest_w * smooth(ms - tw, 0, 45) * (1 - smooth(ms - tw, 45, 150)))[..., None]
        for i, m in enumerate(fl_w):
            at, up_, dn = FLAG_AT[i]
            at = flag_ms + 25 if at is None else at
            pf = pulse(ms, (at - up_, at, at + dn))
            if pf > 0:
                o += lift(0.5, np.array([255.0, 205.0, 110.0])) * (0.9 * pf * m)[..., None]
        o *= min(1, k_ / 2, (STEPS - k_) / 4)
        o *= (solid * edge)[..., None]
        # several sources may overlap: still never past the cap
        o = np.minimum(o, np.maximum(np.maximum(np.array([255.0, 248.0, 214.0]), Ic) - under, 0))
        fx.append(o)
    sheet = grid_sheet(fx, GRID, 3)
    la = np.clip(sheet, 0, 255).max(2) / 255
    o_ = np.dstack([np.where(la[..., None] > 0, sheet / np.maximum(la, 1e-6)[..., None], 0), la * 255])
    o_[la * 255 < 1.5] = 0
    Image.fromarray(np.clip(np.round(o_), 0, 255).astype(np.uint8)).save(OUT / "experience-light.png", optimize=True)

    # --- the strips: unpowered (the station minus the strips' approved light), and that light in the approved hue.
    region = m14f.union_mask(m14f.EXPERIENCE["parts"])
    strip = (np.abs(plate - clean).sum(2) > 6) & (region > 0) & (A > 0) & (yy > 716)
    diff = np.clip(plate - clean, 0, None)
    core = smooth(plate[..., 2] - 0.28 * plate[..., 1], 2, 46)[..., None] * smooth(yy, 716, 720)[..., None]
    ratio = np.clip((clean @ LUM) / np.maximum(plate @ LUM, 1), 0, 1)[..., None]
    # The fixture's unlit face: the darkened plate's, dimmed a little towards the amber stone above it (on its own the
    # plate's flat tan band reads as a grey stripe against this stone).
    face = np.clip(I - (plate - clean), 0, 255)
    warm_face = np.array([255.0, 138.0, 52.0])
    face = (0.45 * face / np.maximum(face @ LUM, 1)[..., None] + 0.55 * warm_face / (warm_face @ LUM)) * (face @ LUM)[..., None] * 0.80
    unlit = core * face + (1 - core) * I * ratio
    # At the anti-aliased base edge the overlay covers twice the station's share, its colour solved so that what shows is
    # the floor behind and the unlit stone in front (otherwise a pale line of the lit strip stays along the edge).
    a2 = np.where(A < 1, np.minimum(1, 2 * A), 1) * strip
    Cs = env * (1 - A[..., None]) + I * A[..., None]
    want = env * (1 - A[..., None]) + unlit * A[..., None]
    off_c = np.where(a2[..., None] > 0, (want - Cs * (1 - a2[..., None])) / np.maximum(a2, 1e-3)[..., None], 0)
    m14f.save_rgba(np.clip(off_c, 0, 255), a2, OUT / "experience-strip-off.png")
    sl = hue_of(diff, plate)
    sl = sl * np.clip((250 - plate.max(2)) / np.maximum(sl.max(2) * 0.8, 1), 0, 1)[..., None]
    save_add(sl * (A * strip)[..., None], OUT / "experience-strip-light.png")
    ys_, xs_ = np.nonzero(strip)
    rep["strip pixels"] = dict(px=int(strip.sum()), bbox=[int(xs_.min()), int(ys_.min()), int(xs_.max()), int(ys_.max())])

    # --- the floor: Experience's share; byte-identical elsewhere.
    fx0, fy0, fx1, fy1 = FLOOR_SHARE
    Rm = m14f.box((((xx >= fx0) & (yy >= fy0) & (yy < fy1))).astype(np.float64), 2)
    FL = prem(fl)
    share = FL * Rm[..., None]
    low = smooth(yy, TOP_Y - 3, TOP_Y + 3)[..., None]
    save_add(share * (1 - low), OUT / "experience-floor.png")
    save_add(share * low, OUT / "experience-floor-top.png")
    # The disc, powered: the same light, scaled (nothing painted or blurred, the floor's texture shows through more). It
    # falls off with the distance from the base, so the oval's far edge no longer lights up. At rest nothing changes.
    Cy = yy + 0.5
    in_disc = smooth(xx, 1140, 1146) * smooth(xx, 1212, 1206) * smooth(yy, 692, 697) * (1 - smooth(yy, 744, 752))
    away = np.clip((1203 - xx) / 44, 0, 1)  # 0 at the base, 1 at the disc's far edge
    s_ = DISC["near"] + (DISC["far"] - DISC["near"]) * smooth(away, 0.05, 0.85)
    ring_x = np.interp(yy, [715, 718, 721, 724, 727, 730, 733, 736, 739, 742, 745], [1183, 1176, 1171, 1166, 1163, 1161, 1160, 1161, 1163, 1166, 1170])  # the ring line, read row by row
    s_ = np.maximum(s_, DISC["ring"] * np.exp(-(((xx - ring_x) / 2.2) ** 2)) * ((yy >= 715) & (yy <= 747)))
    want = 1 + (s_ - 1) * in_disc
    save_add(share * (1 - low) * ((want - FLOOR_STANDBY) / (1 - FLOOR_STANDBY))[..., None], OUT / "experience-floor-lit.png")
    rest = FL - share
    ra = np.clip(rest, 0, 255).max(2) / 255
    rr = np.zeros((H, W, 4))
    rr[..., :3] = np.where(ra[..., None] > 0, np.clip(rest, 0, 255) / np.maximum(ra, 1e-6)[..., None], 0)
    rr[..., 3] = ra * 255
    rr = np.clip(np.round(rr), 0, 255)
    rr[ra * 255 < 0.5] = 0
    rr[Rm == 0] = fl[Rm == 0]
    Image.fromarray(rr.astype(np.uint8)).save(OUT / "floor-light.png", optimize=True)
    rep["floor light: pixels outside Experience's share changed"] = int((np.abs(rr - fl).max(2)[Rm == 0] > 0).sum())
    rep["floor light: light on the share's border (max)"] = float(FL.max(2)[(Rm > 0.02) & (Rm < 0.98) & (xx < 1669)].max())
    fsum = sum(prem(rgba(OUT / n)) for n in ("experience-floor.png", "experience-floor-top.png", "floor-light.png"))
    rep["floor light: shares + rest vs before (max)"] = round(float(np.abs(fsum - FL).max()), 2)

    # --- geometry for the component.
    ts = (
        "// Generated by scripts/m14h4-experience.py (M1.4H.4): do not edit.\n"
        'import type { SceneRect } from "@/lib/scene";\n\n'
        "/** Box of the sprites' frames (scene px), their grid (columns, rows) and steps (frames - 1); their clock (ms after the arrival). */\n"
        f"export const EXP_BOX: SceneRect = {json.dumps(dict(x=bx, y=by, w=bw, h=bh))};\n"
        f"export const EXP_GRID = {json.dumps(list(GRID))} as const;\n"
        f"export const EXP_STEPS = {STEPS};\n"
        f"export const EXP_CLOCK = {json.dumps([T0, T1])} as const;\n"
    )
    (ROOT / "components/lab/experience-v2.ts").write_text(ts, encoding="utf-8")
    np.savez_compressed(WORK / "route.npz", u=u, C=C, M=M, S=S, box=np.array(BOX))
    (WORK / "route.json").write_text(json.dumps([[round(float(x), 1), round(float(y), 1), round(float(2 * w), 1)] for x, y, w in C[::16]]) + "\n", encoding="utf-8")

    # --- check sheets: the trace on the artwork, the masks, simulated moments.
    z = 8
    comp = (env * (1 - A[..., None]) + I * A[..., None])[cut]
    up = lambda a: Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((bw * z, bh * z), Image.LANCZOS)
    gimg = up(comp)
    dr = ImageDraw.Draw(gimg)
    pts = [((x - bx) * z, (y - by) * z) for x, y in C[:, :2]]
    dr.line(pts, fill=(0, 255, 255), width=2)
    for s in range(0, int(total), 25):
        i = int(s / 0.25)
        x, y = pts[i]
        dr.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(0, 255, 0))
        dr.text((x + 6, y - 5), str(s), fill=(0, 255, 0))
    for (x, y), c in ((pts[0], (255, 0, 255)), (pts[-1], (255, 0, 0))):
        dr.ellipse([x - 7, y - 7, x + 7, y + 7], outline=c, width=3)
    gimg.save(WORK / "trace-8x.png")
    up(np.dstack([M * 255, np.clip(S / total, 0, 1) * M * 255, np.maximum(band, k / 0.5) * 255])).save(WORK / "masks-8x.png")
    up(np.dstack([start_m, tail + dest_w, np.maximum(*fl_w)]) * 255).save(WORK / "light-masks-8x.png")
    sim = lambda k_: np.clip(comp * (1 - (left[k_] * cover)[..., None]) + over_c * (left[k_] * cover)[..., None] + fx[k_], 0, 255)
    sh = [0] + [int(round((ms - T0) / (T1 - T0) * STEPS)) for ms in (150, 230, 310, 390, 470, 550, 630, 700, 760, 820, 900)]
    Z = 4
    up(sim(0)).save(WORK / "standby-8x.png")
    S2 = Image.new("RGB", (bw * Z * 4, bh * Z * 3))
    for i, k_ in enumerate(sh):
        S2.paste(Image.fromarray(sim(k_).astype(np.uint8)).resize((bw * Z, bh * Z), Image.LANCZOS), ((i % 4) * bw * Z, (i // 4) * bh * Z))
        ImageDraw.Draw(S2).text(((i % 4) * bw * Z + 6, (i // 4) * bh * Z + 4), f"+{ms_of[k_]:.0f}", fill=(0, 255, 255))
    S2.save(WORK / "simulated-4x.png")
    (WORK / "assets.json").write_text(json.dumps(rep, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
