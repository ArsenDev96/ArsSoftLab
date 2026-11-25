# M1.4J.4: disc.mjs's frames: mean luminance, texture and brightest pixel of the disc (the pixels M1.4H.4.1 changed), now against the checkpoint.   python disc.py <cap dir>
import glob, os, sys
import numpy as np
from PIL import Image
R = sys.argv[1]
V = "E:/ArsSoftLab/public/scene/v2/"
load = lambda n: np.asarray(Image.open(V + n).convert("RGBA")).astype(int)
m = np.abs(load("m14h4/experience-floor.png") - load("m14h4/experience-floor-lit.png")).max(-1) > 0
st = load("m14f/experience.png")[..., 3] > 0
m &= ~st & ~np.roll(st, -10, 0)  # never under the platform, on the floor or raised
m &= np.arange(1672)[None, :] < 1200
K = 1648 / 1672
mm = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((1648, round(941 * K)), Image.NEAREST)) > 0
Y0 = None
def lum(f):
    a = np.asarray(Image.open(f).convert("RGB")).astype(float)
    l = a @ [0.299, 0.587, 0.114]
    h = min(l.shape[0], mm.shape[0])
    v = l[:h][mm[:h]]
    return v.mean(), v.std(), v.max()
print("px", int(mm.sum()))
for f in sorted(glob.glob(f"{R}/disc-base/*.png"), key=os.path.getmtime):
    n = os.path.basename(f)
    if n.startswith("quick"): continue
    print(n[:-4].ljust(10), "checkpoint mean %.1f sd %.1f max %.0f" % lum(f), "| now mean %.1f sd %.1f max %.0f" % lum(f"{R}/disc-now/{n}"))
for d in ("disc-base", "disc-now"):
    v = [(np.asarray(Image.open(f).convert("RGB")).astype(float) @ [0.299, 0.587, 0.114]) for f in glob.glob(f"{R}/{d}/quick-*.png")]
    print(d, "quick returns:", len(v), "frames, brightest mean of the crop %.1f, highest share of px above 235: %.3f %%" % (max(x.mean() for x in v), 100 * max((x > 235).mean() for x in v)))
