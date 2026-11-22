"""M1.4F: Creative Studio and Experience for /lab-v2, recovered from the approved
artwork (the approved camera, perspective, stone, objects and lit strips), as
full-frame (1672 x 941) transparent layers, like M1.4E's hub and foreground.

Sources (nothing is painted or generated; every visible pixel is the approved
artwork's own):
  docs/m1.3k/package/01-source/environment-lines-removed.png
      the approved plate with the five power lines removed (and, by the M1.3
      corrections, the station strips darkened, since the homepage lights them
      with separate layers)
  docs/m1.3k/package/01-source/lab-plate.png
      the approved plate itself: the strips lit, as approved
  The station layer is the line-free plate, with the plate's own lit strips
  (and their light on the stone) where the two differ on the station. The
  strips' light on the FLOOR is the difference between the two plates (the
  approved light itself), kept as a light-only layer (plus-lighter), minus the
  connection lines.

Mattes. The v2 floor is a different render from the plate's (other tiles and
reflections), so the station cannot be separated by a difference against it:
  hard   the stone body (sides and base, low contrast against the floor) is a
         measured outline, anti-aliased at 4x
  band   the objects (and the platform's lit top edge) are bright against the
         plate's dark background: within a rough outer outline, alpha is the
         pixel's difference from that background (estimated by diffusing the
         plate from just outside the outline inward), and the colour is
         un-mixed from it (F = B + (I - B) / alpha), so no plate background is
         carried as a fringe onto the v2 floor; well inside the objects alpha is 1
Creative Studio: the M1.4E steam layer (fg-steam.png, plus-lighter, unchanged)
lies over its stone face, where the plate has the steam baked in; its light is
subtracted from this layer there, so it isn't doubled.

Writes public/scene/v2/m14f/{creative,experience}.png and
{creative,experience}-light.png, docs/m1.4f/work/extract.json and check sheets.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14f-extract.py
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "docs/m1.3k/package/01-source"
ENV = ROOT / "public/scene/v2/environment/lab-background.png"
OUT = ROOT / "public/scene/v2/m14f"
WORK = ROOT / "docs/m1.4f/work"
W, H = 1672, 941
SS = 4

# ---------------------------------------------------------------- Creative Studio (scene px, measured on the plate at 5-9x)
CREATIVE = dict(
    parts=[
        # The platform: top surface's back edge, right end, the base's bottom edge (lit strips
        # included), and the left end (behind the background plant and the books).
        [
            (98, 693), (100, 686.5), (110, 685), (120, 683.6), (129, 683), (171, 680), (330, 672), (423, 665),
            (430, 666.4), (440, 667.9), (450, 668.6), (460, 670), (470, 671.4), (480, 672.9), (490, 675),
            (497, 677.9), (500, 680.7), (501.4, 684), (501.3, 739), (496, 745), (486, 750.5), (470, 756.5),
            (450, 760.8), (420, 766.5), (390, 771.8), (385, 772.5), (340, 773.5), (300, 775), (260, 776.5),
            (230, 778), (229, 779.2), (184, 778.6), (178, 776), (176, 745), (97.5, 738), (97.5, 700),
        ],
        # Easel and painting: the back leg, the mast's two posts and cross piece, the painting's
        # slanted right edge, the tray and legs down to the platform top.
        [
            (166, 547), (175, 546.5), (203.5, 546.3), (204.5, 514), (210.8, 513.5), (215.5, 508.3), (220.2, 509),
            (227.5, 539.5), (237.5, 540), (238, 546), (301.5, 546), (307, 580), (311, 600), (314, 620), (318, 640),
            (322, 655), (324, 662), (333, 663), (333.5, 671), (330, 676), (323, 680), (322.5, 693), (322, 697),
            (171, 697), (171, 650), (170, 600), (166.5, 552),
        ],
        # The cup.
        [(129.5, 648), (168, 648), (168, 700), (166, 703), (132, 703.5), (129.5, 700)],
        # Brushes (left to right): the single one on the left, the bundle, and the two on the right.
        [(111.5, 600), (113, 597.5), (116.5, 598), (119, 605), (124, 616), (130, 630), (136.5, 648), (130, 648),
         (125, 636), (119.5, 623.5), (113.5, 610), (110.8, 602)],
        [(120.4, 576), (121.6, 571), (124.3, 570.6), (126.6, 573.9), (129.9, 587.2), (133, 596), (137.7, 595),
         (139.3, 596.1), (141.6, 609.4), (143.8, 618.3), (146, 627), (149.3, 642.8), (149.9, 648), (136.6, 648),
         (135.4, 633.9), (133.8, 622.8), (132, 612.8), (128.2, 601.7), (123.8, 590.6)],
        [(156, 592.8), (157.7, 587.2), (161, 586.8), (164, 588.5), (161, 591), (160.4, 598), (159.9, 606),
         (158.2, 620.6), (157, 636), (156.5, 648), (151, 648), (152, 636), (153.8, 622.8), (155.4, 606)],
        [(169.9, 598.3), (171, 596.7), (173.2, 596.5), (173.6, 598.3), (170.4, 611.7), (167.1, 622.8),
         (163.8, 636), (161.6, 648), (157.5, 648), (159.5, 636), (163.8, 620.6), (167.1, 609.4)],
        # The two small framed artworks.
        [(333.3, 660.8), (375.8, 660), (380, 688.3), (339.2, 690)],
        [(380, 665.8), (423.3, 665), (426.7, 686.7), (382.5, 689.2)],
    ],
    # Floor light from the strips: where the two plates differ, below / around the base.
    light_box=(170, 735, 520, 800),
    # The Creative connection's end (removed from the light layer).
    line_box=(495, 670, 560, 712),
)


# ---------------------------------------------------------------- Experience (scene px, measured on the plate at 4-5x)
EXPERIENCE = dict(
    parts=[
        # The stone base with its plinth ring: the lower tier's top edge (left), then inside the rock
        # (the rocky top above is the band's), the right end, the plinth's outer edge with the lit strips
        # (unlit between them, as approved), and the left end.
        [
            (1213, 678), (1220, 673), (1240, 668), (1260, 665.5), (1264, 668), (1300, 662), (1388, 660), (1532, 660),
            (1560, 672), (1600, 690), (1656, 693), (1661.5, 700), (1662.5, 745), (1660, 752), (1650, 762), (1640, 769),
            (1620, 774), (1600, 777.5), (1580, 780), (1560, 783), (1500, 784.5), (1440, 784.5), (1398, 783),
            (1350, 777.5), (1300, 770.5), (1295, 768), (1275, 764.5), (1255, 760.5), (1235, 756.5), (1215, 749.5),
            (1206, 741), (1200.5, 733), (1200.5, 727), (1203, 723), (1207.4, 718), (1208, 707), (1210, 695),
        ],
        # The translucent code panel: its border's outer edge, rounded top corners; down behind the terrain.
        [
            (1387.8, 521), (1389, 516.5), (1391.5, 514), (1395, 512.8), (1525, 512.8), (1528.5, 514), (1531.2, 516.5),
            (1532.6, 521), (1532.6, 662), (1387.8, 662),
        ],
        # Flags and poles.
        [(1506.2, 538.3), (1507.8, 538.3), (1507.8, 582), (1506.2, 582)],
        [(1507, 540), (1521, 544), (1518, 548), (1521, 552), (1508, 554)],
        [(1550.4, 586), (1552, 586), (1552, 642), (1550.4, 642)],
        [(1552, 587), (1564, 589), (1560, 593), (1564, 597), (1552, 598)],
    ],
    # The irregular rocky top, the wireframe peaks outside the panel and the plant's upper leaves:
    # difference matte inside this outline (bright or green on the plate's dark floor).
    outer=[
        [
            (1208, 680), (1209, 674), (1220, 668.5), (1240, 663.5), (1260, 661), (1266, 655), (1272, 648), (1280, 646),
            (1300, 647), (1340, 642), (1356, 635), (1364, 624), (1370, 624), (1380, 631), (1388, 629),
            (1388, 662), (1532, 662), (1532, 596), (1548, 608), (1558, 621), (1572, 631), (1580, 631), (1584, 621),
            (1592, 620), (1596, 631), (1612, 639), (1628, 654), (1640, 667), (1652, 681), (1662, 689), (1664, 700),
            (1600, 700), (1300, 680), (1210, 690),
        ],
    ],
    inner=[
        [(1216, 684), (1240, 673), (1262, 668.5), (1278, 659), (1300, 658), (1340, 653), (1388, 652), (1532, 652),
         (1560, 662), (1600, 692), (1640, 696), (1640, 700), (1300, 690), (1216, 690)],
    ],
    light_box=(1180, 715, 1672, 800),
    # The Experience connection's end, at the base's left end.
    line_box=(1140, 680, 1212, 714),
)


def union_mask(polys, ss=SS):
    im = Image.new("L", (W * ss, H * ss), 0)
    dr = ImageDraw.Draw(im)
    for pts in polys:
        dr.polygon([((x + 0.5) * ss - 0.5, (y + 0.5) * ss - 0.5) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BOX)).astype(np.float64) / 255


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float64)


def lum(a):
    return a @ np.array([0.299, 0.587, 0.114])


def polygon_mask(pts, ss=SS):
    im = Image.new("L", (W * ss, H * ss), 0)
    ImageDraw.Draw(im).polygon([((x + 0.5) * ss - 0.5, (y + 0.5) * ss - 0.5) for x, y in pts], fill=255)
    return np.asarray(im.resize((W, H), Image.BOX)).astype(np.float64) / 255


def box(a, r):
    if r <= 0:
        return a.copy()
    p = np.pad(a, [(r, r), (r, r)] + [(0, 0)] * (a.ndim - 2), mode="edge")
    c = np.pad(p.cumsum(0).cumsum(1), [(1, 0), (1, 0)] + [(0, 0)] * (a.ndim - 2))
    n = 2 * r + 1
    return (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / (n * n)


def smooth(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def diffuse(img, known, radii=(1, 2, 3, 5, 8, 12, 18, 27, 40, 60, 90)):
    """Fill unknown pixels from known ones nearby (normalized box filtering, finest scale first)."""
    out = np.zeros_like(img)
    done = np.zeros(known.shape, bool)
    k = known.astype(np.float64)
    for r in radii:
        den = box(k, r)
        num = box(img * k[..., None], r)
        ok = (den > 0.12) & ~done
        out[ok] = num[ok] / den[ok][:, None]
        done |= ok
    out[~done] = img[~done]
    return out


def save_rgba(rgb, a, p):
    o = np.zeros((H, W, 4))
    o[..., :3] = rgb
    o[..., 3] = a * 255
    o[o[..., 3] < 0.5, :3] = 0
    Image.fromarray(np.clip(np.round(o), 0, 255).astype(np.uint8)).save(p, optimize=True)


def station(spec, plate, clean, t0=14.0, t1=48.0):
    """The station's colour and alpha: measured outlines (hard), plus, where the spec has a band, the
    difference matte against the plate's own background (diffused in from outside), un-mixed."""
    hard = union_mask(spec["parts"])
    diff = np.abs(plate - clean).sum(2)
    region = hard.copy()
    outer = union_mask(spec["outer"]) if spec.get("outer") else np.zeros_like(hard)
    inner = union_mask(spec["inner"]) if spec.get("inner") else np.zeros_like(hard)
    region = np.maximum(region, outer)
    strip = (diff > 6) & (region > 0)  # the plate's own lit strips (and their light on the stone)
    src = np.where(strip[..., None], plate, clean)
    a = np.maximum(hard, inner)
    F = src.copy()
    if spec.get("outer"):
        known = box((region > 0).astype(float), 1) == 0
        B = diffuse(clean, known)
        d = np.sqrt(((src - B) ** 2).sum(2))
        band = smooth(d, t0, t1) * (outer > 0)
        a = np.maximum(a, band)
        unmix = B + (src - B) / np.maximum(a, 0.04)[..., None]
        F = np.where((a[..., None] > 0.995) | (hard[..., None] > 0.995), src, unmix)
    a = np.clip(np.where(region > 0, a, 0), 0, 1)
    stats = dict(alpha_px=int((a > 0.02).sum()), opaque_px=int((a > 0.98).sum()), edge_or_band_px=int(((a > 0.02) & (a < 0.98)).sum()), strip_px=int(strip.sum()))
    return np.clip(F, 0, 255), a, stats


