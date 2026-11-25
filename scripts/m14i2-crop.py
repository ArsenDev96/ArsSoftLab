"""M1.4I.2: lossless crops of /lab-v2's full-frame layers.

    python scripts/m14i2-crop.py            writes the crops and the coordinate maps
    python scripts/m14i2-crop.py --check    verifies what is on disk, writes nothing

For every source below, the smallest rectangle holding every pixel with alpha > 0,
widened by GUARD fully transparent pixels (the scene is drawn scaled, so an edge
pixel is filtered with its neighbours), is copied byte for byte: no resizing, no
resampling, no colour conversion. The sources are not modified.

Outputs:
    public/scene/v2/m14i2/*.png       the crops
    components/lab/scene-crops.ts     source -> crop and its place in the 1672 x 941 scene
    docs/m1.4i2/crop-map.json         the same, with the measurements

Dependencies: numpy, Pillow (scripts/requirements.txt).
"""
import io
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUB = os.path.join(ROOT, "public")
OUT = "/scene/v2/m14i2"
W, H = 1672, 941
GUARD = 2

SOURCES = [
    # floor
    "/scene/v2/m14h4/floor-light.png",
    "/scene/v2/m14g/contact.png",
    "/scene/v2/m14g1/playground-ring.png",
    "/scene/v2/m14g1/playground-ring-lit.png",
    "/scene/v2/m14g1/playground-occlusion.png",
    "/scene/v2/m14g1/playground-reflection.png",
    "/scene/v2/m14g1/playground-reflection-lit.png",
    # the central A and the foreground
    "/scene/v2/m14e/fg-table.png",
    "/scene/v2/m14e/fg-plant.png",
    # Engineering
    "/scene/v2/m14h1/engineering-strip-floor.png",
    "/scene/v2/m14h1/engineering-strip-off.png",
    "/scene/v2/m14h1/engineering-strip-light.png",
    "/scene/v2/m14h1/engineering-screen-bars.png",
    "/scene/v2/m14h1/engineering-chart.png",
    "/scene/v2/m14h1/engineering-floor.png",
    # Educational
    "/scene/v2/m14f1/educational.png",
    "/scene/v2/m14f1/educational-light.png",
    "/scene/v2/m14h2/educational-body.png",
    "/scene/v2/m14h2/educational-globe.png",
    "/scene/v2/m14h2/educational-globe-light.png",
    "/scene/v2/m14h2/educational-orbit.png",
    "/scene/v2/m14h2/educational-orbit-light.png",
    "/scene/v2/m14h2/educational-strip-floor.png",
    "/scene/v2/m14h2/educational-strip-off.png",
    "/scene/v2/m14h2/educational-strip-light.png",
    "/scene/v2/m14h2/educational-base.png",
    "/scene/v2/m14h2/educational-flare.png",
    "/scene/v2/m14h2/educational-floor.png",
    "/scene/v2/m14h2/educational-floor-cyan.png",
    # Creative Studio
    "/scene/v2/m14h3/creative-strip-floor.png",
    "/scene/v2/m14h3/creative-strip-off.png",
    "/scene/v2/m14h3/creative-strip-light.png",
    "/scene/v2/m14h3/creative-standby.png",
    "/scene/v2/m14h3/creative-warm.png",
    "/scene/v2/m14h3/creative-highlights.png",
    "/scene/v2/m14h3/creative-floor.png",
    "/scene/v2/m14h3/creative-floor-top.png",
    # Creative Studio's lift (M1.4J.3)
    "/scene/v2/m14j3/creative-fill.png",
    "/scene/v2/m14j3/creative-fill-off.png",
    "/scene/v2/m14j3/creative-books.png",
    "/scene/v2/m14j3/creative-steam.png",
    "/scene/v2/m14j3/creative-light-edge.png",
    "/scene/v2/m14j3/creative-light-spill.png",
    "/scene/v2/m14j3/creative-floor-edge.png",
    "/scene/v2/m14j3/creative-floor-rest.png",
    "/scene/v2/m14j4/experience-light-edge.png",
    "/scene/v2/m14j4/experience-light-spill.png",
    "/scene/v2/m14j4/experience-floor-edge.png",
    "/scene/v2/m14j4/experience-floor-rest.png",
    "/scene/v2/m14j4/experience-floor-lit-rest.png",
    # Experience
    "/scene/v2/m14h4/experience-strip-off.png",
    "/scene/v2/m14h4/experience-strip-light.png",
    "/scene/v2/m14h4/experience-standby.png",
    "/scene/v2/m14h4/experience-floor.png",
    "/scene/v2/m14h4/experience-floor-lit.png",
    "/scene/v2/m14h4/experience-floor-top.png",
]

