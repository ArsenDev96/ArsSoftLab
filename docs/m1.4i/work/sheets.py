# The comparison sheets: all-stations-powered.png, viewport-comparison.png, and the default / approved floor measurements.
from PIL import Image, ImageDraw, ImageFont, ImageChops
import numpy as np, json
F = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22); S = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 17)
C = "captures/"
def cap(im, t, f=F):
    o = Image.new("RGB", (im.width, im.height + 36), (18, 18, 20)); o.paste(im, (0, 36)); ImageDraw.Draw(o).text((10, 4), t, fill=(235, 225, 205), font=f); return o
# 1. all stations powered
k = 0.6
ims = [cap(Image.open(C + f"full-powered-{i}.png").convert("RGB").resize((int(1648*k), int(928*k)), Image.LANCZOS), t) for i, t in [("engineering","Engineering powered"),("educational","Educational powered"),("playground","Playground powered"),("creative","Creative Studio powered"),("experience","Experience powered")]]
ims.insert(0, cap(Image.open(C + "idle-default.png").convert("RGB").resize((int(1648*k), int(928*k)), Image.LANCZOS), "Idle (all five at rest)"))
w, h = ims[0].size
s = Image.new("RGB", (w*2+12, h*3+24), (8, 8, 10))
for i, im in enumerate(ims): s.paste(im, ((i % 2)*(w+12), (i//2)*(h+12)))
s.save("../all-stations-powered.png")
# 2. viewports
rows = []
for z in ["1280x800", "1648x928", "1920x1080", "2560x1080"]:
    W, H = map(int, z.split("x")); hh = 330; row = []
    for n, t in [("idle", "idle"), ("experience", "Experience powered"), ("selected-engineering", "Engineering selected"), ("selected-experience", "Experience selected"), ("home", "homepage (idle)")]:
        row.append(cap(Image.open(C + f"vp-{z}-{n}.jpg").convert("RGB").resize((round(W*hh/H), hh), Image.LANCZOS), f"{z}  {t}", S))
    rows.append(row)
W = max(sum(r.width + 10 for r in row) for row in rows)
s = Image.new("RGB", (W, sum(r[0].height + 12 for r in rows)), (8, 8, 10)); y = 0
for row in rows:
    x = 0
    for im in row: s.paste(im, (x, y)); x += im.width + 10
    y += row[0].height + 12
s.save("../viewport-comparison.png"); print(s.size)
# 3. floor tone
a = np.asarray(Image.open(C + "idle-default.png").convert("RGB")).astype(float); b = np.asarray(Image.open(C + "idle-tone.png").convert("RGB")).astype(float); hm = np.asarray(Image.open(C + "idle-home.png").convert("RGB")).astype(float)
d = np.abs(a-b).max(2); L = lambda x: x @ [.2126, .7152, .0722]
ys, xs = np.where(d > 2); r = {"changed_px": int((d > 2).sum()), "share": round(float((d > 2).mean()), 3), "box": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], "max": int(d.max())}
for n, (x0, y0, x1, y1) in {"left floor": (430, 570, 620, 700), "centre floor": (640, 700, 1000, 880), "right floor": (1040, 570, 1180, 700), "back floor": (480, 395, 660, 440), "front left": (460, 780, 620, 880), "under Experience": (1200, 780, 1500, 860)}.items():
    f = lambda m: [round(float(v), 1) for v in m[y0:y1, x0:x1].reshape(-1, 3).mean(0)] + [round(float(L(m[y0:y1, x0:x1]).mean()), 1), round(float(L(m[y0:y1, x0:x1]).std()), 1)]
    r[n] = {"default": f(a), "approved": f(b), "homepage": f(hm)}
json.dump(r, open("floor-tone.json", "w"), indent=1)
for k, v in r.items(): print(k, v)
A, B = [Image.open(C + f"idle-{n}.png").convert("RGB") for n in ("default", "tone")]
s = Image.new("RGB", (1648, 2*(560+36)))
s.paste(cap(A.crop((0, 368, 1648, 928)), "default floor"), (0, 0)); s.paste(cap(B.crop((0, 368, 1648, 928)), "?floor=approved"), (0, 596)); s.save("floor-compare.png")
Image.fromarray(np.clip(d*6, 0, 255).astype("uint8")).save("floor-diff.png")
a = np.asarray(Image.open(C + "reraster-idle.png").convert("RGB")).astype(int); b = np.asarray(Image.open(C + "reraster-pending.png").convert("RGB")).astype(int); d = np.abs(a-b).max(2); ys, xs = np.where(d > 4); print("reraster gpu", d.max(), (d > 4).sum(), [xs.min(), ys.min(), xs.max(), ys.max()] if len(xs) else None)
