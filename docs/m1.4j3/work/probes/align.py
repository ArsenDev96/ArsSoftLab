# M1.4J.3: align.mjs's frames, the shift taken out.   python align.py <dir>
import glob, os, re, sys
import numpy as np
from PIL import Image
D = sys.argv[1]
load = lambda n: np.asarray(Image.open(os.path.join(D, n + ".png")).convert("RGB")).astype(int)
for s, what in (("painting", "only the painting's and strips' light layers (standby, warm, crest, glints, strips)"), ("station", "the whole station")):
    print(f"{s}: {what}, alone on black: raised by d device px against the same moment at rest, shifted by d")
    ms = sorted({re.match(rf"{s}-(.+)-\d+\.png", os.path.basename(f)).group(1) for f in glob.glob(f"{D}/{s}-*-0.png")}, key=lambda m: (not m.isdigit(), int(m) if m.isdigit() else 0, m))
    worst = 0
    for m in ms:
        a, row = load(f"{s}-{m}-0"), []
        for d in (3, 5, 7, 10):
            b = load(f"{s}-{m}-{d}")
            x, y = np.abs(b[: b.shape[0] - d] - a[d:]).max(-1), np.abs(b - a).max(-1)
            row.append(f"{d}px: max {x.max()}, >2: {(x > 2).sum()} (unshifted >8: {(y > 8).sum()})")
            worst = max(worst, int(x.max()))
        print(m.rjust(9), "|", " | ".join(row))
    print(s, "moments", len(ms), "worst", worst)
