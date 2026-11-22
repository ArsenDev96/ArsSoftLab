"""M1.4E.2: evidence sheets and pixel checks (docs/m1.4e2/) from
scripts/visual/m14e2-capture.mjs, at the same 1648 x 928 viewport and camera as
M1.4E.1 (whose captures, docs/m1.4e1/work/captures/v2/, are the true "before").

    A   the M1.4E.1 endpoint (before; at 3x: the live page with the endpoint layer hidden)
    B   small embedded floor contact, 18 px past the line's end
    B2  the same contact set just under the lifted base's edge (t = 40)
    C   the line continued under the station (chosen)

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14e2-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4e2"
C = D / "work/captures"
BEFORE = ROOT / "docs/m1.4e1/work/captures/v2"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid
CHK = json.loads((C / "checks.json").read_text(encoding="utf-8"))
CAM = CHK["default"]["camera"]
CAM_BEFORE = json.loads((ROOT / "docs/m1.4e1/work/captures/checks.json").read_text(encoding="utf-8"))["v2"]["camera"]
assert CAM == CAM_BEFORE, (CAM, CAM_BEFORE)
REGION = (940, 380, 380, 200)
LUM = np.array([0.299, 0.587, 0.114])


def im(p):
    return Image.open(p).convert("RGB")


def up(i, k):
    return i.resize((round(i.width * k), round(i.height * k)), Image.LANCZOS)


def vp(r):
    x0, y0, w, h = r
    k = CAM["k"]
    return (round(CAM["x"] + x0 * k), round(CAM["y"] + y0 * k), round(CAM["x"] + (x0 + w) * k), round(CAM["y"] + (y0 + h) * k))


def L(p):
    return np.asarray(im(p)).astype(float) @ LUM


def scene_mask(path, thr=0.5):
    """A scene-frame alpha (1672 x 941) resampled to the viewport capture's pixel grid."""
    a = Image.open(path)
    k = CAM["k"]
    W, H = 1648, 928
    big = Image.new("L", (W, H))
    big.paste(a.resize((round(1672 * k), round(941 * k)), Image.BILINEAR), (round(CAM["x"]), round(CAM["y"])))
    return np.asarray(big) / 255 > thr


