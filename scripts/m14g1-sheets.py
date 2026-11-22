"""M1.4G.1: evidence sheets and measurements (docs/m1.4g1/), from
scripts/visual/m14g1-capture.mjs before (M1.4G) and after (M1.4G.1), same
1648 x 928 viewport and camera.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14g1-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4g1"
C = D / "work/captures"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid
B, A = json.loads((C / "before/before.json").read_text(encoding="utf-8")), json.loads((C / "after/after.json").read_text(encoding="utf-8"))
K, X = 0.9861786034688995, -0.4453125
W, H = 1672, 941
LUM = np.array([0.299, 0.587, 0.114])
STATES = ["rest", "charging", "powered", "lifted", "returning-150ms", "returning-300ms", "returned"]
NAMES = {"rest": "At rest", "charging": "Charging (spark travelling)", "powered": "Energy arrived (strips coming up)", "lifted": "Fully powered and lifted",
         "returning-150ms": "Returning (150 ms)", "returning-300ms": "Returning (300 ms)", "returned": "Back at rest"}


def im(p):
    return Image.open(p).convert("RGB")


def vp(x0, y0, x1, y1):
    return (round(X + x0 * K), round(y0 * K), round(X + x1 * K), round(y1 * K))


def state_line(s):
    return f"lift {s['lift_px']} px, strip off {s['strip_off']}, strip reflection {s['strip_reflection_lit']}, ring {s['ring_lit']}"


def sheets():
    rows = [(f"{NAMES[st]}  |  before: {state_line(B['playground'][st])}  |  after: {state_line(A['playground'][st])}",
             [im(C / f"before/pg-{st}-3x.png"), im(C / f"after/pg-{st}-3x.png")]) for st in STATES]
    grid(rows, ["Before (M1.4G)", "After (M1.4G.1)"], D / "playground-floor-states-3x.png",
         "M1.4G.1: Playground's floor through its power and lift, 3x (left M1.4G, right M1.4G.1)")
    rows = [(NAMES[st], [im(C / f"before/pg-{st}.png"), im(C / f"after/pg-{st}.png")]) for st in ("rest", "powered", "lifted", "returning-150ms")]
    grid(rows, ["Before (M1.4G)", "After (M1.4G.1)"], D / "playground-before-after-1x.png", "M1.4G.1: Playground at normal desktop size")
    grid([("Creative Studio's strip end, 3x", [im(C / "before/creative-3x.png"), im(C / "after/creative-3x.png")])],
         ["Before (M1.4G)", "After (M1.4G.1)"], D / "creative-before-after-3x.png", "M1.4G.1: Creative Studio's colour artifact")
    im(C / "after/scene-default.png").save(D / "full-scene-default.png", optimize=True)
    im(C / "after/scene-tone.png").save(D / "full-scene-tone.png", optimize=True)
    grid([("Default (no tone)", [im(C / "after/scene-default.png")]), ("?floor=approved (optional tone)", [im(C / "after/scene-tone.png")])],
         [""], D / "floor-tone-comparison.png", "M1.4G.1: both floor options, same viewport and moment (pointer away, animations settled)")


def measure():
    out = {"playground states": {st: dict(before=B["playground"][st], after=A["playground"][st]) for st in STATES}}
    # Power sync: every power-following opacity must equal 1 - the unpowered-strip overlay's.
    out["power sync (after): max |strip reflection - (1 - strip off)|, max |ring - (1 - strip off)|"] = [
        max(abs(A["playground"][st]["strip_reflection_lit"] - (1 - A["playground"][st]["strip_off"])) for st in STATES),
        max(abs(A["playground"][st]["ring_lit"] - (1 - A["playground"][st]["strip_off"])) for st in STATES)]
    out["timing unchanged: lift and strip at every state, before vs after"] = all(
        B["playground"][st]["lift_px"] == A["playground"][st]["lift_px"] and B["playground"][st]["strip_off"] == A["playground"][st]["strip_off"] for st in STATES)

    # The floor under Playground's strip (scene 1120-1320 x 548-640) at rest and lifted: luminance, warmth.
    def floor(cap):  # the pg-*.png crops start at scene (1000, 330), at the camera's scale
        x0, y0, x1, y1 = [round(v * K) for v in (1120 - 1000, 548 - 330, 1320 - 1000, 640 - 330)]
        a = np.asarray(im(cap)).astype(np.float64)[y0:y1, x0:x1].reshape(-1, 3)
        return dict(luminance=round(float((a @ LUM).mean()), 1), warmth_r_minus_b=round(float(a[:, 0].mean() - a[:, 2].mean()), 1))
    out["floor under Playground's strip"] = {f"{lab} {st}": floor(C / f"{lab}/pg-{st}.png") for lab in ("before", "after") for st in ("rest", "lifted")}

    # Light layers: bluish pixels (blue above red by more than 8) near Creative's strip end, scene 440-560 x 700-800.
    def bluish(p):
        a = np.asarray(Image.open(ROOT / p).convert("RGBA")).astype(np.float64)
        l = a[..., :3] * a[..., 3:] / 255
        s = l[700:800, 440:560]
        return dict(px=int(((s[..., 2] - s[..., 0]) > 8).sum()), max_blue_minus_red=round(float((s[..., 2] - s[..., 0]).max()), 1))
    out["bluish light near Creative's strip end"] = {p: bluish(p) for p in ["public/scene/v2/m14g/floor-light.png", "public/scene/v2/m14g1/floor-light.png",
                                                                           "public/scene/v2/m14f/creative-light.png", "public/scene/v2/m14g1/creative-light.png"]}

    # Elsewhere: how much the scene changed at rest, per station area (floor-light's combine is now hue-preserving).
    areas = {"engineering": (230, 470, 660, 620), "educational": (640, 430, 1040, 560), "creative": (40, 670, 620, 870), "experience": (1040, 660, 1671, 890), "hub": (630, 560, 1050, 720)}
    bd, ad = np.asarray(im(C / "before/scene-default.png")).astype(int), np.asarray(im(C / "after/scene-default.png")).astype(int)
    out["scene at rest, before vs after, per area (max-channel)"] = {}
    for n, r in areas.items():
        x0, y0, x1, y1 = vp(*r)
        d = np.abs(bd[y0:y1, x0:x1] - ad[y0:y1, x0:x1]).max(2)
        out["scene at rest, before vs after, per area (max-channel)"][n] = dict(mean=round(float(d.mean()), 3), px_over_16=int((d > 16).sum()), max=int(d.max()))
    # The tone: open floor (scene 120-1560 x 560-900) in both options.
    def tone(cap):
        x0, y0, x1, y1 = vp(120, 560, 1560, 900)
        a = np.asarray(im(cap)).astype(np.float64)[y0:y1, x0:x1].reshape(-1, 3)
        return dict(luminance=round(float((a @ LUM).mean()), 1), warmth_r_minus_b=round(float(a[:, 0].mean() - a[:, 2].mean()), 1))
    out["floor options (open floor incl. stations' floor light)"] = {"default": tone(C / "after/scene-default.png"), "?floor=approved": tone(C / "after/scene-tone.png")}
    out["checks (after)"] = dict(keyboard=A["keyboard"], reduced_motion=A["reduced_motion"], homepage=A["homepage"],
                                 errors=[A["errors_scene-default.png"], A["errors_scene-tone.png"], A["playground_errors"]])
    (D / "work/measurements.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in out.items() if k not in ("playground states", "checks (after)")}, indent=1))


if __name__ == "__main__":
    sheets()
    measure()
