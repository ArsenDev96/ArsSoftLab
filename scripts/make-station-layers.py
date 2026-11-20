"""
M1.2.2: split the Engineering station out of the clean plate.

Produces four full-frame (1672 x 941) RGBA layers, all lossless WebP. They
share one clip box whose (x, y, w, h) in reference px is printed and must
match `box` in components/lab/scene-layout.ts:

    public/scene/layers/engineering-backdrop.webp
        The scenery *behind* the station, reconstructed. Drawn over the
        unchanged plate (alpha = station silhouette), it never moves.

    public/scene/layers/engineering.webp
        The station itself (platform, laptop, charts, plant, device), with a
        soft-edged alpha that follows its silhouette. This layer moves.

    public/scene/layers/engineering-shadow.webp
        Contact-shadow footprint (black, alpha only). Static, on the floor;
        shown while the station is lifted.

    public/scene/layers/engineering-light.webp
        Warm hover light already clipped to the silhouette (moves with the
        station). Baked so the browser needs no CSS masks.

How the split works
-------------------
1. Silhouette: a hand-traced polygon (ENGINEERING_SILHOUETTE, reference px),
   rasterised at 8x and turned into a soft alpha `M` (1 just inside the
   traced edge, 0 one pixel outside it). The polygon hugs the station
   generously at the top and sides, and tightly where something must stay
   behind: the Creative Studio canvas in front of the lower-left corner,
   the Engineering connection line and the floor arc at the lower right.

2. Reconstruction of the scenery behind it (`reconstruct`):
     a. row interpolation between robust samples just outside the hole
        (the wall, horizon and floor reflections are horizontal bands);
     b. anisotropic membrane relaxation (horizontal-dominant) to remove
        row-to-row seams where the hole width changes;
     c. along the bottom contour, the floor sampled at the contact line is
        carried upward, so the strip revealed when the station lifts
        continues the real floor (the contact shadow darkens it further);
     d. matched film grain.
   Sources exclude the hole's glow fringe, highlights (connection line,
   floor arc, screen glow) and the canvas, so nothing bright is smeared in.
   Telea, FSR and isotropic / horizontal normalized convolution were tried
   and rejected (streaks, false colour, voids, seams; see docs/m1.2.2).

3. Exact matting. With backdrop B = plate*(1-P) + recon*P under the
   station, the station colour is solved from  plate = M*C + (1-M)*B,
   so  station-over-backdrop-over-plate  reproduces the plate at rest
   (max 1/255), while the moved station reveals only `recon`. P equals M
   except in the soft edge, where it is lowered just enough to keep C in
   range (the near-black laptop bezel against the brighter wall).

4. Contact shadow and hover light are baked as separate images.

This never touches reference/ or public/scene/lab-plate.webp.

Requirements (dev-only): pip install opencv-python-headless numpy
Usage: python scripts/make-station-layers.py [--preview docs/m1.2.2]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PLATE = ROOT / "public" / "scene" / "lab-plate.webp"
OUT_DIR = ROOT / "public" / "scene" / "layers"

# Traced outline of the Engineering station, clockwise from the laptop
# screen's top-left corner. Reference pixels. Keep in sync with
# ENGINEERING_LAYER in components/lab/scene-layout.ts (bounds/origin).
ENGINEERING_SILHOUETTE = [
    # laptop screen, chart panels, device, laptop deck
    (338.4, 389.5), (340.6, 383.9), (344.0, 382.6), (476.0, 382.8), (479.4, 384.6), (481.0, 389.0),
    (482.9, 410.6), (490.0, 410.6), (537.4, 410.6), (540.3, 413.5), (540.4, 450.4), (551.8, 450.2),
    (554.4, 452.5), (554.8, 469.5), (557.5, 471.0), (576.5, 475.5), (579.8, 478.5), (580.2, 488.6),
    # right stone block and base ring (tight: floor arc + connection line)
    (587.0, 488.8), (590.0, 491.0), (590.8, 516.8), (594.5, 518.2), (598.0, 520.5), (600.0, 523.5),
    (600.0, 527.0), (597.8, 530.5), (594.0, 534.0), (589.0, 536.0), (583.0, 535.3), (578.5, 535.5),
    # bottom contour (measured from luminance profiles)
    (576.5, 539.0), (570.0, 541.5), (560.0, 543.6), (545.0, 546.0), (530.0, 547.6), (515.0, 548.8),
    (500.0, 549.3), (485.0, 550.0), (470.0, 550.4), (455.0, 551.0), (440.0, 551.3), (425.0, 551.3),
    (410.0, 551.2), (395.0, 550.8), (380.0, 550.2), (365.0, 549.4), (350.0, 548.3), (335.0, 547.2),
    (320.0, 545.8), (310.0, 544.6), (300.0, 543.2), (292.0, 541.6), (285.0, 539.8), (278.0, 538.0),
    # left block, upper tier, plant
    (272.0, 536.8), (266.0, 535.8), (263.8, 534.0), (263.4, 509.0), (264.5, 505.6), (268.0, 503.6),
    (286.5, 502.0), (288.0, 500.0), (288.2, 491.5), (290.0, 489.6), (300.0, 488.8), (305.5, 487.0),
    (308.5, 481.5), (311.0, 474.5), (318.0, 467.5), (323.5, 462.0), (332.5, 461.5), (338.0, 466.5),
    # gap between plant and screen, then the screen's left edge
    (343.0, 469.0), (348.7, 460.0), (345.4, 440.0), (342.0, 420.0), (338.7, 400.0),
]

# Foreground objects that must never be used as reconstruction sources.
FOREGROUND = [(150, 544, 304, 700)]  # Creative Studio canvas + easel (x0, y0, x1, y1)

SS = 8           # silhouette supersampling
EDGE_IN = 0.6    # alpha reaches 1 this far inside the traced edge (px)
EDGE_OUT = 1.0   # ... and 0 this far outside it
BAND = 14        # bottom band carried up from the floor (px)
SHADOW_DEPTH = 16  # contact-shadow footprint height inside the base (px)
BOX_PAD = 2        # transparent margin around the layers' shared crop box (px)


def silhouette_alpha(shape: tuple[int, int], poly) -> np.ndarray:
    h, w = shape
    big = np.zeros((h * SS, w * SS), np.uint8)
    cv2.fillPoly(big, [np.round(np.array(poly) * SS).astype(np.int32)], 255)
    inside = cv2.distanceTransform(big, cv2.DIST_L2, 5) / SS
    outside = cv2.distanceTransform(255 - big, cv2.DIST_L2, 5) / SS
    sd = cv2.resize(inside - outside, (w, h), interpolation=cv2.INTER_AREA)
    return np.clip((sd + EDGE_OUT) / (EDGE_IN + EDGE_OUT), 0, 1).astype(np.float32)


def reconstruct(img: np.ndarray, hole: np.ndarray, seed: int = 11) -> np.ndarray:
    h, w = hole.shape
    lum = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    local = cv2.medianBlur(lum.astype(np.uint8), 21).astype(np.float32)

    near = cv2.dilate(hole.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    valid = ~near & ((lum - local) < 18)
    for x0, y0, x1, y1 in FOREGROUND:
        valid[y0:y1, x0:x1] = False
    # Solve region: the hole plus unusable pixels around it.
    ring = cv2.dilate(hole.astype(np.uint8), np.ones((25, 25), np.uint8)).astype(bool)
    solve = hole | (ring & ~valid)
    usable = solve | valid

    # a. row interpolation (initial guess)
    f = img.copy()

    def sample(y: int, x: int, step: int) -> np.ndarray | None:
        """Median of the first 8 valid pixels beyond x (within 60 px)."""
        vals = []
        for k in range(1, 61):
            xx = x + step * k
            if not 0 <= xx < w or len(vals) == 8:
                break
            if valid[y, xx]:
                vals.append(img[y, xx])
        return np.median(vals, axis=0) if len(vals) >= 3 else None

    for y in np.where(solve.any(1))[0]:
        xs = np.where(solve[y])[0]
        for seg in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
            a, b = int(seg[0]), int(seg[-1])
            left, right = sample(y, a, -1), sample(y, b, +1)
            if left is None and right is None:
                continue
            left = right if left is None else left
            right = left if right is None else right
            t = ((np.arange(a, b + 1) - (a - 1)) / (b - a + 2))[:, None]
            f[y, a : b + 1] = left * (1 - t) + right * t

    # b. anisotropic membrane relaxation inside the solve region
    ys, xs = np.where(solve)
    y0, y1, x0, x1 = ys.min() - 1, ys.max() + 2, xs.min() - 1, xs.max() + 2
    F, S, U = f[y0:y1, x0:x1].copy(), solve[y0:y1, x0:x1], usable[y0:y1, x0:x1].astype(np.float32)
    wx, wy = 1.0, 0.3
    for _ in range(700):
        num = np.zeros_like(F)
        den = np.zeros(F.shape[:2], np.float32)
        for dy, dx, wgt in ((0, 1, wx), (0, -1, wx), (1, 0, wy), (-1, 0, wy)):
            nb = np.roll(F, (dy, dx), (0, 1))
            nu = np.roll(U, (dy, dx), (0, 1)) * wgt
            num += nb * nu[..., None]
            den += nu
        F[S] = (num / np.maximum(den, 1e-6)[..., None])[S]
    f[y0:y1, x0:x1] = F

    # c. carry the floor below the bottom contour upward
    floor = np.zeros((w, 3), np.float32)
    have = np.zeros(w, np.float32)
    bottom = np.full(w, -1)
    for x in range(w):
        col = np.where(hole[:, x])[0]
        if len(col) == 0:
            continue
        bottom[x] = col[-1]
        vs = [img[y, x] for y in range(col[-1] + 1, min(col[-1] + 4, h)) if valid[y, x]]
        if len(vs) >= 2:
            floor[x], have[x] = np.median(vs, axis=0), 1

    def smooth_x(a: np.ndarray) -> np.ndarray:
        return cv2.GaussianBlur(a.reshape(1, w, -1), (0, 0), sigmaX=3, sigmaY=0.01).reshape(a.shape)

    floor = smooth_x(floor * have[:, None]) / np.maximum(smooth_x(have), 1e-4)[:, None]
    have = np.clip(smooth_x(have) * 1.5, 0, 1)
    for x in np.where(bottom >= 0)[0]:
        for y in range(max(0, bottom[x] - BAND), bottom[x] + 1):
            if hole[y, x]:
                k = (1 - (bottom[x] - y) / BAND) * have[x]
                f[y, x] = f[y, x] * (1 - k) + floor[x] * k

    # d. grain
    rng = np.random.default_rng(seed)
    f = f + rng.normal(0, 1.6, f.shape).astype(np.float32)
    return np.where(hole[..., None], np.clip(f, 0, 255), img)


def contact_shadow(hole: np.ndarray) -> np.ndarray:
    """Footprint shadow for the lifted state (static, on the floor).

    Under a lifted object the floor is occluded: darker the deeper under the
    base, with a short soft spill below the contact line to ground it. It is
    only visible in the strip the moving station uncovers.
    """
    h, w = hole.shape
    sh = np.zeros((h, w), np.float32)
    for x in range(w):
        col = np.where(hole[:, x])[0]
        if len(col) == 0:
            continue
        yb = col[-1]
        for y in range(max(0, yb - SHADOW_DEPTH), min(h, yb + 4)):
            depth = yb - y  # >0 inside, <=0 below the contact line
            if depth >= 0 and hole[y, x]:
                sh[y, x] = min(1.0, (depth + 1) / 4)
            elif depth < 0:
                sh[y, x] = 0.45 * (1 + depth / 4)
    sh = cv2.GaussianBlur(sh, (0, 0), 1.1)
    return np.round(np.clip(sh, 0, 1) * 255).astype(np.uint8)


# Hover light: an elliptical warm falloff centred on the laptop deck,
# (centre, radii) in reference px; stops as (offset, (R, G, B), alpha).
LIGHT_CENTRE, LIGHT_RADII = (440, 478), (200, 120)
LIGHT_STOPS = [(0.0, (255, 200, 140), 0.09), (0.55, (255, 180, 110), 0.04), (0.85, (255, 180, 110), 0.0)]


def hover_light(M: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Warm light clipped to the station silhouette (straight RGB + alpha)."""
    h, w = M.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xx + 0.5 - LIGHT_CENTRE[0]) / LIGHT_RADII[0], (yy + 0.5 - LIGHT_CENTRE[1]) / LIGHT_RADII[1])
    offs = [s[0] for s in LIGHT_STOPS]
    alpha = np.interp(r, offs, [s[2] for s in LIGHT_STOPS]).astype(np.float32)
    rgb = np.dstack([np.interp(r, offs, [s[1][c] for s in LIGHT_STOPS]) for c in (2, 1, 0)])  # BGR
    a8 = np.round(np.clip(alpha * M, 0, 1) * 255).astype(np.uint8)
    return rgb.astype(np.float32), a8


