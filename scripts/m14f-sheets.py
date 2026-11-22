"""M1.4F: evidence sheets and measurements (docs/m1.4f/), from
scripts/visual/m14f-capture.mjs (and its --before mode), the approved design
(reference/approved-lab-design.png), the approved plate, and the earlier
captures, all at the same 1648 x 928 viewport and camera:
    before   docs/m1.4e3/work/captures/default/   (/lab-v2 with the generated stations)
    homepage docs/m1.4e1/work/captures/approved/   (the homepage, for the identity check)

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14f-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4f"
C = D / "work/captures"
BEFORE = ROOT / "docs/m1.4e3/work/captures/default"
HOME_E1 = ROOT / "docs/m1.4e1/work/captures/approved"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid
CHK = json.loads((C / "checks.json").read_text(encoding="utf-8"))
CAM = CHK["camera"]
assert CAM == json.loads((ROOT / "docs/m1.4e3/work/captures/checks.json").read_text(encoding="utf-8"))["default"]["camera"]
K = CAM["k"]
W, H = 1672, 941
LUM = np.array([0.299, 0.587, 0.114])
FIT = json.loads((ROOT / "docs/m1.4d/fit.json").read_text(encoding="utf-8"))["objects"]
RECTS = {"creative": (40, 480, 520, 330), "experience": (1150, 480, 521, 330)}


def im(p):
    return Image.open(p).convert("RGB")


def vp(r):
    x0, y0, w, h = r
    return (round(CAM["x"] + x0 * K), round(CAM["y"] + y0 * K), min(1648, round(CAM["x"] + (x0 + w) * K)), round(CAM["y"] + (y0 + h) * K))


def desktop(scene_img):
    """A scene-frame image (1672 x 941) as the desktop viewport shows it."""
    big = Image.new("RGB", (1648, 928))
    big.paste(scene_img.resize((round(W * K), round(H * K)), Image.LANCZOS), (round(CAM["x"]), round(CAM["y"])))
    return big


def placed(name):
    """A generated station image placed in the scene frame (M1.4D transform), RGBA float."""
    o = FIT[name]
    a = Image.open(ROOT / o["src"].lstrip("/").replace("scene/", "public/scene/", 1)).convert("RGBA")
    c = Image.new("RGBA", (W, H))
    c.paste(a.resize((round(W * o["scale"]), round(H * o["scale"])), Image.LANCZOS), (round(o["tx"]), round(o["ty"])))
    return np.asarray(c).astype(np.float64)


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def bbox(a):
    ys, xs = np.nonzero(a > 0.5 * 255)
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


def stone(layer, name, exclude=None):
    """Stone on the platform's side face: opaque pixels in the band 8-40 px above the approved base
    bottom, across the middle 65% of the base, strips and highlights excluded (lum < 190)."""
    o = FIT[name]["approved"]
    rgb, a = layer[..., :3], layer[..., 3]
    yy, xx = np.mgrid[0:H, 0:W]
    m = (a > 250) & (yy >= o["bottom"] - 40) & (yy <= o["bottom"] - 8) & (np.abs(xx - o["cx"]) <= 0.33 * o["base_w"])
    m &= rgb @ LUM < 190
    if exclude:
        m &= ~((xx >= exclude[0]) & (xx <= exclude[1]))
    px = rgb[m]
    lum = px @ LUM
    mean = px.mean(0)
    return dict(px=int(m.sum()), mean_rgb=[round(float(v), 1) for v in mean], luminance=round(float(lum.mean()), 1),
                contrast_std=round(float(lum.std()), 1), warmth_r_minus_b=round(float(mean[0] - mean[2]), 1),
                saturation=round(float((px.max(1) - px.min(1)).mean() / max(1, px.max(1).mean()) * 100), 1))


def measurements():
    out = {}
    plate = np.asarray(Image.open(ROOT / "docs/m1.3k/package/01-source/lab-plate.png").convert("RGBA")).astype(np.float64)
    for name, rec in (("creative", "creative"), ("experience", "experience")):
        gen, new = placed(name), rgba(ROOT / f"public/scene/v2/m14f/{rec}.png")
        # The approved station: the plate itself under the recovered alpha (identical pixels by construction).
        appr = plate.copy()
        appr[..., 3] = new[..., 3]
        f = FIT[name]
        out[name] = {
            "base (approved, measured on the plate)": f["approved"],
            "base depth / width: approved vs generated": [f["base_depth_ratio"]["approved"], f["base_depth_ratio"]["asset"]],
            "station extent [x0, y0, x1, y1]: generated (before)": bbox(gen[..., 3]),
            "station extent [x0, y0, x1, y1]: recovered (after) = approved": bbox(new[..., 3]),
            "stone, generated (before)": stone(gen, name, (230, 335) if name == "creative" else None),
            "stone, recovered (after)": stone(new, name, (230, 335) if name == "creative" else None),
        }
    # The other stations' stone, for consistency (unchanged: generated v2 images; the hub is the approved one).
    hub = rgba(ROOT / "public/scene/v2/m14e/hub.png")
    out["other stations' stone (unchanged)"] = {n: stone(placed(n), n) for n in ("educational", "engineering", "playground")}
    out["other stations' stone (unchanged)"]["hub (approved, M1.4E)"] = stone(hub, "hub")
    # Homepage identity: fresh capture against M1.4E.1's, and Playground against M1.4E.3.
    h0, h1 = np.asarray(im(HOME_E1 / "A-rest.png")).astype(int), np.asarray(im(C / "home/rest.png")).astype(int)
    d = np.abs(h0 - h1).max(2)
    out["homepage: now vs M1.4E.1 (whole frame)"] = dict(mean=round(float(d.mean()), 3), px_over_16=int((d > 16).sum()), max=int(d.max()))
    st = Image.open(ROOT / "docs/m1.4e2/work/station-alpha-rest.png")
    stl = Image.open(ROOT / "docs/m1.4e2/work/station-alpha-lifted.png")

    def pg(cap_now, cap_then, alpha_img):
        mask = Image.new("L", (1648, 928))
        mask.paste(alpha_img.resize((round(W * K), round(H * K)), Image.BILINEAR), (round(CAM["x"]), round(CAM["y"])))
        m = np.asarray(mask) > 10
        x0, y0, x1, y1 = vp((1155, 368, 95, 58))  # the animated arcade screen
        m[y0:y1, x0:x1] = False
        a, b = np.asarray(im(cap_now)).astype(int), np.asarray(im(cap_then)).astype(int)
        dd = np.abs(a - b).max(2)[m]
        return dict(px=int(m.sum()), mean=round(float(dd.mean()), 3), px_over_16=int((dd > 16).sum()), max=int(dd.max()))

    out["playground at rest: M1.4F vs M1.4E.3 (station silhouette, screen excluded)"] = pg(C / "v2/rest.png", BEFORE / "A-rest.png", st)
    out["playground lifted: M1.4F vs M1.4E.3"] = pg(C / "v2/playground-lifted.png", BEFORE / "G-lifted.png", stl)
    (D / "work/measurements.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=1))


def main():
    ref = desktop(im(ROOT / "reference/approved-lab-design.png"))
    home = im(C / "home/rest.png")
    before, after = im(BEFORE / "A-rest.png"), im(C / "v2/rest.png")
    for name, label in (("creative", "Creative Studio"), ("experience", "Experience")):
        r = vp(RECTS[name])
        grid(
            [
                ("Approved design (reference)  |  approved homepage (now)", [ref.crop(r), home.crop(r)]),
                ("Before: /lab-v2 M1.4E.3, generated station  |  After: /lab-v2 M1.4F, recovered approved artwork", [before.crop(r), after.crop(r)]),
            ],
            ["", ""],
            D / f"{name}-before-after.png",
            f"M1.4F: {label} at normal desktop size (1x, 1648 x 928 viewport, same camera)",
        )
        plate3 = Image.open(ROOT / "docs/m1.3k/package/01-source/lab-plate.png").convert("RGB")
        x0, y0, w, h = (90, 500, 430, 290) if name == "creative" else (1185, 500, 486, 300)
        b3, a3 = im(C / f"before/{name}-3x.png"), im(C / f"v2/{name}-3x.png")
        appr3 = plate3.crop((x0, y0, x0 + w, y0 + h)).resize(a3.size, Image.LANCZOS)
        grid(
            [
                ("Approved artwork (the plate, enlarged 3x for reference)", [appr3]),
                ("Before: generated station, /lab-v2 rendered at 3x", [b3]),
                ("After: recovered station on the v2 floor, /lab-v2 rendered at 3x", [a3]),
            ],
            [""],
            D / f"{name}-closeup-3x.png",
            f"M1.4F: {label} at 3x (scene {x0}-{x0 + w} x {y0}-{y0 + h})",
        )
    after.save(D / "full-scene.png", optimize=True)
    grid(
        [("Approved design (reference/approved-lab-design.png, in the desktop framing)", [ref]), ("/lab-v2 after M1.4F", [after])],
        [""],
        D / "approved-vs-v2.png",
        "M1.4F: approved design vs updated /lab-v2 (1648 x 928)",
    )
    measurements()


if __name__ == "__main__":
    main()
