# M1.4J.2: after against before (visual.mjs frames, refs.mjs sizes and hit maps).   python compare.py <run dir>
import glob, json, os, sys
import numpy as np
from PIL import Image
R = sys.argv[1]
K = 1648 / 1672
load = lambda f: np.asarray(Image.open(f).convert("RGB")).astype(int)
def box(d, b, k=K):  # leave a scene box out
    x0, y0, x1, y1 = [int(round(v * k)) for v in b]
    d[max(0, y0) : y1, max(0, x0) : x1] = 0
PG = (1050, 290, 1385, 560)  # Playground's cabinet: Chrome resamples it in two variants, before and after alike
EDU = (640, 250, 1035, 590)
def diff(a, b, leave=()):
    d = np.abs(a - b).max(-1)
    for l in leave: box(d, l)
    ys, xs = np.nonzero(d > 2)
    return int(d.max()), len(ys), (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(ys) else None
for f in sorted(glob.glob(f"{R}/cap/j2/after/1648-gpu-0/*.png")):
    n = os.path.basename(f)
    a = load(f); b = [load(f"{R}/cap/j2/before/1648-gpu-{r}/{n}") for r in (0, 1)]
    lifted = n.startswith("educational") and not any(s in n for s in ("--230", "rest-after", "reduced", "-0040"))
    leave = [PG] + ([EDU] if lifted else [])
    best = min((diff(a, x, leave) for x in b), key=lambda t: (t[1], t[0]))
    noise = diff(b[0], b[1], leave)
    print(n.ljust(30), "outside Educational" if lifted else "whole scene        ", "max", best[0], ">2:", best[1], best[2] or "", "| noise", noise[:2])
print()
for s in ("1648", "1920", "1366", "1024", "home"):
    p = lambda l: f"{R}/cap/j1/sizes/{l}-{s}.png"
    if not os.path.exists(p("after")): continue
    a, b, c = load(p("after")), load(p("before")), load(p("before2"))
    k = K if s in ("1648", "home") else None
    d = [np.abs(a - x).max(-1) for x in (b, c)]
    h, w = d[0].shape
    if s != "home":
        k = max(w / 1672, h / 941); ox, oy = (w - 1672 * k) / 2, (h - 941 * k) / 2
        for q in d: q[int(oy + PG[1] * k) : int(oy + PG[3] * k), int(ox + PG[0] * k) : int(ox + PG[2] * k)] = 0
    q = min(d, key=lambda t: (t > 2).sum())
    print("idle", s, "max", int(q.max()), ">2:", int((q > 2).sum()))
a, b, c = [json.load(open(f"{R}/out/j1-refs-{l}.json")) for l in ("after", "before", "before2")]
for k in b:
    if isinstance(b[k], list) and k not in ("errors", "focus"):
        ch = {}; n = 0; noise = 0
        for j, r in enumerate(b[k]):
            for i, v in enumerate(r):
                if c[k][j][i] != v: noise += 1
                if a[k][j][i] != v: n += 1; q = f"{v}>{a[k][j][i]}"; ch[q] = ch.get(q, 0) + 1
        print("hit map", k, n, ch, "| noise", noise)
print("focus order same", a["focus"] == b["focus"], "| home markup same", a["homeMarkup"] == b["homeMarkup"], "| errors", a["errors"])
