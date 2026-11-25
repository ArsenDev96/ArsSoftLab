# M1.4J.4: others.mjs, now against the checkpoint (two runs of the checkpoint).   python others.py <cap dir>
import glob, json, os, sys
import numpy as np
from PIL import Image
R = sys.argv[1]
L = lambda d, n: np.asarray(Image.open(f"{R}/{d}/{n}").convert("RGB")).astype(int)
def q(a, b, full):
    d = np.abs(a - b).max(-1)
    if not full:  # Playground's cabinet: Chrome resamples it in two variants, before and after alike
        h, w = d.shape; k = max(w / 1672, h / 941); ox, oy = (w - 1672 * k) / 2, (h - 941 * k) / 2
        d[int(oy + 285 * k) : int(oy + 562 * k), int(ox + 1045 * k) : int(ox + 1390 * k)] = 0
    ys, xs = np.nonzero(d > 2)
    return int(d.max()), len(ys), (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(ys) else None
for f in sorted(glob.glob(f"{R}/ot-base0/*.png")):
    n = os.path.basename(f)
    B, N = [L("ot-base0", n), L("ot-base1", n)], L("ot-now", n)
    full = n.startswith("home")
    best = min((q(N, b, full) for b in B), key=lambda t: (t[1], t[0]))
    print(n.ljust(26), "now vs checkpoint", best, "| noise of the checkpoint", q(B[0], B[1], full)[:2])
a, b, c = [json.load(open(f"{R}/{d}/maps.json")) for d in ("ot-now", "ot-base0", "ot-base1")]
for k in b:
    if isinstance(b[k], list) and k not in ("errors", "focus"):
        ch, noise = {}, 0
        for j, r in enumerate(b[k]):
            for i, v in enumerate(r):
                noise += c[k][j][i] != v
                if a[k][j][i] != v: ch[f"{v}>{a[k][j][i]}"] = ch.get(f"{v}>{a[k][j][i]}", 0) + 1
        print("hit map", k, sum(ch.values()), ch, "| noise", noise)
print("focus order same", a["focus"] == b["focus"], len(a["focus"]), "| home markup same", a["homeMarkup"] == b["homeMarkup"], "| home /scene/v2 requests", a["homeV2Requests"], b["homeV2Requests"], "| errors", a["errors"])
