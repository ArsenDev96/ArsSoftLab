"""M1.4I.2: every scene file /lab-v2 loads (loaded.json, from loaded.mjs): size, visible bounds, alpha coverage.
    python audit.py   -> the tables of ../asset-audit.md"""
import json, os
import numpy as np
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(H, "..", "..", ".."))
urls = json.load(open(os.path.join(H, "loaded.json")))
crops = {r["crop"]: r for r in json.load(open(os.path.join(H, "..", "crop-map.json")))["images"]}
def info(u):
    f = os.path.join(ROOT, "public", *u.strip("/").split("/")); im = Image.open(f)
    a = np.array(im.convert("RGBA"))[..., 3]; ys, xs = np.nonzero(a)
    return dict(w=im.width, h=im.height, mb=im.width * im.height * 4 / 2**20, cov=100 * float((a > 0).mean()), bb=(int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1), kb=os.path.getsize(f) // 1024)
rows = [(u, info(u)) for u in urls]
print("### Cropped\n")
print("| Source (1672 × 941, 6.00 MB) | Visible bounds (x, y, w × h) | Alpha > 0 | Crop (x, y, w × h) | Decoded | File, kB |\n|---|---|---|---|---|---|")
for r in crops.values():
    v, q = r["visible_bbox"], r["rect"]
    print(f'| `{r["source"][10:] if r["source"].startswith("/scene/v2/") else r["source"]}` | {v["x"]}, {v["y"]}, {v["w"]} × {v["h"]} | {r["alpha_coverage_pct"]:.2f} % | {q["x"]}, {q["y"]}, {q["w"]} × {q["h"]} | {r["decoded_mb"][1]:.2f} MB | {r["bytes"][0] // 1024} → {r["bytes"][1] // 1024} |')
tot = [sum(r["decoded_mb"][k] for r in crops.values()) for k in (0, 1)]
print(f"| **{len(crops)} files** | | | | **{tot[0]:.1f} → {tot[1]:.1f} MB** | {sum(r['bytes'][0] for r in crops.values()) // 1024} → {sum(r['bytes'][1] for r in crops.values()) // 1024} |\n")
print("### Left as they are\n")
print("| File | Size | Visible bounds | Alpha > 0 | Decoded | If cropped |\n|---|---|---|---|---|---|")
rest = [(u, i) for u, i in rows if u not in crops]
for u, i in sorted(rest, key=lambda t: -t[1]["mb"]):
    if i["mb"] < 0.5: continue
    b = i["bb"]; c = (b[2] - b[0]) * (b[3] - b[1]) * 4 / 2**20
    print(f'| `{u[7:]}` | {i["w"]} × {i["h"]} | {b[0]}, {b[1]}, {b[2]-b[0]} × {b[3]-b[1]} | {i["cov"]:.2f} % | {i["mb"]:.2f} MB | {c:.2f} MB |')
small = [i for u, i in rest if i["mb"] < 0.5]
print(f'| {len(small)} smaller files (already cropped line masks and traces) | | | | {sum(i["mb"] for i in small):.2f} MB | |')
print("total loaded", len(rows), round(sum(i["mb"] for _, i in rows), 1), "MB")