disk = lambda url: os.path.join(PUB, *url.strip("/").split("/"))


def name(src):
    parts = src.strip("/").split("/")
    return f"{OUT}/{parts[-2]}-{parts[-1]}"


def rect(alpha):
    ys, xs = np.nonzero(alpha)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    g = (max(0, x0 - GUARD), max(0, y0 - GUARD), min(W, x1 + GUARD), min(H, y1 + GUARD))
    return (x0, y0, x1, y1), g


def main(check):
    if not check:
        os.makedirs(disk(OUT), exist_ok=True)
    rows, bad = [], 0
    for src in SOURCES:
        im = Image.open(disk(src))
        assert im.size == (W, H) and im.mode == "RGBA" and not ({"icc_profile", "gamma", "transparency"} & set(im.info)), (src, im.size, im.mode, im.info)
        a = np.array(im)
        bbox, (x0, y0, x1, y1) = rect(a[..., 3])
        out = name(src)
        # A crop that already holds these pixels is left as it is (another Pillow would only compress it differently).
        if not check and not (os.path.exists(disk(out)) and np.array_equal(np.array(Image.open(disk(out))), a[y0:y1, x0:x1])):
            buf = io.BytesIO()
            Image.fromarray(a[y0:y1, x0:x1]).save(buf, "PNG", optimize=True)
            with open(disk(out), "wb") as f:
                f.write(buf.getvalue())
        # Put back on an empty canvas: every visible pixel as in the source, nothing else.
        b = np.array(Image.open(disk(out)))
        canvas = np.zeros_like(a)
        same = b.shape == (y1 - y0, x1 - x0, 4)
        if same:
            canvas[y0:y1, x0:x1] = b
            vis = a[..., 3] > 0
            same = np.array_equal(canvas[vis], a[vis]) and not canvas[..., 3][~vis].any()
        bad += not same
        rows.append({
            "source": src,
            "crop": out,
            "canvas": [W, H],
            "rect": {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0},
            "visible_bbox": {"x": bbox[0], "y": bbox[1], "w": bbox[2] - bbox[0], "h": bbox[3] - bbox[1]},
            "alpha_coverage_pct": round(100 * float((a[..., 3] > 0).mean()), 3),
            "visible_px": int((a[..., 3] > 0).sum()),
            "decoded_mb": [round(W * H * 4 / 2**20, 3), round((x1 - x0) * (y1 - y0) * 4 / 2**20, 3)],
            "bytes": [os.path.getsize(disk(src)), os.path.getsize(disk(out))],
            "lossless": bool(same),
        })
    before, after = (sum(r["decoded_mb"][k] for r in rows) for k in (0, 1))
    kb = [sum(r["bytes"][k] for r in rows) // 1024 for k in (0, 1)]
    print(f"{len(rows)} images, {bad} not lossless; decoded {before:.1f} -> {after:.1f} MB; files {kb[0]} -> {kb[1]} kB")
    for r in rows:
        q = r["rect"]
        print(f'  {r["source"]:48s} {q["w"]:4d} x {q["h"]:3d} at {q["x"]:4d},{q["y"]:3d}  {r["decoded_mb"][1]:.2f} MB')
    if bad:
        sys.exit(1)
    if check:
        return
    m = {r["source"]: {"src": r["crop"], **r["rect"]} for r in rows}
    with open(os.path.join(ROOT, "components", "lab", "scene-crops.ts"), "w", encoding="utf8", newline="\n") as f:
        f.write(
            "// Generated by scripts/m14i2-crop.py (M1.4I.2). Do not edit.\n"
            "// A full-frame layer (1672 x 941) -> its lossless crop, and where that lies in the same scene px.\n\n"
            "export type SceneCrop = { src: string; x: number; y: number; w: number; h: number };\n\n"
            "export const SCENE_CROPS: Readonly<Record<string, SceneCrop>> = {\n"
        )
        for k, v in m.items():
            f.write(f"  {json.dumps(k)}: {json.dumps(v)},\n")
        f.write("};\n")
    os.makedirs(os.path.join(ROOT, "docs", "m1.4i2"), exist_ok=True)
    with open(os.path.join(ROOT, "docs", "m1.4i2", "crop-map.json"), "w", encoding="utf8", newline="\n") as f:
        json.dump({"canvas": [W, H], "guard_px": GUARD, "command": "python scripts/m14i2-crop.py", "images": rows}, f, indent=1)
        f.write("\n")


main("--check" in sys.argv)
