# M1.4J.2: align.mjs's frames, shift taken out.   python align.py <dir>
import sys, glob, os, re
import numpy as np
from PIL import Image
D = sys.argv[1]
load = lambda n: np.asarray(Image.open(os.path.join(D, n + ".png")).convert("RGB")).astype(int)
print("station alone on black: raised by d device px against the same moment at rest, shifted by d")
moments = sorted({re.match(r"station-(.+)-\d+\.png", os.path.basename(f)).group(1) for f in glob.glob(D + "/station-*-0.png")}, key=lambda s: (not s.isdigit(), int(s) if s.isdigit() else 0, s))
worst = 0
for m in moments:
    a = load(f"station-{m}-0")
    row = []
    for d in (3, 5, 7, 10):
        b = load(f"station-{m}-{d}")
        x = np.abs(b[: b.shape[0] - d] - a[d:]).max(-1)
        y = np.abs(b - a).max(-1)
        row.append(f"{d}px: max {x.max()}, >2: {(x > 2).sum()}, >8: {(x > 8).sum()} (unshifted >8: {(y > 8).sum()})")
        worst = max(worst, int(x.max()))
    print(m.rjust(8), "|", " | ".join(row))
print("worst", worst)
for d in (5, 10):
    a, b = load("floor-1500-0"), load(f"floor-1500-{d}")
    x = np.abs(b - a).max(-1)
    ys, xs = np.nonzero(x > 2)
    print(f"everything else (station hidden), lift {d}: changed >2: {len(ys)}", (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(ys) else "")
