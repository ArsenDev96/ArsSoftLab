"""M1.4I.2: frames of two sides, pixel by pixel.  python compare.py <before dir> <after dir> <w-mode> [json]
For each frame: the closest pair over the repeats, and (noise) the closest pair among the before repeats."""
import glob, json, os, sys
import numpy as np
from PIL import Image
A, B, vm = sys.argv[1:4]
load = lambda f: np.asarray(Image.open(f).convert("RGB")).astype(np.int16)
def reps(d): return sorted(glob.glob(os.path.join(d, vm + "-*")))
def diff(a, b):
    d = np.abs(a - b).max(2)
    ys, xs = np.nonzero(d > 2)
    return dict(max=int(d.max()), n=int((d > 0).sum()), over2=int((d > 2).sum()), box=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None)
names = sorted(os.path.basename(f) for f in glob.glob(os.path.join(reps(A)[0], "*.png")))
out = {}
for n in names:
    a = [load(os.path.join(r, n)) for r in reps(A) if os.path.exists(os.path.join(r, n))]
    b = [load(os.path.join(r, n)) for r in reps(B) if os.path.exists(os.path.join(r, n))]
    if not b: continue
    key = lambda d: (d["over2"], d["n"])
    # every after repeat against its closest before repeat; the worst of these
    cross = max((min((diff(x, y) for x in a), key=key) for y in b), key=key)
    same = [min((diff(x, y) for j, x in enumerate(a) if j != i), key=key) for i, y in enumerate(a)] if len(a) > 1 else []
    noise = max(same, key=key) if same else None
    out[n[:-4]] = dict(after=cross, noise=noise)
    f = lambda d: f'max {d["max"]:3d}  changed {d["n"]:7d}  >2 {d["over2"]:6d} {d["box"] or ""}' if d else "-"
    print(f"{n[:-4]:26s} after: {f(cross)}   | before vs before: {f(noise)}")
if len(sys.argv) > 4: json.dump(out, open(sys.argv[4], "w"), indent=1)
w = [v["after"] for v in out.values()]
print(len(w), "frames; identical", sum(x["n"] == 0 for x in w), "; max<=2", sum(x["max"] <= 2 for x in w), "; with >2:", sum(x["over2"] > 0 for x in w))
