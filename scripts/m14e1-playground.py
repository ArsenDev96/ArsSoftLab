"""M1.4E.1: Playground's grounding and power connection in /lab-v2 (experimental).

From existing assets only (nothing generated):
  - the accurate M1.3E route (components/lab/playground-route.ts), and
  - the v2 Playground station as placed (public/scene/v2/stations/playground.png,
    scale/translation from docs/m1.4d/fit.json).

Writes public/scene/v2/m14e1/:
  playground-route-core.png / -glow.png / -wide.png
      the spark's masks (white, alpha = coverage), drawn from the route itself,
      so the spark runs exactly on the v2 line; zero on the station's stone
      (the route ends at the base's ground contact and must never light the face)
  playground-strip-off.png
      the station's lit strips as they look unpowered, in the ASSET's own frame
      (it is placed with the station's transform and rides the lift): the strip
      pixels darkened to the stone's level, with their light spill on the stone
      taken back. Opaque over the strips at rest; fades out when the energy
      arrives, so the strips light only after the spark (as on the homepage).
and docs/m1.4e1/work/playground.json (footprint ellipse, contact point, counts).

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14e1-playground.py
"""

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/scene/v2/m14e1"
WORK = ROOT / "docs/m1.4e1/work"
W, H = 1672, 941
SS = 4