def floor_light(spec, plate, clean, a):
    """The strips' light on the floor: the lit plate minus the strip-less plate (the approved light),
    around the base and outside the station, the connection's end excluded."""
    x0, y0, x1, y1 = spec["light_box"]
    lx0, ly0, lx1, ly1 = spec["line_box"]
    yy, xx = np.mgrid[0:H, 0:W]
    lb = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1) & ~((xx >= lx0) & (xx < lx1) & (yy >= ly0) & (yy < ly1))
    light = np.clip(plate - clean, 0, 255) * lb[..., None] * (1 - a)[..., None]
    la = light.max(2) / 255
    return light, la


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    plate = load(SRC_DIR / "lab-plate.png")
    clean = load(SRC_DIR / "environment-lines-removed.png")
    env = load(ENV)
    rep = {}
    st = np.asarray(Image.open(ROOT / "public/scene/v2/m14e/fg-steam.png").convert("RGBA")).astype(np.float64)
    steam = st[..., :3] * (st[..., 3:] / 255)
    checks = []
    for name, spec, crop in (("creative", CREATIVE, (60, 500, 540, 800)), ("experience", EXPERIENCE, (1180, 495, 1672, 800))):
        F, a, rep[name] = station(spec, plate, clean)
        if name == "creative":
            # The steam (M1.4E, plus-lighter, unchanged) is baked into the plate's stone here: take its light back out.
            F = np.clip(F - steam * (a[..., None] > 0), 0, 255)
        save_rgba(F, a, OUT / f"{name}.png")
        light, la = floor_light(spec, plate, clean, a)
        save_rgba(np.where(la[..., None] > 0, light / np.maximum(la, 1e-6)[..., None], 0), la, OUT / f"{name}-light.png")
        rep[name]["floor_light_px"] = int((la > 0.01).sum())
        comp = np.clip(env * (1 - a[..., None]) + F * a[..., None] + light, 0, 255)
        c = Image.fromarray(comp.astype(np.uint8)).crop(crop)
        al = Image.fromarray((a * 255).astype(np.uint8)).crop(crop).convert("RGB")
        sh = Image.new("RGB", (c.width, c.height * 2 + 6))
        sh.paste(c, (0, 0))
        sh.paste(al, (0, c.height + 6))
        sh.save(WORK / f"check-{name}.png")
    (WORK / "extract.json").write_text(json.dumps(rep, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
