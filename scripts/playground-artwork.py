"""M1.3K: Playground's 2.5D artwork, prepared for illustration and integration.

Nothing here generates artwork. The hidden floor and architecture behind
Playground were never painted, so they need new illustration (see
docs/m1.3k/ARTWORK-BRIEF.md). This tool does the three things around it:

  package   builds the illustrator package in docs/m1.3k/package/ from the
            existing plate, M1.3I masks and current layers (nothing is
            re-traced; every mask comes from an existing file).
  check     validates a delivered clean environment (Asset A), and optionally
            a re-matted station (Asset B) and contact rows (Asset A2):
            size and alignment, approved pixels kept, station fully removed,
            no neon left, sharpness against the real floor, copied or
            mirrored texture, seams, and how the station sits on it at rest.
            Writes a report and review sheets (including an offline lifted
            preview) to docs/m1.3k/deliveries/<name>/.
  stage     checks, then writes the experimental layer files for that
            delivery to docs/m1.3k/staging/<name>/ (never to public/), with
            the steps to apply them (docs/m1.3k/INTEGRATION-PLAN.md).
  selftest  proves the pipeline on known inputs (no artwork involved): the
            current synthesised environment round-trips to the current
            layers exactly; the plate itself (station not removed) fails;
            a 1 px shift is detected.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/playground-artwork.py package
    ... check <clean-environment.png> [--object <station.png>] [--contact <rows.png>] [--name <id>]
    ... stage <clean-environment.png> [--object ...] [--contact ...] --name <id> [--force]
    ... selftest

Accepted sizes: 1672 x 941, or 3344 x 1882 (the preferred 2x working
canvas, box-downsampled to the scene; the 2x file is kept for review).
"""

import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1672, 941
P25 = ROOT / "public/scene/layers25d/playground"
F = dict(
    plate=ROOT / "public/scene/lab-plate.webp",
    corrections=ROOT / "public/scene/layers25d/environment-corrections.png",
    background=P25 / "background.png",
    floor=P25 / "floor.png",
    object=P25 / "object.png",
    contact=P25 / "contact-unlit.png",
    remove=ROOT / "docs/m1.3i/masks/playground-remove.png",
    band=ROOT / "docs/m1.3i/masks/playground-floor.png",
    lines=ROOT / "docs/m1.3i/masks/lines.png",
)
OUT = ROOT / "docs/m1.3k"
# The lift (globals.css): translateY(-18 px) scale(1.01) about the origin (scene-layout.ts).
ORIGIN = (1218.0, 546.0)
LIFT, SCALE = 18.0, 1.01
# Region the station and its gap occupy (scene px).
REGION = (1040, 320, 1400, 575)
# Where the floor/back-step line runs behind the station (make-playground-layered.mjs).
FLOOR_Y = lambda x: 432 + (x - 1060) * 18 / 320  # noqa: E731
# Real floor for sharpness reference: left of the base at the band's depth,
# and in front of it below the reflection (both outside the remove mask).
REF_LEFT = (985, 500, 1050, 556)
REF_FRONT = (1100, 566, 1360, 600)
# The neighbouring Experience panel and the lit block left of the station.
EXCLUDE = [(1384, 500, 1584, 700), (930, 380, 1002, 498)]


# ---------------------------------------------------------------- utilities

def rgb(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float64)


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def mask(p):
    return np.asarray(Image.open(p).convert("L")) > 127


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def boxsum(m, r):
    """Sum over a (2r+1)^2 square, same size, zero padded."""
    c = np.pad(m.astype(np.float64), ((r + 1, r), (r + 1, r))).cumsum(0).cumsum(1)
    n = 2 * r + 1
    return c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]


def dilate(m, r):
    return boxsum(m, r) > 0.5


def erode(m, r):
    return ~dilate(~m, r)


def gauss(a, s):
    n = int(3 * s) + 1
    k = np.exp(-np.arange(-n, n + 1) ** 2 / (2 * s * s))
    k /= k.sum()
    pad = [(n, n), (0, 0)] + [(0, 0)] * (a.ndim - 2)
    p = np.pad(a, pad, mode="edge")
    a = sum(k[i] * p[i : i + a.shape[0]] for i in range(2 * n + 1))
    pad = [(0, 0), (n, n)] + [(0, 0)] * (a.ndim - 2)
    p = np.pad(a, pad, mode="edge")
    return sum(k[i] * p[:, i : i + a.shape[1]] for i in range(2 * n + 1))


def laplacian(l):
    p = np.pad(l, 1, mode="edge")
    return 4 * l - p[:-2, 1:-1] - p[2:, 1:-1] - p[1:-1, :-2] - p[1:-1, 2:]


def u8(a):
    return np.clip(np.round(a), 0, 255).astype(np.uint8)


def save(a, p, mode=None):
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    if a.dtype == bool:
        a = a.astype(np.uint8) * 255
    Image.fromarray(a if a.dtype == np.uint8 else u8(a), mode).save(p)
    return p


def crop(a, r):
    x0, y0, x1, y1 = r
    return a[y0:y1, x0:x1]


def zoom(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def font(size=15):
    for f in ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def sheet(panels, path, width=None, bg=(18, 18, 22)):
    """Stack labelled panels [(label, PIL image)] vertically."""
    f = font(15)
    width = width or max(p.width for _, p in panels)
    h = sum(p.height + 26 for _, p in panels)
    out = Image.new("RGB", (width, h), bg)
    d = ImageDraw.Draw(out)
    y = 0
    for label, p in panels:
        d.text((6, y + 4), label, fill=(240, 200, 120), font=f)
        out.paste(p.convert("RGB"), (0, y + 26))
        y += p.height + 26
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path)
    return path


def rel(p):
    return Path(p).resolve().relative_to(ROOT).as_posix()


# ---------------------------------------------------------------- the scene