def box(a, r):
    p = np.pad(a, ((r, r), (r, r)), mode="edge")
    c = np.pad(p.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    n = 2 * r + 1
    return (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)


def smooth(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def route():
    src = (ROOT / "components/lab/playground-route.ts").read_text()
    m = re.search(r"PLAYGROUND_ROUTE[^=]*=\s*(\[\[.*?\]\]);", src, re.S)
    return [tuple(p) for p in json.loads(m.group(1))]


def stroke(pts, width):
    im = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(im)
    s = [((x + 0.5) * SS, (y + 0.5) * SS) for x, y in pts]
    d.line(s, fill=255, width=max(1, round(width * SS)), joint="curve")
    r = width * SS / 2
    for x, y in (s[0], s[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return np.asarray(im.resize((W, H), Image.BOX)).astype(np.float64) / 255


def save_mask(a, p):
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = 255
    out[..., 3] = np.clip(np.round(a * 255), 0, 255)
    Image.fromarray(out).save(p, optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    fit = json.loads((ROOT / "docs/m1.4d/fit.json").read_text())["objects"]["playground"]
    s, tx, ty = fit["scale"], fit["tx"], fit["ty"]
    asset = Image.open(ROOT / "public/scene/v2/stations/playground.png").convert("RGBA")
    placed = Image.new("RGBA", (W, H))
    placed.paste(asset.resize((round(W * s), round(H * s)), Image.LANCZOS), (round(tx), round(ty)))
    pa = np.asarray(placed)[..., 3] / 255.0

    # ------------------------------------------------------------ footprint and contact
    cols = [x for x in range(W) if (pa[:, x] > 0.5).any() and 1000 < x < 1420]
    bottom = np.array([np.nonzero(pa[:, x] > 0.5)[0].max() for x in cols], float)
    xs = np.array(cols, float)
    # Fit the lower half of an ellipse y = cy + ry*sqrt(1-((x-cx)/rx)^2) by a small grid search.
    best = None
    for cx in np.arange(1210, 1226, 0.5):
        for rx in np.arange(152, 166, 0.5):
            u = np.clip(1 - ((xs - cx) / rx) ** 2, 0, None) ** 0.5
            A = np.stack([np.ones_like(u), u], 1)
            sol, *_ = np.linalg.lstsq(A, bottom, rcond=None)
            err = float(np.abs(A @ sol - bottom).mean())
            if best is None or err < best[0]:
                best = (err, cx, rx, sol[0], sol[1])
    err, cx, rx, cy, ry = best
    R = route()
    end = R[-1]
    fp = dict(cx=round(cx, 1), cy=round(cy, 1), rx=round(rx, 1), ry=round(ry, 1), fit_mean_err_px=round(err, 2))

    # ------------------------------------------------------------ spark masks (route, minus the stone)
    stone = box((pa > 0.5).astype(float), 1) > 0.02
    masks = {"core": stroke(R, 2.4), "glow": box(stroke(R, 8), 2), "wide": box(stroke(R, 18), 4)}
    for k, m in masks.items():
        m = m * (~stone)
        save_mask(m, OUT / f"playground-route-{k}.png")
        masks[k] = m

    # ------------------------------------------------------------ strips, unpowered (asset frame)
    A = np.asarray(asset).astype(np.float64)
    rgb, aa = A[..., :3], A[..., 3] / 255
    L = rgb @ np.array([0.299, 0.587, 0.114])
    R_, G_, B_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # Lit strips: bright, saturated orange, on the base (lower part of the asset).
    yy, xx = np.mgrid[0:H, 0:W]
    base_rows = yy > (505 - ty) / s  # the base's face only (scene y >= 505), not the cabinet's trim on the platform top
    orange = smooth(R_ - B_, 90, 150) * smooth(L, 120, 170) * smooth(G_ / np.maximum(R_, 1), 0.35, 0.5) * (1 - smooth(G_ / np.maximum(R_, 1), 0.85, 0.95))
    # ... and their white-hot centres: anything bright right next to the orange.
    seed = (orange > 0.35) & base_rows & (aa > 0.9)
    hot = (L > 140) & (R_ >= B_) & (box(seed.astype(float), 7) > 0.004)
    core = (seed | hot) & base_rows & (aa > 0.9)
    core = box(core.astype(float), 1) > 0.34  # close 1 px gaps between centre and fringe
    # Spill: the strip's light on the stone around it (warm excess), within a few px of the core.
    near = box(core.astype(float), 10) > 0.003
    warm_excess = np.clip((R_ - B_) - 40, 0, None) / 120
    spill = near & base_rows & (aa > 0.5) & (warm_excess > 0.15)
    # Unpowered colour: the strip's housing, a dim warm beige (as the homepage's
    # unpowered strips read), shaded by the strip's own brightness profile so its
    # form survives; the spill on the stone is taken back to ~62% (the stone's level).
    housing = np.array([86.0, 70.0, 56.0])
    shade = 0.9 + 0.12 * smooth(L, 160, 255)
    off = np.where(core[..., None], housing * shade[..., None], rgb * 0.62 * (0.8 * (L / np.maximum(L, 1)))[..., None] + 0 * rgb)
    off = np.where(core[..., None], off, (0.7 * L[..., None] + 0.3 * rgb) * 0.62)
    a_core = box(core.astype(float), 2) > 0.02
    alpha = np.where(a_core, 1.0, 0.0)
    alpha = np.maximum(alpha, spill * np.clip(warm_excess, 0, 1) * 0.85)
    alpha = box(alpha, 1) * (aa > 0.5)
    out = np.zeros((H, W, 4))
    out[..., :3] = off
    out[..., 3] = alpha * 255
    out[out[..., 3] < 1, :3] = 0
    Image.fromarray(np.clip(np.round(out), 0, 255).astype(np.uint8)).save(OUT / "playground-strip-off.png", optimize=True)

    rep = dict(
        footprint_ellipse=fp,
        contact_point=list(end),
        route_points=len(R),
        route_start=list(R[0]),
        route_on_stone_px=int((masks["core"] * stone).sum()),
        mask_px={k: int((m > 0.05).sum()) for k, m in masks.items()},
        strip_core_px_asset=int(core.sum()),
        strip_off_alpha_px_asset=int((alpha > 0.05).sum()),
        strip_core_bbox_scene=[round(tx + s * float(v), 1) for v in np.nonzero(core.any(0))[0][[0, -1]].tolist()] + [round(ty + s * float(v), 1) for v in np.nonzero(core.any(1))[0][[0, -1]].tolist()],
    )
    (WORK / "playground.json").write_text(json.dumps(rep, indent=1) + "\n")
    print(json.dumps(rep, indent=1))

    # check: strip-off over the asset (placed), and masks over the scene crop
    po = Image.new("RGBA", (W, H))
    po.paste(Image.open(OUT / "playground-strip-off.png").resize((round(W * s), round(H * s)), Image.LANCZOS), (round(tx), round(ty)))
    lit = placed.crop((1040, 480, 1400, 560))
    unlit = Image.alpha_composite(placed, po).crop((1040, 480, 1400, 560))
    sheet = Image.new("RGB", (360, 166), (20, 20, 20))
    sheet.paste(lit.convert("RGB"), (0, 0))
    sheet.paste(unlit.convert("RGB"), (0, 86))
    sheet.resize((360 * 3, 166 * 3), Image.LANCZOS).save(WORK / "check-strip-off.png")


if __name__ == "__main__":
    main()
