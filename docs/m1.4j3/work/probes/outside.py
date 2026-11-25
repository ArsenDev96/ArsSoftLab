# M1.4J.3: outside.mjs, everything outside Creative Studio's own box, best of the three runs against each other.   python outside.py <cap dir>
import sys
import numpy as np
from PIL import Image
R = sys.argv[1]
L = lambda d, n: np.asarray(Image.open(f"{R}/{d}/{n}.png").convert("RGB")).astype(int)
K = 1648 / 1672
def q(a, b, own):
    d = np.abs(a - b).max(-1)
    d[285:555, 1035:1370] = 0  # Playground's cabinet: two variants, before and after alike
    if own: d[int(485 * K) : int(885 * K), int(60 * K) : int(565 * K)] = 0
    ys, xs = np.nonzero(d > 2)
    return int(d.max()), len(ys), (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(ys) else None
for n in ("raised", "back", "raised-reduced", "back-reduced"):
    for k in range(3):
        print(n.ljust(15), "now", k, "vs checkpoint", min((q(L("out-now", f"{n}-{k}"), L("out-base", f"{n}-{j}"), n == "raised") for j in range(3)), key=lambda t: (t[1], t[0])), "| checkpoint", k, "vs the others", max((q(L("out-base", f"{n}-{k}"), L("out-base", f"{n}-{j}"), n == "raised") for j in range(3)), key=lambda t: (t[1], t[0]))[:2])
