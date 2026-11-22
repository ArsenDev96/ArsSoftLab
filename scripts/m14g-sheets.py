"""M1.4G: evidence sheets and measurements (docs/m1.4g/), from
scripts/visual/m14g-capture.mjs, the approved design and M1.4F.1's captures, all
at the same 1648 x 928 viewport and camera.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14g-sheets.py
"""

import importlib.util
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4g"
C = D / "work/captures"
F1 = ROOT / "docs/m1.4f1/work/captures"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid
CHK = json.loads((C / "checks.json").read_text(encoding="utf-8"))
CAM = CHK["camera"]
assert CAM == json.loads((F1 / "checks.json").read_text(encoding="utf-8"))["camera"]
K = CAM["k"]
W, H = 1672, 941
LUM = np.array([0.299, 0.587, 0.114])
AREAS = {
    "engineering": (230, 470, 430, 150),
    "educational": (640, 430, 400, 130),
    "playground": (1010, 460, 420, 160),
    "creative": (40, 670, 580, 200),
    "experience": (1040, 660, 631, 230),
}
LABEL = {"engineering": "Engineering", "educational": "Educational", "playground": "Playground", "creative": "Creative Studio", "experience": "Experience"}


def im(p):
    return Image.open(p).convert("RGB")


def vp(r):
    x0, y0, w, h = r
    return (round(CAM["x"] + x0 * K), round(CAM["y"] + y0 * K), min(1648, round(CAM["x"] + (x0 + w) * K)), round(CAM["y"] + (y0 + h) * K))


def desktop(scene_img):
    big = Image.new("RGB", (1648, 928))
    big.paste(scene_img.resize((round(W * K), round(H * K)), Image.LANCZOS), (round(CAM["x"]), round(CAM["y"])))
    return big


def scene_mask(sm):
    i = Image.fromarray((sm * 255).astype(np.uint8)).resize((round(W * K), round(H * K)), Image.NEAREST)
    big = Image.new("L", (1648, 928))
    big.paste(i, (round(CAM["x"]), round(CAM["y"])))
    return np.asarray(big) > 127


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def cmp(a, b, mask=None):
    d = np.abs(np.asarray(im(a)).astype(int) - np.asarray(im(b)).astype(int)).max(2)
    d = d[mask] if mask is not None else d.ravel()
    return dict(px=int(d.size), mean=round(float(d.mean()), 3), px_over_16=int((d > 16).sum()), max=int(d.max()))


def sheets():
    ref = desktop(im(ROOT / "reference/approved-lab-design.png"))
    before, after, tone = im(F1 / "v2/rest.png"), im(C / "after/rest.png"), im(C / "tone/rest.png")
    grid(
        [
            ("Approved design (reference)", [ref]),
            ("Before: /lab-v2 after M1.4F.1", [before]),
            ("After: M1.4G floor rings, reflections and contact shadows (default)", [after]),
            ("After, with the optional floor tone (/lab-v2?floor=approved)", [tone]),
        ],
        [""],
        D / "full-scene-before-after.png",
        "M1.4G: full scene, 1648 x 928, same camera",
    )
    for name, r in AREAS.items():
        box = vp(r)
        grid(
            [
                ("Approved design  |  before (M1.4F.1)", [ref.crop(box), before.crop(box)]),
                ("After (default)  |  after with the optional floor tone", [after.crop(box), tone.crop(box)]),
                ("3x: before (the M1.4G layers hidden)  |  after (default)", [im(C / f"before/{name}-3x.png"), im(C / f"after/{name}-3x.png")]),
            ],
            ["", ""],
            D / f"floor-{name}.png",
            f"M1.4G: {LABEL[name]}'s floor (ring, reflection, contact) at 1x and 3x",
        )
    P = C / "playground"
    pg = lambda f: im(P / f)
    grid(
        [
            ("At rest  |  energy arriving (lift 3 px)", [pg("rest.png"), pg("lift-760.png")]),
            ("Rising (11 px)  |  nearly up (17 px)", [pg("lift-875.png"), pg("lift-990.png")]),
            ("Fully lifted (18 px): before M1.4G  |  after", [pg("lifted-before.png"), pg("lift-2400.png")]),
            ("Fully lifted, shadows disabled  |  reduced motion, hovered (no lift)", [pg("lifted-no-shadows.png"), pg("reduced-motion-hover.png")]),
        ],
        ["", ""],
        D / "playground-lift.png",
        "M1.4G: Playground's ring (fixed), reflection (drops with the lift) and shadows through the lift",
    )
    # Reflections at normal desktop size and 3x, all five stations after M1.4G.
    rows = []
    for name in AREAS:
        rows.append((f"{LABEL[name]}: 1x  |  3x", [after.crop(vp(AREAS[name])), im(C / f"after/{name}-3x.png").resize((after.crop(vp(AREAS[name])).width * 2, round(after.crop(vp(AREAS[name])).width * 2 * im(C / f'after/{name}-3x.png').height / im(C / f'after/{name}-3x.png').width)))]))
    grid(rows, ["", ""], D / "reflections-1x-3x.png", "M1.4G: floor reflections and rings after M1.4G, 1x and 3x (default, no tone)")


