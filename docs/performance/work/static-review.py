"""Static Lite final visual review: compares static-review.mjs's captures of ?render=static and ?render=lite.

    python static-review.py   -> work/static-central-a-closeup.png, results/static-review.json

1672 x 941   the scene's own scale: any remaining difference is a real one (no resampling), with its location
1648, 1366   the same states resampled: differences overall and around the central A, and edge sharpness
close-up     the central A and its connections, 2x, static beside Lite, for both two-station states
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
CAP = HERE / "captures" / "static" / "review"
load = lambda mode, state, w: np.asarray(Image.open(CAP / f"{mode}-{state}-{w}.png").convert("RGB")).astype(np.int16)
sharp = lambda x: float(np.abs(np.diff(x.mean(2), axis=1)).mean() + np.abs(np.diff(x.mean(2), axis=0)).mean())
# The central A, its ring and the connections' meeting points, in scene px (the shared sprite pixels are at about
# (708, 564) and (943, 561)).
HUB = (600, 440, 1090, 700)


def to_view(box, w, h):
    s = max(w / 1672, h / 941)
    ox, oy = (w - 1672 * s) / 2, (h - 941 * s) / 2
    return tuple(int(round(v * s + (ox if i % 2 == 0 else oy))) for i, v in enumerate(box))


def stats(a, b, box=None):
    d = np.abs(a - b).max(axis=2)
    if box:
        d = d[box[1] : box[3], box[0] : box[2]]
    ys, xs = np.nonzero(d > 8)
    return {
        "max": int(d.max()), "over0": int((d > 0).sum()), "over2": int((d > 2).sum()), "over8": int((d > 8).sum()),
        "share_over8": round(float((d > 8).mean()), 4),
        "box_over8": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None,
    }


out = {}
for w, h, states in [(1672, 941, ["rest", "sel-eng-hover-pg", "sel-edu-hover-pg"]), (1648, 928, ["rest", "sel-eng-hover-pg", "sel-edu-hover-pg"]), (1366, 768, ["rest"])]:
    hub = to_view(HUB, w, h)
    for st in states:
        a, b = load("static", st, w), load("lite", st, w)
        out[f"{w} {st}"] = {"frame": stats(a, b), "centralA": stats(a, b, hub), "sharpness": {"static": round(sharp(a), 2), "lite": round(sharp(b), 2)}}

# Close-up at 1648 x 928: static | Lite, for each two-station state, 2x.
hub = to_view(HUB, 1648, 928)
cw, ch = (hub[2] - hub[0]) * 2, (hub[3] - hub[1]) * 2
pad, head = 12, 30
sheet = Image.new("RGB", (cw * 2 + pad * 3, (ch + head) * 2 + pad * 3), (18, 18, 20))
draw = ImageDraw.Draw(sheet)
for row, (st, label) in enumerate([("sel-eng-hover-pg", "Engineering selected + Playground hovered"), ("sel-edu-hover-pg", "Educational selected + Playground hovered")]):
    for col, mode in enumerate(["static", "lite"]):
        x, y = pad + col * (cw + pad), pad + row * (ch + head + pad)
        draw.text((x, y + 8), f"{'Static' if mode == 'static' else 'Lite'}  |  {label}  |  1648 x 928, central A at 2x", fill=(220, 220, 220))
        crop = Image.open(CAP / f"{mode}-{st}-1648.png").convert("RGB").crop(hub).resize((cw, ch), Image.NEAREST)
        sheet.paste(crop, (x, y + head))
sheet.save(HERE / "static-central-a-closeup.png")

(HERE / "results" / "static-review.json").write_text(json.dumps(out, indent=1) + "\n")
for k, v in out.items():
    f, c = v["frame"], v["centralA"]
    print(f"{k:24} frame max {f['max']:3} >0 {f['over0']:7} >8 {f['over8']:6} | central A max {c['max']:3} >0 {c['over0']:6} >8 {c['over8']:5} box {c['box_over8']} | sharp static {v['sharpness']['static']} lite {v['sharpness']['lite']}")
