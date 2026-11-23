"""M1.4H.3: evidence sheets and measurements from scripts/visual/m14h3-capture.mjs
(run it with `before` first, then without). Writes
docs/m1.4h3/{creative-phases,creative-painting-closeup,full-scene-powered}.png
and docs/m1.4h3/work/measurements.json.

    python scripts/m14h3-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "docs/m1.4h3"
WORK = DOC / "work"
B, A = WORK / "captures/before", WORK / "captures/after"
V2 = ROOT / "public/scene/v2"
K = 928 / 941  # the camera's scale at 1648 x 928
X0 = (1648 - 1672 * K) / 2
CRE = (90, 500, 560, 390)  # capture box, scene px
BOXES = {"engineering": 232, "educational": 620, "playground": 1000, "experience": 1130}

_s = importlib.util.spec_from_file_location("m14h3", ROOT / "scripts/m14h3-creative.py")
m14h3 = importlib.util.module_from_spec(_s)
_s.loader.exec_module(m14h3)
box = m14h3.m14f.box
LUM = m14h3.LUM

try:
    FONT = ImageFont.truetype("segoeui.ttf", 22)
    SMALL = ImageFont.truetype("segoeui.ttf", 16)
except OSError:
    FONT = SMALL = ImageFont.load_default()


def img(p):
    return Image.open(p).convert("RGB")


def arr(p):
    return np.asarray(img(p)).astype(np.float64)


def rgba(n):
    return np.asarray(Image.open(V2 / "m14h3" / n).convert("RGBA")).astype(np.float64)


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


def vmask(m, shape=(928, 1648)):
    """A scene-px mask sampled at the viewport's pixels."""
    ys, xs = np.mgrid[0 : shape[0], 0 : shape[1]]
    return m[np.clip(np.round((ys + 0.5) / K - 0.5).astype(int), 0, 940), np.clip(np.round((xs + 0.5 - X0) / K - 0.5).astype(int), 0, 1671)]


