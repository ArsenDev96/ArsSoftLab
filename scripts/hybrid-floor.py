"""M1.3J.2: hybrid floor for the band Playground's lift uncovers.

LaMa c2 gives the band's tone and continuity (its low frequencies); the
fine texture (high frequencies) is copied from the real floor in front of
the station, at integer offsets (no resampling, no mirroring, no noise).
The result is a 512 x 192 crop for scripts/inpaint-playground.mjs, which
composites only the exact hidden-floor mask back.

Runs in the isolated venv (numpy + Pillow only; see docs/m1.3j/lama/SETUP.md):

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/hybrid-floor.py \
        --sigma 2 --out docs/m1.3j/hybrid/candidates/h1-s2.png

Measured (docs/m1.3j/hybrid/NOTES.md): the floor's grain is pixel-scale
(autocorrelation ~0.7 px vertically) and the source is 30-70 px nearer the
camera than the band, a ~10-20 % perspective difference. At that scale it
is invisible, while resampling to "correct" it would only soften the
grain, so the copy is pixel-exact.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 1672, 941
CROP = dict(x=962, y=432, w=512, h=192)
IN = Path("docs/m1.3j/inpaint")
C2 = Path("docs/m1.3j/lama/candidates/c2-env-2x-floor.png")
# Never a texture source (scene px): the Experience panel, the central
# platform's rim (as inpaint-playground.mjs), and the panel's reflections on
# the floor just under the contact line (bright spots, crop x 370-400).
EXCLUDE = [(1384, 470, 160, 170), (930, 540, 150, 100), (1328, 548, 66, 28)]
LUMA = np.array([0.299, 0.587, 0.114])


def load(path, mode="RGB"):
    return np.asarray(Image.open(path).convert(mode)).astype(np.float64)


def gauss_blur(a, s):
    n = int(3 * s) + 1
    x = np.arange(-n, n + 1)
    k = np.exp(-x * x / (2 * s * s))
    k /= k.sum()
    pad = [(n, n), (n, n)] + [(0, 0)] * (a.ndim - 2)
    p = np.pad(a, pad, mode="edge")
    p = sum(k[i] * p[:, i : i + a.shape[1]] for i in range(2 * n + 1))
    p = sum(k[i] * p[i : i + a.shape[0]] for i in range(2 * n + 1))
    return p


def norm_blur(a, w, s):
    """Normalised convolution: blur of a over the pixels where w = 1 only."""
    w3 = w[..., None] if a.ndim == 3 else w
    num = gauss_blur(a * w3, s)
    den = gauss_blur(w.astype(np.float64), s)
    den = den[..., None] if a.ndim == 3 else den
    return num / np.maximum(den, 1e-6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sigma", type=float, required=True, help="split between c2 (below) and the real floor (above), px")
    ap.add_argument("--dy", type=int, default=65, help="source rows below the band (main piece)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--lf-band-only", action="store_true", help="c2 low frequencies from the band alone")
    ap.add_argument("--debug", action="store_true")
    ap.add_argument("--seamless", action="store_true", help="match the visible floor along the band's edges (not its top)")
    a = ap.parse_args()

    # Full-frame environment as the 2.5D build shows it around the gap: the
    # plate under the environment-correction layer (lines and the strip
    # reflection taken out).
    plate = load("public/scene/lab-plate.webp")
    corr = load("public/scene/layers25d/environment-corrections.png", "RGBA")
    ca = corr[..., 3:] / 255
    env = corr[..., :3] * ca + plate * (1 - ca)

    cx, cy, cw, ch = CROP["x"], CROP["y"], CROP["w"], CROP["h"]
    band = np.zeros((H, W), bool)
    band[cy : cy + ch, cx : cx + cw] = load(IN / "mask-floor.png", "L") > 127

    # Where real floor may be copied from: the floor visible at rest, below
    # the back step, not the station, not a connection line or its window,
    # not a lit glow, not the excluded areas.
    remove = load("docs/m1.3i/masks/playground-remove.png", "L") > 127
    floor_sup = load("docs/m1.3i/masks/playground-floor.png", "L") > 127
    lines = load("docs/m1.3i/masks/lines.png", "L") > 127
    corr_cover = ca[..., 0] > 0  # re-estimated floor in the line windows: not authentic
    yy, xx = np.mgrid[0:H, 0:W]
    lum = env @ LUMA
    ok = (yy > 432 + (xx - 1060) * 18 / 320 + 4) & ~remove & ~floor_sup & ~lines & ~corr_cover & (lum < 150)
    for x, y, w, h in EXCLUDE:
        ok[y : y + h, x : x + w] = False

    # LaMa c2 at 1x, as integrate averages it.
    c2 = load(C2)
    c2 = c2.reshape(ch, 2, cw, 2, 3).mean(axis=(1, 3))
    c2_full = env.copy()
    c2_full[cy : cy + ch, cx : cx + cw] = c2

    # Low frequencies of c2 over the band and the floor shown below it only
    # (never the station area above the band, hidden while lifted). The
    # floor right under the contact line counts here, as the build shows it
    # (environment layer): it is what the band's tone must continue.
    floor_vis = (yy >= cy) & (yy > 432 + (xx - 1060) * 18 / 320 + 4) & ~remove & ~band & (lum < 150)
    for x, y, w, h in EXCLUDE[:2]:
        floor_vis[y : y + h, x : x + w] = False
    lf_w = band if a.lf_band_only else band | floor_vis
    c2_lf = norm_blur(c2_full, lf_w.astype(np.float64), a.sigma)

    # High frequencies of the real floor, as a luminance ratio (keeps c2's hue:
    # no orange or blue carried in), split at the same sigma.
    src_lf = norm_blur(lum, ok.astype(np.float64), a.sigma)
    ratio = lum / np.maximum(src_lf, 1.0)

    # Pieces: the band is wider than the clean floor in front of it (the
    # central platform's rim and the Experience panel bound it), so the left
    # end takes a second, different patch; the two meet with a
    # power-preserving crossfade (uncorrelated grain keeps its amplitude).
    bx = np.nonzero(band.any(axis=0))[0]
    x_split, fade = 1082, 10
    pieces = [dict(dx=0, dy=a.dy), dict(dx=34, dy=a.dy + 24)]
    out = c2_lf.copy()
    ys, xs = np.nonzero(band)
    used = np.zeros((H, W), bool)
    bad = 0
    r_main = ratio[ys + pieces[0]["dy"], xs + pieces[0]["dx"]]
    r_left = ratio[ys + pieces[1]["dy"], xs + pieces[1]["dx"]]
    ok_main = ok[ys + pieces[0]["dy"], xs + pieces[0]["dx"]]
    ok_left = ok[ys + pieces[1]["dy"], xs + pieces[1]["dx"]]
    t = np.clip((xs - (x_split - fade / 2)) / fade, 0, 1)  # 0 left piece, 1 main piece
    wm = np.sin(t * np.pi / 2)
    wl = np.cos(t * np.pi / 2)
    wm = np.where(ok_main, wm, 0)
    wl = np.where(ok_left, wl, 0)
    norm = np.sqrt(wm**2 + wl**2)
    bad = int((norm == 0).sum())
    norm = np.where(norm == 0, 1, norm)
    hf = (wm * (r_main - 1) + wl * (r_left - 1)) / norm
    # Rows above the contact line, per column.
    bottom = np.full(W, -1)
    for x in bx:
        bottom[x] = np.nonzero(band[:, x])[0].max()
    d = bottom[xs] - ys
    if a.debug:
        for k in range(0, 40, 3):
            sel = d == k
            if sel.any():
                print(f"d={k:2d} n={sel.sum():4d} hf mean {hf[sel].mean():+.4f} std {hf[sel].std():.4f} c2 lf {(c2_lf[ys[sel], xs[sel]] @ LUMA).mean():.1f}")
    out[ys, xs] = c2_lf[ys, xs] * (1 + hf)[:, None]
    for p in pieces:
        used[ys + p["dy"], xs + p["dx"]] = True

    if a.seamless:
        END = 24
        # Seamless edges: what the lifted view shows next to the band is the
        # environment (or M1.3I's clean background where it covers). Along
        # every band edge near its two ends that touches that visible floor
        # (not the top, which stays under the lifted station), the
        # band's low frequencies are pulled to the neighbour's, and the
        # correction is spread smoothly inside (a membrane: Laplace with
        # those edges fixed, the top free). Grain is untouched; nothing
        # outside the band changes.
        bga = load("public/scene/layers25d/playground/background.png", "RGBA")
        shown = env.copy()
        cover = bga[..., 3] > 0
        shown[cover] = bga[..., :3][cover]
        shown_lf = gauss_blur(shown, 1.0)
        top = np.full(W, H)
        for x in bx:
            top[x] = np.nonzero(band[:, x])[0].min()
        n_fix = np.zeros((H, W))
        s_fix = np.zeros((H, W, 3))
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            if dy == -1:
                continue  # never across the top edge
            qy, qx = ys + dy, xs + dx
            vis = ~band[qy, qx] & (qy >= top[qx])
            # Only at the band's two ends (where its edge steps): along the
            # contact line the neighbour is the contact highlight, and pulling
            # the whole band to it would only brighten it.
            vis &= (xs < bx.min() + END) | (xs > bx.max() - END)
            n_fix[ys[vis], xs[vis]] += 1
            s_fix[ys[vis], xs[vis]] += shown_lf[qy[vis], qx[vis]] - c2_lf[ys[vis], xs[vis]]
        fixed = n_fix > 0
        r = np.zeros((H, W, 3))
        r[fixed] = s_fix[fixed] / n_fix[fixed][:, None]
        c = np.zeros((H, W, 3))
        inner = band & ~fixed
        iy, ix = np.nonzero(inner)
        for _ in range(3000):
            acc = np.zeros((len(iy), 3))
            cnt = np.zeros(len(iy))
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                qy, qx = iy + dy, ix + dx
                m = band[qy, qx]
                acc[m] += c[qy[m], qx[m]]
                cnt += m
            c[iy, ix] = acc / (cnt + 0.02)[:, None]  # screened: fades ~7 px from the ends
            c[fixed] = r[fixed]
        out[ys, xs] += c[ys, xs]
        seam_info = dict(edge_px=int(fixed.sum()), mean_abs_correction=round(float(np.abs(c[band]).mean()), 2), max_abs_correction=round(float(np.abs(c[band]).max()), 1))
    else:
        seam_info = None

    crop = np.clip(np.round(out[cy : cy + ch, cx : cx + cw]), 0, 255).astype(np.uint8)
    # Outside the band the crop is the environment (never composited).
    env_crop = np.clip(np.round(env[cy : cy + ch, cx : cx + cw]), 0, 255).astype(np.uint8)
    bm = band[cy : cy + ch, cx : cx + cw]
    crop = np.where(bm[..., None], crop, env_crop)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(crop).save(a.out)

    # Diagnostics: where the texture came from.
    diag = np.clip(np.round(env[cy : cy + ch, cx : cx + cw] * 0.55), 0, 255).astype(np.uint8)
    u = used[cy : cy + ch, cx : cx + cw]
    diag[u] = [60, 220, 90]
    diag[bm] = [230, 70, 70]
    Image.fromarray(diag).save(str(a.out).replace(".png", "-sources.png"))

    lum_band = (out @ LUMA)[band]
    print(
        json.dumps(
            dict(
                out=a.out,
                sigma=a.sigma,
                pieces=pieces,
                split_x=x_split,
                band_px=int(band.sum()),
                px_without_source=bad,
                band_lum=round(float(lum_band.mean()), 1),
                hf_std=round(float(np.std(hf)), 4),
                seamless=seam_info,
            )
        )
    )


if __name__ == "__main__":
    main()
