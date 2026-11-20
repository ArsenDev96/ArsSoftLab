"""
Build luminous-feature masks for the M1.2 light animations.

Each mask isolates pixels that are *already glowing* in the clean plate:
the five amber connection lines and the globe's gold orbit ring. Animated
highlights are drawn through these masks, so they can only brighten existing
light. They never draw new geometry, and occlusion (the orbit passing
behind the church and the globe) is inherited from the artwork itself.

Inputs : public/scene/lab-plate.webp
Outputs: public/scene/masks/connections.png       (crisp line pixels)
         public/scene/masks/connections-glow.png  (soft halo around them)
         public/scene/masks/orbit.png
         public/scene/masks/orbit-glow.png
         public/scene/masks/platforms.png         (M1.3A: platform strips, half res)
(white RGBA, alpha = mask strength, full 1672 x 941 frame; platforms.png is
the same frame at half resolution and is drawn scaled up)

The polyline geometry below is shared with components/lab/scene-fx.ts
(the animation paths). Keep the two in sync.

Requirements (dev-only): pip install opencv-python-headless numpy
Usage: python scripts/make-scene-masks.py
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PLATE = ROOT / "public" / "scene" / "lab-plate.webp"
OUT_DIR = ROOT / "public" / "scene" / "masks"

# Quadratic Béziers fitted to the connection lines (sub-pixel residuals),
# ordered from the central platform outward: (start, control, end).
CONNECTIONS = {
    "educational": ((838.5, 528.0), (838.5, 495.0), (838.5, 462.0)),
    "engineering": ((716.0, 569.5), (651.0, 556.3), (586.0, 540.8)),
    "playground": ((967.0, 567.2), (1027.5, 556.1), (1088.0, 536.5)),
    "creative": ((721.0, 645.7), (613.0, 685.9), (505.0, 695.2)),
    "experience": ((964.0, 648.1), (1088.0, 687.7), (1212.0, 696.2)),
}

# Hand-traced orbit ring (closed loop). The ring is not a clean projected
# ellipse in the illustration, so the exact shape comes from the pixels.
ORBIT = [
    (673.5, 404), (676, 395), (682.5, 387.5), (697.5, 376), (720, 362.5),
    (740, 355), (770, 348), (800, 342), (830, 338), (860, 336), (900, 333.5),
    (922.5, 327.5), (955, 316), (980, 310), (990, 311.5), (992, 316),
    (990, 330), (977.5, 352.5), (960, 372.5), (930, 392.5), (897.5, 407.5),
    (875, 422), (845, 431), (807.5, 433), (770, 430), (740, 425),
    (717.5, 421.5), (692.5, 420.5), (679, 416),
]

# Spans where the ring is hidden in the artwork (behind the glass dome, the
# church and the island) and the corridor would otherwise catch mountains,
# snow or moss. (x0, y0, x1, y1)
ORBIT_EXCLUDE = [
    (752, 325, 905, 362),   # behind the dome / mountain skyline
    (826, 294, 910, 372),   # church walls and tower
    (905, 334, 945, 350),   # snow-capped peak under the ring
    (722, 415, 805, 445),   # front arc hidden behind the island and moss
]


# M1.3A: platform light strips that brighten while a station is hovered or
# selected. Bands are hand-placed around each platform's own amber strips
# (and, where visible, its floor ring), clear of the objects standing on it;
# within a band only warm, locally bright pixels count. Mirrored by
# PLATFORM_LIGHTS in components/lab/scene-fx.ts (the element boxes, which
# must contain these bands). Rectangles (x0, y0, x1, y1) or polygons.
PLATFORM_BANDS = {
    "educational": [(745, 449, 930, 466), (676, 484, 706, 500), (955, 482, 1000, 500)],
    "engineering": [(352, 525, 474, 543)],
    "playground": [(1132, 519, 1234, 540), (1345, 527, 1380, 545)],
    "creative": [(172, 768, 238, 784),
                 [(372, 760), (440, 755), (488, 744), (506, 726), (520, 728), (512, 750), (480, 770), (420, 780), (372, 782)]],
    "experience": [[(1192, 718), (1250, 744), (1330, 764), (1420, 770), (1420, 790), (1320, 786), (1232, 764), (1186, 736)],
                   (1568, 764, 1652, 782),
                   [(1152, 744), (1150, 722), (1162, 706), (1196, 700), (1200, 712), (1172, 722), (1166, 744)]],
}
PLATFORM_SCALE = 0.5  # soft light: half resolution keeps the decoded mask ~1.6 MB


def quad_points(p0, p1, p2, n=400) -> np.ndarray:
    t = np.linspace(0, 1, n)[:, None]
    a, b, c = (np.array(p, float) for p in (p0, p1, p2))
    return (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c


def catmull_rom_closed(pts, samples=24) -> np.ndarray:
    p = np.array(pts, float)
    n = len(p)
    out = []
    for i in range(n):
        p0, p1, p2, p3 = p[(i - 1) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]
        for t in np.linspace(0, 1, samples, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


def corridor(shape, polyline: np.ndarray, width: int, closed=False) -> np.ndarray:
    m = np.zeros(shape, np.uint8)
    cv2.polylines(m, [np.round(polyline * 4).astype(np.int32)], closed, 255, width * 4 + 1,
                  lineType=cv2.LINE_AA, shift=2)
    return m.astype(np.float32) / 255.0


def ridge(lum: np.ndarray) -> np.ndarray:
    """How much brighter a pixel is than its neighbourhood (0..1)."""
    background = cv2.GaussianBlur(lum, (0, 0), 6)
    return np.clip((lum - background - 6) / 40.0, 0, 1)


def halo(mask: np.ndarray, sigma: float) -> np.ndarray:
    """Soft bloom region hugging a mask, normalised so the core reaches ~1."""
    h = cv2.GaussianBlur(mask, (0, 0), sigma)
    return np.clip(h / max(float(np.percentile(h[h > 0.02], 99)), 1e-6), 0, 1) ** 1.3


def bands(shape, items) -> np.ndarray:
    m = np.zeros(shape, np.uint8)
    for it in items:
        if len(it) == 4 and not isinstance(it[0], tuple):
            x0, y0, x1, y1 = it
            cv2.rectangle(m, (x0, y0), (x1, y1), 255, -1)
        else:
            cv2.fillPoly(m, [np.round(np.array(it) * 4).astype(np.int32)], 255, lineType=cv2.LINE_AA, shift=2)
    return m.astype(np.float32) / 255.0


def save_mask(name: str, alpha: np.ndarray, scale: float = 1.0) -> None:
    if scale != 1.0:
        alpha = cv2.resize(alpha, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    a = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.full_like(a, 255)] * 3 + [a])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{name}.png"
    cv2.imwrite(str(path), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB, "
          f"{int((a > 20).sum())} px)")


def main() -> None:
    img = cv2.imread(str(PLATE), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"cannot read {PLATE}")
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    b, g, r = (img[..., i].astype(np.float32) for i in range(3))
    warm = np.clip((r - b - 20) / 60.0, 0, 1)  # excludes the blue globe shell
    warm *= np.clip((r - g + 8) / 16.0, 0, 1)  # gold ring has R >= G; moss doesn't
    lit = ridge(lum)

    # Connection lines: brightness ridge inside a narrow corridor.
    conn = np.zeros(lum.shape, np.float32)
    for p0, p1, p2 in CONNECTIONS.values():
        conn = np.maximum(conn, corridor(lum.shape, quad_points(p0, p1, p2), 3))
    conn_mask = cv2.GaussianBlur(conn * np.maximum(lit, 0.25 * (lum > 150)), (0, 0), 0.7)
    save_mask("connections", conn_mask)
    save_mask("connections-glow", halo(conn_mask, 3.5))

    # Orbit ring: warm ridge pixels near the traced loop, minus occluders.
    loop = catmull_rom_closed(ORBIT)
    orbit = corridor(lum.shape, loop, 5, closed=True)
    for x0, y0, x1, y1 in ORBIT_EXCLUDE:
        orbit[y0:y1, x0:x1] = 0
    orbit_mask = cv2.GaussianBlur(orbit * lit * np.maximum(warm, 0.35), (0, 0), 0.7)
    save_mask("orbit", orbit_mask)
    save_mask("orbit-glow", halo(orbit_mask, 3))

    # Platform strips: warm, bright, locally brighter pixels inside the bands,
    # minus the connection lines (they have their own light), plus a bloom.
    # All five stations share this one image; each station's light element
    # only covers its own box.
    plat = np.zeros(lum.shape, np.float32)
    for items in PLATFORM_BANDS.values():
        plat = np.maximum(plat, bands(lum.shape, items))
    plat *= 1 - np.clip(conn * 1.5, 0, 1)
    strong = np.clip((r - b - 40) / 60.0, 0, 1) * np.clip((lum - 110) / 90.0, 0, 1)
    contrast = np.clip((lum - cv2.GaussianBlur(lum, (0, 0), 8) - 4) / 50.0, 0, 1)
    core = cv2.GaussianBlur(plat * strong * np.clip(0.25 + 1.2 * contrast, 0, 1), (0, 0), 0.7)
    save_mask("platforms", np.maximum(core, 0.6 * halo(core, 5)), PLATFORM_SCALE)


if __name__ == "__main__":
    main()