class Scene:
    """The approved plate, the experimental environment and Playground's masks."""

    def __init__(self):
        self.plate = rgb(F["plate"])
        c = rgba(F["corrections"])
        ca = c[..., 3:] / 255
        # The environment the experimental build shows: plate with the five
        # connection lines and Playground's strip reflection removed.
        self.env = c[..., :3] * ca + self.plate * (1 - ca)
        bg = rgba(F["background"])
        self.bg_rgb = bg[..., :3]
        # The hole: every pixel the station covers (the current background's footprint).
        self.hole = bg[..., 3] > 0
        self.obj = rgba(F["object"])
        self.oa = self.obj[..., 3] / 255
        self.remove = mask(F["remove"])
        self.band = mask(F["band"])
        self.floor_hidden = rgba(F["floor"])[..., 3] > 0
        self.lines = mask(F["lines"])
        # Uncovered by the lift: the station's coverage drops there (a soft edge
        # whose coverage stays the same is not newly exposed).
        self.exposed = {}
        for d in (18, 24):
            la = self.lifted_alpha(d)
            self.exposed[d] = self.hole & (la < 0.98) & (self.oa - la > 0.02)

    def lifted_alpha(self, lift=LIFT):
        return self.lift_rgba(np.dstack([np.zeros((H, W, 3)), self.oa * 255]), lift)[..., 3] / 255

    def lift_rgba(self, img, lift=LIFT):
        """img (H, W, 4; straight alpha 0-255) as the lift draws it: translate, then scale about the origin. Bilinear, premultiplied."""
        a = img[..., 3:] / 255
        pm = np.dstack([img[..., :3] * a, a])
        x0, y0, x1, y1 = REGION
        ys, xs = np.mgrid[y0 - 30 : y1, x0 - 10 : x1 + 10]
        ox, oy = ORIGIN
        sx = ox + (xs + 0.5 - ox) / SCALE - 0.5
        sy = oy + (ys + 0.5 + lift - oy) / SCALE - 0.5
        ix, iy = np.floor(sx).astype(int), np.floor(sy).astype(int)
        fx, fy = (sx - ix)[..., None], (sy - iy)[..., None]
        ix, iy = ix.clip(0, W - 2), iy.clip(0, H - 2)
        s = pm[iy, ix] * (1 - fx) * (1 - fy) + pm[iy, ix + 1] * fx * (1 - fy) + pm[iy + 1, ix] * (1 - fx) * fy + pm[iy + 1, ix + 1] * fx * fy
        out = np.zeros((H, W, 4))
        a = s[..., 3:]
        out[ys, xs, :3] = np.where(a > 1e-6, s[..., :3] / np.maximum(a, 1e-6), 0)
        out[ys, xs, 3] = a[..., 0] * 255
        return out

    def contact_line(self):
        """Per column, the station's bottom edge (lowest row with alpha >= 0.5), +0.5 px."""
        pts = []
        for x in range(1055, 1382):
            ys = np.nonzero(self.oa[334:556, x] >= 0.5)[0]
            if len(ys):
                pts.append((x, 334 + ys.max() + 0.5))
        return pts


def over(top, a, below):
    a = a[..., None] if a.ndim == 2 else a
    return top * a + below * (1 - a)


# ---------------------------------------------------------------- package

