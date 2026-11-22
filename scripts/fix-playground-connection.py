"""M1.3J.3: remove the base-corner copy from Playground's connection layer.

The artifact: near its end, Playground's line part 1 (its trace and lit
images, public/scene/layers25d/lines/playground-1-*.png) carried 360 px of
the plate's base corner (x 1061-1098, y 521-539). They were copied from the
approved unpowered overlay, which includes the corner. The environment layer
under them erased that corner (line removal), and the connection layer
painted it back. The connection layer is drawn above the station, so when
Playground lifts, that copy stays on the floor: the dark wedge at the left end
of the gap.

The fix moves those pixels below the station:
  - trace and lit: transparent at exactly those pixels (the station's cut-out
    footprint, all inside its clean-background hole). The line itself, its
    path, core, glow, charging and draining are untouched: the line ends
    outside the footprint.
  - environment layer: those pixels become the exact at-rest view (from a real
    browser frame of the idle scene), so idle is unchanged. Whenever the
    station's layers show, its clean background covers them.

Inputs: the idle frame captured before the fix
(docs/m1.3j/connection/before/rest.png, scripts/visual/playground-wedge-evidence.mjs).
The originals are kept in docs/m1.3j/connection/original/. Re-run this
after `npm run layers:25d`, which regenerates the line layers.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/fix-playground-connection.py
"""

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

LINES = Path("public/scene/layers25d/lines")
FILES = {
    "trace": LINES / "playground-1-trace.png",
    "lit": LINES / "playground-1-lit.png",
    "env": Path("public/scene/layers25d/environment-corrections.png"),
}
OBJECT = Path("public/scene/layers25d/playground/object.png")
BACKGROUND = Path("public/scene/layers25d/playground/background.png")
REST = Path("docs/m1.3j/connection/before/rest.png")
REST_AT = (1040, 325)  # scene px of the frame's top-left
ORIGINAL = Path("docs/m1.3j/connection/original")


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).copy()


def main():
    ORIGINAL.mkdir(parents=True, exist_ok=True)
    for f in FILES.values():
        keep = ORIGINAL / f.name
        if not keep.exists():
            shutil.copy2(f, keep)
    # Always work from the originals, so the script is idempotent.
    trace, lit, env = (rgba(ORIGINAL / f.name) for f in FILES.values())
    station = rgba(OBJECT)[..., 3]
    hole = rgba(BACKGROUND)[..., 3] > 0

    q = ((trace[..., 3] > 0) | (lit[..., 3] > 0)) & (station > 0)
    if (q & ~hole).any():
        raise SystemExit(f"{int((q & ~hole).sum())} px outside the clean-background hole: they would show when lifted")
    rest = np.asarray(Image.open(REST).convert("RGB"))
    ys, xs = np.nonzero(q)
    ry, rx = ys - REST_AT[1], xs - REST_AT[0]
    if ry.min() < 0 or rx.min() < 0 or ry.max() >= rest.shape[0] or rx.max() >= rest.shape[1]:
        raise SystemExit("artifact outside the idle frame")

    trace[q] = 0
    lit[q] = 0
    env[ys, xs, :3] = rest[ry, rx]
    env[ys, xs, 3] = 255
    for name, img in (("trace", trace), ("lit", lit), ("env", env)):
        Image.fromarray(img).save(FILES[name])

    # Check: the line itself is intact (its pixels off the station unchanged).
    orig_trace = rgba(ORIGINAL / FILES["trace"].name)
    orig_lit = rgba(ORIGINAL / FILES["lit"].name)
    off = ~q
    report = dict(
        removed_px=int(q.sum()),
        bbox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
        on_opaque_station_px=int((q & (station == 255)).sum()),
        on_soft_edge_px=int((q & (station < 255)).sum()),
        line_px_kept_trace=int((orig_trace[..., 3][off] > 0).sum()),
        line_px_kept_lit=int((orig_lit[..., 3][off] > 0).sum()),
        line_pixels_changed_off_station=int((np.any(orig_trace[off] != trace[off], axis=-1)).sum() + (np.any(orig_lit[off] != lit[off], axis=-1)).sum()),
        env_px_changed=int(q.sum()),
    )
    Path("docs/m1.3j/connection/fix.json").write_text(json.dumps(report, indent=1) + "\n")
    print(json.dumps(report))



def refine(frame):
    """One correction pass: the browser draws the environment layer with a
    sub-pixel resampling, so each baked pixel also feels its neighbours.
    Nudge the baked pixels by the residual against the original idle frame
    (a few passes converge)."""
    env = rgba(FILES["env"])
    trace = rgba(ORIGINAL / FILES["trace"].name)
    lit = rgba(ORIGINAL / FILES["lit"].name)
    q = ((trace[..., 3] > 0) | (lit[..., 3] > 0)) & (rgba(OBJECT)[..., 3] > 0)
    target = np.asarray(Image.open(REST).convert("RGB")).astype(np.float64)
    got = np.asarray(Image.open(frame).convert("RGB")).astype(np.float64)
    ys, xs = np.nonzero(q)
    ry, rx = ys - REST_AT[1], xs - REST_AT[0]
    res = target[ry, rx] - got[ry, rx]
    env[ys, xs, :3] = np.clip(np.round(env[ys, xs, :3] + 0.8 * res), 0, 255)
    Image.fromarray(env).save(FILES["env"])
    print(json.dumps(dict(residual_max=float(np.abs(res).max()), over2=int((np.abs(res).max(1) > 2).sum()))))


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 2 and sys.argv[1] == "refine":
        refine(sys.argv[2])
    else:
        main()