def erode(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out &= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def checks():
    g = json.loads((D / "work/geometry.json").read_text(encoding="utf-8"))
    rest = scene_mask(D / "work/station-alpha-rest.png")
    lifted = scene_mask(D / "work/station-alpha-lifted.png")
    k = CAM["k"]
    H, W = rest.shape
    yy, xx = np.mgrid[0:H, 0:W]
    sx, sy = (xx - CAM["x"]) / k, (yy - CAM["y"]) / k
    # The line (and the extension) as a band, in scene px.
    E = np.array(g["line_end_E"])
    d = np.array(g["line_direction_at_E"])
    rel_x, rel_y = sx - E[0], sy - E[1]
    t = rel_x * d[0] + rel_y * d[1]
    n = np.abs(-rel_x * d[1] + rel_y * d[0])
    # The floor the lift uncovers: under the station at rest, not under it lifted.
    band = rest & ~lifted & (sx > 1075) & (sx < 1360)
    floor = band & ~((n < 7) & (t > -5) & (t < 64))
    out = {}
    Lg, Lh = L(C / "default/G-lifted.png"), L(C / "default/H-lifted-no-shadow.png")
    hp = lambda a: a - (np.roll(a, 2, 0) + np.roll(a, -2, 0) + np.roll(a, 2, 1) + np.roll(a, -2, 1)) / 4
    out["uncovered_floor_px"] = int(floor.sum())
    out["uncovered_floor_luminance_ratio_with_vs_without_shadow"] = round(float(Lg[floor].mean() / Lh[floor].mean()), 3)
    out["uncovered_floor_texture_ratio_with_vs_without_shadow"] = round(float(hp(Lg)[floor].std() / hp(Lh)[floor].std()), 3)
    out["uncovered_floor_darkest_1pct_luminance"] = round(float(np.percentile(Lg[floor], 1)), 1)
    out["uncovered_floor_darkest_1pct_luminance_no_shadow"] = round(float(np.percentile(Lh[floor], 1)), 1)
    # The line through the gap: its brightest pixel per step along it, with and without the shadow.
    core = (n < 1.2)
    prof = []
    for t0 in range(2, 52, 4):
        m = core & (t >= t0) & (t < t0 + 4) & ~lifted
        if m.any():
            prof.append((t0, round(float(Lg[m].max()), 1), round(float(Lh[m].max()), 1)))
    out["line_core_peak_luminance_through_gap_t_with_without_shadow"] = prof
    out["line_visible_to_t"] = max((p[0] + 4 for p in prof if p[1] > 150), default=0)
    # The endpoint layer never lands on the stone: chosen vs none, inside the station's silhouette (eroded 1 px).
    for phase, mask in (("A-rest", rest), ("G-lifted", lifted)):
        a, b = L(C / f"default/{phase}.png"), L(C / f"none/{phase}.png")
        inside = erode(mask, 1)
        out[f"stone_face_max_abs_diff_{phase}"] = round(float(np.abs(a - b)[inside].max()), 2)
        out[f"outside_station_max_abs_diff_{phase}"] = round(float(np.abs(a - b)[~mask].max()), 2)
    # B (contact): how dark the recess gets against the same floor without it (no shadow).
    a, b = L(C / "contact/H-lifted-no-shadow.png"), L(C / "none/H-lifted-no-shadow.png")
    var = json.loads((C / "variants-contact-contact-deep-extension.json").read_text(encoding="utf-8"))
    x0, y0, w, h = var["contact"]["lifted"]["contact_rect"]
    m = (sx >= x0 - 1) & (sx <= x0 + w + 1) & (sy >= y0 - 1) & (sy <= y0 + h + 1)
    out["contact_B_rect_scene"] = [x0, y0, w, h]
    out["contact_B_darkest_ratio_vs_floor"] = round(float((a[m] / np.maximum(b[m], 1)).min()), 3)
    out["contact_B_peak_luminance"] = round(float(a[m].max()), 1)
    out["fixed_while_lifting"] = CHK["default"]["fixed_while_lifting"]
    (D / "work/gap-checks.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=1))


def main():
    reg = vp(REGION)
    # 1x: rest, arriving, lifted, returning.
    ph = [("A-rest", "A-rest"), ("C-spark-arriving", "C-spark-arriving"), ("G-lifted", "D-lifted"), ("I-returning", "F-returning")]
    rows = [("A  M1.4E.1 (before): the line ends at the base's ground contact", [im(BEFORE / f"{b}.png").crop(reg) for _, b in ph])]
    for v, lab in (("contact", "B  small embedded floor contact (18 px past the end)"), ("contact-deep", "B2 the contact just under the lifted base's edge"), ("default", "C  the line continued under the station (chosen)")):
        rows.append((lab, [im(C / f"{v}/{p}.png").crop(reg) for p, _ in ph]))
    grid(rows, ["at rest", "spark arriving (612 ms)", "fully lifted", "returning (half way down)"], D / "endpoint-before-after-1x.png",
         "M1.4E.2: Playground's connection endpoint at normal desktop size (1x desktop px, same camera)")
    # 3x: rising, lifted, lifted without shadows, returning.
    ph3 = ["E-rising", "G-lifted", "H-lifted-no-shadow", "I-returning"]
    rows = []
    for v, lab in (("none", "A  before (endpoint layer hidden)"), ("contact", "B  floor contact"), ("contact-deep", "B2 contact under the base's edge"), ("default", "C  line continued under the station (chosen)")):
        rows.append((lab, [im(C / f"{v}/{p}-3x.png") for p in ph3]))
    grid(rows, ["rising (850 ms, 9.6 px up)", "fully lifted (18 px)", "fully lifted, shadows off", "returning (half way down)"], D / "endpoint-closeup-3x.png",
         "M1.4E.2: the endpoint at 3x (scene 1040-1200 x 492-556)")
    # Playground lifted: the whole scene, then before / after at 2x.
    full = im(C / "default/G-lifted.png")
    pair = [up(im(BEFORE / "D-lifted.png").crop(reg), 2), up(im(C / "default/G-lifted.png").crop(reg), 2)]
    from PIL import ImageDraw

    f, fb = m14a.pa.font(15), m14a.pa.font(18)
    gap = 8
    Wd = max(full.width, pair[0].width * 2 + gap) + 2 * gap
    Hd = 34 + full.height + 30 + pair[0].height + 26 + gap
    out = Image.new("RGB", (Wd, Hd), (18, 18, 22))
    dr = ImageDraw.Draw(out)
    dr.text((gap, 8), "M1.4E.2: Playground fully lifted in /lab-v2 (1x, 1648 x 928); below, 2x: M1.4E.1 before | M1.4E.2", fill=(255, 255, 255), font=fb)
    out.paste(full, (gap, 34))
    y = 34 + full.height + 8
    dr.text((gap, y), "M1.4E.1: the line stops on open floor", fill=(240, 200, 120), font=f)
    dr.text((gap * 2 + pair[0].width, y), "M1.4E.2: the line runs on under the lifted station", fill=(240, 200, 120), font=f)
    out.paste(pair[0], (gap, y + 22))
    out.paste(pair[1], (gap * 2 + pair[0].width, y + 22))
    out.save(D / "playground-lifted.png", optimize=True)
    checks()


if __name__ == "__main__":
    main()
