"""M1.4D: the review sheets in docs/m1.4d/ from the browser captures
(scripts/visual/m14d-capture.mjs) and the offline fit (scripts/v2-fit.py).

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14d-sheets.py
"""

import importlib.util
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4d"
C = D / "work/captures"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid


def im(n):
    return Image.open(C / n).convert("RGB")


def half(i):
    return i.resize((i.width // 2, i.height // 2), Image.LANCZOS)


def x(i, k):
    return i.resize((round(i.width * k), round(i.height * k)), Image.LANCZOS)


def main():
    grid(
        [("/lab-v2 at rest: environment + 5 stations + central A, NO connections", [im("A-v2-no-connections.png")]),
         ("same, contact-shadow ellipses also off (raw layers on the environment)", [im("A-v2-no-connections-no-shadow.png")])],
        ["1648 x 928 desktop viewport, HTML navigation, headings, names and chips"],
        D / "assembled-no-connections.png",
        "M1.4D A: the layered v2 lab without connections",
    )
    gen = Image.open(D / "work/offline-generated-connections-vs-paths.png").convert("RGB")
    grid(
        [("/lab-v2 at rest WITH the five connections: the accurate M1.3I routes, drawn as vector strokes (retained implementation)", [im("C-v2-with-connections.png")]),
         ("For comparison only: the five GENERATED connection PNGs as delivered (orange) over the offline composite, with the accurate routes in cyan. Not used.", [gen.resize((1648, 928), Image.LANCZOS)])],
        ["1648 x 928"],
        D / "assembled-with-connections.png",
        "M1.4D C: connections",
    )
    ref = Image.open(ROOT / "reference/approved-lab-design.png").convert("RGB").resize((1648, 928), Image.LANCZOS)
    outl = Image.open(D / "work/offline-outlines-on-approved.png").convert("RGB").resize((1648, 928), Image.LANCZOS)
    grid(
        [("approved reference / v2", [half(ref), half(im("C-v2-with-connections.png"))]),
         ("approved homepage (live, same camera) / v2 placed outlines (cyan) on the approved plate", [half(im("approved-rest.png")), half(outl)])],
        ["left", "right"],
        D / "approved-vs-v2.png",
        "M1.4D B: approved design vs the layered v2 lab (half size)",
    )
    k = 1.5
    grid(
        [("1x desktop px, shown at 1.5x", [x(im("approved-station.png"), k), x(im("m13j-lifted-station.png"), k), x(im("D-v2-rest-station.png"), k), x(im("D-v2-lifted-station.png"), k)])],
        ["approved homepage, at rest", "M1.3J experimental, lifted 18 px", "v2, at rest", "v2, lifted 18 px (manual, CSS transform as in the lift)"],
        D / "playground-rest-vs-lifted.png",
        "M1.4D D: Playground at rest and elevated 18 px (shadows on)",
    )
    grid(
        [("station, 1x desktop px shown at 1.5x", [x(im("m13j-lifted-no-shadow-station.png"), k), x(im("E-v2-lifted-no-shadow-station.png"), k)]),
         ("the gap, browser-rendered at 3x", [im("m13j-lifted-no-shadow-gap-3x.png"), im("E-v2-lifted-no-shadow-gap-3x.png")])],
        ["M1.3J experimental (contact + ambient shadows off)", "v2 (contact ellipses off)"],
        D / "playground-lifted-no-shadow.png",
        "M1.4D E: Playground elevated 18 px, shadows disabled",
    )
    # Supporting: every new object's edges at 3x, at rest.
    tiles = [x(im(f"edges-{n}-3x.png"), 0.6) for n in ("engineering", "educational", "hub", "creative", "experience")]
    grid([("browser-rendered at 3x, shown at 0.6", tiles[:3]), ("", tiles[3:] + [x(im("G-v2-hover-live-station.png"), 1.8)])],
         ["engineering / creative", "educational / experience", "central A / Playground hovered live (arcade running)"],
         D / "work/edges-3x.png", "M1.4D: layer edges (halos, fringes) and the arcade on the new screen")
    print("sheets written")


if __name__ == "__main__":
    main()
