"""M1.3J.2: Playground's base edge in the experimental 2.5D build.

Two compositing defects of the M1.3H cut-out (public/scene/layers/playground-v2.png),
corrected in a new, experimental-only cut-out
(public/scene/layers25d/playground/object.png); the original file and the
station's artwork are not changed:

1. Stepped silhouette at the far-right base corner: the matte there has
   notches and hard 100+ -> 0 cut-offs. Alpha is rebuilt in that corner only
   from a smooth silhouette fitted to the matte's own coverage (bottom curve,
   right edge, rounded corner), with the edge's own measured ramp.
2. Edge colour at the arrival instant: when the layers switch on (lift at
   identity), the cut-out's soft edge over the new floor didn't reproduce
   what was on screen just before (orange fringe at the right corner, a
   ring at the left end). The edge colour is solved from real browser frames:
   the frame just before the switch (target), and the frame just after with
   the edge pixels rendered black and white (the composite is linear in the
   cut-out colour, whatever lies above or below it), so the switch is exact
   to rounding, while alpha and every opaque station pixel stay as they were.

    python scripts/playground-edge.py variants
        -> docs/m1.3j/hybrid/edge/object-{black,white}.png, solve-mask.png
    node scripts/playground-edge-frames.mjs ...   (captures, see that file)
    python scripts/playground-edge.py solve
        -> public/scene/layers25d/playground/object.png

The colour solve depends on the floor under the edge, so run it again after
integrating another floor candidate (docs/m1.3j/hybrid/NOTES.md).
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path("public/scene/layers/playground-v2.png")
OUT = Path("public/scene/layers25d/playground/object.png")
EDGE = Path("docs/m1.3j/hybrid/edge")
BG = Path("public/scene/layers25d/playground/background.png")
# Captured region (scene px; the frames script uses the same).
R = dict(x=1040, y=325, w=360, h=250)
# Colour solve: soft-edge pixels of the base's lower part.
SOLVE_Y0 = 490
# Alpha rebuild: the far-right corner only, cross-faded in from the left.
AX0, AX1, AY0, AY1, FADE = 1290, 1381, 525, 551, 16
RAMP = 2.51  # px; the right edge's own profile 229 / 128 / 26


def load_rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def rebuilt_alpha(a):
    """Smooth silhouette for the far-right corner, from the matte's coverage."""
    a = a / 255
    # Bottom edge y_e(x): coverage below the last fully opaque row.
    xs = np.arange(1180, 1367)
    ye = np.array([530 + a[530:552, x].sum() for x in xs])
    # Robust quadratic fit (iteratively drop the worst 10 %: the notches).
    keep = np.ones_like(xs, bool)
    for _ in range(4):
        c = np.polyfit(xs[keep], ye[keep], 2)
        r = np.abs(np.polyval(c, xs) - ye)
        keep = r <= np.quantile(r, 0.9)
    # Right edge x_r: coverage of the rows above the corner (notch rows out).
    rows = [y for y in range(505, 529)]
    xr = float(np.median([1368 + a[y, 1368:1384].sum() for y in rows]))
    # Corner radius: the one whose coverage matches the original corner's.
    yy, xx = np.mgrid[AY0:AY1, AX0:AX1]
    px, py = xx + 0.5, yy + 0.5

    def shape(rad):
        fy = np.polyval(c, px)
        slope = np.polyval(np.polyder(c), px)
        db = (py - fy) / np.sqrt(1 + slope**2)
        dr = px - xr
        q = np.stack([db + rad, dr + rad])
        sd = np.sqrt((np.maximum(q, 0) ** 2).sum(0)) + np.minimum(np.maximum(db, dr) + rad, 0) - rad
        return np.clip(0.5 - sd / RAMP, 0, 1)

    corner = (xx >= 1350)
    target = a[AY0:AY1, AX0:AX1][corner].sum()
    best = min(np.arange(0.0, 14.01, 0.25), key=lambda rad: abs(shape(rad)[corner].sum() - target))
    new = shape(best)
    # Cross-fade from the original matte over the first FADE columns.
    w = np.clip((xx - AX0) / FADE, 0, 1)
    out = a.copy()
    out[AY0:AY1, AX0:AX1] = a[AY0:AY1, AX0:AX1] * (1 - w) + new * w
    info = dict(bottom_fit=[round(v, 6) for v in c], right_edge_x=round(xr, 2), corner_radius=float(best))
    return np.round(out * 255), info


