"""M1.4H.4: evidence sheets and measurements from scripts/visual/m14h4-capture.mjs
(run it with `before` first, then without). Writes
docs/m1.4h4/{experience-phases,experience-trail-closeup,full-scene-powered}.png
and docs/m1.4h4/work/measurements.json.

    python scripts/m14h4-sheets.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "docs/m1.4h4"
WORK = DOC / "work"
B, A = WORK / "captures/before", WORK / "captures/after"
V2 = ROOT / "public/scene/v2"
K = 928 / 941  # the camera's scale at 1648 x 928
X0 = (1648 - 1672 * K) / 2
EXP = (1112, 490, 552, 390)  # capture boxes, scene px
TRAIL = (1388, 556, 176, 160)

_s = importlib.util.spec_from_file_location("m14h4", ROOT / "scripts/m14h4-experience.py")
m14h4 = importlib.util.module_from_spec(_s)
_s.loader.exec_module(m14h4)
box = m14h4.m14f.box
poly = m14h4.m14f.polygon_mask
LUM = m14h4.LUM

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
    return np.asarray(Image.open(V2 / "m14h4" / n).convert("RGBA")).astype(np.float64)


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


def cmask(m, shape, scale, b=EXP):
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
    yy, xx = np.mgrid[0:941, 0:1672]
    r_ = np.load(WORK / "route.npz")
    bx, by, bw, bh = r_["box"]
    M, S = np.zeros((941, 1672)), np.zeros((941, 1672))
    M[by : by + bh, bx : bx + bw], S[by : by + bh, bx : bx + bw] = r_["M"], r_["S"]
    total = float(r_["u"][-1])
    route = M > 0.5

    # --- sheets
    names = [
        ("rest", "At rest: standby"),
        ("spark-approaching", "Spark approaching (-120 ms): nothing has changed"),
        ("energy-arrival", "+100 ms: the strip lights, the route's start responds"),
        ("route-25", "+250 ms: about 25% of the route"),
        ("route-50", "+388 ms: about 50%"),
        ("route-75", "+545 ms: about 75%"),
        ("destination", "+790 ms: the destination"),
        ("settling", "+880 ms: settling"),
        ("stable", "+1500 ms: stable, the approved artwork"),
        ("returning-150ms", "Leaving, 150 ms: the trail draws back"),
        ("returning-250ms", "Leaving, 250 ms"),
        ("returned", "Back at rest"),
    ]
    m["experience-phases.png"] = sheet([(img(A / f"phase-{n}-3x.png"), c) for n, c in names], 3, 840, DOC / "experience-phases.png", "M1.4H.4  Experience activation, times after the energy's arrival (660 ms after hover)")
    one = [(img(A / f"phase-{n}.png"), c) for n, c in names[:11]]
    sheet(one, 4, one[0][0].width, WORK / "experience-phases-1x.png", "M1.4H.4  the same at normal desktop size (1648 x 928)")
    up = lambda n: img(WORK / n).resize((1104, 1152), Image.LANCZOS).crop((16, 156, 1072, 1116))
    cells = [(up("trace-8x.png"), "The traced route: start (magenta) to end (red), arc length in px"),
             (up("masks-8x.png"), "Pixels: the route (red, purple to white along it); the light it throws (blue)"),
             (up("light-masks-8x.png"), "Added light: the start (red), the destination (green), the flags (blue)")]
    cells += [(img(A / f"trail-{s}.png"), c) for s, c in [("rest", "Standby")] + [(s, f"+{s} ms") for s in (100, 150, 200, 250, 300, 350, 388, 450, 500, 545, 600, 650, 700, 750, 790, 830, 880, 1000)]]
    m["experience-trail-closeup.png"] = sheet(cells, 4, 620, DOC / "experience-trail-closeup.png", "M1.4H.4  the route (6x captures)")
    img(A / "scene-powered.png").save(DOC / "full-scene-powered.png", optimize=True)

    # --- the stable state against the approved scene (before this milestone Experience was always lit).
    m["stable vs approved (whole scene)"] = compare(B / "scene-rest.png", A / "scene-forced-powered.png")
    top = (xx >= bx) & (xx < bx + bw) & (yy >= by) & (yy < by + bh)
    m["stable vs approved (route, terrain, flags, panel)"] = compare(B / "scene-rest.png", A / "scene-forced-powered.png", vmask(top))
    m["the two ends of the settling cross-fade (whole scene)"] = compare(A / "scene-forced-layers.png", A / "scene-forced-powered.png")
    b_ = (xx >= 1028) & (yy >= 526) & (yy < 916)
    m["rest vs approved, outside Experience's box"] = compare(B / "scene-rest.png", A / "scene-rest.png", ~vmask(b_))
    m["returned vs rest (whole scene)"] = compare(A / "scene-rest.png", A / "scene-returned.png")
    m["stable, 2.5 s apart (2x)"] = compare(A / "quiet-a.png", A / "quiet-b.png")

    # --- the other stations: the same seeked moments before and after. Only Playground's crop (x 1000-1440, y 330-630)
    # holds some of Experience: the left ridge wires, now in standby. Masked out (grown 2 px).
    cov = box((rgba("experience-standby.png")[..., 3] > 0).astype(np.float64), 2) > 0

    def other(p):
        if p.name.split("-")[1] != "playground":
            return compare(p, A / p.name)
        w, h = Image.open(p).size
        return compare(p, A / p.name, ~cmask(cov, (h, w), 1, (1000, 330, 440, 300)))

    m["other stations"] = {p.name: other(p) for p in sorted(B.glob("others-*.png"))}
    bo, ao = (json.loads((x / "others.json").read_text(encoding="utf-8")) for x in (B, A))
    m["other stations: states whose numbers differ"] = [f"{i}:{t}" for i in bo for t in bo[i] if bo[i][t] != ao[i][t]]

    # --- what standby leaves alone.
    st = np.asarray(Image.open(V2 / "m14f/experience.png").convert("RGBA")).astype(np.float64)
    li = np.asarray(Image.open(V2 / "m14f/experience-light.png").convert("RGBA"))
    touched = (rgba("experience-standby.png")[..., 3] > 0) | (rgba("experience-strip-off.png")[..., 3] > 0) | (li[..., 3] > 0) | (rgba("experience-floor.png")[..., 3] > 0)
    grown = box(touched.astype(np.float64), 2) > 0
    keep = (st[..., 3] == 255) & ~grown
    m["stone, plant, panel, everything else on the station: rest vs approved"] = compare(B / "scene-rest.png", A / "scene-rest.png", vmask(keep))
    flag_poly = np.zeros((941, 1672), bool)
    for f in m14h4.FLAGS:
        flag_poly |= poly(f[1]) > 0.9
    flag_poly &= (st[..., 3] > 250) & (st[..., 0] > 200)
    panel = (poly([(1389, 515), (1531, 515), (1531, 564), (1389, 564)]) > 0.5) & ~(box(flag_poly.astype(np.float64), 3) > 0) & ~((xx > 1503) & (xx < 1511))
    m["the two flags: rest vs approved"] = compare(B / "scene-rest.png", A / "scene-rest.png", vmask(flag_poly))
    m["the code panel's text: rest vs approved"] = compare(B / "scene-rest.png", A / "scene-rest.png", vmask(panel))
    Yb, Ya = arr(B / "scene-rest.png") @ LUM, arr(A / "scene-rest.png") @ LUM
    vr = vmask(route)
    m["route luminance at rest: approved, standby, ratio"] = [round(float(Yb[vr].mean()), 1), round(float(Ya[vr].mean()), 1), round(float(Ya[vr].mean() / Yb[vr].mean()), 3)]
    ter = vmask(top & (rgba("experience-standby.png")[..., 3] > 0) & ~(box(route.astype(np.float64), 2) > 0))
    m["terrain the route lights, at rest: approved, standby, ratio"] = [round(float(Yb[ter].mean()), 1), round(float(Ya[ter].mean()), 1), round(float(Ya[ter].mean() / Yb[ter].mean()), 3)]

    # --- the added light's confinement: the same paused moment with and without it.
    green = (xx > 1488) & (yy > 662) & (st[..., 1] > st[..., 0] * 0.72) & (st[..., 2] < st[..., 1] * 0.55) & (st[..., 3] > 200)  # the plant
    off_station = box((st[..., 3] > 0).astype(np.float64), 2) == 0
    conf = {}
    for s in (100, 170, 250, 388, 470, 545, 680, 790, 830, 880):
        a = arr(A / f"fx-{s}.png")
        d = a - arr(A / f"fx-{s}-off.png")
        dm = np.abs(d).max(2)
        cm = lambda x: cmask(x, dm.shape, 2)
        # the strips' pulse is gated separately and stays in both captures
        conf[f"+{s}"] = dict(changed_px_over_4=int((dm > 4).sum()), outside_the_station=int((dm > 4)[cm(off_station)].sum()), on_the_code_text=int((dm > 4)[cm(panel)].sum()), on_the_plant=int((dm > 4)[cm(green)].sum()), px_whose_blue_passes_green_or_red=int(((a[..., 2] > np.minimum(a[..., 0], a[..., 1]) + 2) & (dm > 4) & ~((a - d)[..., 2] > np.minimum((a - d)[..., 0], (a - d)[..., 1]) + 2)).sum()), darkened_px=int((d.min(2) < -2).sum()), clipped_white_px=int((a.min(2) >= 254)[cm(top)].sum()), clipped_white_px_without=int((arr(A / f"fx-{s}-off.png").min(2) >= 254)[cm(top)].sum()))
    m["added light (2x, with vs without)"] = conf

    # --- the reveal follows the route: in the 6x captures, every route pixel's own share of its way from standby to the
    # approved, against its arc length. (Pixels whose standby and approved differ by 40 or more.)
    rest6, st6 = arr(A / "trail-rest.png") @ LUM, arr(A / "trail-1000.png") @ LUM
    ys, xs = np.mgrid[0 : rest6.shape[0], 0 : rest6.shape[1]]
    sx = np.clip(np.round(TRAIL[0] + (xs + 0.5) / (K * 6) - 0.5).astype(int), 0, 1671)
    sy = np.clip(np.round(TRAIL[1] + (ys + 0.5) / (K * 6) - 0.5).astype(int), 0, 940)
    ok = (M[sy, sx] > 0.9) & (st6 - rest6 > 40)
    s6 = S[sy, sx]
    prog = {}
    for t in (100, 150, 200, 250, 300, 350, 388, 450, 500, 545, 600, 650, 700, 750, 880):
        v = (arr(A / f"trail-{t}.png") @ LUM - rest6) / np.maximum(st6 - rest6, 1)
        lit = v > 0.5
        bins = np.arange(0, total, 4)
        frac = np.array([lit[ok & (s6 >= b) & (s6 < b + 4)].mean() if (ok & (s6 >= b) & (s6 < b + 4)).any() else np.nan for b in bins])
        edge = next((i for i, f in enumerate(frac) if f < 0.5), len(frac))
        front = bins[edge] if edge < len(bins) else total
        prog[f"+{t}"] = dict(route_lit_share=round(float(front / total), 2), lit_px_more_than_14px_ahead=int((lit & ok & (s6 > front + 14)).sum()), unlit_px_more_than_14px_behind=int((~lit & ok & (s6 < front - 14)).sum()))
    m["the reveal along the route (6x)"] = prog
    m["route px checked (6x)"] = int(ok.sum())

    # --- legibility at normal desktop size (1x).
    L = {n: arr(A / f"phase-{n}.png") @ LUM for n, _ in names[:9]}
    r, stl = L["rest"], L["stable"]
    cr = cmask(route, r.shape, 1)
    ct = cmask(top & (xx > 1392) & (st[..., 3] > 200), r.shape, 1)
    m["1x route px, station-top px"] = [int(cr.sum()), int(ct.sum())]
    m["1x route luminance by phase"] = {n: round(float(v[cr].mean()), 1) for n, v in L.items()}
    m["1x px brighter than standby by 25"] = {n: int(((v - r) > 25)[ct].sum()) for n, v in L.items()}
    m["1x px brighter than the approved by 10 (the moving light)"] = {n: int(((v - stl) > 10)[ct].sum()) for n, v in L.items()}
    m["rest brighter than the approved by 4 or more (whole scene, px)"] = int(((Ya - Yb) > 4).sum())
    end = (np.hypot(xx - 1484, yy - 611) < 26) & (st[..., 3] > 200)
    ce = cmask(end, r.shape, 1)
    m["1x destination area: max and mean gain over the approved, by phase"] = {n: [int((v - stl)[ce].max()), round(float((v - stl)[ce].mean()), 1)] for n, v in L.items()}
    reg = {"front strip": (xx > 1300) & (xx < 1395) & (np.abs(yy - (769 + (xx - 1300) * 0.115)) < 3), "right strip": (xx > 1590) & (xx < 1635) & (np.abs(yy - (776 - (xx - 1590) * 0.17)) < 3), "ring, left of the base": (xx > 1163) & (xx < 1195) & (yy > 715) & (yy < 742)}
    m["1x luminance rest -> stable"] = {k: [round(float(r[cmask(v, r.shape, 1)].mean()), 1), round(float(stl[cmask(v, r.shape, 1)].mean()), 1)] for k, v in reg.items()}

    m["checks"] = {k: checks[k] for k in ("switching", "deep_link", "escape", "pacing", "homepage", "phase_errors", "forced_powered_errors", "animations_running_when_stable") if k in checks}
    (WORK / "measurements.json").write_text(json.dumps(m, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in m.items() if k != "other stations"}, indent=None).replace('], "', '],\n"').replace('}, "', '},\n"'))
    k = "other stations"
    print(k, "images", len(m[k]), "max", max(x["max"] for x in m[k].values()), "px>2", {n: x["px_over_2"] for n, x in m[k].items() if x["px_over_2"]})


if __name__ == "__main__":
    main()
