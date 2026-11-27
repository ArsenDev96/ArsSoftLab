"""Static Lite experiment: pixel differences between ?render=lite and ?render=static (static-compare.mjs's captures).

    python static-compare.py   -> results/static-compare-pixels.json, captures/static/compare/sheet-*.png

Per state: the largest channel difference, how many pixels differ by more than 2, 8 and 24 / 255, and the box
around those over 8. The sheets put Lite, static and their difference (x4) side by side.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).parent
CAP = HERE / "captures" / "static" / "compare"
STATES = ["rest"] + [f"hover-{s}" for s in ["engineering", "educational", "playground", "creative", "experience"]] + ["selected-engineering", "selected-sqlorbit"]

out = {}
for s in STATES:
    a = np.asarray(Image.open(CAP / f"lite-{s}.png").convert("RGB")).astype(np.int16)
    b = np.asarray(Image.open(CAP / f"static-{s}.png").convert("RGB")).astype(np.int16)
    d = np.abs(a - b).max(axis=2)
    ys, xs = np.nonzero(d > 8)
    out[s] = {
        "max": int(d.max()),
        "over2": int((d > 2).sum()),
        "over8": int((d > 8).sum()),
        "over24": int((d > 24).sum()),
        "share_over2": round(float((d > 2).mean()), 4),
        "box_over8": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None,
    }
    if s in ("rest", "hover-engineering", "selected-sqlorbit"):
        h, w = d.shape
        sheet = Image.new("RGB", (w * 3, h))
        sheet.paste(Image.fromarray(a.astype(np.uint8)), (0, 0))
        sheet.paste(Image.fromarray(b.astype(np.uint8)), (w, 0))
        sheet.paste(Image.fromarray(np.clip(d * 4, 0, 255).astype(np.uint8)).convert("RGB"), (2 * w, 0))
        sheet.resize((w * 3 // 2, h // 2)).save(CAP / f"sheet-{s}.png")
(HERE / "results" / "static-compare-pixels.json").write_text(json.dumps(out, indent=1) + "\n")
for s, v in out.items():
    print(f"{s:22} max {v['max']:3}  >2: {v['over2']:6} ({v['share_over2']:.2%})  >8: {v['over8']:5}  >24: {v['over24']:4}  box>8 {v['box_over8']}")
