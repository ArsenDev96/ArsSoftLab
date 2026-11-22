"""M1.4E: recover the approved central A and the foreground details from the
approved artwork, as separate full-frame (1672 x 941) layers for /lab-v2.

Source: the approved plate with the five power lines removed
(docs/m1.3k/package/01-source/environment-lines-removed.png = lab-plate.webp +
environment-corrections.png), so no connection is baked into any layer.

The v2 environment's floor is a different render from the plate's (other
tiles, other reflections), so a difference matte against it is not usable;
every matte here is geometric (measured on the plate) or colour-based, and
nothing is painted or generated: every visible pixel is the plate's own.

Writes public/scene/v2/m14e/:
  hub.png          platform + A + the rings where they lie on the platform (normal alpha)
  hub-light.png    light only, drawn with mix-blend-mode: plus-lighter: the two
                   holographic rings and the A's glow above the rim, and the
                   amber floor reflection under the platform (excess over the
                   floor's own level, so no plate floor texture is carried)
  fg-table.png     book stack, mug and table (normal alpha, hard edges, 1 px AA)
  fg-steam.png     the mug's steam as light (mix-blend-mode: plus-lighter)
  fg-plant.png     the defocused plant at the lower-right edge (soft alpha)
and docs/m1.4e/work/extract.json, plus check sheets in docs/m1.4e/work/.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14e-extract.py
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/m1.3k/package/01-source/environment-lines-removed.png"
ENV = ROOT / "public/scene/v2/environment/lab-background.png"
OUT = ROOT / "public/scene/v2/m14e"
WORK = ROOT / "docs/m1.4e/work"
W, H = 1672, 941
SS = 4  # supersampling for anti-aliased geometric masks

# Hub (measured on the plate, scene px).
HUB_TOP = dict(cx=838.5, cy=596.0, rx=181.5, ry=35.0)  # top rim ellipse
HUB_BOTTOM = dict(cx=840.0, cy=612.0, rx=200.0, ry=43.0)  # flange / bottom ellipse
RING = dict(cx=834.0, cy=589.0, r_in=56.0, r_out=68.0)  # two thin vertical circles
REFLECTION = dict(x0=705, x1=975, y1=735)  # floor reflection under the platform

# Foreground: book stack + mug + table, one outline (scene px).
TABLE_CLUSTER = [
    (0, 733), (60, 733), (120, 737), (172, 741), (176, 745), (176, 772), (184, 773), (186, 806),
    (190, 806), (191, 840), (194, 841), (195, 848),
    (212, 851), (211, 832), (213, 820), (219, 816), (226, 815), (228, 808), (229, 800), (240, 793), (273, 791), (306, 793),
    (319, 798), (322, 808), (321, 863),
    (446, 878), (447, 941), (0, 941),  # the shadowed floor between the table legs is kept, as approved
]
STEAM = dict(cx=282.0, cy=752.0, rx=44.0, ry=54.0)
PLANT = dict(x0=1395, y0=770)


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float64)


def lum(a):
    return a @ np.array([0.299, 0.587, 0.114])


def ellipse_mask(e, ss=SS):
    yy, xx = np.mgrid[0 : H * ss, 0 : W * ss]
    x = (xx + 0.5) / ss - 0.5
    y = (yy + 0.5) / ss - 0.5
    m = ((x - e["cx"]) / e["rx"]) ** 2 + ((y - e["cy"]) / e["ry"]) ** 2 <= 1
    return m.reshape(H, ss, W, ss).mean((1, 3))


def polygon_mask(pts, ss=SS):
    im = Image.new("L", (W * ss, H * ss), 0)
    ImageDraw.Draw(im).polygon([((x + 0.5) * ss, (y + 0.5) * ss) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BOX)).astype(np.float64) / 255


def box(a, r):
    """Mean over a (2r+1)^2 window (edge-padded)."""
    p = np.pad(a, ((r, r), (r, r)) + ((0, 0),) * (a.ndim - 2), mode="edge")
    c = p.cumsum(0).cumsum(1)
    c = np.pad(c, ((1, 0), (1, 0)) + ((0, 0),) * (a.ndim - 2))
    n = 2 * r + 1
    return (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)


def minf(a, r):
    out = a.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out = np.minimum(out, np.roll(np.roll(a, dy, 0), dx, 1))
    return out


def smooth(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def save_rgba(rgb, a, p):
    out = np.zeros((H, W, 4))
    out[..., :3] = rgb
    out[..., 3] = np.clip(a, 0, 1) * 255
    out[out[..., 3] == 0, :3] = 0
    p.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8)).save(p, optimize=True)


def main():
    P = load(SRC)
    L = lum(P)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    rep = {}

    # ---------------------------------------------------------------- hub
    top = ellipse_mask(HUB_TOP)
    bot = ellipse_mask(HUB_BOTTOM)
    # between the two ellipses' widest points: the side band
    band = ((yy >= HUB_TOP["cy"]) & (yy <= HUB_BOTTOM["cy"]) & (np.abs(xx - HUB_BOTTOM["cx"]) <= HUB_BOTTOM["rx"] - 1)).astype(float)
    plat = np.maximum(np.maximum(top, bot), band * np.maximum(top.max(), 1) * (np.abs(xx - HUB_BOTTOM["cx"]) <= HUB_BOTTOM["rx"]))
    plat = np.clip(np.maximum(top, bot), 0, 1)
    plat = np.maximum(plat, np.where((yy >= HUB_TOP["cy"]) & (yy <= HUB_BOTTOM["cy"]), np.clip(HUB_BOTTOM["rx"] + 0.5 - np.abs(xx - HUB_BOTTOM["cx"]), 0, 1), 0))
    # The A's upper strokes rise above the rim: take the glyph's own bright, opaque core there.
    # (inside the inner ring only: the rings are light, in hub-light.png)
    above = (yy < 575) & (yy > 540) & (np.abs(xx - 838) < 40) & (top < 1) & (np.hypot(xx - RING["cx"], yy - RING["cy"]) < RING["r_in"] - 3)
    glyph = above * smooth(L, 150, 200)
    hub_a = np.clip(np.maximum(plat, glyph), 0, 1)
    save_rgba(P, hub_a, OUT / "hub.png")

    # Light: rings + A halo above the rim, and the floor reflection under the platform.
    r = np.hypot(xx - RING["cx"], yy - RING["cy"])
    ring_zone = (r >= RING["r_in"] - 4) & (r <= RING["r_out"] + 4) & (yy < 600)
    halo_zone = (np.hypot((xx - 838) / 48, (yy - 566) / 30) <= 1)
    zone = (ring_zone | halo_zone) & (hub_a < 0.999)
    # The Educational connection runs straight up from the hub here (x ~838); its residue in the
    # line-free source must not become part of the hub.
    zone &= ~((np.abs(xx - 838.5) <= 4) & (yy < 545) & ((r < RING["r_in"] + 1) | (r > RING["r_out"] - 1)))
    # Floor level behind the light: a wide minimum, then a mean (an opening), per channel.
    base = np.stack([box(minf(P[..., c], 5), 5) for c in range(3)], -1)
    excess = np.clip(P - base, 0, None)
    exl = lum(excess)
    light = np.zeros_like(P)
    w_ring = zone * smooth(exl, 6, 20)
    light += excess * w_ring[..., None]
    # Reflection: per row, the excess over the row's 30th percentile across the reflection span,
    # faded down to nothing at y1 and at the sides; only where it is warm (amber), not floor joints.
    y_top = (HUB_BOTTOM["cy"] + HUB_BOTTOM["ry"] * np.sqrt(np.clip(1 - ((xx - HUB_BOTTOM["cx"]) / HUB_BOTTOM["rx"]) ** 2, 0, 1)))
    refl_zone = (xx >= REFLECTION["x0"]) & (xx <= REFLECTION["x1"]) & (yy > y_top) & (yy <= REFLECTION["y1"])
    rows = np.zeros_like(P)
    for y in range(int(HUB_BOTTOM["cy"]), REFLECTION["y1"] + 1):
        seg = P[y, REFLECTION["x0"] : REFLECTION["x1"]]
        rows[y] = np.percentile(seg, 30, axis=0)
    rexc = np.clip(P - rows, 0, None)
    warm = smooth(P[..., 0] - P[..., 2], 15, 45)
    fade_y = np.clip((REFLECTION["y1"] - yy) / (REFLECTION["y1"] - 655), 0, 1) ** 1.5
    fade_x = np.clip(np.minimum(xx - REFLECTION["x0"], REFLECTION["x1"] - xx) / 50, 0, 1)
    contact = np.clip(1 - (yy - y_top) / 3, 0, 1)  # the rows touching the platform stay in hub.png's AA
    w_refl = refl_zone * warm * fade_y * fade_x * (1 - contact)
    light += rexc * w_refl[..., None]
    light = np.clip(light, 0, 255)
    out = np.zeros((H, W, 4))
    out[..., :3] = light
    out[..., 3] = 255 * (lum(light) > 0.5)
    out[out[..., 3] == 0, :3] = 0
    Image.fromarray(np.round(out).astype(np.uint8)).save(OUT / "hub-light.png", optimize=True)
    rep["hub"] = dict(platform_px=int((hub_a > 0.5).sum()), soft_edge_px=int(((hub_a > 0) & (hub_a < 1)).sum()), glyph_above_rim_px=int((glyph > 0.5).sum()),
                      light_px=int((lum(light) > 0.5).sum()), ring_light_px=int((w_ring > 0.05).sum()), reflection_px=int((w_refl > 0.05).sum()),
                      bbox_alpha=[int(v) for v in (np.nonzero((hub_a > 0).any(0))[0][[0, -1]].tolist() + np.nonzero((hub_a > 0).any(1))[0][[0, -1]].tolist())])

    # ---------------------------------------------------------------- foreground: books, mug, table
    tab = polygon_mask(TABLE_CLUSTER)
    save_rgba(P, tab, OUT / "fg-table.png")
    rep["table_cluster"] = dict(px=int((tab > 0.5).sum()), soft_edge_px=int(((tab > 0) & (tab < 1)).sum()))

    # ---------------------------------------------------------------- steam
    # Light, drawn with plus-lighter: the near-grey excess over the local level
    # (an opening of the luminance), so the stone's warm veins are not carried.
    s = STEAM
    zone = smooth(1 - np.hypot((xx - s["cx"]) / s["rx"], (yy - s["cy"]) / s["ry"]), 0, 0.25) * (1 - tab)  # feathered column; never over the mug
    sat = (P.max(2) - P.min(2)) / np.maximum(P.max(2), 1)
    bgL = box(minf(L, 9), 9)
    dL = box(np.clip(L - bgL, 0, None), 1)
    grey = smooth(0.5 - sat, 0.0, 0.2)
    steam_l = dL * grey * zone * smooth(dL, 3, 10)
    tint = P / np.maximum(L, 1)[..., None]
    steam = np.clip(steam_l[..., None] * tint, 0, 255)
    out = np.zeros((H, W, 4))
    out[..., :3] = steam
    out[..., 3] = 255 * (lum(steam) > 0.5)
    out[out[..., 3] == 0, :3] = 0
    Image.fromarray(np.round(out).astype(np.uint8)).save(OUT / "fg-steam.png", optimize=True)
    rep["steam"] = dict(px=int((lum(steam) > 0.5).sum()), max_added_luminance=round(float(lum(steam).max()), 1), mode="plus-lighter")

    # ---------------------------------------------------------------- plant (defocused)
    # Lower-right corner only; the limit drops towards the left, where the floor has dark olive patches.
    region = (xx >= PLANT["x0"]) & (yy >= PLANT["y0"] + 35 + np.clip(1600 - xx, 0, None) * 0.3)
    R, G, B = P[..., 0], P[..., 1], P[..., 2]
    # Leaves are dark olive (G/R ~0.83-1.04, G > B); the floor is warm (G/R ~0.6) or bluish grey (B > G).
    gr = G / np.maximum(R, 1)
    f = smooth(gr, 0.70, 0.82) * smooth(G - B, -3, 4) * smooth(95 - lum(P), 0, 30)
    leaf = smooth(box(f, 4), 0.25, 0.6) * region  # defocused leaves: close the gaps, soft edges
    leaf = minf(-minf(-leaf, 4), 4)  # closing: fill the pale highlights inside the leaves
    leaf = box(leaf, 2)
    leaf *= np.clip((xx - PLANT["x0"]) / 25, 0, 1) * smooth(yy - (PLANT["y0"] + 35 + np.clip(1600 - xx, 0, None) * 0.3), 0, 12)
    save_rgba(P, leaf, OUT / "fg-plant.png")
    rep["plant"] = dict(px=int((leaf > 0.5).sum()), soft_px=int(((leaf > 0.02) & (leaf <= 0.5)).sum()))

    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "extract.json").write_text(json.dumps(rep, indent=1) + "\n")
    print(json.dumps(rep, indent=1))

    # ---------------------------------------------------------------- check composites (offline)
    E = load(ENV)
    comp = E.copy()

    def over(img, a):
        nonlocal comp
        comp = img * a[..., None] + comp * (1 - a[..., None])

    over(P, hub_a)
    comp = np.clip(comp + light, 0, 255)  # plus-lighter
    over(P, tab)
    comp = np.clip(comp + steam, 0, 255)
    over(P, leaf)
    Image.fromarray(np.round(comp).astype(np.uint8)).save(WORK / "offline-env-plus-layers.png")
    chk = np.zeros((H, W, 3)) + np.array([255, 0, 255]) * ((xx // 8 + yy // 8) % 2)[..., None] * 0.5 + 60

    def onchk(img, a):
        return img * a[..., None] + chk * (1 - a[..., None])

    for name, img, al, box_ in [("hub", P, hub_a, (620, 500, 1070, 700)), ("table", P, tab, (0, 690, 470, 941)), ("plant", P, leaf, (1380, 740, 1672, 941))]:
        x0, y0, x1, y1 = box_
        a1 = onchk(img, al)[y0:y1, x0:x1]
        a2 = comp[y0:y1, x0:x1]
        a3 = P[y0:y1, x0:x1]
        sheet = np.concatenate([a3, a1, a2], 1)
        Image.fromarray(np.clip(np.round(sheet), 0, 255).astype(np.uint8)).resize((sheet.shape[1] * 2, sheet.shape[0] * 2), Image.LANCZOS).save(WORK / f"check-{name}.png")
    x0, y0, x1, y1 = 600, 490, 1080, 745
    lt = light[y0:y1, x0:x1] * 3
    Image.fromarray(np.clip(np.round(np.concatenate([P[y0:y1, x0:x1], lt], 1)), 0, 255).astype(np.uint8)).resize(((x1 - x0) * 4, (y1 - y0) * 2), Image.LANCZOS).save(WORK / "check-hub-light-x3.png")
    x0, y0, x1, y1 = 200, 690, 360, 810
    st = steam[y0:y1, x0:x1] * 3
    Image.fromarray(np.clip(np.round(np.concatenate([P[y0:y1, x0:x1], st, comp[y0:y1, x0:x1]], 1)), 0, 255).astype(np.uint8)).resize(((x1 - x0) * 9, (y1 - y0) * 3), Image.LANCZOS).save(WORK / "check-steam.png")


if __name__ == "__main__":
    main()
