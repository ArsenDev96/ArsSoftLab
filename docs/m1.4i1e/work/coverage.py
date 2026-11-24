# Offline: straight hotspot <-> label paths over the recorded hit map plus proposed connector polygons (scene px).
# Needs the hit maps: run geometry.mjs before (checkpoint code) first; the kept geometry-*.json have the boxes only.
#   python coverage.py bridges.json -> table, coverage.png
import json, sys
import numpy as np
from PIL import Image, ImageDraw
g = json.load(open("geometry-before.json"))
B = json.load(open(sys.argv[1]))
IDS = dict(engineering="e", educational="d", playground="p", creative="c", experience="x")
rng = np.random.default_rng(1)
Y0, HH, WW = 180, 621, 1672
def poly(pts):
    S = 4
    im = Image.new("1", (WW * S, HH * S)); ImageDraw.Draw(im).polygon([(x * S, (y - Y0) * S) for x, y in pts], fill=1)
    return np.array(im.resize((WW, HH), Image.BOX).convert("L") if False else im)[::S, ::S]
def arr(s): return np.array([[ord(c) for c in r] for r in g["map"][s]])
bg = np.array(Image.open("scene-rest.png").convert("RGB").resize((1672, 941))).astype(float)
masks = {k: poly(v) for k, v in B.items()}
for id, c in IDS.items():
    for state in ["rest"] + ([id] if id == "playground" else []):
        a = arr(state); mine = (a == ord(c)) | (a == ord(c.upper()))
        # A hotspot or label of any station sits above a connector.
        free = a == ord("."); br = masks[id] & free
        own = mine | br
        hot = np.argwhere(a == ord(c)); lb = np.argwhere(a == ord(c.upper()))
        N, n = 60000, 400
        A = hot[rng.integers(len(hot), size=N)].astype(float); E = lb[rng.integers(len(lb), size=N)].astype(float)
        t = np.linspace(0, 1, n)
        I = np.rint(A[:, None, :] * (1 - t)[None, :, None] + E[:, None, :] * t[None, :, None]).astype(int)
        seg = np.linalg.norm(E - A, axis=1) / (n - 1)
        def longest(m):
            run = np.zeros(N); best = np.zeros(N)
            for k in range(n):
                run = np.where(m[I[:, k, 0], I[:, k, 1]], 0, run + 1); best = np.maximum(best, run)
            return best * seg
        L0, L = longest(mine), longest(own)
        miss = ~own[I[..., 0], I[..., 1]]
        crossed_other = (~free & ~mine)[I[..., 0], I[..., 1]].any(1).mean()
        over = [(k, int((masks[id] & m).sum())) for k, m in masks.items() if k != id and (masks[id] & m).any()]
        hits = {ch: int((masks[id] & (a == ord(ch))).sum()) for ch in "edpcxEDPCXN" if ch.lower() != c and (masks[id] & (a == ord(ch))).any()}
        print(f"{id:12s} {state:10s} connector {int(br.sum())} px | paths with a gap {100*(L0>1.5).mean():.1f}% -> {100*(L>1.5).mean():.2f}% ; >20px {100*(L0>20).mean():.1f}% -> {100*(L>20).mean():.2f}% ; max {L0.max():.0f} -> {L.max():.0f}px | paths over another station {100*crossed_other:.2f}% | polygon over others {hits} bridges {over}")
        if state == "rest":
            sub = bg[Y0:Y0 + HH]
            sub[br] = sub[br] * 0.45 + np.array([255, 190, 60]) * 0.55
            cnt = np.zeros((HH, WW)); m = ~own[I[..., 0], I[..., 1]]; np.add.at(cnt, (I[..., 0][m], I[..., 1][m]), 1)
            z = cnt > 0; sub[z] = sub[z] * 0.4 + np.array([255, 40, 40]) * 0.6
Image.fromarray(bg.astype("uint8")).crop((0, Y0, 1672, 800)).save("coverage.png")