def variants():
    src = load_rgba(SRC)
    alpha, info = rebuilt_alpha(src[..., 3])
    changed = alpha != src[..., 3]
    yy = np.mgrid[0 : src.shape[0], 0 : src.shape[1]][0]
    region = np.zeros(alpha.shape, bool)
    region[R["y"] : R["y"] + R["h"], R["x"] : R["x"] + R["w"]] = True
    solve = region & (yy >= SOLVE_Y0) & (alpha > 0) & ((alpha < 255) | changed)
    bg = load_rgba(BG)[..., 3] > 0
    EDGE.mkdir(parents=True, exist_ok=True)
    for name, v in (("black", 0), ("white", 255)):
        o = src.copy()
        o[..., 3] = alpha
        o[solve, :3] = v
        Image.fromarray(o.astype(np.uint8)).save(EDGE / f"object-{name}.png")
    Image.fromarray((solve * 255).astype(np.uint8)).save(EDGE / "solve-mask.png")
    np.save(EDGE / "alpha.npy", alpha.astype(np.uint8))
    info.update(
        alpha_changed_px=int(changed.sum()),
        solve_px=int(solve.sum()),
        new_alpha_outside_background_hole=int(((alpha > 0) & ~bg & changed).sum()),
    )
    (EDGE / "alpha.json").write_text(json.dumps(info, indent=1) + "\n")
    print(json.dumps(info))


PREFIX = sys.argv[2] if len(sys.argv) > 2 else ""


def frame(name):
    return np.asarray(Image.open(EDGE / "frames" / (PREFIX + name)).convert("RGB")).astype(np.float64)


def place(f):
    full = np.zeros((941, 1672, 3))
    full[R["y"] : R["y"] + R["h"], R["x"] : R["x"] + R["w"]] = f
    return full


def solve():
    src = load_rgba(SRC)
    alpha = np.load(EDGE / "alpha.npy").astype(np.float64)
    mask = np.asarray(Image.open(EDGE / "solve-mask.png")) > 127
    before = place(frame("black-rest.png"))
    before2 = place(frame("white-rest.png"))
    fb = place(frame("black-rest-on.png"))
    fw = place(frame("white-rest-on.png"))
    unstable = np.abs(before - before2).max(2) > 1
    k = (fw - fb) / 255
    ok = mask & (k.min(2) >= 0.06) & ~unstable
    col = src[..., :3].copy()
    sol = (before - fb) / np.maximum(k, 1e-6)
    col[ok] = np.clip(np.round(sol[ok]), 0, 255)
    out = np.dstack([col, alpha]).astype(np.uint8)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out).save(OUT)
    clipped = ((sol[ok] < -0.5) | (sol[ok] > 255.5)).any(1).sum()
    rep = dict(
        out=str(OUT),
        solved_px=int(ok.sum()),
        left_unsolved_low_coverage=int((mask & ~ok).sum()),
        unstable_px=int((mask & unstable).sum()),
        clipped_px=int(clipped),
        mean_colour_change=round(float(np.abs(col[ok] - src[..., :3][ok]).mean()), 1),
    )
    (EDGE / "solve.json").write_text(json.dumps(rep, indent=1) + "\n")
    print(json.dumps(rep))



def refine():
    """One correction step against a render of the current object.png
    (frames <prefix>fixed-rest-on.png): the browser resamples the cut-out by
    a sub-pixel amount, so each pixel also feels its neighbours; a few steps
    converge where a single per-pixel solve can't."""
    cur = load_rgba(OUT)
    mask = np.asarray(Image.open(EDGE / "solve-mask.png")) > 127
    target = place(frame("black-rest.png"))
    got = place(frame("fixed-rest-on.png"))
    k = (place(frame("white-rest-on.png")) - place(frame("black-rest-on.png"))) / 255
    ok = mask & (k.min(2) >= 0.06)
    col = cur[..., :3].copy()
    step = 0.8 * (target - got) / np.maximum(k, 1e-6)
    col[ok] = np.clip(np.round(col[ok] + step[ok]), 0, 255)
    Image.fromarray(np.dstack([col, cur[..., 3]]).astype(np.uint8)).save(OUT)
    res = np.abs(target - got).max(2)
    rep = dict(residual_before_step_max=float(res[mask].max()), over12=int((res[mask] > 12).sum()), over4=int((res[mask] > 4).sum()))
    print(json.dumps(rep))


if __name__ == "__main__":
    {"variants": variants, "solve": solve, "refine": refine}[sys.argv[1]]()