def cmask(m, shape, scale, b=CRE):
    """The same, at the pixels of a clip capture of `b`."""
    ys, xs = np.mgrid[0 : shape[0], 0 : shape[1]]
    sx = np.round(b[0] + (xs + 0.5) / (K * scale) - 0.5).astype(int)
    sy = np.round(b[1] + (ys + 0.5) / (K * scale) - 0.5).astype(int)
    return m[np.clip(sy, 0, 940), np.clip(sx, 0, 1671)]


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
        ("first-response", "+150 ms: warm details along the lower edge"),
        ("sun", "+200 ms: the painted sun comes up"),
        ("clouds", "+260 ms: along the cloud edges"),
        ("sky-and-peak", "+320 ms: across the sky, to the peak"),
        ("ridge-glint", "+500 ms: a glint along the sunlit ridge"),
        ("summit", "+550 ms: at the summit"),
        ("settling", "+660 ms: settling"),
        ("stable", "+1400 ms: stable, the approved artwork"),
        ("returned", "Back at rest"),
    ]
    m["creative-phases.png"] = sheet([(img(A / f"phase-{n}-3x.png"), c) for n, c in names], 3, 840, DOC / "creative-phases.png", "M1.4H.3  Creative Studio activation, times after the energy's arrival (640 ms after hover)")
    one = [(img(A / f"phase-{n}.png"), c) for n, c in names[:11]]
    sheet(one, 4, one[0][0].width, WORK / "creative-phases-1x.png", "M1.4H.3  the same at normal desktop size (1648 x 928)")
    up = lambda n: img(WORK / n).resize((1008, 888), Image.LANCZOS)
    cells = [(up("geometry-6x.png"), "The painting's measured area (cyan), the ridge's path (green), the easel's ledge (magenta)"),
             (up("sunrise-contours-6x.png"), "The sunrise's order: each line is one moment, solved through the painting from its sun"),
             (up("highlights-6x.png"), "The light its front adds: the painting's own highlights"),
             (up("glint-masks-6x.png"), "Where the glints are: the ridge (red), warm cloud edges (green)")]
    cells += [(img(A / f"painting-{s}.png"), c) for s, c in [("rest", "Standby")] + [(s, f"+{s} ms") for s in (150, 180, 210, 250, 290, 330, 370, 410, 450, 490, 530, 580, 640, 800)]]
    m["creative-painting-closeup.png"] = sheet(cells, 4, 620, DOC / "creative-painting-closeup.png", "M1.4H.3  the painting (6x captures)")
    sc = [(img(A / f"small-{s}.png"), c) for s, c in [("rest", "Standby")] + [(s, f"+{s} ms") for s in (410, 450, 490, 530, 580, 640, 800)]]
    sheet(sc, 4, 620, WORK / "small-paintings.png", "M1.4H.3  the small framed paintings (8x captures)")
    img(A / "scene-powered.png").save(DOC / "full-scene-powered.png", optimize=True)

    # --- the stable state against the approved scene (before this milestone Creative Studio was always lit).
    yy, xx = np.mgrid[0:941, 0:1672]
    m["stable vs approved (whole scene)"] = compare(B / "scene-rest.png", A / "scene-forced-powered.png")
    q = m14h3.m14f.polygon_mask(m14h3.PAINTING) > 0.5
    m["stable vs approved (the painting)"] = compare(B / "scene-rest.png", A / "scene-forced-powered.png", vmask(q))
    m["the two ends of the settling cross-fade (whole scene)"] = compare(A / "scene-forced-layers.png", A / "scene-forced-powered.png")
    b_ = (xx >= 24) & (xx < 578) & (yy >= 536) & (yy < 906)
    m["rest vs approved, outside Creative Studio's box"] = compare(B / "scene-rest.png", A / "scene-rest.png", ~vmask(b_))
    m["returned vs rest (whole scene)"] = compare(A / "scene-rest.png", A / "scene-returned.png")
    m["stable, 2.5 s apart (2x)"] = compare(A / "quiet-a.png", A / "quiet-b.png", ~cmask((yy > 660) & (xx > 220) & (xx < 345), arr(A / "quiet-a.png").shape[:2], 2))

    # --- the other stations: the same seeked moments before and after. Only Engineering's crop (x 232-632, y 370-660)
    # holds some of Creative Studio: the top of its painting, which is now in standby. Masked out (grown 2 px).
    area = box((m14h3.m14f.polygon_mask(m14h3.PAINTING) > 0).astype(np.float64), 2) > 0

    def other(p):
        st_ = p.name.split("-")[1]
        if st_ != "engineering":
            return compare(p, A / p.name)
        w, h = Image.open(p).size
        return compare(p, A / p.name, ~cmask(area, (h, w), 1, (232, 370, 400, 290)))

    m["other stations"] = {p.name: other(p) for p in sorted(B.glob("others-*.png"))}
    bo, ao = (json.loads((x / "others.json").read_text(encoding="utf-8")) for x in (B, A))
    m["other stations: states whose numbers differ"] = [f"{i}:{t}" for i in bo for t in bo[i] if bo[i][t] != ao[i][t]]

    # --- what standby leaves alone: every pixel of the station outside the painted areas and the strips.
    st = np.asarray(Image.open(V2 / "m14f/creative.png").convert("RGBA"))
    touched = (rgba("creative-standby.png")[..., 3] > 0) | (rgba("creative-strip-off.png")[..., 3] > 0) | (rgba("creative-strip-floor.png")[..., 3] > 0) | (rgba("creative-floor.png")[..., 3] > 0)
    keep = (st[..., 3] == 255) & ~(box(touched.astype(np.float64), 2) > 0)
    m["easel, brushes, cup, frames, stone: rest vs approved"] = compare(B / "scene-rest.png", A / "scene-rest.png", vmask(keep))
    Yb, Ya = arr(B / "scene-rest.png") @ LUM, arr(A / "scene-rest.png") @ LUM
    vq = vmask(q)
    m["painting luminance at rest: approved, standby, ratio"] = [round(float(Yb[vq].mean()), 1), round(float(Ya[vq].mean()), 1), round(float(Ya[vq].mean() / Yb[vq].mean()), 3)]

    # --- the added light's confinement: the same paused moment with and without it. Allowed: the painted areas and the
    # ledge (grown 2 px for resampling).
    allow = np.zeros((941, 1672))
    for p in [m14h3.PAINTING, *m14h3.SMALL, m14h3.LEDGE]:
        allow = np.maximum(allow, m14h3.m14f.polygon_mask(p))
    allow = box(allow, 2) > 0
    conf = {}
    for s in (160, 220, 280, 340, 420, 500, 560):
        a = arr(A / f"fx-{s}.png")
        d = a - arr(A / f"fx-{s}-off.png")
        dm = np.abs(d).max(2)
        conf[f"+{s}"] = dict(changed_px_over_4=int((dm > 4).sum()), outside_the_paintings_and_ledge=int((dm > 4)[~cmask(allow, dm.shape, 2)].sum()), darkened_px=int((d.min(2) < -2).sum()), clipped_px_in_the_painting=int((a.min(2) >= 254)[cmask(q, dm.shape, 2)].sum()))
    m["added light (2x, with vs without)"] = conf

    # --- legibility at normal desktop size (1x): the painting through the sequence.
    L = {n: arr(A / f"phase-{n}.png") @ LUM for n, _ in names[:11]}
    r, stl = L["rest"], L["stable"]
    cq = cmask(q, r.shape, 1)
    sky = cq & cmask(yy < 610, r.shape, 1)
    m["1x painting luminance by phase"] = {n: round(float(v[cq].mean()), 1) for n, v in L.items()}
    m["1x painting px brighter than standby by 25"] = {n: int(((v - r) > 25)[cq].sum()) for n, v in L.items()}
    m["1x painting px brighter than the approved by 15"] = {n: int(((v - stl) > 15)[cq].sum()) for n, v in L.items()}
    m["1x painting px (total, sky)"] = [int(cq.sum()), int(sky.sum())]
    reg = {"front strip": (xx > 380) & (xx < 480) & (np.abs(yy - (769 - (xx - 388) * 0.185)) < 3), "floor right of the base": (xx > 505) & (xx < 552) & (yy > 712) & (yy < 760)}
    m["1x luminance rest -> stable"] = {k: [round(float(r[cmask(v, r.shape, 1)].mean()), 1), round(float(stl[cmask(v, r.shape, 1)].mean()), 1)] for k, v in reg.items()}

    # --- the platform's right end: no bluer than the approved scene at any moment of the sequence.
    end = (xx > 470) & (xx < 520) & (yy > 715) & (yy < 760)
    br = {n: (lambda a: a[..., 2] - a[..., 0])(arr(A / f"phase-{n}.png")) for n, _ in names[:11]}
    ce = cmask(end, br["stable"].shape, 1)
    lim = np.maximum(br["rest"], br["stable"])
    m["right end: px bluer (by > 3) than both standby and the approved, by phase"] = {n: int(((v - lim) > 3)[ce].sum()) for n, v in br.items()}

    m["checks"] = {k: checks[k] for k in ("switching", "deep_link", "escape", "pacing", "homepage", "phase_errors", "forced_powered_errors", "animations_running_when_stable") if k in checks}
    (WORK / "measurements.json").write_text(json.dumps(m, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in m.items() if k != "other stations"}, indent=None).replace('], "', '],\n"').replace('}, "', '},\n"'))
    k = "other stations"
    print(k, "images", len(m[k]), "max", max(x["max"] for x in m[k].values()), "px>2", {n: x["px_over_2"] for n, x in m[k].items() if x["px_over_2"]})


if __name__ == "__main__":
    main()
