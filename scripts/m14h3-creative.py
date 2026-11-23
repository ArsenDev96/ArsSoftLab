"""M1.4H.3: Creative Studio's activation layers for /lab-v2 (experimental).

Every layer is a copy of, or light taken from, what /lab-v2 already shows
(M1.4F's recovered Creative Studio, M1.4G.1's light layer, the current floor
light); nothing is painted. The station image itself (m14f/creative.png) is
always drawn, unmodified: standby is an overlay on the painting that the
sunrise removes, so the stable state is the approved image. Writes
public/scene/v2/m14h3/ and components/lab/creative-v2.ts only.

  creative-standby.png      the painting (and the two small framed ones) a little
                            subdued, its highlights most: a tone curve on its own
                            pixels, inside the painted areas only
  creative-sunrise.png      sprite (alpha): how much of that overlay is left, per
                            frame: the sunrise's per-pixel timing
  creative-crest.png        sprite (alpha): the sunrise's front
  creative-highlights.png   the painting's own highlights, for the front (plus-lighter)
  creative-warm.png         its warm details along its lower edge, and the easel's
                            ledge, for the first response (plus-lighter)
  creative-glints.png       sprite (plus-lighter): the ridge's glint, cloud edges, the
                            small paintings: their own pixels
  creative-strip-off.png    the strips unpowered (the approved darkened plate's light)
  creative-strip-light.png  the strips' own light, in the approved hue, for the pulse
  creative-strip-floor.png  the strips' floor light (M1.4G.1's creative-light)
  creative-floor.png        Creative Studio's share of the floor light that follows
                            the strips (ring, spill, strip reflections)
  creative-floor-top.png    its share that mirrors the lit objects on top
  floor-light.png           the current floor light without those shares

    python scripts/m14h3-creative.py
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
OUT = V2 / "m14h3"
WORK = ROOT / "docs/m1.4h3/work"
smooth = m14f.smooth
LUM = np.array([0.299, 0.587, 0.114])
yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)

# The painted areas, measured on the plate at 8x (pixel indices; TL, TR, BR, BL), inside the canvas's light rim.
PAINTING = [(175.2, 549.0), (300.4, 548.3), (323.2, 662.8), (202.6, 674.6)]
SMALL = [
    [(336.9, 663.1), (374.0, 662.5), (377.7, 683.5), (342.5, 686.2)],
    [(382.8, 667.3), (421.0, 666.5), (424.0, 684.4), (386.0, 686.0)],
]
SUN = (230.6, 605.6)  # the painted sun
SMALL_SUN = [(355.6, 670.5), (402.8, 673.5)]  # the small paintings' lit peaks
# The sunlit ridge, from under the sun to the summit (8x readings).
RIDGE = [(216.2, 628.1), (225, 624.4), (235, 619.4), (245, 614.4), (252.5, 611.2), (258.5, 608.6), (263.5, 605.0),
         (266.2, 601.5), (269.5, 597.0), (273.2, 593.6), (277.5, 596.6), (282, 600.6)]
LEDGE = [(203, 676.2), (332, 663.5), (332, 667.5), (205, 680.8)]  # the easel's ledge under the canvas

# Standby: the share taken from the darkest and from the brightest painted pixels.
STANDBY = dict(painting=(0.07, 0.24), small=(0.04, 0.16))

BOX = (164, 540, 268, 152)  # every painted area, plus a margin
STEPS = 23
GRID = (6, 4)
GLINT_STEPS = 21
GLINT_GRID = (6, 4)
# As CRE_TIMING in components/lab/CreativeV2.tsx (the sunrise runs almost evenly), to place the cloud edges' glints.
SUNRISE_AT, SUNRISE_MS, GLINT_AT, GLINT_MS = 150, 440, 350, 380
# Creative Studio's share of the floor light (scene px). Engineering's ends at y 670 (x 232-632) and Experience's
# starts right of x 1100; nothing of another station is in here.
FLOOR_SHARE = (30, 672, 572, 900)
TOP_Y = 812  # below it the share mirrors the lit objects on the platform, above it the strips and ring


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def prem(a):
    return a[..., :3] * a[..., 3:] / 255


def save_add(P, p):
    """A light layer (plus-lighter): alpha is its brightest channel."""
    P = np.clip(P, 0, 255)
    a = P.max(2) / 255
    m14f.save_rgba(np.where(a[..., None] > 0, P / np.maximum(a, 1e-6)[..., None], 0), a, p)


def gauss(a, s):
    r = int(3 * s + 1)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / s) ** 2)
    k /= k.sum()
    p = np.pad(a, r, mode="edge")
    p = np.apply_along_axis(lambda v: np.convolve(v, k, "valid"), 0, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, "valid"), 1, p)


def hue_of(light, ref):
    """`light`'s brightness in `ref`'s hue (as M1.4G.1: a clipped plate makes the difference of two plates cyan)."""
    return ref / np.maximum(ref.max(2), 1)[..., None] * light.max(2)[..., None]


def travel(inside, L, warm, seeds):
    """When the light reaches each painted pixel (0 at the seeds): the shortest path through the painting (Dijkstra,
    8 neighbours), fast along its bright warm paint, slow through its dark, and slower across its contours."""
    v = 0.13 + 1.5 * np.clip(0.75 * smooth(L, 60, 205) + 0.25 * warm, 0, 1) ** 2.2
    d = np.full(inside.shape, np.inf)
    heap = []
    for y, x in seeds:
        d[y, x] = 0
        heapq.heappush(heap, (0.0, y, x))
    nb = [(-1, 0, 1), (1, 0, 1), (0, -1, 1), (0, 1, 1), (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]
    while heap:
        c, y, x = heapq.heappop(heap)
        if c > d[y, x]:
            continue
        for dy, dx, w in nb:
            y2, x2 = y + dy, x + dx
            if not inside[y2, x2]:
                continue
            n = c + w * 2 / (v[y, x] + v[y2, x2]) + 0.07 * abs(L[y, x] - L[y2, x2])
            if n < d[y2, x2]:
                d[y2, x2] = n
                heapq.heappush(heap, (n, y2, x2))
    return d


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


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    st = rgba(V2 / "m14f/creative.png")
    li = rgba(V2 / "m14g1/creative-light.png")
    fl = rgba(V2 / "m14h2/floor-light.png")
    env = rgba(V2 / "environment/lab-background.png")[..., :3]
    plate = m14f.load(m14f.SRC_DIR / "lab-plate.png")
    clean = m14f.load(m14f.SRC_DIR / "environment-lines-removed.png")
    A = st[..., 3] / 255
    I = st[..., :3]
    Y = I @ LUM
    R_, G_, B_ = I[..., 0], I[..., 1], I[..., 2]
    rep = {}

    # --- the painted areas (anti-aliased, softened 1 px inwards) and the painting's own light.
    q = m14f.polygon_mask(PAINTING)
    qs = [m14f.polygon_mask(p) for p in SMALL]
    soft = lambda m: np.clip(m14f.box(m, 1) * 2 - 1, 0, 1) * smooth(A, 0.9, 1.0)
    Q, Qs = soft(q), [soft(m) for m in qs]
    warm = smooth(R_ - B_, 15, 130)
    # local contrast against the painted pixels around (nothing outside the canvas)
    around = lambda r: m14f.box(Y * q, r) / np.maximum(m14f.box(q, r), 1e-3)
    local = Y - around(5)
    # its highlights, its crisp bright details most; the sun's light, so its warm paint far more than its cool clouds
    sun_d = np.hypot(xx - SUN[0], yy - SUN[1])
    sunlit = np.maximum(0.25 + 0.75 * smooth(R_ - B_, -10, 70), np.exp(-((sun_d / 7.0) ** 2)))
    H_ = smooth(Y, 105, 225) * (0.45 + 0.55 * smooth(local, -6, 26)) * sunlit
    H_ = H_ * (1 - 0.4 * np.exp(-((sun_d / 12.0) ** 2)))  # the sun is nearly white already
    rep["painted px: painting, small"] = [round(float(Q.sum())), [round(float(m.sum())) for m in Qs]]
    rep["station alpha where the overlay is (min)"] = float(A[(Q > 0.02) | (Qs[0] > 0.02) | (Qs[1] > 0.02)].min())
    rep["quad px outside the station's matte"] = int(((q > 0.5) & (A < 0.9)).sum())

    # --- standby: a tone curve on the painting's own pixels: its highlights give up most, its darks almost nothing,
    # a touch less red than blue (the light that is missing is the sun's).
    w = smooth(Y, 55, 220)[..., None]
    tint = np.array([1.06, 1.0, 0.86])
    off = I.copy()
    cover = np.zeros((H, W))
    for m, (lo, hi) in [(Q, STANDBY["painting"]), (Qs[0], STANDBY["small"]), (Qs[1], STANDBY["small"])]:
        o = I * (1 - (lo + (hi - lo) * w) * tint)
        off = np.where(m[..., None] > 0, o, off)
        cover = np.maximum(cover, m)
    m14f.save_rgba(np.clip(off, 0, 255), cover, OUT / "creative-standby.png")
    sb = I * (1 - cover[..., None]) + off * cover[..., None]
    inq = q > 0.5
    rep["painting luminance: approved, standby, ratio"] = [round(float(Y[inq].mean()), 1), round(float((sb @ LUM)[inq].mean()), 1), round(float((sb @ LUM)[inq].mean() / Y[inq].mean()), 3)]
    rep["its brightest 5%: approved, standby"] = [round(float(np.percentile(Y[inq], 95)), 1), round(float(np.percentile((sb @ LUM)[inq], 95)), 1)]

    # --- the sunrise: when the light reaches each painted pixel.
    phase = np.full((H, W), 2.0)
    inside = m14f.box(q, 1) > 0.02
    sy, sx = int(round(SUN[1])), int(round(SUN[0]))
    seeds = [(y, x) for y in range(sy - 4, sy + 5) for x in range(sx - 4, sx + 5) if np.hypot(y - sy, x - sx) <= 4]
    d = travel(inside, gauss(Y, 0.7), warm, seeds)
    # Paced by area: the order is the path's, but mostly the painting lights at an even rate (its wide bright sky
    # would otherwise light at once and the dark ground wait).
    dv = d[inside]
    rank = np.empty(dv.size)
    rank[np.argsort(dv, kind="stable")] = np.linspace(0, 1, dv.size)
    phi = np.zeros((H, W))
    phi[inside] = 0.75 * rank ** 0.58 + 0.25 * np.clip(dv / np.percentile(dv, 99.5), 0, 1)
    # a pixel and a half of smoothing, inside the canvas only (no jagged front, the contours stay)
    nrm = gauss(inside.astype(np.float64), 1.3)
    phi = np.where(inside, gauss(phi * inside, 1.3) / np.maximum(nrm, 1e-6), 2.0)
    phase[inside] = 0.80 * phi[inside]
    phase = np.where(inside, np.maximum(phase - 0.03, 0), phase)  # (the smoothing lifts the sun's own zero)
    for m, sun, (t0, t1) in zip(qs, SMALL_SUN, ((0.50, 0.74), (0.62, 0.84))):
        ins = m14f.box(m, 1) > 0.02
        ds = np.hypot(xx - sun[0], yy - sun[1]) / 24 * (1.25 - 0.5 * smooth(Y, 40, 190))
        phase[ins] = (t0 + (t1 - t0) * np.clip(ds, 0, 1))[ins]
    bx, by, bw, bh = BOX
    cut = (slice(by, by + bh), slice(bx, bx + bw))
    ph = phase[cut]
    edge = 0.05 + 0.10 * np.clip(ph / 0.25, 0, 1)  # the sun comes up quickly, what it lights follows softly
    left, crest = [], []
    for k_ in range(STEPS + 1):
        t = k_ / STEPS
        r = smooth(t - ph, 0.0, edge)
        left.append(np.ones_like(ph) if k_ == 0 else np.zeros_like(ph) if k_ == STEPS else 1 - r)
        c = np.where(t < ph, np.exp(-(((ph - t) / 0.035) ** 2)), np.exp(-(((t - ph) / 0.15) ** 2)))
        crest.append(c * np.clip(min(k_ / 2, (STEPS - k_) / 4), 0, 1))
    save_alpha_sheet(grid_sheet(left, GRID, 1), OUT / "creative-sunrise.png")
    save_alpha_sheet(grid_sheet(crest, GRID, 1), OUT / "creative-crest.png")
    lit = np.maximum(Q, np.maximum(0.8 * Qs[0], 0.6 * Qs[1]))
    save_add(I * (H_ * lit * 0.56)[..., None], OUT / "creative-highlights.png")

    # --- the first response: the painting's warm details along its lower edge, and the ledge it stands on.
    top = np.interp(xx, [PAINTING[0][0], PAINTING[1][0]], [PAINTING[0][1], PAINTING[1][1]])
    bot = PAINTING[3][1] + (xx - PAINTING[3][0]) * (PAINTING[2][1] - PAINTING[3][1]) / (PAINTING[2][0] - PAINTING[3][0])
    v_ = (yy - top) / (bot - top)
    ww = smooth(v_, 0.66, 0.96) * Q * smooth(G_ - B_, 0, 34) * smooth(R_ - B_, 10, 70) * smooth(Y, 45, 105)
    ledge = soft(m14f.polygon_mask(LEDGE)) * smooth(R_ - B_, 20, 80) * smooth(Y, 50, 130) * (A > 0.99)
    save_add(I * (0.85 * ww + 0.30 * ledge)[..., None], OUT / "creative-warm.png")

    # --- the glints: the ridge's lit edge (a short light running to the summit), bright cloud edges as the sunrise has
    # passed them, the small paintings' lit peaks. Their own pixels, brighter.
    kn = np.array(RIDGE)
    s0 = np.r_[0, np.cumsum(np.hypot(*np.diff(kn, axis=0).T))]
    u = np.arange(0, s0[-1], 0.5)
    path = np.c_[np.interp(u, s0, kn[:, 0]), np.interp(u, s0, kn[:, 1])]
    # onto the ridge's own bright edge (+-2 px across), smoothed
    tan = np.gradient(path, axis=0)
    nor = np.c_[-tan[:, 1], tan[:, 0]] / np.hypot(*tan.T)[:, None]
    off_ = np.arange(-2.5, 2.51, 0.25)
    sc = gauss(Y, 0.6)
    X_, Y_ = path[:, None, 0] + nor[:, None, 0] * off_, path[:, None, 1] + nor[:, None, 1] * off_
    x0, y0 = np.floor(X_).astype(int), np.floor(Y_).astype(int)
    fx, fy = X_ - x0, Y_ - y0
    pr = sc[y0, x0] * (1 - fx) * (1 - fy) + sc[y0, x0 + 1] * fx * (1 - fy) + sc[y0 + 1, x0] * (1 - fx) * fy + sc[y0 + 1, x0 + 1] * fx * fy
    best = off_[np.argmax(pr - 1.2 * np.abs(off_), 1)]
    best = np.convolve(np.pad(best, 9, mode="edge"), np.hanning(19) / np.hanning(19).sum(), "valid")
    path = path + nor * best[:, None]
    total = float(u[-1])
    rd, rs = np.full((H, W), 99.0), np.zeros((H, W))
    for (x, y), s in zip(path, u):
        xa, xb, ya, yb = int(x) - 6, int(x) + 8, int(y) - 6, int(y) + 8
        dd = np.hypot(xx[ya:yb, xa:xb] - x, yy[ya:yb, xa:xb] - y)
        m = dd < rd[ya:yb, xa:xb]
        rd[ya:yb, xa:xb][m] = dd[m]
        rs[ya:yb, xa:xb][m] = s
    ridge_m = np.exp(-((rd / 1.5) ** 2)) * smooth(Y, 70, 150) * Q * smooth(total - rs, 0, 14)
    sky = np.clip(m14f.box(Q, 2) * 3 - 2, 0, 1) * (1 - smooth(v_, 0.44, 0.56))  # 3 px inside the canvas
    cloud = sky * smooth(Y - around(4), 8, 24) * smooth(Y, 115, 185) * smooth(R_ - B_, 10, 80) * smooth(np.hypot(xx - SUN[0], yy - SUN[1]), 7, 12)
    small = [m * np.exp(-((np.hypot(xx - c[0], (yy - c[1]) * 1.2) / 9.0) ** 2)) * smooth(Y, 70, 160) for m, c in zip(Qs, SMALL_SUN)]
    rep["glint px: ridge, cloud edges, small"] = [int((ridge_m > 0.1).sum()), int((cloud > 0.1).sum()), [int((m > 0.1).sum()) for m in small]]
    rep["ridge path length px"] = round(total, 1)
    gl = []
    ci, cc, cr_, cphi = I[cut], cloud[cut], ridge_m[cut], ph
    for k_ in range(GLINT_STEPS + 1):
        t = k_ / GLINT_STEPS
        f = np.zeros((bh, bw, 3))
        if 0 < k_ < GLINT_STEPS:
            h_ = -6 + (total + 30) * np.clip(t / 0.72, 0, 1.4)
            back = h_ - rs[cut]
            run = np.where(back < 0, np.exp(-((back / 3) ** 2)), np.exp(-back / 15))
            f += ci * (1.05 * cr_ * run)[..., None]
            tc = (SUNRISE_MS * np.clip(cphi, 0, 0.84) + SUNRISE_AT + 60 - GLINT_AT) / GLINT_MS
            f += ci * (0.50 * cc * smooth(tc, 0.0, 0.12) * np.exp(-(((t - tc) / 0.13) ** 2)))[..., None]
            for m, t0 in zip(small, (0.20, 0.36)):  # as the sunrise reaches each: one swell
                f += ci * (0.40 * m[cut] * np.exp(-(((t - t0) / (0.10 if t < t0 else 0.20)) ** 2)))[..., None]
            f *= np.clip(min(k_ / 2, (GLINT_STEPS - k_) / 3), 0, 1)
        gl.append(np.clip(f, 0, 255))
    sheet = grid_sheet(gl, GLINT_GRID, 3)
    la = sheet.max(2) / 255
    o_ = np.dstack([np.where(la[..., None] > 0, sheet / np.maximum(la, 1e-6)[..., None], 0), la * 255])
    o_[la * 255 < 1.5] = 0
    Image.fromarray(np.clip(np.round(o_), 0, 255).astype(np.uint8)).save(OUT / "creative-glints.png", optimize=True)

    # --- the strips: unpowered (the station minus the strips' approved light), and that light in the approved hue.
    region = m14f.union_mask(m14f.CREATIVE["parts"])
    strip = (np.abs(plate - clean).sum(2) > 6) & (region > 0) & (A > 0) & (yy > 712)
    diff = np.clip(plate - clean, 0, None)
    # The fixture (its white-hot core) as the darkened plate has it; the glow on the stone taken away in the stone's own
    # hue (the plate's own removal left a grey patch at the right end). At the anti-aliased base edge the overlay is as
    # transparent as the station, so its colour also takes off what still shows through.
    core = smooth(plate[..., 2], 105, 165)[..., None]
    ratio = np.clip((clean @ LUM) / np.maximum(plate @ LUM, 1), 0, 1)[..., None]
    unlit = core * np.clip(I - (plate - clean), 0, 255) + (1 - core) * I * ratio
    unlit = np.clip(unlit - (1 - A)[..., None] * I, 0, 255)
    m14f.save_rgba(unlit, A * strip, OUT / "creative-strip-off.png")
    sl = hue_of(diff, plate)
    sl = sl * np.clip((250 - plate.max(2)) / np.maximum(sl.max(2) * 0.8, 1), 0, 1)[..., None]  # never clips: the amber stays amber
    save_add(sl * (A * strip)[..., None], OUT / "creative-strip-light.png")
    ys_, xs_ = np.nonzero(strip)
    rep["strip pixels"] = dict(px=int(strip.sum()), bbox=[int(xs_.min()), int(ys_.min()), int(xs_.max()), int(ys_.max())])
    save_add(prem(li), OUT / "creative-strip-floor.png")
    lp = prem(rgba(OUT / "creative-strip-light.png"))
    rep["strip light: px with blue above red"] = int(((lp[..., 2] - lp[..., 0]) > 2).sum())

    # --- the floor: Creative Studio's share; byte-identical elsewhere.
    fx0, fy0, fx1, fy1 = FLOOR_SHARE
    Rm = m14f.box((((xx >= fx0) & (xx < fx1) & (yy >= fy0) & (yy < fy1))).astype(np.float64), 2)
    FL = prem(fl)
    share = FL * Rm[..., None]
    low = smooth(yy, TOP_Y - 3, TOP_Y + 3)[..., None]
    save_add(share * (1 - low), OUT / "creative-floor.png")
    save_add(share * low, OUT / "creative-floor-top.png")
    rest = FL - share
    ra = np.clip(rest, 0, 255).max(2) / 255
    rr = np.zeros((H, W, 4))
    rr[..., :3] = np.where(ra[..., None] > 0, np.clip(rest, 0, 255) / np.maximum(ra, 1e-6)[..., None], 0)
    rr[..., 3] = ra * 255
    rr = np.clip(np.round(rr), 0, 255)
    rr[ra * 255 < 0.5] = 0
    rr[Rm == 0] = fl[Rm == 0]
    Image.fromarray(rr.astype(np.uint8)).save(OUT / "floor-light.png", optimize=True)
    rep["floor light: pixels outside Creative Studio's share changed"] = int((np.abs(rr - fl).max(2)[Rm == 0] > 0).sum())
    rep["floor light: light on the share's border (max)"] = float(FL.max(2)[(Rm > 0.02) & (Rm < 0.98)].max())
    fsum = sum(prem(rgba(OUT / n)) for n in ("creative-floor.png", "creative-floor-top.png", "floor-light.png"))
    rep["floor light: shares + rest vs before (max)"] = round(float(np.abs(fsum - FL).max()), 2)

    # --- geometry for the component.
    ts = (
        "// Generated by scripts/m14h3-creative.py (M1.4H.3): do not edit.\n"
        'import type { SceneRect } from "@/lib/scene";\n\n'
        "/** Box of the sunrise's and glints' sprite frames (scene px); each sprite's grid (columns, rows) and steps (frames - 1). */\n"
        f"export const CRE_BOX: SceneRect = {json.dumps(dict(x=bx, y=by, w=bw, h=bh))};\n"
        f"export const CRE_GRID = {json.dumps(list(GRID))} as const;\n"
        f"export const CRE_SUNRISE_STEPS = {STEPS};\n"
        f"export const CRE_GLINT_GRID = {json.dumps(list(GLINT_GRID))} as const;\n"
        f"export const CRE_GLINT_STEPS = {GLINT_STEPS};\n"
    )
    (ROOT / "components/lab/creative-v2.ts").write_text(ts, encoding="utf-8")

    # --- check sheets: geometry on the artwork, standby, the sunrise's contours and frames, the light maps.
    vb = (164, 538, 332, 686)
    s = 6
    up = lambda a, b=vb, z=s: Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).crop(b).resize(((b[2] - b[0]) * z, (b[3] - b[1]) * z), Image.LANCZOS)
    comp = env * (1 - A[..., None]) + I * A[..., None]
    g = up(comp)
    dr = ImageDraw.Draw(g)
    P_ = lambda p: ((p[0] + 0.5 - vb[0]) * s, (p[1] + 0.5 - vb[1]) * s)
    dr.line([P_(p) for p in PAINTING + [PAINTING[0]]], fill=(0, 255, 255), width=1)
    dr.line([P_(p) for p in path], fill=(0, 255, 0), width=2)
    dr.line([P_(p) for p in LEDGE + [LEDGE[0]]], fill=(255, 0, 255), width=1)
    g.save(WORK / "geometry-6x.png")
    con = np.where((np.mod(phase * 12, 1) < 0.10)[..., None] & inq[..., None], 255.0, comp)
    con_img = up(con)
    con_img.save(WORK / "sunrise-contours-6x.png")
    up(comp * (1 - cover[..., None]) + off * cover[..., None]).save(WORK / "standby-6x.png")
    up(prem(rgba(OUT / "creative-highlights.png"))).save(WORK / "highlights-6x.png")
    up(prem(rgba(OUT / "creative-warm.png"))).save(WORK / "warm-6x.png")
    up(np.dstack([ridge_m * 255, cloud * 255, np.zeros((H, W))])).save(WORK / "glint-masks-6x.png")
    (WORK / "assets.json").write_text(json.dumps(rep, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
