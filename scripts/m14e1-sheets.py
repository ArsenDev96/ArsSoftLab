"""M1.4E.1: evidence sheets (docs/m1.4e1/) from scripts/visual/m14e1-capture.mjs
(approved homepage and /lab-v2 at the same phases), the M1.4E state before this
milestone (docs/m1.4e1/work/before/, docs/m1.4e/work/captures/), all at the
same 1648 x 928 viewport and camera.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14e1-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4e1"
C = D / "work/captures"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid
CHK = json.loads((C / "checks.json").read_text())
CAM = CHK["v2"]["camera"]


def im(p):
    return Image.open(p).convert("RGB")


def x(i, k):
    return i.resize((round(i.width * k), round(i.height * k)), Image.LANCZOS)


def vp(r):
    x0, y0, w, h = r
    k = CAM["k"]
    return (round(CAM["x"] + x0 * k), round(CAM["y"] + y0 * k), round(CAM["x"] + (x0 + w) * k), round(CAM["y"] + (y0 + h) * k))


def gap_ratio(with_, without):
    a = np.asarray(im(with_)).astype(float) @ [0.299, 0.587, 0.114]
    b = np.asarray(im(without)).astype(float) @ [0.299, 0.587, 0.114]
    out = {}
    for name, r in {"gap centre": (1150, 532, 140, 14), "gap left": (1080, 525, 70, 15), "just in front": (1150, 548, 140, 8), "floor further out": (1150, 565, 140, 15)}.items():
        x0, y0, x1, y1 = vp(r)
        out[name] = round(float(a[y0:y1, x0:x1].mean() / b[y0:y1, x0:x1].mean()), 2)
    return out


def main():
    v, a = C / "v2", C / "approved"
    P = ["A-rest", "B-spark-half", "C-spark-arriving", "D-lifted", "E-lifted-no-shadow", "F-returning"]
    LBL = ["A. at rest", "B. spark half way", "C. spark arriving", "D. fully lifted", "E. lifted, shadows off", "F. returning (half way down)"]
    st = (1000, 300, 440, 320)
    grid(
        [("M1.4E.1 /lab-v2", [im(v / f"{p}.png").crop(vp(st)) for p in P]),
         ("approved homepage, same phases (reference)", [im(a / f"{p}.png").crop(vp(st)) for p in P])],
        LBL, D / "phases-desktop.png", "M1.4E.1: Playground at normal desktop size (1x desktop px, same camera)",
    )
    ln = (860, 480, 560, 130)
    b = D / "work/before"
    grid(
        [("M1.4E (before)", [im(b / n) for n in ("0-rest-3x.png", "t380-3x.png", "t640-3x.png", "t2400-3x.png")]),
         ("M1.4E.1", [im(v / n) for n in ("A-rest-line-3x.png", "B-spark-half-line-3x.png", "C-spark-arriving-line-3x.png", "D-lifted-line-3x.png")]),
         ("approved homepage", [im(a / n) for n in ("A-rest-line-3x.png", "B-spark-half-line-3x.png", "C-spark-arriving-line-3x.png", "D-lifted-line-3x.png")])],
        ["at rest", "spark in flight", "spark arriving", "fully lifted"], D / "connection-3x.png",
        "M1.4E.1: Playground's connection, browser-rendered at 3x (scene x 860-1420, y 480-610)",
    )
    m14e = ROOT / "docs/m1.4e/work/captures"
    ratios = {"m14e1": gap_ratio(v / "D-lifted.png", v / "E-lifted-no-shadow.png")}
    grid(
        [("1x desktop px, shown at 1.5x", [x(im(m14e / "pg-lifted.png"), 1.5), x(im(v / "D-lifted.png").crop(vp(st)), 1.5), x(im(v / "E-lifted-no-shadow.png").crop(vp(st)), 1.5), x(im(a / "D-lifted.png").crop(vp(st)), 1.5)])],
        ["M1.4E (before): full lift", "M1.4E.1: full lift", "M1.4E.1: full lift, shadows off", "approved homepage: full lift"],
        D / "grounding.png",
        "M1.4E.1: grounding at full lift; floor luminance with/without shadow: " + ", ".join(f"{k} {v_}" for k, v_ in ratios["m14e1"].items()),
    )
    e_whole = m14e / "v2-hover-playground.png"
    grid(
        [("whole scene at full lift, half size", [x(im(a / "D-lifted.png"), 0.5), x(im(e_whole), 0.5), x(im(v / "D-lifted.png"), 0.5)])],
        ["approved homepage", "M1.4E (before; live hover)", "M1.4E.1"], D / "approved-vs-m14e-vs-m14e1.png", "M1.4E.1: comparison at full lift (same camera)",
    )
    (D / "work/gap-shadow-ratios.json").write_text(json.dumps(ratios, indent=1) + "\n")
    print(json.dumps(ratios, indent=1))


if __name__ == "__main__":
    main()
