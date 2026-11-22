"""M1.4E.2: where Playground's line ends relative to the station, at rest and lifted.

From the v2 Playground asset as placed (docs/m1.4d/fit.json) and the lift
transform (translateY(-18) scale(1.01) about the base's (cx, bottom) =
(1218, 547), globals.css), measures in scene px:
  - the line's end E (the route's last point) against the base's ground contour
    at rest and its bottom edge at full lift,
  - how far along the line's own direction the floor is covered by the base at
    rest and by the lifted base (so: what the lift uncovers around E),
  - the ambient shadow's coverage at E at full lift (SceneV2 PlaygroundGround).
Writes docs/m1.4e2/work/geometry.json and the silhouettes station-alpha-{rest,lifted}.png.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14e2-geometry.py
"""

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H = 1672, 941
O = (1218.0, 547.0)
LIFT, SCALE = 18.0, 1.01
FOOT = dict(cx=1217.5, cy=522.8, rx=157.0, ry=23.7)


def route():
    src = (ROOT / "components/lab/playground-route.ts").read_text(encoding="utf-8")
    m = re.search(r"PLAYGROUND_ROUTE[^=]*=\s*(\[\[.*?\]\]);", src, re.S)
    return [tuple(p) for p in json.loads(m.group(1))]


def main():
    fit = json.loads((ROOT / "docs/m1.4d/fit.json").read_text(encoding="utf-8"))["objects"]["playground"]
    s, tx, ty = fit["scale"], fit["tx"], fit["ty"]
    asset = Image.open(ROOT / "public/scene/v2/stations/playground.png").convert("RGBA")
    sz = (round(W * s), round(H * s))
    rest = Image.new("L", (W, H))
    rest.paste(asset.resize(sz, Image.LANCZOS).split()[3], (round(tx), round(ty)))
    # Lifted: the same alpha through the lift's transform (inverse-mapped, bilinear).
    a = np.asarray(rest).astype(np.float64) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    sx = O[0] + (xx + 0.5 - O[0]) / SCALE - 0.5
    sy = O[1] + (yy + 0.5 - O[1] + LIFT) / SCALE - 0.5
    x0, y0 = np.floor(sx).astype(int), np.floor(sy).astype(int)
    fx, fy = sx - x0, sy - y0
    ok = (x0 >= 0) & (y0 >= 0) & (x0 < W - 1) & (y0 < H - 1)
    x0c, y0c = np.clip(x0, 0, W - 2), np.clip(y0, 0, H - 2)
    lifted = (a[y0c, x0c] * (1 - fx) * (1 - fy) + a[y0c, x0c + 1] * fx * (1 - fy) + a[y0c + 1, x0c] * (1 - fx) * fy + a[y0c + 1, x0c + 1] * fx * fy) * ok

    def covered(m, x, y):
        xi, yi = int(round(x)), int(round(y))
        return float(m[yi, xi])

    def bottom(m, x):
        col = np.nonzero(m[:, int(round(x))] > 0.5)[0]
        return int(col.max()) + 1 if len(col) else None  # first floor row below the base

    R = route()
    E = np.array(R[-1])
    d = E - np.array(R[-3])
    d /= np.hypot(*d)
    # Along the line's direction past E: is the floor covered by the base at rest / lifted?
    walk = []
    for t in np.arange(-6, 80.5, 1.0):
        p = E + t * d
        walk.append(dict(t=float(t), x=round(float(p[0]), 2), y=round(float(p[1]), 2), rest=round(covered(a, *p), 2), lifted=round(covered(lifted, *p), 2)))
    first = lambda key: next((w["t"] for w in walk if w["t"] >= 0 and w[key] > 0.5), None)
    t_rest, t_lift = first("rest"), first("lifted")

    # Ambient shadow at full lift (--lp = 1): centre +3 px, radii x1.08 / x1.47, stops of the gradient.
    cx, cy, rx, ry = FOOT["cx"], FOOT["cy"] + 3, FOOT["rx"] * 1.08, FOOT["ry"] * 1.47
    stops = [(0, 0.9), (0.4, 0.8), (0.68, 0.5), (0.86, 0.2), (1, 0)]

    def ambient(x, y):
        r = float(np.hypot((x - cx) / rx, (y - cy) / ry))
        for (r0, a0), (r1, a1) in zip(stops, stops[1:]):
            if r <= r1:
                return 0.9 * (a0 + (a1 - a0) * (r - r0) / (r1 - r0))
        return 0.0

    rep = dict(
        line_end_E=[round(float(v), 2) for v in E],
        line_direction_at_E=[round(float(v), 4) for v in d],
        rest_first_floor_row_below_base_at_Ex=bottom(a, E[0]),
        lifted_first_floor_row_below_base_at_Ex=bottom(lifted, E[0]),
        footprint_contour_y_at_Ex=round(FOOT["cy"] + FOOT["ry"] * (1 - ((E[0] - FOOT["cx"]) / FOOT["rx"]) ** 2) ** 0.5, 2),
        E_covered_rest=round(covered(a, *E), 2),
        E_covered_lifted=round(covered(lifted, *E), 2),
        along_line_first_covered_rest_t=t_rest,
        along_line_first_covered_lifted_t=t_lift,
        uncovered_by_lift_along_line_px=None if t_rest is None or t_lift is None else t_lift - t_rest,
        lifted_gap_below_base_at_Ex_px=None,
        ambient_shadow_alpha_at_E=round(ambient(*E), 3),
        walk=walk,
    )
    lb = rep["lifted_first_floor_row_below_base_at_Ex"]
    if lb is not None:
        rep["lifted_gap_below_base_at_Ex_px"] = round(float(E[1]) - lb, 2)
    out = ROOT / "docs/m1.4e2/work"
    out.mkdir(parents=True, exist_ok=True)
    # The station's silhouette at rest and at full lift (scene frame), for the pixel checks.
    Image.fromarray(np.round(a * 255).astype(np.uint8)).save(out / "station-alpha-rest.png")
    Image.fromarray(np.round(lifted * 255).astype(np.uint8)).save(out / "station-alpha-lifted.png")
    (out / "geometry.json").write_text(json.dumps(rep, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in rep.items() if k != "walk"}, indent=1))
    for w in walk:
        if w["t"] % 5 == 0:
            print(w)


if __name__ == "__main__":
    main()