def package():
    s = Scene()
    pk = OUT / "package"
    if pk.exists():  # rebuilt from scratch; the hand-written README.md stays
        for c in pk.iterdir():
            if c.name != "README.md":
                shutil.rmtree(c) if c.is_dir() else c.unlink()
    made = []

    # 01 source
    made.append(save(u8(s.plate), pk / "01-source/lab-plate.png"))
    made.append(save(u8(s.env), pk / "01-source/environment-lines-removed.png"))
    up = Image.fromarray(u8(s.plate)).resize((2 * W, 2 * H), Image.LANCZOS)
    p = pk / "01-source/lab-plate@2x-UPSCALED-no-new-detail.png"
    up.save(p)
    made.append(p)
    up = Image.fromarray(u8(s.env)).resize((2 * W, 2 * H), Image.LANCZOS)
    p = pk / "01-source/environment-lines-removed@2x-UPSCALED-no-new-detail.png"
    up.save(p)
    made.append(p)

    # 02 masks (white = the area named, black = keep the approved pixels)
    masks = {
        "1-lift-exposed-18px": s.exposed[18],
        "2-lift-exposed-24px-safety": s.exposed[24],
        "3-floor-hidden": s.floor_hidden,
        "4-floor-band": s.band,
        "5-hole-station-footprint": s.hole,
        "6-remove-with-6px-margin": s.remove,
        "7-connection-lines-reference": s.lines,
    }
    for name, m in masks.items():
        made.append(save(m, pk / f"02-masks/{name}.png", "L"))
        made.append(save(np.repeat(np.repeat(m, 2, 0), 2, 1), pk / f"02-masks/@2x/{name}@2x.png", "L"))

    # Provenance: what is original, what must be newly illustrated.
    dim = s.plate * 0.45
    prov = dim.copy()
    layers = [
        (s.remove & ~s.hole, (230, 170, 40), 0.75),  # blend margin: original, kept
        (s.hole, (60, 120, 230), 0.8),  # hidden: new illustration
        (s.floor_hidden, (40, 200, 120), 0.9),  # hidden floor
        (s.exposed[24], (240, 90, 200), 0.95),  # exposed by the lift (+ safety)
        (s.exposed[18], (240, 40, 40), 1.0),  # exposed by the 18 px lift
    ]
    for m, c, k in layers:
        prov[m] = prov[m] * (1 - k) + np.array(c) * k
    made.append(save(u8(prov), pk / "02-masks/provenance-full.png"))
    pc = Image.fromarray(u8(crop(prov, REGION)))
    legend = Image.new("RGB", (pc.width * 3, 120), (18, 18, 22))
    d = ImageDraw.Draw(legend)
    f = font(17)
    items = [
        ((115, 115, 115), "Dimmed: ORIGINAL approved pixels. Keep exactly."),
        ((230, 170, 40), "Amber: 6 px blend margin. Original pixels; visible at rest; discarded from the delivery."),
        ((60, 120, 230), "Blue: hidden by the station. NEW ILLUSTRATION (wall, step, floor behind the cabinet)."),
        ((40, 200, 120), "Green: hidden floor band. NEW ILLUSTRATION, highest quality."),
        ((240, 40, 40), "Red: what the 18 px lift uncovers (magenta: +6 px safety). Must be flawless at 3x."),
    ]
    for i, (c, t) in enumerate(items):
        d.rectangle((10, 8 + i * 22, 26, 24 + i * 22), fill=c)
        d.text((34, 6 + i * 22), t, fill=(230, 230, 230), font=f)
    made.append(sheet([("Provenance at 3x (scene x %d-%d, y %d-%d)" % (REGION[0], REGION[2], REGION[1], REGION[3]), zoom(pc, 3)), ("Legend", legend)], pk / "02-masks/provenance-3x.png"))

    # 03 context
    ctx = (960, 300, 1480, 620)
    pl = Image.fromarray(u8(s.plate))
    made.append(save(np.asarray(pl.crop(ctx)), pk / "03-context/context-1x.png"))
    made.append(save(np.asarray(zoom(pl.crop(ctx), 2)), pk / "03-context/context-2x.png"))
    details = {
        "cabinet-top": (1100, 336, 1300, 400),
        "base-left-end": (1050, 480, 1150, 556),
        "base-middle": (1150, 500, 1290, 560),
        "base-right-end": (1280, 470, 1390, 560),
    }
    for k, r in details.items():
        made.append(save(np.asarray(zoom(pl.crop(r), 4)), pk / f"03-context/detail-{k}-4x.png"))
    # The current cut-out (Asset B as it is), on a checkerboard and on flat colours.
    yy, xx = np.mgrid[0:H, 0:W]
    checker = np.where(((xx // 6 + yy // 6) % 2)[..., None] == 0, 200.0, 150.0) * np.ones(3)
    made.append(save(np.asarray(zoom(Image.fromarray(u8(crop(over(s.obj[..., :3], s.oa, checker), REGION))), 2)), pk / "03-context/station-cutout-current-checker-2x.png"))
    shutil.copy(F["object"], pk / "03-context/station-cutout-current.png")
    made.append(pk / "03-context/station-cutout-current.png")
    edges = []
    for label, r, k in [("Cabinet top: a dark band of wall and glow is cut out with the marquee", (1100, 340, 1300, 400), 4), ("Base bottom: lit floor kept under the stone; notches under the strip", (1055, 505, 1385, 552), 3)]:
        for name, c in [("green", (0, 200, 120)), ("white", (235, 235, 235))]:
            img = Image.fromarray(u8(crop(over(s.obj[..., :3], s.oa, np.full((H, W, 3), c, float)), r)))
            edges.append((f"{label} (over {name})", zoom(img, k)))
    made.append(sheet(edges, pk / "03-context/station-cutout-defects.png"))

    # 04 guides: measured geometry over the plate, 2x.
    gr = (1000, 320, 1440, 600)
    k = 2
    g = zoom(Image.fromarray(u8(crop(s.plate, gr) * 0.8)), k).convert("RGBA")
    ov = Image.new("RGBA", g.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    P = lambda x, y: ((x - gr[0]) * k, (y - gr[1]) * k)  # noqa: E731

    def outline(m, col):
        e = m & ~erode(m, 1)
        ys, xs = np.nonzero(crop(e, gr))
        for x, y in zip(xs, ys):
            d.rectangle((x * k, y * k, x * k + k - 1, y * k + k - 1), fill=col)

    outline(s.hole, (255, 255, 255, 170))
    outline(s.exposed[18], (255, 60, 60, 255))
    cl = s.contact_line()
    d.line([P(x, y) for x, y in cl], fill=(0, 230, 255, 255), width=2)
    ox, oy = ORIGIN
    lifted = [(ox + (x - ox) * SCALE, oy + (y - oy) * SCALE - LIFT) for x, y in cl]
    d.line([P(x, y) for x, y in lifted], fill=(255, 220, 0, 255), width=2)
    d.line([P(1040, FLOOR_Y(1040)), P(1400, FLOOR_Y(1400))], fill=(160, 255, 120, 220), width=2)
    # Same-depth rows: where the real floor at the band's depth is visible.
    for y in range(int(min(y for _, y in lifted)), int(max(y for _, y in cl)) + 1, 6):
        d.line([P(1000, y), P(1052, y)], fill=(255, 160, 60, 200), width=1)
    g = Image.alpha_composite(g, ov)
    legend = Image.new("RGB", (g.width, 140), (18, 18, 22))
    d2 = ImageDraw.Draw(legend)
    for i, (c, t) in enumerate([
        ((0, 230, 255), "Cyan: contact line at rest (the station's bottom edge, measured from its alpha)."),
        ((255, 220, 0), "Yellow: the same edge at full lift (18 px up, 1% scale about x 1218, y 546)."),
        ((255, 60, 60), "Red outline: floor uncovered at full lift. White outline: the station footprint (hole)."),
        ((160, 255, 120), "Green: where the floor meets the back step behind the station (y = 432 + (x-1060)*18/320)."),
        ((255, 160, 60), "Orange ticks: rows at the gap's depth where real floor is visible, left of the base (grain-scale reference)."),
    ]):
        d2.rectangle((10, 10 + i * 24, 26, 26 + i * 24), fill=c)
        d2.text((34, 8 + i * 24), t, fill=(230, 230, 230), font=font(16))
    made.append(sheet([("Measured geometry, 2x (scene x %d-%d, y %d-%d)" % gr, g), ("Legend", legend)], pk / "04-guides/geometry-guides-2x.png"))
    # Joints: local contrast, so the flagstone joints and grain read.
    lc = (960, 430, 1480, 700)
    L = lum(s.env)
    hp = (L - gauss(L, 10.0)) * 5 + 128
    made.append(sheet([("Floor joints and grain (local contrast x5, lines removed), 2x: continue only joints that run into the hole", zoom(Image.fromarray(u8(crop(hp, lc))), 2))], pk / "04-guides/floor-joints-contrast-2x.png"))

    # 05 floor reference: same depth, real pixels.
    for k_, r in {"left-of-base-same-depth": REF_LEFT, "in-front-of-base": REF_FRONT}.items():
        made.append(save(np.asarray(zoom(Image.fromarray(u8(crop(s.plate, r))), 4)), pk / f"05-floor-reference/{k_}-4x.png"))
    stats = {k_: floor_stats(s.plate, r) for k_, r in {"left_of_base_same_depth": REF_LEFT, "in_front_of_base": REF_FRONT}.items()}
    (pk / "05-floor-reference/floor-stats.json").write_text(json.dumps(stats, indent=1) + "\n")
    made.append(pk / "05-floor-reference/floor-stats.json")

    # 06 defects to avoid (crops of earlier evidence).
    made.append(defects_sheet(pk / "06-defects/defects-to-avoid.png"))

    summary = {
        "exposed_18px": int(s.exposed[18].sum()),
        "exposed_24px": int(s.exposed[24].sum()),
        "exposed_18px_floor": int((s.exposed[18] & s.floor_hidden).sum()),
        "exposed_18px_not_floor": int((s.exposed[18] & ~s.floor_hidden).sum()),
        "floor_hidden": int(s.floor_hidden.sum()),
        "floor_band": int(s.band.sum()),
        "hole": int(s.hole.sum()),
        "remove": int(s.remove.sum()),
        "station_partial_alpha": int(((s.oa > 0) & (s.oa < 1)).sum()),
        "floor_reference": stats,
    }
    (pk / "package.json").write_text(json.dumps(summary, indent=1) + "\n")
    print(json.dumps(summary, indent=1))
    print(f"{len(made)} files in {rel(pk)}")


def floor_stats(a, r):
    c = crop(a, r)
    l = lum(c)
    lap = np.abs(laplacian(l))[1:-1, 1:-1]
    return dict(rect=list(r), mean_rgb=[round(float(v), 1) for v in c.reshape(-1, 3).mean(0)], luminance=round(float(l.mean()), 1), detail_mean_abs_laplacian=round(float(lap.mean()), 2))


def defects_sheet(path):
    D = ROOT / "docs"
    items = [
        ("Ghost of the station: patch synthesis behind the cabinet (M1.3H). Architecture cannot be synthesised.", D / "m1.3h/clean-background.png", (930, 28, 1850, 568), 1),
        ("Soft, smeared floor: LaMa c2 at 3x, shadows off (M1.3J.1).", D / "m1.3j/lama/lift-gap-3x-no-shadow.png", (0, 690, 1006, 990), 1),
        ("Grey synthetic band with a dark seam, read as a second stone step (M1.3I floor, 3x).", D / "m1.3j/lama/lift-gap-3x-no-shadow.png", (0, 22, 1006, 322), 1),
        ("Dark gap, notched base edge, soft floor (M1.3J.5 'before', 3x, shadows off).", D / "m1.3j/depth/lifted-no-shadow-3x.png", (0, 22, 1006, 258), 1),
        ("Base-corner copy (dark wedge) left in another layer (M1.3J.3 'before', 4x).", D / "m1.3j/connection/left-end-4x.png", (0, 22, 400, 220), 2),
    ]
    panels = []
    for label, p, r, k in items:
        im = Image.open(p).convert("RGB")
        r = (r[0], r[1], min(r[2], im.width), min(r[3], im.height))
        im = im.crop(r)
        if k != 1:
            im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        if im.width > 1006:
            im = im.resize((1006, round(im.height * 1006 / im.width)), Image.LANCZOS)
        panels.append((label, im))
    return sheet(panels, path, width=1006)


# ---------------------------------------------------------------- deliveries

def load_delivery(p, alpha=False):
    im = Image.open(p)
    icc = im.info.get("icc_profile")
    a = np.asarray(im.convert("RGBA" if alpha or im.mode in ("RGBA", "LA", "PA") else "RGB")).astype(np.float64)
    h, w = a.shape[:2]
    if (w, h) == (W, H):
        scale = 1
    elif (w, h) == (2 * W, 2 * H):
        scale = 2
        if a.shape[2] == 4:  # premultiplied box filter
            al = a[..., 3:] / 255
            pm = np.dstack([a[..., :3] * al, al])
            pm = pm.reshape(H, 2, W, 2, 4).mean((1, 3))
            a1 = pm[..., 3:]
            a = np.dstack([np.where(a1 > 1e-6, pm[..., :3] / np.maximum(a1, 1e-6), 0), a1 * 255])
        else:
            a = a.reshape(H, 2, W, 2, a.shape[2]).mean((1, 3))
    else:
        raise SystemExit(f"{p}: {w} x {h}; expected {W} x {H} or {2 * W} x {2 * H}")
    srgb = icc is None or b"sRGB" in icc or b"sRGB IEC61966" in icc
    return a, scale, srgb


def ncc_map(img, tpl):
    """Normalised cross-correlation of a zero-mean template over img (valid positions), via FFT."""
    th, tw = tpl.shape
    t = tpl - tpl.mean()
    tn = np.sqrt((t * t).sum())
    if tn < 1e-6:
        return None
    Hh, Ww = img.shape
    fi = np.fft.rfft2(img)
    ft = np.fft.rfft2(t, s=img.shape)
    num = np.fft.irfft2(fi * np.conj(ft), s=img.shape)[: Hh - th + 1, : Ww - tw + 1]
    c1 = np.pad(img, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    c2 = np.pad(img * img, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    win = lambda c: c[th:, tw:] - c[:-th, tw:] - c[th:, :-tw] + c[:-th, :-tw]  # noqa: E731
    s1, s2 = win(c1), win(c2)
    var = np.maximum(s2 - s1 * s1 / (th * tw), 1e-9)
    return num / (np.sqrt(var) * tn)


def repetition(L, region_mask, crop_r, tw=20, th=8):
    """Templates tiled over region_mask (fully inside it); best match elsewhere in crop_r, straight and mirrored."""
    x0, y0, x1, y1 = crop_r
    hp = L - gauss(L, 2.0)
    img = hp[y0:y1, x0:x1]
    m = region_mask[y0:y1, x0:x1]
    res = []
    for ty in range(0, m.shape[0] - th, th // 2):
        for tx in range(0, m.shape[1] - tw, tw // 2):
            if not m[ty : ty + th, tx : tx + tw].all():
                continue
            tpl = img[ty : ty + th, tx : tx + tw]
            best = {}
            for kind, t in (("copy", tpl), ("mirror_h", tpl[:, ::-1]), ("mirror_v", tpl[::-1, :])):
                n = ncc_map(img, t)
                if n is None:
                    continue
                if kind == "copy":
                    n[max(0, ty - 6) : ty + 7, max(0, tx - 6) : tx + 7] = -1
                i = np.unravel_index(np.argmax(n), n.shape)
                best[kind] = (float(n[i]), int(i[1] + x0 - (tx + x0)), int(i[0] + y0 - (ty + y0)))
            res.append(dict(at=[tx + x0, ty + y0], **{k: dict(ncc=round(v[0], 3), dx=v[1], dy=v[2]) for k, v in best.items()}))
    return res


def check(env_path, obj_path=None, contact_path=None, name=None, s=None, quiet=False):
    s = s or Scene()
    name = name or Path(env_path).stem
    out = OUT / "deliveries" / name
    out.mkdir(parents=True, exist_ok=True)
    rep = dict(delivery=str(env_path), name=name, checks=[])

    def note(level, key, msg, **data):
        rep["checks"].append(dict(level=level, check=key, message=msg, **data))

    env, scale, srgb = load_delivery(env_path)
    rep["scale"] = scale
    if env.shape[2] == 4:
        if (env[..., 3][s.hole] < 255).any():
            note("FAIL", "opaque", "The environment has transparent pixels inside the station footprint.")
        env = env[..., :3]
    if not srgb:
        note("WARN", "colour-profile", "Embedded colour profile is not sRGB; export as sRGB.")
    note("OK", "size", f"{'3344 x 1882 (2x), box-downsampled' if scale == 2 else '1672 x 941'}.")

    # Alignment: the ring just outside the remove mask must match the plate.
    ring = dilate(s.remove, 30) & ~s.remove & ~s.lines
    for x0, y0, x1, y1 in EXCLUDE:
        ring[y0:y1, x0:x1] = False
    d_plate = np.abs(env - s.plate).max(2)
    d_env = np.abs(env - s.env).max(2)
    diff = np.minimum(d_plate, d_env)  # either base (plate, or lines removed) is accepted
    best = None
    ys, xs = np.nonzero(ring)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            yy, xx = (ys + dy).clip(0, H - 1), (xs + dx).clip(0, W - 1)
            m = float(np.minimum(np.abs(env[yy, xx] - s.plate[ys, xs]).max(1), np.abs(env[yy, xx] - s.env[ys, xs]).max(1)).mean())
            if best is None or m < best[0]:
                best = (m, dx, dy)
    ring_mean = float(diff[ring].mean())
    tol = 1.0 if scale == 1 else 3.0
    if (best[1], best[2]) != (0, 0) and best[0] < ring_mean - 0.5:
        note("FAIL", "alignment", f"Misaligned: matches the plate best shifted by dx {best[1]}, dy {best[2]} px.", best_offset=[best[1], best[2]], ring_mean_at_offset=round(best[0], 2), ring_mean=round(ring_mean, 2))
    elif ring_mean > tol + 2:
        note("FAIL", "alignment", f"Around the station the delivery differs from the plate by {ring_mean:.1f} levels on average (tolerance {tol}): repainted or regraded outside the mask.", ring_mean=round(ring_mean, 2))
    else:
        note("OK", "alignment", f"Aligned (best offset 0, 0); mean difference around the station {ring_mean:.2f} levels.", ring_mean=round(ring_mean, 2))

    # Approved pixels outside the mask: always discarded, but changes there mean misuse.
    outside = ~s.remove
    changed = outside & (diff > (3 if scale == 1 else 12))
    margin = s.remove & ~s.hole
    if changed.sum() > (0 if scale == 1 else 200):
        ys, xs = np.nonzero(changed)
        note("FAIL", "outside-mask", f"{int(changed.sum())} px outside the remove mask differ from the approved plate (bbox x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}). Outside the mask the delivery must be the plate.", px=int(changed.sum()))
    else:
        note("OK", "outside-mask", "Approved pixels outside the remove mask are unchanged.", px=int(changed.sum()))
    note("INFO", "margin", f"Blend margin: {int((margin & (diff > 3)).sum())} of {int(margin.sum())} px changed. They are visible at rest and never taken from the delivery.")

    # Station removed: the footprint's interior must not still be the plate.
    inner = s.hole & (s.oa >= 1)
    same = inner & (d_plate < 6)
    frac = float(same.sum() / inner.sum())
    if frac > 0.10:
        note("FAIL", "station-removed", f"{frac:.0%} of the station's interior is still the plate's pixels: the station was not removed.", fraction=round(frac, 3))
    else:
        note("OK", "station-removed", f"Station interior repainted ({frac:.1%} still equal to the plate).", fraction=round(frac, 3))
    R, G, B = env[..., 0], env[..., 1], env[..., 2]
    neon = s.hole & (((B > 110) & (B > G + 50) & (R > G + 20)) | ((R > 200) & (G > 110) & (B < 120)))
    lvl = "WARN" if neon.sum() > 30 else "OK"
    note(lvl, "station-light", f"{int(neon.sum())} px of neon-purple or strip-orange colour inside the footprint (station light must not be baked in).", px=int(neon.sum()))

    # Floor quality in the band the lift uncovers.
    L = lum(env)
    lap = np.abs(laplacian(L))
    band_in = erode(s.floor_hidden, 1)
    ref = np.zeros((H, W), bool)
    # The floor in front: same tone as the gap. (Left of the base the floor at
    # the same depth carries the bright window reflection: a grain-scale
    # reference for the artist, not a detail yardstick.)
    x0, y0, x1, y1 = REF_FRONT
    ref[y0:y1, x0:x1] = True
    ref &= ~s.remove & ~dilate(s.lines, 2)
    Lp = lum(s.plate)
    lapp = np.abs(laplacian(Lp))
    det, det_ref = float(lap[band_in].mean()), float(lapp[ref].mean())
    ratio = det / det_ref
    # A guard only. Calibrated on the rejected floors (M1.3H 1.40, M1.3J.2
    # hybrid 1.21, LaMa c2 1.09, c1 1.73): local detail does not separate
    # them from the real floor, which is itself dark and soft at 1x. Perceived
    # blur is judged in the visual review; this catches gross smoothing or noise.
    lvl = "WARN" if ratio < 0.5 or ratio > 2.0 else "INFO"
    msg = "much softer than the real floor (smoothing)" if ratio < 0.5 else ("much noisier than the real floor (sharpening or added noise)" if ratio > 2.0 else "within the range of the real floor; blur is judged visually")
    note(lvl, "sharpness", f"Fine detail in the uncovered floor {det:.2f} vs real floor {det_ref:.2f} (ratio {ratio:.2f}): {msg}.", band=round(det, 2), real=round(det_ref, 2), ratio=round(ratio, 2))
    tone, tone_ref = float(L[band_in].mean()), float(Lp[ref].mean())
    note("INFO", "tone", f"Uncovered floor luminance {tone:.1f}; real floor beside and in front {tone_ref:.1f}. Judge visually: the floor under the platform may be slightly darker (worn disc).", band=round(tone, 1), real=round(tone_ref, 1))

    # Seam at the footprint's edge: step across it vs the natural step just outside.
    e_in = s.hole & ~erode(s.hole, 1) & ~s.lines
    e_out = dilate(s.hole, 1) & ~s.hole & ~s.lines
    steps = []
    nat = []
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nb = np.roll(np.roll(e_out, -dy, 0), -dx, 1) & e_in
        if nb.any():
            ys, xs = np.nonzero(nb)
            steps.append(np.abs(L[ys, xs] - L[ys + dy, xs + dx]))
        nb2 = np.roll(np.roll(e_out, -dy, 0), -dx, 1) & dilate(s.hole, 2) & ~dilate(s.hole, 1)
        if nb2.any():
            ys, xs = np.nonzero(nb2)
            nat.append(np.abs(Lp[ys, xs] - Lp[(ys + dy).clip(0, H - 1), (xs + dx).clip(0, W - 1)]))
    seam = float(np.concatenate(steps).mean()) if steps else 0
    natural = float(np.concatenate(nat).mean()) if nat else 1
    lvl = "WARN" if seam > 2.5 * natural + 1 else "OK"
    note(lvl, "seam", f"Mean step across the footprint's edge {seam:.2f} vs {natural:.2f} between neighbouring original pixels.", seam=round(seam, 2), natural=round(natural, 2))

    # Copied or mirrored texture in the uncovered floor.
    rep_res = repetition(L, s.floor_hidden, (962, 432, 1474, 624))
    ref_res = repetition(Lp, ref & erode(ref, 1), (962, 432, 1474, 624)) if not quiet else []
    worst = max((max(r[k]["ncc"] for k in ("copy", "mirror_h", "mirror_v") if k in r) for r in rep_res), default=0)
    flagged = [r for r in rep_res if any(r.get(k, {}).get("ncc", 0) > 0.85 for k in ("copy", "mirror_h", "mirror_v"))]
    ref_worst = max((max(r[k]["ncc"] for k in ("copy", "mirror_h", "mirror_v") if k in r) for r in ref_res), default=None)
    lvl = "WARN" if flagged else "OK"
    note(lvl, "repetition", f"{len(flagged)} of {len(rep_res)} floor windows (20 x 8 px) have a near-copy or mirror elsewhere (NCC > 0.85; worst {worst:.2f}" + (f"; real floor's own worst {ref_worst:.2f}" if ref_worst is not None else "") + ").", windows=len(rep_res), flagged=len(flagged), worst=round(worst, 3), real_floor_worst=ref_worst, examples=flagged[:6])

    # The station over the delivery.
    obj = s.obj
    if obj_path:
        obj, oscale, _ = load_delivery(obj_path, alpha=True)
        oa = obj[..., 3] / 255
        outside_rm = (oa > 0) & ~dilate(s.remove, 1)
        if outside_rm.any():
            note("FAIL", "object-extent", f"The station layer has {int(outside_rm.sum())} px outside the remove mask: no painted background exists there.", px=int(outside_rm.sum()))
        part = (oa > 0) & (oa < 1)
        note("INFO", "object-alpha", f"Delivered station: {int((oa > 0).sum())} px, {int(part.sum())} soft-edge px ({'2x' if oscale == 2 else '1x'}).")
    oa = obj[..., 3] / 255
    rest = over(obj[..., :3], oa, np.where(s.hole[..., None], env, s.env))
    # Under the station the screen shows the plate at rest; the layers must
    # recompose it when they switch on at the energy's arrival. Baseline: the
    # current cut-out over the current background (offline; the browser's
    # resampling adds a little, see playground-edge.py).
    hole_obj = (oa > 0) | s.hole
    d_rest = np.abs(rest - s.plate).max(2)[hole_obj]
    cur_rest = over(s.obj[..., :3], s.oa[..., None], np.where(s.hole[..., None], s.bg_rgb, s.env))
    base99 = float(np.percentile(np.abs(cur_rest - s.plate).max(2)[(s.oa > 0) | s.hole], 99))
    p99 = float(np.percentile(d_rest, 99))
    lvl = "OK" if p99 <= base99 + 2 else "WARN"
    note(lvl, "at-rest", f"Station over this environment vs the plate (what rest shows): mean {d_rest.mean():.2f}, 99th percentile {p99:.1f}, max {d_rest.max():.0f} levels; current layers {base99:.1f}. This is what appears at the layer switch on arrival" + ("" if obj_path else " (the current cut-out; staging re-solves its soft-edge colour, so the switch stays as it is today)") + ".", mean=round(float(d_rest.mean()), 2), p99=round(p99, 1), max=round(float(d_rest.max()), 1), current_p99=round(base99, 1))

    contact = rgba(F["contact"])
    if contact_path:
        contact, _, _ = load_delivery(contact_path, alpha=True)
        ca = contact[..., 3] > 0
        ys, xs = np.nonzero(ca)
        note("INFO", "contact", f"Contact rows delivered: {int(ca.sum())} px, x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()} (current procedural layer: 1,764 px, y 526-553).")

    # Review sheets.
    scene_env = np.where(s.hole[..., None], env, s.env)
    lifted = s.lift_rgba(obj)
    con = contact[..., 3:] / 255
    # Contact rows at full lift (--lp = 1) lie in .lab-depth, under the moving station.
    lifted_unlit = over(lifted[..., :3], lifted[..., 3] / 255, over(contact[..., :3], con, scene_env))
    gap = (1050, 480, 1390, 575)
    imgs = {k: Image.fromarray(u8(crop(v, REGION))) for k, v in dict(plate=s.plate, env=scene_env, rest=rest, lifted=lifted_unlit).items()}
    sheet([
        ("Approved plate (at rest)", zoom(imgs["plate"], 2)),
        ("Delivered environment (inside the footprint), with the approved scene outside it", zoom(imgs["env"], 2)),
        ("Offline preview, full lift (18 px, 1%), shadows OFF, reflection and connection layers not drawn: the browser check is the authority", zoom(imgs["lifted"], 2)),
    ], out / "review-2x.png")
    sheet([
        ("Gap at 3x, offline preview, shadows off: approved plate at rest", zoom(Image.fromarray(u8(crop(s.plate, gap))), 3)),
        ("Gap at 3x, offline preview, shadows, reflection and connection off: lifted over this delivery", zoom(Image.fromarray(u8(crop(lifted_unlit, gap))), 3)),
    ], out / "gap-3x.png")
    if scale == 2:
        big = np.asarray(Image.open(env_path).convert("RGB"))
        g2 = tuple(2 * v for v in gap)
        sheet([("The delivered 2x master, uncovered floor region, at 2x of the master (6x scene)", zoom(Image.fromarray(big[g2[1] : g2[3], g2[0] : g2[2]]), 1))], out / "master-2x-gap.png")
    heat = np.clip(diff * 8, 0, 255)
    hv = np.dstack([heat, heat * 0.5, heat * 0.2])
    hv[s.hole & ~(diff > 0)] = (20, 40, 90)
    save(u8(crop(hv, (960, 300, 1480, 620))), out / "difference-from-plate-x8.png")

    rep["summary"] = {lv: sum(c["level"] == lv for c in rep["checks"]) for lv in ("FAIL", "WARN", "OK", "INFO")}
    (out / "report.json").write_text(json.dumps(rep, indent=1) + "\n")
    lines = [f"# Delivery check: {name}", "", f"Source: `{env_path}`", "", "| Result | Check | Finding |", "|---|---|---|"]
    lines += [f"| {c['level']} | {c['check']} | {c['message']} |" for c in rep["checks"]]
    lines += ["", "Sheets: `review-2x.png`, `gap-3x.png`, `difference-from-plate-x8.png`" + (", `master-2x-gap.png`" if scale == 2 else "") + ".", "", "Automatic checks cannot judge perspective, believability or design fidelity: the owner's visual review (SA-1) decides."]
    (out / "report.md").write_text("\n".join(lines) + "\n")
    if not quiet:
        for c in rep["checks"]:
            print(f"{c['level']:5} {c['check']:16} {c['message']}")
        print(f"report: {rel(out / 'report.md')}")
    return rep, dict(env=env, obj=obj, contact=contact if contact_path else None)


def stage(env_path, obj_path, contact_path, name, force=False, s=None, out=None):
    s = s or Scene()
    rep, d = check(env_path, obj_path, contact_path, name, s=s)
    fails = [c for c in rep["checks"] if c["level"] == "FAIL"]
    if fails and not force:
        raise SystemExit(f"not staged: {len(fails)} failing check(s); see the report (or --force for review only)")
    env, obj = d["env"], d["obj"]
    out = out or OUT / "staging" / name
    dst = out / "public/scene/layers25d/playground"
    dst.mkdir(parents=True, exist_ok=True)
    oa = obj[..., 3] / 255
    # A delivered cut-out may cover a little more; the current one has exactly the current footprint.
    hole = s.hole | (oa > 0) if obj_path else s.hole
    bg = np.zeros((H, W, 4))
    bg[hole, :3] = env[hole]
    bg[hole, 3] = 255
    save(u8(bg), dst / "background.png")
    fl = np.zeros((H, W, 4))
    fl[s.floor_hidden, :3] = env[s.floor_hidden]
    fl[s.floor_hidden, 3] = 255
    save(u8(fl), dst / "floor.png")
    info = dict(background_px=int(hole.sum()), floor_px=int(s.floor_hidden.sum()))
    if obj_path:
        save(u8(obj), dst / "object.png")
        info["object"] = "delivered"
    else:
        # Re-solve the soft edge's colour so the switch at arrival shows what
        # it shows today: target = current cut-out over current background.
        cur = over(s.obj[..., :3], s.oa, np.where(s.hole[..., None], s.bg_rgb, s.env))
        part = (s.oa > 0.08) & (s.oa < 1)
        new = s.obj.copy()
        a = s.oa[part][:, None]
        c = (cur[part] - (1 - a) * env[part]) / a
        clamped = ((c < -0.5) | (c > 255.5)).any(1)
        new[part, :3] = np.clip(c, 0, 255)
        save(u8(new), dst / "object.png")
        moved = np.abs(new[part, :3] - s.obj[part, :3]).max(1)
        info.update(object="current cut-out, soft-edge colour re-solved", edge_px=int(part.sum()), edge_clamped_px=int(clamped.sum()), edge_change_mean=round(float(moved.mean()), 2), edge_change_max=round(float(moved.max()), 1))
    if d["contact"] is not None:
        save(u8(d["contact"]), dst / "contact-unlit.png")
        info["contact"] = "delivered"
    else:
        info["contact"] = "regenerate after applying: scripts/playground-contact-unlit.py"
    (out / "stage.json").write_text(json.dumps(info, indent=1) + "\n")
    (out / "APPLY.md").write_text(APPLY.format(name=name, info=json.dumps(info, indent=1)))
    print(json.dumps(info, indent=1))
    print(f"staged (not applied): {rel(out)}")
    return info, dst


APPLY = """# Apply staged delivery `{name}` (only after the owner approves the check)

Nothing in `public/` has been changed. These steps change the experimental
build only; the default build never references these files.

```
{info}
```

1. Back up the current layers:
   `mkdir -p docs/m1.3k/staging/_previous && cp public/scene/layers25d/playground/{{background,floor,object,contact-unlit}}.png docs/m1.3k/staging/_previous/`
2. Copy the staged files:
   `cp docs/m1.3k/staging/{name}/public/scene/layers25d/playground/*.png public/scene/layers25d/playground/`
3. If no contact rows were delivered:
   `E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/playground-contact-unlit.py`
4. Restart the experimental server (`NEXT_DIST_DIR=.next-layered npx next start -p 3001`); no rebuild is
   needed while the file names are unchanged. Refine the cut-out's edge colour in the browser:
   `scripts/playground-edge.py variants`, `node scripts/playground-edge-frames.mjs`, `scripts/playground-edge.py solve`, then `refine` passes.
5. Compare (default build on :3000, experimental on :3001):
   `npm run visual:scene25d`, `node scripts/visual/playground-depth-evidence.mjs {name}`,
   `npm run inpaint:playground -- compare --name {name}`.
6. Undo: copy `docs/m1.3k/staging/_previous/*.png` back.
"""


# ---------------------------------------------------------------- self-test

def selftest():
    s = Scene()
    tmp = OUT / "selftest"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    results = []

    # 1. Round trip: the current synthesised environment (not a candidate).
    cur = np.where(s.hole[..., None], s.bg_rgb, s.env)
    p = save(u8(cur), tmp / "inputs/current-synthesised-environment.png")
    rep, _ = check(p, name="selftest-roundtrip", s=s, quiet=True)
    info, dst = stage(p, None, None, "selftest-roundtrip", force=True, s=s, out=tmp / "staged")
    bg_new = rgba(dst / "background.png")
    bg_old = rgba(F["background"])
    same_bg = bool((bg_new[..., 3] == bg_old[..., 3]).all() and (bg_new[s.hole] == bg_old[s.hole]).all())
    ob_new, ob_old = rgba(dst / "object.png"), rgba(F["object"])
    ob_max = float(np.abs(ob_new - ob_old).max())
    fl_new = rgba(dst / "floor.png")
    fl_ok = bool((fl_new[..., 3] > 0).sum() == s.floor_hidden.sum())
    results.append(dict(test="round trip: current synthesised environment -> staged layers", background_identical=same_bg, object_max_change=ob_max, floor_px_match=fl_ok,
                        checks={c["check"]: c["level"] for c in rep["checks"]}, repetition=next(c for c in rep["checks"] if c["check"] == "repetition")["message"],
                        sharpness=next(c for c in rep["checks"] if c["check"] == "sharpness")["message"],
                        passed=same_bg and ob_max <= 1 and fl_ok))

    # 2. The plate itself: the station was not removed.
    p2 = save(u8(s.plate), tmp / "inputs/plate-unchanged.png")
    rep2, _ = check(p2, name="selftest-plate", s=s, quiet=True)
    st = next(c for c in rep2["checks"] if c["check"] == "station-removed")
    results.append(dict(test="the plate (station still present) must fail", station_removed=st["level"], message=st["message"], passed=st["level"] == "FAIL"))

    # 3. A 1 px shift of the round-trip environment.
    p3 = save(u8(np.roll(cur, 1, axis=1)), tmp / "inputs/shifted-1px.png")
    rep3, _ = check(p3, name="selftest-shift", s=s, quiet=True)
    al = next(c for c in rep3["checks"] if c["check"] == "alignment")
    results.append(dict(test="1 px shift must be detected", alignment=al["level"], message=al["message"], passed=al["level"] == "FAIL"))

    # 4. 2x path: the round-trip environment upscaled (nearest) must downsample back exactly.
    p4 = save(u8(np.repeat(np.repeat(cur, 2, 0), 2, 1)), tmp / "inputs/roundtrip@2x.png")
    rep4, d4 = check(p4, name="selftest-2x", s=s, quiet=True)
    exact = bool((u8(d4["env"]) == u8(cur)).all())
    results.append(dict(test="2x delivery downsamples onto the scene exactly", exact=exact, alignment=next(c for c in rep4["checks"] if c["check"] == "alignment")["level"], passed=exact))

    # The self-test writes no artwork anywhere: drop its inputs and deliveries' images.
    shutil.rmtree(tmp / "inputs")
    for n in ("selftest-roundtrip", "selftest-plate", "selftest-shift", "selftest-2x"):
        dd = OUT / "deliveries" / n
        if dd.exists():
            shutil.move(str(dd / "report.md"), tmp / f"{n}.md")
            shutil.rmtree(dd)
    shutil.rmtree(tmp / "staged")
    if (OUT / "deliveries").exists() and not any((OUT / "deliveries").iterdir()):
        (OUT / "deliveries").rmdir()
    (tmp / "selftest.json").write_text(json.dumps(results, indent=1) + "\n")
    for r in results:
        print(("PASS " if r["passed"] else "FAIL ") + r["test"])
    print(json.dumps(results, indent=1))
    if not all(r["passed"] for r in results):
        raise SystemExit(1)


# ---------------------------------------------------------------- main

def opt(argv, k):
    return argv[argv.index(k) + 1] if k in argv else None


if __name__ == "__main__":
    argv = sys.argv[1:]
    cmd = argv[0] if argv else ""
    if cmd == "package":
        package()
    elif cmd == "check" and len(argv) > 1:
        check(argv[1], opt(argv, "--object"), opt(argv, "--contact"), opt(argv, "--name"))
    elif cmd == "stage" and len(argv) > 1 and opt(argv, "--name"):
        stage(argv[1], opt(argv, "--object"), opt(argv, "--contact"), opt(argv, "--name"), "--force" in argv)
    elif cmd == "selftest":
        selftest()
    else:
        print(__doc__)
        sys.exit(2)
