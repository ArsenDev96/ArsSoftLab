"""M1.4H.1: evidence sheets and measurements (docs/m1.4h1/), from
scripts/visual/m14h1-capture.mjs (same 1648 x 928 viewport and camera as M1.4G.1,
whose captures are the "before").

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14h1-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "docs/m1.4h1"
C = D / "work/captures"
G1 = ROOT / "docs/m1.4g1/work/captures/after"
spec = importlib.util.spec_from_file_location("m14a", ROOT / "scripts/m14a-preview.py")
m14a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m14a)
grid = m14a.grid
CHK = json.loads((C / "checks.json").read_text(encoding="utf-8"))
K, X = 0.9861786034688995, -0.4453125
W, H = 1672, 941
LUM = np.array([0.299, 0.587, 0.114])
ENG = (240, 370, 560, 300)  # the capture box (scene px)
ARRIVE = CHK["arrive_ms"]


def im(p):
    return Image.open(p).convert("RGB")


def arr(p):
    return np.asarray(im(p)).astype(np.float64)


def vp(x0, y0, x1, y1):
    return (round(X + x0 * K), round(y0 * K), round(X + x1 * K), round(y1 * K))


def scene_mask(path, size, box, scale):
    """A full-frame mask (alpha) resampled onto a capture of scene box `box` at `scale` x the camera."""
    m = Image.open(path).convert("RGBA").split()[3]
    x, y, w, h = box
    return np.asarray(m.crop((x, y, x + w, y + h)).resize(size, Image.BILINEAR)).astype(np.float64) / 255


def fit(img, w):
    return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)


def line(st):
    return (f"strips {st['strip_pw']}, scan {st['scan']}, bars {st['bars'][0]}..{st['bars'][-1]}, glass {st['chart_glass']}, "
            f"display standby {st['screen_standby']}, drawn as {st.get('drawn')}")


def sheets():
    P = CHK["phases"]
    rows = [
        ("At rest: strips unpowered, display in standby, chart faint", "rest", "Spark approaching (400 ms after hover, 220 ms before arrival): nothing on the station yet", "spark-approaching"),
        (f"Energy arrival (+45 ms): the plinth's strip lights from the connection, the pulse on its front", "energy-arrival", "Laptop scan (+260 ms): the line at 40% of the display, the front strip half lit, the first bars rising", "laptop-scan"),
        ("Chart activation (+380 ms): the scan near the bottom, the bars rising in turn", "chart-activation", "Stable (+1400 ms): the approved Engineering, powered", "stable"),
        ("Returning (220 ms after leaving): strips drained, bars sinking, display dimming", "returning-220ms", "Back at rest", "returned"),
    ]
    out = []
    for la, a, lb, b in rows:
        ia = fit(im(C / f"phase-{a}-3x.png"), 1000) if (C / f"phase-{a}-3x.png").exists() else fit(im(C / f"phase-{a}.png"), 1000)
        ib = fit(im(C / f"phase-{b}-3x.png"), 1000) if (C / f"phase-{b}-3x.png").exists() else fit(im(C / f"phase-{b}.png"), 1000)
        out.append((f"{la}   |   {lb}", [ia, ib]))
    grid(out, ["", ""], D / "engineering-phases.png", "M1.4H.1: Engineering's activation, real browser, seeked (times after the energy's arrival at 620 ms; 3x)")

    steps = [("rest", "At rest (standby)"), ("140", "+140 ms: the scan starts at the top"), ("200", "+200 ms"), ("260", "+260 ms"),
             ("320", "+320 ms"), ("380", "+380 ms"), ("440", "+440 ms: the scan leaves at the bottom"), ("700", "+700 ms: stable")]
    rows = [(f"{a}   |   {b}", [im(C / f"screen-{x}.png"), im(C / f"screen-{y}.png")]) for (x, a), (y, b) in zip(steps[::2], steps[1::2])]
    rows.insert(0, ("Measured display quad (red) and the bars (yellow) on the artwork, 6x", [fit(im(D / "work/geometry-6x.png"), 647 * 2 + 6)]))
    grid(rows[:1], [""], D / "work/_geom.png", "")
    grid(rows[1:], ["", ""], D / "work/_screen.png", "")
    a, b = im(D / "work/_geom.png"), im(D / "work/_screen.png")
    grid([("Measured display quad (red) and the bars (yellow) on the artwork, 6x", [fit(im(D / "work/geometry-6x.png"), b.width - 12)])]
         + [(r[0], [Image.fromarray(np.hstack([np.asarray(r[1][0]), np.full((r[1][0].height, 6, 3), 18, np.uint8), np.asarray(r[1][1])]))]) for r in rows[1:]],
         [""], D / "engineering-screen-closeup.png", "M1.4H.1: the laptop's display at 4x, real browser (times after the energy's arrival)")
    for p in (D / "work/_geom.png", D / "work/_screen.png"):
        p.unlink()

    steps = [("rest", "At rest (faint)"), ("200", "+200 ms: bar 1 rising"), ("260", "+260 ms"), ("320", "+320 ms"),
             ("380", "+380 ms"), ("440", "+440 ms: the panel's bars"), ("520", "+520 ms: the last bar, the glass up"), ("700", "+700 ms: stable")]
    rows = [(f"{a}   |   {b}", [im(C / f"chart-{x}.png"), im(C / f"chart-{y}.png")]) for (x, a), (y, b) in zip(steps[::2], steps[1::2])]
    grid(rows, ["", ""], D / "engineering-chart-closeup.png", "M1.4H.1: the holographic chart at 4x, real browser (bars 1-7 on the display, 8-11 in the panel)")

    im(C / "scene-powered.png").save(D / "full-scene-powered.png", optimize=True)


def measure():
    out = {"timing (ms after the energy's arrival; arrival = 620 ms after hover)": {
        "strip: plinth wrap / front strip (existing PLATFORM_POWER fronts)": "6-77 / 159-340",
        "strip pulse": "rides each front (visible while it moves)",
        "floor (ring, spill, reflections)": "0-110 right, 107-475 left (under the strip's front)",
        "screen scan": "90-470 (380 ms)",
        "chart bars 1-11": "180 + 24 k, 150 ms each: 180-570",
        "chart glass": "180-480 (outside the bars)",
        "stable": "570",
        "shimmer": "from 900, every 5.2 s",
    }}
    out["phases"] = {k: line(v) for k, v in CHK["phases"].items()}

    # The stable state against the approved artwork: forced powered (pointer away) vs M1.4G.1's scene.
    a, b = arr(C / "scene-forced-powered.png"), arr(G1 / "scene-default.png")
    d = np.abs(a - b).max(2)
    out["stable (forced powered, pointer away) vs M1.4G.1 scene (max-channel)"] = dict(mean=round(float(d.mean()), 4), px_over_8=int((d > 8).sum()), px_over_16=int((d > 16).sum()), max=int(d.max()))

    # Rest: changed only on Engineering (station and its floor share), against M1.4G.1.
    r = arr(C / "scene-rest.png")
    d = np.abs(r - b).max(2)
    x0, y0, x1, y1 = vp(228, 372, 642, 674)
    inside = np.zeros_like(d, bool)
    inside[y0:y1, x0:x1] = True
    out["rest vs M1.4G.1 scene: px over 8 inside / outside Engineering's box"] = [int((d[inside] > 8).sum()), int((d[~inside] > 8).sum())]
    ys, xs = np.nonzero((d > 8) & inside)
    out["rest vs M1.4G.1: changed bbox (viewport px)"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None

    # Powered vs rest: everything that changes lies in Engineering's box.
    d = np.abs(a - r).max(2)
    out["forced powered vs rest: px over 8 inside / outside Engineering's box"] = [int((d[inside] > 8).sum()), int((d[~inside] > 8).sum())]

    # The scan line's confinement: the same paused moment with and without it (2x captures of the ENG box).
    conf = {}
    for s in (200, 320, 440):
        p, q = arr(C / f"scan-{s}.png"), arr(C / f"scan-{s}-noband.png")
        dd = np.abs(p - q).max(2)
        m = scene_mask(ROOT / "public/scene/v2/m14h1/engineering-screen-mask.png", (p.shape[1], p.shape[0]), ENG, 2)
        ch = dd > 4
        conf[f"+{s} ms"] = dict(changed_px=int(ch.sum()), outside_display=int((ch & (m < 0.02)).sum()), max_gain=int(dd.max()))
    out["scan line: pixels it changes, and how many lie outside the display mask (2x)"] = conf

    # Visible at normal desktop size (1x): the display, the chart, the strip, rest vs powered.
    areas = {"display": (350, 393, 484, 472), "chart panel": (490, 410, 540, 470), "front strip": (360, 528, 470, 540), "floor under the strip": (330, 548, 490, 575)}
    vis = {}
    for n, rr in areas.items():
        x0, y0, x1, y1 = vp(*rr)
        lr, lp = (r[y0:y1, x0:x1] @ LUM).mean(), (a[y0:y1, x0:x1] @ LUM).mean()
        vis[n] = dict(rest=round(float(lr), 1), powered=round(float(lp), 1), ratio=round(float(lp / max(lr, 1)), 2))
    # The scan line at 1x: its row against the rows just below it on the display (laptop-scan phase).
    ph = arr(C / "phase-laptop-scan.png")
    x0, y0, x1, y1 = [round(v * K) for v in (360 - ENG[0], 393 - ENG[1], 470 - ENG[0], 472 - ENG[1])]
    rows = (ph[y0:y1, x0:x1] @ LUM).mean(1)
    k = int(np.argmax(rows))
    vis["scan line at 1x (row mean luminance: line, 3 rows below)"] = [round(float(rows[k]), 1), round(float(rows[min(k + 3, len(rows) - 1)]), 1)]
    out["visibility at 1x (mean luminance)"] = vis

    # Playground: unchanged against M1.4G.1's captures (same crops).
    pg = {}
    for f in ("pg-rest.png", "pg-rest-3x.png", "pg-lifted.png", "pg-lifted-3x.png"):
        dd = np.abs(arr(C / f) - arr(G1 / f)).max(2)
        pg[f] = dict(mean=round(float(dd.mean()), 3), px_over_16=int((dd > 16).sum()), max=int(dd.max()))
    out["Playground vs M1.4G.1 (same crops)"] = pg
    out["Playground states"] = {k: v for k, v in CHK["playground"].items() if k != "errors"}
    out["checks"] = dict(
        switching={k: line(v) for k, v in CHK["switching"].items() if k != "errors"},
        keyboard=dict(tab=CHK["keyboard"]["tab"], **{k: line(CHK["keyboard"][k]) + (f", url {CHK['keyboard'][k].get('url')}" if "url" in CHK["keyboard"][k] else "")
                                                      for k in ("focused", "selected", "escaped", "blurred", "clicked_while_charging")}),
        deep_link=line(CHK["deep_link"]) + f", url {CHK['deep_link']['url']}",
        reduced_motion={k: line(v) for k, v in CHK["reduced_motion"].items() if k != "errors"},
        homepage=CHK["homepage"],
        errors=[CHK["phase_errors"], CHK["switching"]["errors"], CHK["keyboard"]["errors"], CHK["deep_link"]["errors"], CHK["reduced_motion"]["errors"], CHK["playground"]["errors"], CHK["forced_powered"]["errors"]],
    )
    (D / "work/measurements.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in out.items() if k not in ("phases", "checks")}, indent=1))


if __name__ == "__main__":
    sheets()
    measure()
