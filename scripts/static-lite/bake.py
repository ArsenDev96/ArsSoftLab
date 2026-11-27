"""Lite's flattened scene, step 2 of 2: build the plate and the five powered sprites from bake.mjs's captures.

    python scripts/static-lite/bake.py [--captures <dir>] [--out <dir>]

--captures  bake.mjs's frames (default: <os temp>/arssoftlab-static-lite)
--out       where the images go (default: public/scene/static-lite). Only when writing there is the manifest
            (components/lab/static-lite-manifest.json) updated: checksums, sizes and the sprites' boxes. Then run
            `node scripts/static-lite/check.mjs --write` to record the sources and the commit.

plate     the layered Lite scene at rest, 1672 x 941, lossless WebP.
sprites   for each station, only the pixels its powered state changes (any channel differing from rest), cropped to
          their bounding box, transparent elsewhere, lossless. Drawn over the plate, each gives exactly the captured
          powered frame; two sprites only disagree where both stations change the same pixel.
Requires Pillow and NumPy. Development tool only: nothing here runs in the build.
"""
import argparse
import hashlib
import json
import tempfile
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public" / "scene" / "static-lite"
MANIFEST = ROOT / "components" / "lab" / "static-lite-manifest.json"
STATIONS = ["engineering", "educational", "playground", "creative", "experience"]

ap = argparse.ArgumentParser()
ap.add_argument("--captures", type=Path, default=Path(tempfile.gettempdir()) / "arssoftlab-static-lite")
ap.add_argument("--out", type=Path, default=PUBLIC)
args = ap.parse_args()
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=True)

load = lambda name: np.asarray(Image.open(args.captures / f"{name}.png").convert("RGB")).astype(np.int16)
rest = load("rest")
assert np.abs(rest - load("rest-2")).max() == 0, "the two rest captures differ: the scene is not static at rest"
assert rest.shape[:2] == (941, 1672), f"captures are {rest.shape[1]} x {rest.shape[0]}, not 1672 x 941"

Image.fromarray(rest.astype(np.uint8)).save(out / "plate.webp", lossless=True, quality=100, method=6)
boxes = {}
for sid in STATIONS:
    on = load(f"on-{sid}")
    changed = np.abs(on - rest).max(axis=2) > 0
    ys, xs = np.nonzero(changed)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = on[y0:y1, x0:x1]
    rgba[..., 3] = np.where(changed[y0:y1, x0:x1], 255, 0)
    path = out / f"on-{sid}.webp"
    Image.fromarray(rgba, "RGBA").save(path, lossless=True, quality=100, method=6, exact=True)
    # Round trip: the sprite over the plate must give the captured powered frame back exactly.
    back = np.asarray(Image.open(path).convert("RGBA")).astype(np.int16)
    comp = rest.copy()
    m = back[..., 3] == 255
    comp[y0:y1, x0:x1][m] = back[..., :3][m]
    assert np.abs(comp - on).max() == 0, f"{sid}: sprite does not reproduce its powered frame"
    boxes[f"on-{sid}.webp"] = {"x": int(x0), "y": int(y0), "w": int(x1 - x0), "h": int(y1 - y0)}

digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assets = {f: {"sha256": digest(out / f), "bytes": (out / f).stat().st_size, **({"box": boxes[f]} if f in boxes else {})} for f in ["plate.webp", *boxes]}
for f, a in assets.items():
    print(f"{f:22} {a['sha256'][:16]}  {a['bytes']:8} B  {a.get('box', '')}")

if out == PUBLIC.resolve():
    manifest = json.loads(MANIFEST.read_text())
    manifest["assets"] = assets
    manifest["source"].update({"viewport": "1672x941", "bakedOn": date.today().isoformat()})
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Updated {MANIFEST.relative_to(ROOT)}. Next: node scripts/static-lite/check.mjs --write")
