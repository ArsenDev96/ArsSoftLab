"""M1.4K.6 (home verification): pixel comparison of two capture sets, whole frame and scene-only (below the header).

    python -I cmp.py <dir A> <dir B> [header_px]
"""
import os
import sys

import numpy as np
from PIL import Image

a_dir, b_dir = sys.argv[1], sys.argv[2]
hdr = int(sys.argv[3]) if len(sys.argv) > 3 else 72


def box(m):
    ys, xs = np.nonzero(m)
    return None if len(xs) == 0 else [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


for f in sorted(os.listdir(a_dir)):
    if not f.endswith(".png") or not os.path.exists(os.path.join(b_dir, f)):
        continue
    a = np.asarray(Image.open(os.path.join(a_dir, f)).convert("RGB")).astype(np.int16)
    b = np.asarray(Image.open(os.path.join(b_dir, f)).convert("RGB")).astype(np.int16)
    d = np.abs(a - b).max(axis=2)
    s = d[hdr:]
    print(
        f"{f:16} whole: max {d.max():3} px>0 {int((d > 0).sum()):7} px>2 {int((d > 2).sum()):7} box>0 {box(d > 0)}"
        f" | scene(y>={hdr}): max {s.max():3} px>0 {int((s > 0).sum()):7} px>2 {int((s > 2).sum()):7}"
    )