def measurements():
    out = {}
    # The open floor's tone: approved (in the desktop framing), before, after, with the tone (stations, hub and
    # foreground excluded, scene y 560-900, x 120-1560).
    occ = np.zeros((H, W))
    for p in ["m14f/creative.png", "m14f/experience.png", "m14f1/engineering.png", "m14f1/educational.png", "m14e/hub.png", "m14e/fg-table.png", "m14e/fg-plant.png"]:
        occ = np.maximum(occ, rgba(ROOT / "public/scene/v2" / p)[..., 3] / 255)
    yy, xx = np.mgrid[0:H, 0:W]
    floor = (occ < 0.05) & (yy >= 560) & (yy <= 900) & (xx >= 120) & (xx <= 1560)
    m = scene_mask(floor)
    ref = desktop(im(ROOT / "reference/approved-lab-design.png"))
    tones = {}
    for label, img in (("approved", ref), ("before (M1.4F.1)", im(F1 / "v2/rest.png")), ("after (default)", im(C / "after/rest.png")), ("after with tone", im(C / "tone/rest.png"))):
        px = np.asarray(img).astype(np.float64)[m]
        lum = px @ LUM
        tones[label] = dict(mean_rgb=[round(float(v), 1) for v in px.mean(0)], luminance=round(float(lum.mean()), 1), median=round(float(np.median(lum)), 1), warmth_r_minus_b=round(float(px[:, 0].mean() - px[:, 2].mean()), 1))
    out["open floor tone"] = tones
    # The station artwork unchanged (their opaque pixels, floor layers under them): before vs after.
    st = np.zeros((H, W), bool)
    for p in ["m14f/creative.png", "m14f/experience.png", "m14f1/engineering.png", "m14f1/educational.png"]:
        st |= rgba(ROOT / "public/scene/v2" / p)[..., 3] > 250
    out["recovered stations' own pixels: after vs M1.4G layers hidden"] = cmp(C / "after/rest.png", C / "before/rest.png", scene_mask(st))
    # Connections: the floor layers' light along each route (the routes are drawn above them, unchanged).
    L = rgba(ROOT / "public/scene/v2/m14g/floor-light.png")
    light = (L[..., :3] * L[..., 3:] / 255).max(2)
    txt = (ROOT / "components/lab/charge-routes.ts").read_text(encoding="utf-8")
    routes = {k: v["route"] for k, v in json.loads(txt[txt.index("= {") + 2: txt.rindex("}") + 1]).items()}
    pgt = (ROOT / "components/lab/playground-route.ts").read_text(encoding="utf-8")
    routes["playground"] = json.loads(re.search(r"PLAYGROUND_ROUTE[^=]*= (\[\[.*?\]\]);", pgt).group(1))
    conn = {}
    for k, rt in routes.items():
        mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).line([tuple(p) for p in rt], fill=255, width=5)
        mm = np.asarray(mask) > 0
        v = light[mm]
        conn[k] = dict(route_px=int(mm.sum()), floor_light_over_8=int((v > 8).sum()), max=round(float(v.max()), 1))
    out["floor light under the connections (within 2.5 px of each route)"] = conn
    # Homepage identity.
    # (the Educational globe's orbit is animated: M1.4F.1's two captures differ from each other by ~320 px)
    out["homepage: now vs M1.4F.1's captures (first, second)"] = [cmp(C / "home/rest.png", F1 / "home/rest.png"), cmp(C / "home/rest.png", F1 / "home/rest-2.png")]
    out["homepage: run-to-run noise (two captures now)"] = cmp(C / "home/rest.png", C / "home/rest-2.png")
    out["files (bytes)"] = {p.name: p.stat().st_size for p in sorted((ROOT / "public/scene/v2/m14g").glob("*.png"))}
    out["playground lift"] = {k: v for k, v in CHK["playground"].items() if k != "errors"}
    out["frame time during Playground's lift"] = CHK["frame_time"]
    (D / "work/measurements.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    sheets()
    measurements()
