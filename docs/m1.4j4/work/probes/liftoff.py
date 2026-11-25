# M1.4J.4: liftoff.mjs, now against the checkpoint, two runs each.   python liftoff.py <cap dir>
import glob, os, sys
import numpy as np
from PIL import Image
R = sys.argv[1]
L = lambda d, n: np.asarray(Image.open(f"{R}/{d}/{n}").convert("RGB")).astype(int)
def q(a, b):
    d = np.abs(a - b).max(-1)
    d[285:555, 1035:1370] = 0  # Playground's cabinet: Chrome resamples it in two variants, before and after alike
    ys, xs = np.nonzero(d > 2)
    return int(d.max()), len(ys), (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(ys) else None
for f in sorted(glob.glob(f"{R}/lo-base0/*.png")):
    n = os.path.basename(f)
    B, N = [L("lo-base0", n), L("lo-base1", n)], [L("lo-now0", n), L("lo-now1", n)]
    print(n.ljust(22), "now vs checkpoint", q(N[0], B[0]), q(N[1], B[1]), "| noise: checkpoint", q(B[0], B[1])[:2], "now", q(N[0], N[1])[:2])
