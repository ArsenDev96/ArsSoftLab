"""
Build the scene "clean plate" from the approved reference design.

The approved reference (reference/approved-lab-design.png) has its interface
text baked into the pixels. The website re-creates that interface as real,
accessible HTML, so the baked-in copies must be removed from the background
layer to avoid doubled text.

This script never modifies the reference. It writes a derived asset:

    public/scene/lab-plate.webp   (1672 x 941, same frame as the reference)

Scene objects that are part of the illustration (the central glowing A, the
book spines, the mug monogram, screen contents) are intentionally kept.

Requirements (dev-only, not a website dependency):
    pip install opencv-python-headless numpy

Usage:
    python scripts/make-clean-plate.py [--debug out_mask.png]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "reference" / "approved-lab-design.png"
OUT = ROOT / "public" / "scene" / "lab-plate.webp"

# --- Regions, in reference pixel coordinates (1672 x 941) -------------------

# Solid UI surfaces (pills, buttons): removed entirely, (x0, y0, x1, y1, pad).
SURFACES: list[tuple[int, int, int, int, int]] = [
    # Header
    (597, 12, 708, 61, 4),      # active "Lab" pill + amber underline
    (1328, 17, 1440, 58, 4),    # search pill
    (1475, 15, 1626, 62, 7),    # Let's Talk (has an outer glow)
    # Educational chips
    (825, 253, 898, 280, 3),
    (906, 253, 974, 280, 3),
    # Engineering chips
    (424, 351, 506, 380, 3),
    (511, 351, 614, 380, 3),
    # Playground chip
    (1286, 357, 1348, 385, 3),
    # Creative Studio chip
    (406, 605, 505, 636, 3),
    # Experience chip
    (1276, 598, 1351, 627, 3),
    # Station icon bodies (their dark interiors would otherwise leave a ghost)
    (761, 226, 804, 258, 2),
    (347, 578, 384, 615, 2),
    (1217, 569, 1253, 603, 2),
    (1223, 329, 1266, 360, 2),
]

# Text / line-icon areas: only pixels brighter than their surroundings are
# removed, which preserves as much of the underlying scene as possible.
# (x0, y0, x1, y1, threshold, dilate_px)
GLYPHS: list[tuple[int, int, int, int, int, int]] = [
    # Header brand
    (58, 15, 106, 61, 14, 3),       # A monogram
    (124, 16, 290, 43, 16, 2),      # Arsen Manukyan
    (125, 44, 306, 59, 16, 2),      # SOFTWARE ENGINEER
    # Nav items (non-active)
    (732, 20, 828, 48, 14, 2),      # Projects
    (869, 20, 988, 48, 14, 2),      # Experience
    (1030, 20, 1112, 48, 14, 2),    # About
    # Hero copy
    (117, 116, 246, 134, 16, 2),    # INSIDE MY LAB
    (116, 146, 436, 273, 16, 3),    # Explore my world / of products, tools / and ideas.
    (118, 289, 182, 300, 10, 2),    # amber rule
    # Station icons (glowing, so lower threshold + wider dilation)
    (754, 219, 811, 265, 10, 4),    # Educational cap
    (354, 318, 412, 362, 8, 5),     # Engineering </>
    (1216, 322, 1273, 367, 8, 5),   # Playground controller
    (340, 571, 391, 622, 10, 4),    # Creative Studio palette
    (1210, 562, 1260, 610, 10, 4),  # Experience briefcase
    # Station titles
    (821, 222, 936, 248, 16, 4),
    (420, 320, 538, 351, 16, 4),
    (1283, 323, 1398, 354, 16, 4),
    (401, 573, 563, 601, 16, 4),
    (1265, 566, 1381, 597, 16, 4),
    # Explore the Lab
    (822, 818, 853, 860, 12, 3),    # mouse icon
    (778, 866, 900, 891, 14, 2),    # label
    (680, 873, 746, 882, 8, 2),     # left rule
    (930, 873, 1008, 882, 8, 2),    # right rule
]


def rounded_rect_mask(shape: tuple[int, int], box: tuple[int, int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1, pad = box
    x0, y0, x1, y1 = x0 - pad, y0 - pad, x1 + pad, y1 + pad
    m = np.zeros(shape, np.uint8)
    r = (y1 - y0) // 2
    cv2.rectangle(m, (x0 + r, y0), (x1 - r, y1), 255, -1)
    cv2.circle(m, (x0 + r, y0 + r), r, 255, -1)
    cv2.circle(m, (x1 - r, y0 + r), r, 255, -1)
    return m


def glyph_mask(lum: np.ndarray, background: np.ndarray, box: tuple[int, int, int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1, thr, dil = box
    m = np.zeros(lum.shape, np.uint8)
    diff = lum[y0:y1, x0:x1] - background[y0:y1, x0:x1]
    m[y0:y1, x0:x1] = np.where(diff > thr, 255, 0).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dil + 1, 2 * dil + 1))
    return cv2.dilate(m, k)


def fill_masked(img: np.ndarray, mask: np.ndarray, highlight: np.ndarray) -> np.ndarray:
    """Multi-scale normalized-convolution fill.

    Each masked pixel becomes a weighted average of nearby *unmasked* pixels.
    Bright features next to a region (screen edges, glow lines) are excluded
    as sources so they don't bleed into the repaired area. Coarse scales fill
    the interior smoothly; finer scales restore detail near the edges.
    """
    src = img.astype(np.float32)
    hole = mask > 0
    weight = (~hole).astype(np.float32)
    weight[highlight > 22] *= 0.05

    filled = src.copy()
    result = None
    for sigma, min_w in ((10, 0.0), (5, 0.2), (2.5, 0.4)):
        w = cv2.GaussianBlur(weight, (0, 0), sigma)
        v = cv2.GaussianBlur(src * weight[..., None], (0, 0), sigma)
        est = v / np.maximum(w, 1e-4)[..., None]
        if result is None:
            result = est
        else:
            # Blend toward the finer estimate where it has enough support.
            a = np.clip((w - min_w) / (1 - min_w), 0, 1)[..., None]
            result = result * (1 - a) + est * a
    assert result is not None

    rng = np.random.default_rng(7)
    result += rng.normal(0, 1.8, img.shape).astype(np.float32)  # match sensor grain

    feather = cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 1.0)[..., None]
    feather = np.maximum(feather, hole[..., None].astype(np.float32))
    filled = src * (1 - feather) + result * feather
    return np.clip(filled, 0, 255).astype(np.uint8)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug", type=Path, help="write the removal mask here")
    args = ap.parse_args()

    img = cv2.imread(str(SRC), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"cannot read {SRC}")

    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.int16)
    background = cv2.medianBlur(lum.astype(np.uint8), 31).astype(np.int16)

    mask = np.zeros(lum.shape, np.uint8)
    for s in SURFACES:
        mask |= rounded_rect_mask(lum.shape, s)
    for g in GLYPHS:
        mask |= glyph_mask(lum, background, g)

    out = fill_masked(img, mask, lum - background)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUT), out, [cv2.IMWRITE_WEBP_QUALITY, 94])
    if args.debug:
        cv2.imwrite(str(args.debug), mask)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB), "
          f"masked {int((mask > 0).sum())} px")


if __name__ == "__main__":
    main()
