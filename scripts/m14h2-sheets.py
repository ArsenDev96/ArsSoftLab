"""M1.4H.2: evidence sheets and measurements from scripts/visual/m14h2-capture.mjs
(run it with `before` on the previous commit, then without). Writes
docs/m1.4h2/{educational-phases,educational-orbit-closeup,full-scene-powered}.png
and docs/m1.4h2/work/measurements.json.

    python scripts/m14h2-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "docs/m1.4h2"
WORK = DOC / "work"
B, A = WORK / "captures/before", WORK / "captures/after"
V2 = ROOT / "public/scene/v2"
K = 928 / 941  # the camera's scale at 1648 x 928
X0 = (1648 - 1672 * K) / 2
EDU = (620, 250, 440, 330)  # capture box, scene px

_s = importlib.util.spec_from_file_location("m14h2", ROOT / "scripts/m14h2-educational.py")
m14h2 = importlib.util.module_from_spec(_s)
_s.loader.exec_module(m14h2)

try:
    FONT = ImageFont.truetype("segoeui.ttf", 22)
    SMALL = ImageFont.truetype("segoeui.ttf", 16)
except OSError:
    FONT = SMALL = ImageFont.load_default()


def img(p):
    return Image.open(p).convert("RGB")


def arr(p):
    return np.asarray(img(p)).astype(np.float64)


def sheet(cells, cols, w, out, title):
    """cells: (image, caption). One width, captions above."""
    cells = [(i.resize((w, round(w * i.height / i.width)), Image.LANCZOS), c) for i, c in cells]
    h = max(i.height for i, _ in cells)
    rows = (len(cells) + cols - 1) // cols
    pad, cap = 10, 34
    o = Image.new("RGB", (cols * (w + pad) + pad, 56 + rows * (h + cap + pad)), (14, 16, 20))
    d = ImageDraw.Draw(o)
    d.text((pad, 14), title, font=FONT, fill=(235, 235, 235))
    for k, (i, c) in enumerate(cells):
        x, y = pad + (k % cols) * (w + pad), 56 + (k // cols) * (h + cap + pad)
        d.text((x, y + 5), c, font=SMALL, fill=(200, 205, 212))
        o.paste(i, (x, y + cap))
    o.save(out, optimize=True)
    return o.size


def vmask(scene_mask, shape=(928, 1648)):
    """A scene-px mask (H x W) sampled at the viewport's pixels."""
    ys, xs = np.mgrid[0 : shape[0], 0 : shape[1]]
    sx = np.clip(np.round((xs + 0.5 - X0) / K - 0.5).astype(int), 0, 1671)
    sy = np.clip(np.round((ys + 0.5) / K - 0.5).astype(int), 0, 940)
    return scene_mask[sy, sx]


def cmask(scene_mask, shape, scale, box=EDU):
    """The same, at the pixels of a clip capture of `box`."""
    ys, xs = np.mgrid[0 : shape[0], 0 : shape[1]]
    sx = np.round(box[0] + (xs + 0.5) / (K * scale) - 0.5).astype(int)
    sy = np.round(box[1] + (ys + 0.5) / (K * scale) - 0.5).astype(int)
    return scene_mask[np.clip(sy, 0, 940), np.clip(sx, 0, 1671)]


def compare(p, q, mask=None):
    d = np.abs(arr(p) - arr(q)).max(2)
    if mask is not None:
        d = d[mask]
    return dict(max=int(d.max()), px_over_2=int((d > 2).sum()), px_over_8=int((d > 8).sum()), px=int(d.size))


