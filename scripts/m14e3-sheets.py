"""M1.4E.3: evidence sheets and the line's continuity profile (docs/m1.4e3/), from
scripts/visual/m14e3-capture.mjs, against the earlier states at the same
1648 x 928 viewport and camera:
    M1.4E.1  docs/m1.4e1/work/captures/v2/   (two parts, round ends; 3x line captures)
    M1.4E.2  docs/m1.4e2/work/captures/default/   (two parts, butt ends, floor extension; 1x)

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14e3-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4e3"
C = D / "work/captures/default"
E1 = ROOT / "docs/m1.4e1/work/captures/v2"
E2 = ROOT / "docs/m1.4e2/work/captures/default"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid
CHK = json.loads((D / "work/captures/checks.json").read_text(encoding="utf-8"))
CAM = CHK["default"]["camera"]
for p in (ROOT / "docs/m1.4e1/work/captures/checks.json", ROOT / "docs/m1.4e2/work/captures/checks.json"):
    c = json.loads(p.read_text(encoding="utf-8"))
    assert (c.get("v2") or c.get("default"))["camera"] == CAM, p
K = CAM["k"]
LUM = np.array([0.299, 0.587, 0.114])
LINE3 = (870, 500)  # M1.4E.3 line-3x origin (scene px)
LINE3_E1 = (860, 480)  # M1.4E.1 line-3x origin
REGION = (860, 300, 600, 300)
NEAR_A = (880, 535, 130, 50)
JUNCTION = (930, 550, 70, 32)


def im(p):
    return Image.open(p).convert("RGB")


def vp(r):
    x0, y0, w, h = r
    return (round(CAM["x"] + x0 * K), round(CAM["y"] + y0 * K), round(CAM["x"] + (x0 + w) * K), round(CAM["y"] + (y0 + h) * K))


def from3x(img, origin, r):
    """Crop scene rect r out of a 3x capture whose top-left is scene `origin`."""
    x0, y0, w, h = r
    s = 3 * K
    return img.crop((round((x0 - origin[0]) * s), round((y0 - origin[1]) * s), round((x0 - origin[0] + w) * s), round((y0 - origin[1] + h) * s)))


def from1x_as3x(img, r):
    c = img.crop(vp(r))
    return c.resize((round(r[2] * 3 * K), round(r[3] * 3 * K)), Image.NEAREST)


def station_mask(name):
    return np.asarray(Image.open(ROOT / f"docs/m1.4e2/work/station-alpha-{name}.png")) / 255.0


def profile(img_path, origin, samples, station):
    """Per 1 px of arc: the core's peak luminance (within 1 scene px across the
    line) and the glow's width (scene px across the line brighter than the
    floor beside it by 35+ levels). Points under the station are skipped."""
    L = np.asarray(im(img_path)).astype(float) @ LUM
    s = 3 * K
    pts = np.array(samples)
    out = []
    for i in range(1, len(pts) - 1):
        p = pts[i]
        if station[int(round(p[1])), int(round(p[0]))] > 0.02:
            out.append(None)
            continue
        t = pts[i + 1] - pts[i - 1]
        t /= np.hypot(*t)
        n = np.array([-t[1], t[0]])
        offs = np.arange(-8, 8.01, 1 / 3)
        vals = []
        for o in offs:
            q = (p + o * n - origin) * s
            vals.append(L[int(round(q[1])), int(round(q[0]))])
        vals = np.array(vals)
        core = vals[np.abs(offs) <= 1].max()
        floor = np.median(np.r_[vals[:6], vals[-6:]])
        out.append((float(core), float((vals > floor + 35).sum() / 3)))
    return out


def stats(prof, lo=0, hi=None):
    v = [x for x in prof[lo:hi] if x is not None]
    core = np.array([a for a, _ in v])
    width = np.array([b for _, b in v])
    steps = np.abs(np.diff(core))
    return dict(
        samples=len(v),
        core_min=round(float(core.min()), 1),
        core_median=round(float(np.median(core)), 1),
        core_max=round(float(core.max()), 1),
        core_max_step_per_px=round(float(steps.max()), 1),
        width_min=round(float(width.min()), 2),
        width_median=round(float(np.median(width)), 2),
        width_max=round(float(width.max()), 2),
    )


def continuity():
    rest_s, lift_s = CHK["default"]["rest"]["line_samples"], CHK["default"]["lifted"]["line_samples"]
    assert rest_s == lift_s
    pts = np.array(rest_s)
    bend = int(np.argmin(np.hypot(pts[:, 0] - 963.5, pts[:, 1] - 570.15)))
    st_rest, st_lift = station_mask("rest"), station_mask("lifted")
    out = {"path_length_px": len(rest_s) - 1, "bend_arc_px": bend}
    runs = {
        "M1.4E.3 idle (rest)": (C / "A-rest-line-3x.png", LINE3, st_rest),
        "M1.4E.3 powered (fully lifted)": (C / "G-lifted-line-3x.png", LINE3, st_lift),
        "M1.4E.1 idle (rest)": (E1 / "A-rest-line-3x.png", LINE3_E1, st_rest),
        "M1.4E.1 powered (fully lifted)": (E1 / "D-lifted-line-3x.png", LINE3_E1, st_lift),
    }
    for name, (p, origin, st) in runs.items():
        prof = profile(p, np.array(origin, float), rest_s, st)
        vis = [i for i, x in enumerate(prof) if x is not None]
        out[name] = {
            "visible_arc_px": [vis[0] + 1, vis[-1] + 1],
            "whole visible line (excluding the first and last 4 px)": stats(prof, 4, vis[-1] - 4),
            "rim junction (arc +-12 px)": stats(prof, bend - 13, bend + 12),
        }
    (D / "work/continuity.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=1))


def main():
    i1 = {k: im(E1 / f"{k}-line-3x.png") for k in ("A-rest", "D-lifted")}
    i2 = {k: im(E2 / f"{k}.png") for k in ("A-rest", "G-lifted")}
    i3 = {k: im(C / f"{k}-line-3x.png") for k in ("A-rest", "B0-spark-at-rim", "G-lifted")}
    # The grid helper needs an image in every cell: blank cells for the phases the earlier runs lack.
    def blank(ref):
        return Image.new("RGB", ref.size, (18, 18, 22))

    for name, r, title in (
        ("connection-near-a-3x.png", NEAR_A, "M1.4E.3: the connection near the central A, 3x (scene 880-1010 x 535-585)"),
        ("connection-junction-3x.png", JUNCTION, "M1.4E.3: rim junction, 3x (scene 930-1000 x 550-582)"),
    ):
        a = from3x(i3["A-rest"], LINE3, r)
        grid(
            [
                ("M1.4E.1: two parts, round ends (3x capture)", [from3x(i1["A-rest"], LINE3_E1, r), blank(a), from3x(i1["D-lifted"], LINE3_E1, r)]),
                ("M1.4E.2: two parts, butt ends (1x capture, enlarged 3x)", [from1x_as3x(i2["A-rest"], r), blank(a), from1x_as3x(i2["G-lifted"], r)]),
                ("M1.4E.3: one continuous path (3x capture)", [a, from3x(i3["B0-spark-at-rim"], LINE3, r), from3x(i3["G-lifted"], LINE3, r)]),
            ],
            ["idle (at rest)", "spark crossing the rim (255 ms)", "powered (fully lifted)"],
            D / name,
            title,
        )
    reg = vp(REGION)
    for name, b, c, title in (
        ("playground-rest.png", "A-rest", "A-rest", "Playground at rest, 1x"),
        ("playground-lifted.png", "G-lifted", "G-lifted", "Playground fully lifted, 1x"),
    ):
        grid(
            [("M1.4E.2 (before)", [im(E2 / f"{b}.png").crop(reg)]), ("M1.4E.3: continuous line; no floating gamepad over the marquee", [im(C / f"{c}.png").crop(reg)])],
            [""],
            D / name,
            f"M1.4E.3: {title} (scene 860-1460 x 300-600, same camera)",
        )
    seq = [
        ("A-rest", "rest"),
        ("B0-spark-at-rim", "255 ms spark at the rim"),
        ("C-spark-arriving", "612 ms spark arrives"),
        ("D-endpoint-activates", "700 ms strips light"),
        ("E-rising", "850 ms rising"),
        ("G-lifted", "fully lifted"),
        ("I1-before-drain", "leave +360 ms: lowered, still powered"),
        ("J-rest-again", "rest again (drained)"),
    ]
    half = lambda p: im(C / f"{p}-1x.png").resize((296, 148), Image.LANCZOS)
    grid([("  |  ".join(l for _, l in seq[:4]), [half(p) for p, _ in seq[:4]]), ("  |  ".join(l for _, l in seq[4:]), [half(p) for p, _ in seq[4:]])],
         ["", "", "", ""], D / "playground-hover-sequence.png", "M1.4E.3: Playground hover sequence, 1x (real time: playground-hover-sequence.webm)")
    continuity()


if __name__ == "__main__":
    main()
