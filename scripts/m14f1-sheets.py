"""M1.4F.1: evidence sheets and measurements (docs/m1.4f1/), from
scripts/visual/m14f1-capture.mjs (and its --before mode), the approved design
(reference/approved-lab-design.png), the approved plate, and the earlier
captures, all at the same 1648 x 928 viewport and camera:
    before   docs/m1.4f/work/captures/v2/          (/lab-v2 after M1.4F: generated Engineering and Educational)
    homepage docs/m1.4e1/work/captures/approved/   (the homepage, for the identity check)

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14f1-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4f1"
C = D / "work/captures"
BEFORE = ROOT / "docs/m1.4f/work/captures/v2"
BEFORE_CHK = ROOT / "docs/m1.4f/work/captures/checks.json"
HOME_E1 = ROOT / "docs/m1.4e1/work/captures/approved"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid
CHK = json.loads((C / "checks.json").read_text(encoding="utf-8"))
CAM = CHK["camera"]
assert CAM == json.loads(BEFORE_CHK.read_text(encoding="utf-8"))["camera"]
K = CAM["k"]
W, H = 1672, 941
LUM = np.array([0.299, 0.587, 0.114])
FIT = json.loads((ROOT / "docs/m1.4d/fit.json").read_text(encoding="utf-8"))["objects"]
RECTS = {"engineering": (235, 355, 400, 225), "educational": (635, 235, 390, 290)}
CLOSE = {"engineering": (250, 372, 365, 190), "educational": (655, 255, 350, 255)}


def im(p):
    return Image.open(p).convert("RGB")


def vp(r):
    x0, y0, w, h = r
    return (round(CAM["x"] + x0 * K), round(CAM["y"] + y0 * K), min(1648, round(CAM["x"] + (x0 + w) * K)), round(CAM["y"] + (y0 + h) * K))


def cmp(a, b, mask=None, blur=0):
    """Max-channel difference of two viewport captures: mean, pixels over 16, max."""
    def ld(p):
        i = Image.open(p).convert("RGB")
        if blur:
            from PIL import ImageFilter
            i = i.filter(ImageFilter.BoxBlur(blur))
        return np.asarray(i).astype(int)
    d = np.abs(ld(a) - ld(b)).max(2)
    d = d[mask] if mask is not None else d.ravel()
    return dict(px=int(d.size), mean=round(float(d.mean()), 3), px_over_16=int((d > 16).sum()), max=int(d.max()))


def box_mask(r, exclude=None):
    m = np.zeros((928, 1648), bool)
    x0, y0, x1, y1 = vp(r)
    m[y0:y1, x0:x1] = True
    if exclude:
        x0, y0, x1, y1 = vp(exclude)
        m[y0:y1, x0:x1] = False
    return m


def scene_mask(sm):
    """A scene-frame boolean mask in viewport pixels."""
    im_ = Image.fromarray((sm * 255).astype(np.uint8)).resize((round(W * K), round(H * K)), Image.NEAREST)
    big = Image.new("L", (1648, 928))
    big.paste(im_, (round(CAM["x"]), round(CAM["y"])))
    return np.asarray(big) > 127


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
    for name in ("engineering", "educational"):
        gen, new = placed(name), rgba(ROOT / f"public/scene/v2/m14f1/{name}.png")
        # The approved station: the plate itself under the recovered alpha (identical pixels by construction).
        appr = plate.copy()
        appr[..., 3] = new[..., 3]
        f = FIT[name]
        out[name] = {
            "base (approved, measured on the plate)": f["approved"],
            "base depth / width: approved vs generated": [f["base_depth_ratio"]["approved"], f["base_depth_ratio"]["asset"]],
            "station extent [x0, y0, x1, y1]: generated (before)": bbox(gen[..., 3]),
            "station extent [x0, y0, x1, y1]: recovered (after) = approved": bbox(new[..., 3]),
            "stone, generated (before)": stone(gen, name),
            "stone, recovered (after)": stone(new, name),
        }
    # The other stations' stone, for consistency (unchanged: generated v2 images; the hub is the approved one).
    hub = rgba(ROOT / "public/scene/v2/m14e/hub.png")
    out["other stations' stone"] = {"playground (generated, unchanged)": stone(placed("playground"), "playground"), "hub (approved, M1.4E)": stone(hub, "hub")}
    for n in ("creative", "experience"):
        out["other stations' stone"][f"{n} (approved, M1.4F)"] = stone(rgba(ROOT / f"public/scene/v2/m14f/{n}.png"), n)
    # Homepage identity: fresh capture against M1.4E.1's and M1.4F's (and the run-to-run noise).
    h0, h1 = np.asarray(im(HOME_E1 / "A-rest.png")).astype(int), np.asarray(im(C / "home/rest.png")).astype(int)
    d = np.abs(h0 - h1).max(2)
    out["homepage: now vs M1.4E.1 (whole frame)"] = dict(mean=round(float(d.mean()), 3), px_over_16=int((d > 16).sum()), max=int(d.max()))
    out["homepage: now vs M1.4F's capture (whole frame)"] = cmp(C / "home/rest.png", ROOT / "docs/m1.4f/work/captures/home/rest.png")
    out["homepage: run-to-run noise (two captures now, same code)"] = cmp(C / "home/rest.png", C / "home/rest-2.png")
    # Playground and its connection against M1.4F, from scripts/visual/m14f1-playground.mjs (dev badge
    # left visible: with it hidden Chrome sometimes re-rasterises the transformed Playground layer
    # slightly softer, pre-existing). Raw, and after a 2 px box blur, which removes raster sharpness
    # differences but keeps any shift, colour or missing-element change.
    station = box_mask((1000, 300, 460, 305), exclude=(1155, 368, 95, 58))  # the animated arcade screen excluded
    connection = box_mask((860, 515, 330, 85))  # the line, from the hub to the station (below Educational)
    P, F4 = C / "playground", ROOT / "docs/m1.4f/work/captures/v2"
    for label, now, then in (("at rest", P / "rest.png", F4 / "rest.png"), ("lifted", P / "lifted.png", F4 / "playground-lifted.png")):
        for part, m in (("station", station), ("connection", connection)):
            out[f"playground {part} {label}: M1.4F.1 vs M1.4F"] = dict(raw=cmp(now, then, m), blur2=cmp(now, then, m, blur=2))
    out["playground lift"] = json.loads((P / "lift.json").read_text(encoding="utf-8"))
    # Creative Studio and Experience (M1.4F) unchanged: their own pixels (alpha > 0.5), away from the new layers.
    newa = sum(rgba(ROOT / f"public/scene/v2/m14f1/{n}{s}.png")[..., 3] for n in ("engineering", "educational") for s in ("", "-light"))
    for n in ("creative", "experience"):
        a = rgba(ROOT / f"public/scene/v2/m14f/{n}.png")[..., 3]
        out[f"{n} at rest: M1.4F.1 vs M1.4F (its own pixels)"] = cmp(C / "v2/rest.png", F4 / "rest.png", scene_mask((a > 127) & (newa == 0)))
    (D / "work/measurements.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=1))


def main():
    ref = desktop(im(ROOT / "reference/approved-lab-design.png"))
    home = im(C / "home/rest.png")
    before, after = im(BEFORE / "rest.png"), im(C / "v2/rest.png")
    for name, label in (("engineering", "Engineering"), ("educational", "Educational")):
        r = vp(RECTS[name])
        grid(
            [
                ("Approved design (reference)  |  approved homepage (now)", [ref.crop(r), home.crop(r)]),
                ("Before: /lab-v2 M1.4F, generated station  |  After: /lab-v2 M1.4F.1, recovered approved artwork", [before.crop(r), after.crop(r)]),
            ],
            ["", ""],
            D / f"{name}-before-after.png",
            f"M1.4F.1: {label} at normal desktop size (1x, 1648 x 928 viewport, same camera)",
        )
        plate3 = Image.open(ROOT / "docs/m1.3k/package/01-source/lab-plate.png").convert("RGB")
        x0, y0, w, h = CLOSE[name]
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
            f"M1.4F.1: {label} at 3x (scene {x0}-{x0 + w} x {y0}-{y0 + h})",
        )
    after.save(D / "full-scene.png", optimize=True)
    grid(
        [("Approved design (reference/approved-lab-design.png, in the desktop framing)", [ref]), ("/lab-v2 after M1.4F.1", [after])],
        [""],
        D / "approved-vs-v2.png",
        "M1.4F.1: approved design vs updated /lab-v2 (1648 x 928)",
    )
    measurements()


if __name__ == "__main__":
    main()
