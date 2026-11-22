"""M1.3J.5: the floor at Playground's contact line without its contact highlight.

At rest the plate's floor is brighter in the 1-6 rows right under the base: the
light where the base meets the polished floor. When the station lifts, that
highlight stayed on the floor under the open gap: it repeated the base's lit
bottom edge one step lower and made the gap read as another stone layer.

This writes the same floor pixels with only that highlight taken out:
public/scene/layers25d/playground/contact-unlit.png (full frame, opaque only on
those rows). The experimental build fades it in with the lift (--lp), so at rest
and at the switch nothing changes, and the highlight goes as the base rises.

Per column under the hidden-floor band, rows 1-6 below it:
  - each row's tone is its horizontal low-pass (sigma 4 px along the row; the
    1-3 px tall highlight is never blurred vertically);
  - the unlit tone is the straight line between the floor just above (the
    band's last rows, as the build shows them) and just below (rows 7-10);
  - only the excess over that line is removed, per channel; the grain (each
    pixel's difference from its row's low-pass) is kept.
Nothing is generated: every pixel is the plate's own floor, darkened where it
was lit by the contact.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/playground-contact-unlit.py
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path("public/scene/layers25d/playground/contact-unlit.png")
ROWS = 6  # highlight rows under the band
BELOW = (7, 11)  # reference rows below
ABOVE = 3  # reference rows above (the band's last rows)
SIGMA = 4.0


def load(p, mode="RGB"):
    return np.asarray(Image.open(p).convert(mode)).astype(np.float64)


def blur_x(a, s):
    n = int(3 * s) + 1
    x = np.arange(-n, n + 1)
    k = np.exp(-x * x / (2 * s * s))
    k /= k.sum()
    p = np.pad(a, ((0, 0), (n, n), (0, 0)), mode="edge")
    return sum(k[i] * p[:, i : i + a.shape[1]] for i in range(2 * n + 1))


def main():
    plate = load("public/scene/lab-plate.webp")
    corr = load("public/scene/layers25d/environment-corrections.png", "RGBA")
    ca = corr[..., 3:] / 255
    env = corr[..., :3] * ca + plate * (1 - ca)
    fl = load("public/scene/layers25d/playground/floor.png", "RGBA")
    band = fl[..., 3] > 0
    shown = fl[..., :3] * (fl[..., 3:] / 255) + env * (1 - fl[..., 3:] / 255)
    lines = load("docs/m1.3i/masks/lines.png", "L") > 127

    H, W = band.shape
    cols = np.nonzero(band.any(axis=0))[0]
    lf = blur_x(shown, SIGMA)
    out = np.zeros((H, W, 4))
    removed = []
    for x in cols:
        bb = np.nonzero(band[:, x])[0].max()
        top = lf[bb - ABOVE + 1 : bb + 1, x].mean(0)
        bot = lf[bb + BELOW[0] : bb + BELOW[1], x].mean(0)
        for r in range(1, ROWS + 1):
            y = bb + r
            if lines[y, x]:
                continue  # the connection's own pixels are never touched
            t = (r - 0) / (BELOW[0] + (BELOW[1] - BELOW[0]) / 2)
            base = top * (1 - t) + bot * t
            h = np.maximum(0, lf[y, x] - base)
            out[y, x, :3] = shown[y, x] - h
            out[y, x, 3] = 255
            removed.append(h.max())
    out = np.clip(np.round(out), 0, 255).astype(np.uint8)
    Image.fromarray(out).save(OUT)
    r = np.array(removed)
    rep = dict(out=str(OUT), px=int((out[..., 3] > 0).sum()), mean_removed=round(float(r.mean()), 1), max_removed=round(float(r.max()), 1), rows_under_band=ROWS)
    Path("docs/m1.3j/depth").mkdir(parents=True, exist_ok=True)
    Path("docs/m1.3j/depth/contact-unlit.json").write_text(json.dumps(rep, indent=1) + "\n")
    print(json.dumps(rep))


if __name__ == "__main__":
    main()
