"""M1.4K.3: pixel comparison of two capture sets (eng-capture.mjs).

    python -I compare.py <dir A> <dir B> [label]     -> prints per capture; writes results/compare-<label>.json

Per capture: largest channel difference (of 255), pixels differing at all, pixels differing by more than 2, and where
(bounding box). Also the same inside Engineering's region (scene x 230-640, y 300-600, scaled to the capture).
"""
import json
import os
import sys

import numpy as np
from PIL import Image

a_dir, b_dir = sys.argv[1], sys.argv[2]
label = sys.argv[3] if len(sys.argv) > 3 else "cmp"
rows = {}
for f in sorted(os.listdir(a_dir)):
    if not f.endswith(".png") or not os.path.exists(os.path.join(b_dir, f)):
        continue
    a = np.asarray(Image.open(os.path.join(a_dir, f)).convert("RGB")).astype(np.int16)
    b = np.asarray(Image.open(os.path.join(b_dir, f)).convert("RGB")).astype(np.int16)
    d = np.abs(a - b).max(axis=2)
    h, w = d.shape
    k = w / 1672 if w / h <= 1672 / 941 else h / 941  # the scene covers the window (object-fit: cover)
    ox, oy = (w - 1672 * k) / 2, (h - 941 * k) / 2
    ex = (int(ox + 230 * k), int(oy + 300 * k), int(ox + 640 * k), int(oy + 600 * k))
    de = d[max(0, ex[1]):ex[3], max(0, ex[0]):ex[2]]
    ys, xs = np.nonzero(d > 2)
    r = {
        "max": int(d.max()), "px_any": int((d > 0).sum()), "px_over2": int((d > 2).sum()),
        "over2_box": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None,
        "eng_max": int(de.max()), "eng_px_over2": int((de > 2).sum()),
    }
    rows[f[:-4]] = r
    print(f"{f[:-4]:28s} max {r['max']:3d}  px>0 {r['px_any']:7d}  px>2 {r['px_over2']:6d}  box {r['over2_box']}  | Engineering: max {r['eng_max']:3d} px>2 {r['eng_px_over2']}")
os.makedirs("results", exist_ok=True)
with open(os.path.join("results", f"compare-{label}.json"), "w", encoding="utf8") as fh:
    json.dump(rows, fh, indent=1)
