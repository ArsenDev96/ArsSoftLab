# Which empty pixels straight moves between a station's hotspot and its own label cross (hit map, scene px).
# Needs the hit maps: run geometry.mjs <label> first (the kept geometry-*.json have the boxes only).
#   python lines.py <label>  -> lines-<label>.png (shading: share of paths), table
import json, sys
import numpy as np
from PIL import Image
lab = sys.argv[1]
g = json.load(open(f"geometry-{lab}.json"))
IDS = dict(engineering="e", educational="d", playground="p", creative="c", experience="x")
rng = np.random.default_rng(1)
H0 = 180
acc_img = np.zeros((621, 1672), float)
def arr(state): return np.array([[ord(c) for c in r] for r in g["map"][state]])
for id, c in IDS.items():
    for state in ["rest"] + ([id] if id == "playground" else []):
        a = arr(state)
        hot = np.argwhere(a == ord(c)); labp = np.argwhere(a == ord(c.upper()))
        own = (a == ord(c)) | (a == ord(c.upper()))
        N = 60000
        A = hot[rng.integers(len(hot), size=N)].astype(float); B = labp[rng.integers(len(labp), size=N)].astype(float)
        n = 400
        t = np.linspace(0, 1, n)
        P = A[:, None, :] * (1 - t)[None, :, None] + B[:, None, :] * t[None, :, None]
        I = np.rint(P).astype(int)
        ok = own[I[..., 0], I[..., 1]]
        seg = np.linalg.norm(B - A, axis=1) / (n - 1)
        # longest uncovered run
        run = np.zeros(N); best = np.zeros(N)
        for k in range(n):
            run = np.where(ok[:, k], 0, run + 1); best = np.maximum(best, run)
        L = best * seg
        cnt = np.zeros_like(a, float); m = ~ok
        np.add.at(cnt, (I[..., 0][m], I[..., 1][m]), 1)
        cnt[own] = 0
        area = (cnt > 0).sum()
        s = np.sort(cnt[cnt > 0])[::-1]; cum = np.cumsum(s) / s.sum()
        oth = (cnt > 0) & (a != ord("."))
        print(f"{id:12s} {state:10s} gap px: median {np.median(L):.0f}, 95% {np.percentile(L,95):.0f}, max {L.max():.0f}; paths with a gap {100*(L>1).mean():.0f}%; crossed px {area}, px for 90/99% of crossings {np.searchsorted(cum,.9)}/{np.searchsorted(cum,.99)}; hotspot {len(hot)} label {len(labp)}; on others {oth.sum()}")
        if state == "rest" or id == "playground": acc_img = np.maximum(acc_img, (cnt / cnt.max()) ** 0.4)
bg = Image.open("scene-rest.png").convert("RGB").resize((1672, 941))
o = np.array(bg).astype(float); sub = o[H0:H0+621]
sub[:] = sub * (1 - 0.8 * acc_img[..., None]) + np.array([255, 60, 60]) * 0.8 * acc_img[..., None]
Image.fromarray(o.astype("uint8")).crop((0, 180, 1672, 800)).save(f"lines-{lab}.png")
