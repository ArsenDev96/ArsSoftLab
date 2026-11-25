# frames that differ from the per-pixel median of their own kind (Educational's and Playground's area).   python flake.py <dir> [dir...]
import sys, glob, os
import numpy as np
from PIL import Image
for D in sys.argv[1:]:
    for kind in ("rest", "e-on"):
        fs = sorted(glob.glob(f"{D}/{kind}-*.png"))
        if len(fs) < 3: continue
        A = np.stack([np.asarray(Image.open(f).convert("RGB"))[240:600, 600:1040] for f in fs]).astype(np.int16)
        m = np.median(A, axis=0)
        bad = []
        for f, a in zip(fs, A):
            d = np.abs(a - m).max(-1) > 6
            if d.sum() > 30:
                ys, xs = np.nonzero(d); bad.append((os.path.basename(f), int(d.sum()), (int(xs.min()) + 600, int(ys.min()) + 240, int(xs.max()) + 600, int(ys.max()) + 240)))
        print(D, kind, f"{len(bad)} of {len(fs)} corrupted", bad)