def save_rgba(path: Path, rgb: np.ndarray, alpha8: np.ndarray, box: tuple[int, int, int, int]) -> None:
    """Save a full-frame RGB + alpha pair; everything outside `box` is cleared.

    The images stay full-frame on purpose: the browser draws them at the
    plate's exact geometry (pixel snapping included), clipped to the box. A
    cropped file would be snapped on its own and land up to ~0.3 px off.
    """
    x, y, w, h = box
    rgba = np.dstack([np.clip(np.round(rgb), 0, 255).astype(np.uint8), alpha8])
    outside = np.ones(alpha8.shape, bool)
    outside[y : y + h, x : x + w] = False
    rgba[outside | (rgba[..., 3] == 0)] = 0
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), rgba, [cv2.IMWRITE_WEBP_QUALITY, 101])  # >100 = lossless
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", type=Path, help="write mask/backdrop previews into this folder")
    args = ap.parse_args()

    plate = cv2.imread(str(PLATE), cv2.IMREAD_COLOR)
    if plate is None:
        raise SystemExit(f"cannot read {PLATE}")
    O = plate.astype(np.float32)

    alpha8 = np.round(silhouette_alpha(O.shape[:2], ENGINEERING_SILHOUETTE) * 255).astype(np.uint8)
    M = (alpha8.astype(np.float32) / 255)[..., None]
    hole = alpha8 > 0

    recon8 = np.round(reconstruct(O, hole)).astype(np.float32)

    # Backdrop coverage P: equal to M, except in the soft edge where the
    # matting would need an out-of-range station colour (e.g. the laptop's
    # near-black bezel against the brighter reconstructed wall). There P is
    # lowered just enough that the solved colour stays in 0..255.
    #   C = O + (1 - M) * P * (O - recon) / M  must lie in [0, 255].
    with np.errstate(divide="ignore", invalid="ignore"):
        d = O - recon8
        room = np.where(d < 0, O, 255 - O)
        p_max = np.where(np.abs(d) > 0.5, room * M / ((1 - M) * np.abs(d)), np.inf)
    P = np.minimum(M[..., 0], np.nan_to_num(p_max.min(-1), nan=np.inf, posinf=1.0))
    P = np.where(M[..., 0] >= 1, 1.0, np.clip(P, 0, 1))
    p8 = np.floor(P * 255).astype(np.uint8)
    Pq = (p8.astype(np.float32) / 255)[..., None]

    backdrop = O * (1 - Pq) + recon8 * Pq
    station = np.where(M > 0, (O - (1 - M) * backdrop) / np.maximum(M, 1e-6), 0)

    shadow8 = contact_shadow(hole)
    light_rgb, light8 = hover_light(M[..., 0])

    # All four layers share one clip box (the union of their coverage, padded),
    # so the browser composites ~60k px per layer instead of the full frame.
    ys, xs = np.where((alpha8 > 0) | (p8 > 0) | (shadow8 > 0) | (light8 > 0))
    x0, y0 = int(xs.min()) - BOX_PAD, int(ys.min()) - BOX_PAD
    box = (x0, y0, int(xs.max()) + 1 + BOX_PAD - x0, int(ys.max()) + 1 + BOX_PAD - y0)
    print(f"layer box (x, y, w, h) = {box}  -> ENGINEERING layer `box` in components/lab/scene-layout.ts")

    save_rgba(OUT_DIR / "engineering-backdrop.webp", recon8, p8, box)
    save_rgba(OUT_DIR / "engineering.webp", station, alpha8, box)
    save_rgba(OUT_DIR / "engineering-shadow.webp", np.zeros_like(O), shadow8, box)
    save_rgba(OUT_DIR / "engineering-light.webp", light_rgb, light8, box)

    # Round-trip check: composite exactly as the browser does (premultiplied).
    def premul(rgb, a8):
        return np.round(np.clip(np.round(rgb), 0, 255) * a8[..., None] / 255)

    a = alpha8.astype(np.float32)[..., None] / 255
    under = premul(recon8, p8) + (1 - Pq) * O
    rest = premul(station, alpha8) + (1 - a) * under
    err = np.abs(rest - O).max(-1)
    print(f"rest-state reconstruction: max {err.max():.2f}, mean {err[hole].mean():.3f} over {hole.sum()} px")

    if args.preview:
        write_previews(args.preview, plate, alpha8, recon8, station, under)


