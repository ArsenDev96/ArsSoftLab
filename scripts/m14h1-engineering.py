"""M1.4H.1: Engineering's activation layers for /lab-v2 (experimental).

Every layer is a partition or a copy of what /lab-v2 already shows (M1.4F.1's
recovered Engineering, M1.4G.1's floor light) or of the approved artwork's own
unpowered strips; nothing is painted. Powered, the layers recompose exactly the
current Engineering (checked below). Writes public/scene/v2/m14h1/ and
components/lab/engineering-v2.ts only; M1.4F.1's and M1.4G.1's files are read,
never written.

  engineering-body.png        the station without its chart hologram (normal)
  engineering-chart.png       the chart hologram's solid part (normal): a hard
                              per-pixel partition of the station, so body + chart
                              over the room is the station exactly
  engineering-body-light.png  the station's light without the chart's glow and the
                              strip's floor light (plus-lighter): the plant
  engineering-chart-light.png the chart's glow (plus-lighter)
  engineering-strip-off.png   the strips unpowered: the approved plate with the
                              strips darkened (M1.3K's line-free plate, which the
                              station was switched against in M1.4F.1), at exactly
                              the pixels where the station took the lit plate
  engineering-strip-light.png the strips' own light (lit - unpowered), for the
                              energy pulse that runs along them (plus-lighter)
  engineering-floor.png       Engineering's share of the floor light: its ring,
                              strip spill and reflections (M1.4G.1) (plus-lighter)
  engineering-strip-floor.png the strips' floor light (M1.4F.1's, from the station's
                              light layer), drawn with the station as before
  floor-light.png             M1.4G.1's floor light without that share (the other
                              stations' pixels byte-identical)
  engineering-screen-mask.png the laptop's display (alpha): the measured quad
  engineering-screen-bars.png the chart's bars painted on the display (a copy of the
                              body's opaque pixels there), drawn above the screen's
                              standby dimming so they can rise with the chart

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14h1-engineering.py
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
OUT = V2 / "m14h1"
WORK = ROOT / "docs/m1.4h1/work"
ENG = m14f1.ENGINEERING
CHART_POLY = ENG["soft"][1]["poly"]
LUM = np.array([0.299, 0.587, 0.114])
yy, xx = np.mgrid[0:H, 0:W]

# Engineering's share of the floor light (scene px): its ring (x 305-615), the strips' spill and its reflections
# down to y 660. Creative Studio's ring starts below y 675 and the hub's floor light right of x 640.
FLOOR_SHARE = (232, 505, 632, 670)
# The chart's bars: column ranges (scene px, inclusive), left to right. 1-7 are painted on the display, 8-11
# stand in the glass panel. Tops and bottoms are measured below.
BAR_COLS = [(439, 444), (449, 454), (457, 459), (462, 467), (471, 476), (479, 484), (488, 493), (498, 503), (508, 513), (516, 521), (526, 532)]
CHART_BOX = (430, 392, 562, 480)


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def prem(a):
    return a[..., :3] * a[..., 3:] / 255


def save_add(add, p):
    """An additive (plus-lighter) layer: alpha = its brightest channel, colour = the light at full alpha."""
    a = np.clip(add, 0, 255).max(2) / 255
    m14f.save_rgba(np.where(a[..., None] > 0, np.clip(add, 0, 255) / np.maximum(a, 1e-6)[..., None], 0), a, p)


def dilate(m, r):
    o = m.copy()
    for _ in range(r):
        o = o | np.roll(o, 1, 0) | np.roll(o, -1, 0) | np.roll(o, 1, 1) | np.roll(o, -1, 1)
    return o


def fit_line(ts, vs):
    b, a = np.polyfit(ts, vs, 1)
    return a, b  # v = a + b t


def grow(quad, d):
    """Offset every edge of a convex quad outward by d."""
    n = len(quad)
    cx, cy = np.mean([p[0] for p in quad]), np.mean([p[1] for p in quad])
    lines = []
    for i, p in enumerate(quad):
        q = quad[(i + 1) % n]
        dx, dy = q[0] - p[0], q[1] - p[1]
        ln = np.hypot(dx, dy)
        nx, ny = dy / ln, -dx / ln
        if nx * (p[0] - cx) + ny * (p[1] - cy) < 0:
            nx, ny = -nx, -ny
        lines.append((p[0] + nx * d, p[1] + ny * d, dx, dy))
    out = []
    for i in range(n):
        ax, ay, adx, ady = lines[(i - 1) % n]
        bx, by, bdx, bdy = lines[i]
        t = ((bx - ax) * bdy - (by - ay) * bdx) / (adx * bdy - ady * bdx)
        out.append((ax + adx * t, ay + ady * t))
    return out


def measure_screen(C):
    """The display quad, from the lid's own rims: its left and right rims are the brightest column in each row,
    its top rim the brightest row in each column; the display lies a measured bezel inside them (profiles at
    y 395-465: left 5.8 px, right 4.7 px, top 6 px). Its lower edge meets the hinge at y 473.5."""
    L = C @ LUM
    ys = np.arange(396, 469)
    left = [338 + int(np.argmax(L[y, 338:359])) for y in ys]
    ys_r = np.arange(393, 449)
    right = [474 + int(np.argmax(L[y, 474:493])) for y in ys_r]
    xs_t = np.arange(352, 470)
    top = [382 + int(np.argmax(L[382:390, x])) for x in xs_t]
    la, lb = fit_line(ys, left)
    ra, rb = fit_line(ys_r, right)
    ta, tb = fit_line(xs_t, top)
    rims = dict(left=[round(la, 2), round(lb, 4)], right=[round(ra, 2), round(rb, 4)], top=[round(ta, 2), round(tb, 4)],
                left_rms=round(float(np.sqrt(np.mean((la + lb * ys - left) ** 2))), 2),
                right_rms=round(float(np.sqrt(np.mean((ra + rb * ys_r - right) ** 2))), 2))
    y_top = lambda x: ta + tb * x + 6.0
    x_left = lambda y: la + lb * y + 5.8
    x_right = lambda y: ra + rb * y - 4.7
    y_bot = 473.5
    # Corners: intersect the side lines with the top line (iterate: the top is nearly flat) and the bottom.
    def on_top(xf):
        x = xf(391.0)
        for _ in range(5):
            x = xf(y_top(x))
        return (round(x, 2), round(y_top(x), 2))
    quad = [on_top(x_left), on_top(x_right), (round(x_right(y_bot), 2), y_bot), (round(x_left(y_bot), 2), y_bot)]
    return quad, rims


def measure_bars(C):
    """Each bar: the longest run of rows (y 415-470, above the chart's base line) where its columns' mean blue is
    above 150 (the bars are 200-255, the display and glass around them 20-140), so neither a code line above a
    short bar nor the base line's glow below a tall one is taken."""
    Bc = C[..., 2]
    bars = []
    for c0, c1 in BAR_COLS:
        on = [Bc[y, c0:c1 + 1].mean() > 150 for y in range(415, 471)]
        runs, start = [], None
        for i, v in enumerate(on + [False]):
            if v and start is None:
                start = i
            if not v and start is not None:
                runs.append((start, i - 1))
                start = None
        s0, s1 = max(runs, key=lambda r: r[1] - r[0])
        top, bot = 415 + s0, 415 + s1
        bars.append(dict(x=c0 - 1, y=top - 1, w=c1 - c0 + 3, h=bot - top + 3))
    return bars


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    st = rgba(V2 / "m14f1/engineering.png")
    li = rgba(V2 / "m14f1/engineering-light.png")
    fl = rgba(V2 / "m14g1/floor-light.png")
    env = rgba(V2 / "environment/lab-background.png")[..., :3]
    plate = m14f.load(m14f.SRC_DIR / "lab-plate.png")
    clean = m14f.load(m14f.SRC_DIR / "environment-lines-removed.png")
    a = st[..., 3] / 255
    rep = {}

    # --- the chart: a hard per-pixel partition of the station (a pixel goes whole to one layer).
    hard = m14f.union_mask(ENG["hard"])
    chart_poly = m14f.polygon_mask(CHART_POLY)
    chart = (chart_poly >= 0.5) & (hard < 0.5) & (a > 0)
    body = st.copy()
    body[chart] = 0
    ch = st.copy()
    ch[~chart] = 0
    Image.fromarray(body.astype(np.uint8)).save(OUT / "engineering-body.png", optimize=True)
    Image.fromarray(ch.astype(np.uint8)).save(OUT / "engineering-chart.png", optimize=True)
    rep["chart pixels"] = int(chart.sum())

    # --- the station's light: the chart's glow (its polygon, 3 px around), the strips' floor light (y >= 537),
    # the rest (the plant).
    Lt = prem(li)
    mc = m14f.box(dilate(chart_poly > 0, 3).astype(np.float64), 1)
    chart_light = Lt * mc[..., None]
    strip_floor = Lt * (yy >= 537)[..., None] * (1 - mc[..., None])
    body_light = np.clip(Lt - chart_light - strip_floor, 0, None)
    save_add(chart_light, OUT / "engineering-chart-light.png")
    save_add(body_light, OUT / "engineering-body-light.png")
    rep["light split (px > 2): chart, strip floor, rest"] = [int((chart_light.max(2) > 2).sum()), int((strip_floor.max(2) > 2).sum()), int((body_light.max(2) > 2).sum())]

    # --- the strips, unpowered: where the station took the lit plate (M1.4F.1's own rule), the darkened plate.
    region = np.maximum(hard, m14f.union_mask([s["poly"] for s in ENG["soft"]]))
    x0, y0, x1, y1 = ENG["line_box"]
    in_line = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
    strip = (np.abs(plate - clean).sum(2) > 6) & (region > 0) & ~in_line & (a > 0)
    off_a = a * strip
    m14f.save_rgba(clean, off_a, OUT / "engineering-strip-off.png")
    strip_add = np.clip(plate - clean, 0, None) * off_a[..., None]
    save_add(strip_add, OUT / "engineering-strip-light.png")
    ys_, xs_ = np.nonzero(strip)
    rep["strip pixels (station lit, unpowered from the darkened plate)"] = dict(px=int(strip.sum()), bbox=[int(xs_.min()), int(ys_.min()), int(xs_.max()), int(ys_.max())])
    # Station pixels the powered strip must equal: the station itself (it is the lit plate there).
    rep["station == lit plate on the strip pixels (max diff)"] = float(np.abs(st[..., :3] - plate)[strip & (a > 0.999)].max())

    # --- the floor: Engineering's share (feathered 2 px), byte-identical elsewhere.
    fx0, fy0, fx1, fy1 = FLOOR_SHARE
    R = m14f.box((((xx >= fx0) & (xx < fx1) & (yy >= fy0) & (yy < fy1))).astype(np.float64), 2)
    FL = prem(fl)
    share = FL * R[..., None]
    save_add(share, OUT / "engineering-floor.png")
    # The strips' floor light stays in the station's group (above the contact shadow, as in M1.4F.1).
    save_add(strip_floor, OUT / "engineering-strip-floor.png")
    rest = FL - share
    ra = np.clip(rest, 0, 255).max(2) / 255
    rest_rgba = np.zeros((H, W, 4))
    rest_rgba[..., :3] = np.where(ra[..., None] > 0, np.clip(rest, 0, 255) / np.maximum(ra, 1e-6)[..., None], 0)
    rest_rgba[..., 3] = ra * 255
    rest_rgba = np.clip(np.round(rest_rgba), 0, 255)
    rest_rgba[ra * 255 < 0.5] = 0
    rest_rgba[R == 0] = fl[R == 0]
    Image.fromarray(rest_rgba.astype(np.uint8)).save(OUT / "floor-light.png", optimize=True)
    rep["floor light: pixels outside Engineering's share changed"] = int((np.abs(rest_rgba - fl).max(2)[R == 0] > 0).sum())
    rep["floor light: Engineering's share (px > 2)"] = int((share.max(2) > 2).sum())

    # --- the display and the bars on it.
    C = st[..., :3] * a[..., None] + Lt
    quad, rims = measure_screen(C)
    mask = m14f.polygon_mask(grow(quad, 0.8))
    m14f.save_rgba(np.full((H, W, 3), 255.0), mask, OUT / "engineering-screen-mask.png")
    bars = measure_bars(C)
    sb = np.zeros_like(st)
    for b in bars:
        r = (xx >= b["x"]) & (xx < b["x"] + b["w"]) & (yy >= b["y"]) & (yy < b["y"] + b["h"]) & (body[..., 3] == 255)
        sb[r] = body[r]
    Image.fromarray(sb.astype(np.uint8)).save(OUT / "engineering-screen-bars.png", optimize=True)
    rep["screen"] = dict(quad=quad, rims=rims, mask_px=round(float(mask.sum()), 1))
    rep["bars"] = bars

    # --- check: powered, the layers over the v2 room recompose the current Engineering exactly.
    def over(dst, layer):
        la = layer[..., 3:] / 255
        return layer[..., :3] * la + dst * (1 - la)
    now = over(env, st) + Lt + FL
    pw = over(over(env, body), ch) + prem(rgba(OUT / "engineering-body-light.png")) + prem(rgba(OUT / "engineering-chart-light.png"))
    pw = pw + prem(rgba(OUT / "engineering-floor.png")) + prem(rgba(OUT / "engineering-strip-floor.png")) + prem(rgba(OUT / "floor-light.png"))
    d = np.abs(np.clip(pw, 0, 255) - np.clip(now, 0, 255)).max(2)
    rep["powered recomposition vs current (max-channel, 8-bit)"] = dict(mean=round(float(d.mean()), 4), max=round(float(d.max()), 2), px_over_1=int((d > 1).sum()))
    # Unpowered strips: the lit station's strip pixels replaced by the darkened plate's.
    off = rgba(OUT / "engineering-strip-off.png")
    d2 = np.abs(over(over(env, st), off) - over(env, np.dstack([clean, st[..., 3:]]))).max(2)[strip & (a > 0.999)]
    rep["unpowered strip == darkened plate (max diff)"] = round(float(d2.max()), 2)

    # --- geometry for the component.
    ts = (
        "// Generated by scripts/m14h1-engineering.py (M1.4H.1): do not edit.\n"
        'import type { SceneRect } from "@/lib/scene";\n\n'
        "/** The laptop's display (TL, TR, BR, BL), scene px: measured from the lid's rims (docs/m1.4h1/NOTES.md). */\n"
        f"export const ENG_SCREEN_QUAD = {json.dumps([list(p) for p in quad])} as const;\n\n"
        "/** The chart's bars (scene px, 1 px margin), left to right: 1-7 on the display, 8-11 in the glass panel. */\n"
        f"export const ENG_BARS: readonly SceneRect[] = {json.dumps(bars)};\n\n"
        "/** Box holding the chart layers (scene px). */\n"
        f"export const ENG_CHART_BOX: SceneRect = {json.dumps(dict(x=CHART_BOX[0], y=CHART_BOX[1], w=CHART_BOX[2] - CHART_BOX[0], h=CHART_BOX[3] - CHART_BOX[1]))};\n"
    )
    (ROOT / "components/lab/engineering-v2.ts").write_text(ts, encoding="utf-8")

    # --- verification overlay: the quad (grown mask edge dashed) and the bars on the display at 6x.
    comp = np.clip(over(env, st) + Lt, 0, 255).astype(np.uint8)
    bx = (330, 380, 562, 482)
    s = 6
    im = Image.fromarray(comp).crop(bx).resize(((bx[2] - bx[0]) * s, (bx[3] - bx[1]) * s), Image.NEAREST)
    dr = ImageDraw.Draw(im)
    P = lambda p: ((p[0] - bx[0]) * s, (p[1] - bx[1]) * s)
    dr.line([P(p) for p in quad + [quad[0]]], fill=(255, 60, 60), width=2)
    for b in bars:
        dr.rectangle([P((b["x"], b["y"])), P((b["x"] + b["w"], b["y"] + b["h"]))], outline=(255, 220, 0), width=1)
    im.save(WORK / "geometry-6x.png")
    (WORK / "assets.json").write_text(json.dumps(rep, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