def main():
    m = {}
    checks = json.loads((A / "checks.json").read_text(encoding="utf-8"))

    # --- sheets
    names = [
        ("rest", "At rest: standby"),
        ("spark-approaching", "Spark approaching (-120 ms): nothing has changed"),
        ("energy-arrival", "+80 ms: the strip lights from the arrival point"),
        ("base-pulse", "+135 ms: the pool at the globe's foot pulses"),
        ("globe-awakening", "+250 ms: the wave climbs the great bubble"),
        ("orbit-front", "+330 ms: light over the island's front; wave on the dome"),
        ("orbit-back", "+400 ms: behind, towards the dome"),
        ("orbit-left", "+560 ms: out at the left"),
        ("settling", "+700 ms: the tail leaves the ring"),
        ("stable", "+1400 ms: stable, the approved artwork"),
        ("returning-220ms", "Leaving, 220 ms: draining"),
        ("returned", "Back at rest"),
    ]
    crop = lambda i: i.crop((0, 0, i.width, round(i.height * 0.80)))
    m["educational-phases.png"] = sheet([(crop(img(A / f"phase-{n}-3x.png")), c) for n, c in names], 3, 860, DOC / "educational-phases.png", "M1.4H.2  Educational activation, times after the energy's arrival (460 ms after hover)")
    one = [(img(A / f"phase-{n}.png"), c) for n, c in names[:10]]
    sheet(one, 5, one[0][0].width, WORK / "educational-phases-1x.png", "M1.4H.2  the same at normal desktop size (1648 x 928)")
    steps = [("rest", "At rest")] + [(s, f"+{s} ms") for s in (260, 300, 340, 380, 420, 470, 520, 550, 580, 620, 820)]
    geo = img(WORK / "geometry-4x.png")
    cells = [(geo.crop((0, 0, geo.width, 998)), "The traced ring (green visible, violet hidden) and the fitted bubbles")]
    cells += [(img(A / f"orbit-{s}.png"), c) for s, c in steps]
    cells = [(i.crop((0, 0, i.width, round(i.width * 0.60))), c) for i, c in cells]
    m["educational-orbit-closeup.png"] = sheet(cells, 2, 1180, DOC / "educational-orbit-closeup.png", "M1.4H.2  the light round the ring, 4x captures")
    img(A / "scene-powered.png").save(DOC / "full-scene-powered.png", optimize=True)

    # --- the stable state against the approved scene (before this milestone Educational was always lit).
    m["stable vs approved (whole scene)"] = compare(B / "scene-rest.png", A / "scene-forced-powered.png")
    m["the swap: layers at their end values vs the station image"] = compare(A / "scene-forced-layers.png", A / "scene-forced-powered.png")
    yy, xx = np.mgrid[0:941, 0:1672]
    box = (xx >= 640) & (xx < 1030) & (yy >= 256) & (yy < 584)
    vb = vmask(box)
    m["rest vs approved, outside Educational's box"] = compare(B / "scene-rest.png", A / "scene-rest.png", ~vb)
    m["returned vs rest (whole scene)"] = compare(A / "scene-rest.png", A / "scene-returned.png")

    # --- the other stations: the same seeked moments before and after.
    # Playground's crop starts at scene x 1000: Educational's own floor ring reaches into it (to x 1014). Compared
    # outside Educational's box, like everything else.
    def other(p):
        x0 = {"engineering": 232, "playground": 1000, "creative": 120, "experience": 1130}[p.name.split("-")[1]]
        w, h = Image.open(p).size
        mask = np.tile(x0 + np.arange(w) / K >= 1030, (h, 1)) if x0 == 1000 else None
        return compare(p, A / p.name, mask)
    m["other stations"] = {p.name: other(p) for p in sorted(B.glob("others-*.png"))}
    bo, ao = (json.loads((x / "others.json").read_text(encoding="utf-8")) for x in (B, A))
    m["other stations: states whose numbers differ"] = [f"{i}:{t}" for i in bo for t in bo[i] if bo[i][t] != ao[i][t]]

    # --- what standby leaves alone: the opaque landscape, church and upper stone.
    st = np.asarray(Image.open(V2 / "m14f1/educational.png").convert("RGBA")).astype(np.float64)
    globe = np.asarray(Image.open(V2 / "m14h2/educational-globe.png").convert("RGBA")).astype(np.float64)
    orbit = np.asarray(Image.open(V2 / "m14h2/educational-orbit.png").convert("RGBA")).astype(np.float64)
    off = np.asarray(Image.open(V2 / "m14h2/educational-strip-off.png").convert("RGBA")).astype(np.float64)
    from_layers = (globe[..., 3] > 0) | (orbit[..., 3] > 0) | (off[..., 3] > 0)
    grown = m14h2.m14f.box(from_layers.astype(np.float64), 2) > 0
    keep = (st[..., 3] == 255) & ~grown & (yy < 490)
    m["landscape, church, stone: rest vs approved"] = compare(B / "scene-rest.png", A / "scene-rest.png", vmask(keep))

    # --- the light's and the crest's confinement: the same paused moment with and without.
    ring = np.asarray(Image.open(V2 / "m14h2/educational-ring-core.png").convert("RGBA"))[..., 3] > 0
    near = m14h2.m14f.box(ring.astype(np.float64), 9) > 0
    island = m14h2.m14f.polygon_mask(m14h2.EDU["hard"][1]) > 0.5
    path, _ = m14h2.trace_ring(m14h2.m14f.load(m14h2.m14f.SRC_DIR / "environment-lines-removed.png"))
    iright = int(np.argmax(path[:, 0]))
    fd, _, _ = m14h2.ring_fields(path[: iright + 1], np.ones(iright + 1))
    behind = island & (fd > 12)
    flare = np.asarray(Image.open(V2 / "m14h2/educational-flare.png").convert("RGBA"))[..., 3] > 0
    flare = m14h2.m14f.box(flare.astype(np.float64), 1) > 0
    conf = {}
    for s in (280, 350, 410, 480, 570):
        a = arr(A / f"hl-{s}.png")
        d = np.abs(a - arr(A / f"hl-{s}-off.png")).max(2)
        conf[f"light +{s}"] = dict(
            changed_px_over_4=int((d > 4).sum()),
            outside_the_ring_band=int((d > 4)[~cmask(near, d.shape, 2)].sum()),
            over_the_island_or_church_away_from_the_front_arc=int((d > 4)[cmask(behind, d.shape, 2)].sum()),
        )
    for s in (230, 300):
        a = arr(A / f"crest-{s}.png")
        d = np.abs(a - arr(A / f"crest-{s}-off.png")).max(2)
        conf[f"crest +{s}"] = dict(changed_px_over_4=int((d > 4).sum()), outside_the_hologram=int((d > 4)[~cmask(flare, d.shape, 2)].sum()))
    m["confinement (2x captures, with vs without)"] = conf

    # --- legibility at 1x: mean luminance, rest vs the moment, at normal desktop size.
    L = lambda n: arr(A / f"phase-{n}.png") @ np.array([0.299, 0.587, 0.114])
    r = L("rest")
    reg = {
        "great bubble": (xx - 786.2) ** 2 + (yy - 352.9) ** 2 < 70**2,
        "dome sky": ((xx - 841) ** 2 + (yy - 372.8) ** 2 < 68**2) & (yy < 330),
        "pool": (xx > 800) & (xx < 950) & (yy > 416) & (yy < 438),
        "front strip": (xx > 755) & (xx < 918) & (yy > 455) & (yy < 463),
        "floor under the base": (xx > 760) & (xx < 920) & (yy > 505) & (yy < 555),
    }
    st_ = L("stable")
    m["1x luminance rest -> stable"] = {k: [round(float(r[cmask(v, r.shape, 1)].mean()), 1), round(float(st_[cmask(v, r.shape, 1)].mean()), 1)] for k, v in reg.items()}
    peaks = {}
    core = np.asarray(Image.open(V2 / "m14h2/educational-ring-core.png").convert("RGBA"))[..., 3] > 120
    for n in ("orbit-front", "orbit-back", "orbit-left"):
        c = cmask(core, r.shape, 1)
        peaks[n] = dict(ring_p99=round(float(np.percentile(L(n)[c], 99)), 1), ring_p99_at_rest=round(float(np.percentile(r[c], 99)), 1), ring_px_brighter_than_rest_by_40=int(((L(n) - r) > 40)[c].sum()))
    m["1x light on the ring"] = peaks

    m["checks"] = {k: checks[k] for k in ("switching", "deep_link", "pacing", "homepage", "phase_errors", "forced_powered_errors", "escape") if k in checks}
    (WORK / "measurements.json").write_text(json.dumps(m, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(m, indent=1))


if __name__ == "__main__":
    main()