def write_previews(folder: Path, plate, alpha8, recon8, station, under) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    x0, y0, x1, y1 = 230, 360, 640, 575
    crop = lambda a: a[y0:y1, x0:x1]
    up = lambda a, s=2: cv2.resize(np.clip(a, 0, 255).astype(np.uint8), None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)

    def label(img, text):
        img = img.copy()
        cv2.rectangle(img, (0, 0), (img.shape[1], 26), (14, 14, 16), -1)
        cv2.putText(img, text, (8, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (120, 190, 242), 1, cv2.LINE_AA)
        return img

    a = alpha8.astype(np.float32)[..., None] / 255
    # 1. outline on the plate, 2. matte, 3. station over a checkerboard, 4. backdrop
    outline = plate.astype(np.float32).copy()
    edge = cv2.morphologyEx((alpha8 > 127).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
    outline[edge] = (60, 230, 255)
    tint = plate.astype(np.float32) * (1 - 0.45 * a) + np.array([40, 60, 255], np.float32) * 0.45 * a
    yy, xx = np.mgrid[0 : plate.shape[0], 0 : plate.shape[1]]
    checker = np.where((((yy // 8) + (xx // 8)) % 2)[..., None] == 0, 70.0, 40.0) * np.ones(3)
    cut = station * a + checker * (1 - a)

    tiles = [
        label(up(crop(outline)), "Traced silhouette (alpha 0.5 contour) on the plate"),
        label(up(crop(tint)), "Station alpha (red tint)"),
        label(up(crop(np.repeat(alpha8[..., None], 3, -1).astype(np.float32))), "Alpha matte"),
        label(up(crop(cut)), "Extracted station layer over a checkerboard"),
    ]
    sheet = np.vstack([np.hstack(tiles[:2]), np.hstack(tiles[2:])])

    # Enlarged edge details (8x): screen corner, plant, line junction, canvas corner.
    details = [((332, 378, 362, 400), "screen corner"), ((300, 455, 352, 495), "plant"),
               ((568, 510, 612, 550), "ring / line / floor arc"), ((256, 526, 312, 552), "canvas corner")]
    det_tiles = []
    for (dx0, dy0, dx1, dy1), name in details:
        o = cv2.resize(plate[dy0:dy1, dx0:dx1], (240, 180), interpolation=cv2.INTER_NEAREST)
        m = cv2.resize(cut[dy0:dy1, dx0:dx1].astype(np.uint8), (240, 180), interpolation=cv2.INTER_NEAREST)
        det_tiles.append(label(np.hstack([o, m]), f"{name}: plate | layer"))
    details_row = np.hstack(det_tiles)
    pad = sheet.shape[1] - details_row.shape[1]
    details_row = np.hstack([details_row, np.full((details_row.shape[0], max(pad, 0), 3), 14, np.uint8)])[:, : sheet.shape[1]]
    cv2.imwrite(str(folder / "mask-preview.png"), np.vstack([sheet, details_row]))

    rec = np.hstack([label(up(crop(plate.astype(np.float32))), "Plate (station present)"),
                     label(up(crop(under)), "Backdrop with the station removed (reconstructed)")])
    cv2.imwrite(str(folder / "background-reconstruction.png"), rec)
    print(f"wrote previews to {folder}")


if __name__ == "__main__":
    main()
