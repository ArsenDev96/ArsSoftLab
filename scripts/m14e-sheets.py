"""M1.4E: review sheets (docs/m1.4e/) from the browser captures of the approved
homepage, M1.4D (docs/m1.4d/work/captures/) and M1.4E
(docs/m1.4e/work/captures/), all at the same 1648 x 928 viewport and camera.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14e-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4e"
C14E = D / "work/captures"
C14D = ROOT / "docs/m1.4d/work/captures"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid

CAM = json.loads((C14E / "checks.json").read_text())["camera"]
REG = {
    "hub": (600, 470, 480, 270),
    "foreground left": (1, 640, 469, 299),
    "foreground right": (1380, 740, 290, 199),
    "playground": (1000, 300, 440, 320),
}


def vp(r):
    x, y, w, h = r
    k = CAM["k"]
    return (round(CAM["x"] + x * k), round(CAM["y"] + y * k), round(CAM["x"] + (x + w) * k), round(CAM["y"] + (y + h) * k))


def load(p):
    return Image.open(p).convert("RGB")


def x(i, k, nearest=False):
    return i.resize((round(i.width * k), round(i.height * k)), Image.NEAREST if nearest else Image.LANCZOS)


def checker(rgba, box_):
    im = Image.open(rgba).convert("RGBA").crop(box_)
    w, h = im.size
    yy, xx = np.mgrid[0:h, 0:w]
    c = np.where(((xx // 8 + yy // 8) % 2)[..., None] == 0, [70, 70, 78], [200, 0, 200]).astype(np.uint8)
    bg = Image.fromarray(c).convert("RGBA")
    return Image.alpha_composite(bg, im).convert("RGB")


def light(png, box_, gain=2.0):
    a = np.asarray(Image.open(png).convert("RGB").crop(box_)).astype(float) * gain
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main():
    approved = load(C14E / "approved-rest.png")
    m14d = load(C14D / "C-v2-with-connections.png")
    m14e = load(C14E / "v2-with-connections.png")
    shots = {"approved": approved, "m14d": m14d, "m14e": m14e}

    # Closeness to the approved homepage, per region (mean |diff|, max over channels).
    A = np.asarray(approved).astype(float)
    metrics = {}
    for name, im in (("m14d", m14d), ("m14e", m14e)):
        B = np.asarray(im).astype(float)
        d = np.abs(A - B).max(2)
        metrics[name] = {"whole frame": round(float(d.mean()), 1)}
        for k, r in REG.items():
            x0, y0, x1, y1 = vp(r)
            metrics[name][k] = round(float(d[y0:y1, x0:x1].mean()), 1)
    (D / "work/closeness-to-approved.json").write_text(json.dumps(metrics, indent=1) + "\n")

    L = {"approved": "A. APPROVED homepage", "m14d": "B. M1.4D /lab-v2", "m14e": "C. M1.4E /lab-v2"}
    rows = [("whole scene, half size", [x(shots[k], 0.5) for k in L])]
    for reg in ("hub", "foreground left", "foreground right"):
        rows.append((f"{reg}, 1x desktop px", [shots[k].crop(vp(REG[reg])) for k in L]))
    grid(rows, [f"{L[k]}" + (f"  (mean |diff| vs A: {metrics[k]['whole frame']})" if k in metrics else "") for k in L],
         D / "approved-vs-m14d-vs-m14e.png", "M1.4E: approved original vs M1.4D vs M1.4E (same viewport and camera; connections on)")

    hub_box = (620, 500, 1070, 740)
    grid(
        [("1x desktop px, shown at 2x", [x(shots[k].crop(vp(REG["hub"])), 2) for k in L]),
         ("M1.4E layers: hub.png on a checkerboard / hub-light.png (plus-lighter, shown x2) / M1.4E browser-rendered at 3x",
          [x(checker(ROOT / "public/scene/v2/m14e/hub.png", hub_box), 2), x(light(ROOT / "public/scene/v2/m14e/hub-light.png", hub_box), 2), x(load(C14E / "hub-3x.png"), 0.68)])],
        [L["approved"], L["m14d"] + " (generated central-a.png)", L["m14e"] + " (recovered from the approved artwork)"],
        D / "central-a-before-after.png", "M1.4E: the central A",
    )

    fgl_box, fgr_box = (0, 690, 470, 941), (1380, 740, 1672, 941)
    grid(
        [("lower left, 1x desktop px, shown at 2x", [x(shots[k].crop(vp(REG["foreground left"])), 2) for k in L]),
         ("lower right, 1x desktop px, shown at 2x", [x(shots[k].crop(vp(REG["foreground right"])), 2) for k in L]),
         ("M1.4E layers: fg-table.png on a checkerboard / fg-steam.png (plus-lighter, shown x3) / fg-plant.png on a checkerboard",
          [x(checker(ROOT / "public/scene/v2/m14e/fg-table.png", fgl_box), 2), x(light(ROOT / "public/scene/v2/m14e/fg-steam.png", (200, 680, 360, 820), 3.0), 4), x(checker(ROOT / "public/scene/v2/m14e/fg-plant.png", fgr_box), 2)]),
         ("M1.4E browser-rendered at 3x", [x(load(C14E / "fg-left-3x.png"), 0.68), x(load(C14E / "fg-right-3x.png"), 0.68), Image.new("RGB", (8, 8), (18, 18, 22))])],
        [L["approved"], L["m14d"], L["m14e"]],
        D / "foreground-before-after.png", "M1.4E: foreground details (books, mug and steam, table; lower-right plant)",
    )

    grid(
        [("1x desktop px, shown at 1.5x", [x(load(C14E / n), 1.5) for n in ("pg-rest.png", "pg-lifted.png", "pg-lifted-no-shadow.png", "pg-hover-live.png")]),
         ("the gap, browser-rendered at 3x", [load(C14E / "pg-lifted-gap-3x.png"), load(C14E / "pg-lifted-no-shadow-gap-3x.png"), Image.new("RGB", (8, 8), (18, 18, 22)), Image.new("RGB", (8, 8), (18, 18, 22))])],
        ["at rest", "full 18 px lift (CSS transform as in the lift)", "full lift, contact ellipses off", "real hover after 3.2 s (energy, lift, arcade running)"],
        D / "playground-lifted.png", "M1.4E: Playground at rest and lifted (station assets unchanged from M1.4D)",
    )
    print(json.dumps(metrics, indent=1))


if __name__ == "__main__":
    main()
