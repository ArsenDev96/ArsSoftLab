# M1.4J.3: the review sheets from capture.mjs and align.mjs.   python sheets.py <cap dir> <out dir>
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
CAP, OUT = sys.argv[1:3]
EV, AL, HE = f"{CAP}/ev", f"{CAP}/align", f"{CAP}/heights"
F = lambda s, b=False: ImageFont.truetype("C:/Windows/Fonts/segoeui%s.ttf" % ("b" if b else ""), s)
info = json.load(open(f"{EV}/states.json"))
BG, G = (16, 17, 20), 12
def sheet(name, title, sub, rows):
    """rows: [row title or None, [[label, PIL image], ...]]"""
    W = max(max(sum(i.width + G for _, i in r[1]) + G for r in rows), 1150)
    H = 84 + sum((30 if r[0] else 0) + 26 + max(i.height for _, i in r[1]) + G for r in rows)
    o = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(o)
    d.text((G, 10), title, font=F(23, True), fill="white"); d.text((G, 46), sub, font=F(15), fill=(170, 172, 178))
    y = 84
    for t, cells in rows:
        if t: d.text((G, y), t, font=F(17, True), fill=(255, 197, 108)); y += 30
        x = G
        for label, im in cells:
            d.text((x, y + 2), label, font=F(14), fill=(212, 214, 217)); o.paste(im.convert("RGB"), (x, y + 26)); x += im.width + G
        y += 26 + max(i.height for _, i in cells) + G
    o.save(f"{OUT}/{name}", optimize=True)
    print(name, o.size, os.path.getsize(f"{OUT}/{name}") // 1024, "kB")
im = lambda k, r, d=EV: Image.open(f"{d}/{k}.{r}.png")
up = lambda k: f"{info[k]['y']:.1f} px up"
D = {"default-rest": "Rest", "default-0": "Spark arrival (+0 ms)", "default-25": "Quarter lift (+222 ms)", "default-50": "Half lift (+288 ms)", "default-full": "Full lift, 10 px (+760 ms on)", "default-leave": "Partial return (147 ms after leaving)", "default-back": "Fully returned"}
c = lambda k, r: [f"{D[k]}: {up(k)}", im(k, r)]
FROZEN = "Frames frozen at the sequence's own times, 1648 x 928, enlarged. Deterministic captures, not a real-time recording."
fit = lambda i, w: i.resize((w, round(i.height * w / i.width)), Image.LANCZOS)
sheet("creative-lift-phases.png", "M1.4J.3 Creative Studio lift: phases", FROZEN, [
    [None, [c("default-rest", "station"), c("default-0", "station")]], [None, [c("default-25", "station"), c("default-50", "station")]],
    [None, [c("default-full", "station"), c("default-leave", "station")]],
    [None, [c("default-back", "station"), ["Full lift, ?floor=approved: " + up("tone-full"), im("tone-full", "station")]]]])
sheet("creative-lift-closeup.png", "M1.4J.3 Creative Studio lift: close-up (3x)", FROZEN, [[None, [c("default-rest", "close")]], [None, [c("default-50", "close")]], [None, [c("default-full", "close")]]])

def black(s, m, d):
    a, b = [np.asarray(Image.open(f"{AL}/{s}-{m}-{k}.png").convert("RGB")).astype(int) for k in (0, d)]
    still = np.abs(b - a).max(-1); moved = np.zeros_like(still); moved[:-d] = np.abs(b[:-d] - a[d:]).max(-1)
    box = (85, 485, 525, 790)
    heat = lambda x: Image.fromarray(np.clip(x * 20, 0, 255).astype(np.uint8)).crop(box).resize((528, 366), Image.NEAREST)
    return Image.fromarray(b.astype(np.uint8)).crop(box).resize((528, 366), Image.LANCZOS), heat(still), heat(moved), int(moved.max()), int((moved > 2).sum())
moving = [[f"+{t} ms: {info[f'm{t}']['y']:.1f} px up", fit(im(f"m{t}", "canvas"), 400)] for t in (150, 200, 260, 320, 420, 500, 600, 740)]
rows = [["The sunrise, the ridge's glint and the small paintings while the station rises", moving[:4]], [None, moving[4:]]]
for s, m, d in (("station", "230", 3), ("painting", "300", 5), ("painting", "500", 7), ("station", "1500", 10)):
    a, h1, h2, mx, n = black(s, m, d)
    rows.append([f"{'The station' if s == 'station' else 'Only the light layers (standby, warm, crest, glints, strips)'} on black, +{m} ms, lifted {d} device px", [["every layer", a], ["difference to the resting frame (x20)", h1], [f"the same, shifted back by {d} px: max {mx} of 255, {n} px above 2", h2]]])
sheet("sunrise-alignment.png", "M1.4J.3 sunrise alignment", FROZEN + " Full result for 16 moments at 4 heights: work/align.txt.", rows)

sheet("connection-and-shadow.png", "M1.4J.3 the connection, the ground and the strips' light", FROZEN, [
    ["The connection (6x): it ends at the stone's upright right side, which rises along itself", [[l, fit(i, 560)] for l, i in (c("default-rest", "line"), c("default-50", "line"), c("default-full", "line"))]],
    [None, [[l, fit(i, 560)] for l, i in (c("default-leave", "line"), c("default-back", "line"))]],
    ["The contact shadow giving way to the soft one of the platform's own footprint (3.4x)", [c("default-rest", "under")]], [None, [c("default-25", "under")]], [None, [c("default-50", "under")]], [None, [c("default-full", "under")]], [None, [c("default-leave", "under")]],
    ["The right corner (5x): the strip's edge rises, its light on the floor and the ring stay", [[l, fit(i, 560)] for l, i in (c("default-rest", "right"), c("default-50", "right"), c("default-full", "right"))]],
    ["Floor, ring and reflections (2x)", [["Full", fit(im("default-full", "floor"), 860)], ["Full, ?floor=approved", fit(im("tone-full", "floor"), 860)]]]])

sheet("foreground-occlusion.png", "M1.4J.3 what stands in front stays in front", FROZEN + " 'As it is': the recovered station lifted without this milestone's layers.", [
    ["Books (5x): the station holds the upper book's edge and a corner of the second, and ends where they hid it", [["Rest", fit(im("default-rest", "left"), 560)], ["Lifted as it is (not used)", fit(im("plain", "left"), 560)], ["Full lift", fit(im("default-full", "left"), 560)]]],
    ["Steam (5x): the station holds some of it, and the steam layer some of the stone's edge", [["Rest", fit(im("default-rest", "steam"), 560)], ["Lifted as it is (not used)", fit(im("plain", "steam"), 560)], ["Full lift", fit(im("default-full", "steam"), 560)]]],
    ["Quarter, half and partial return", [[f"{D[k]}", fit(im(k, "left"), 560)] for k in ("default-25", "default-50", "default-leave")]], [None, [[f"{D[k]}", fit(im(k, "steam"), 560)] for k in ("default-25", "default-50", "default-leave")]],
    ["Engineering's platform behind the canvas (5x), and the label (3.4x)", [["Rest", fit(im("default-rest", "top"), 420)], ["Full lift", fit(im("default-full", "top"), 420)], ["Rest", fit(im("default-rest", "label"), 420)], ["Full lift", fit(im("default-full", "label"), 420)]]]])

h = lambda n, r, w: [[f"{px} px" + (" (chosen)" if px == 10 else ""), fit(Image.open(f"{HE}/h{px}.{r}.png"), w)] for px in (8, 10, 12)]
sheet("lift-height-comparison.png", "M1.4J.3 lift height: 8, 10 (chosen), 12 px, fully raised", FROZEN, [
    [None, h(0, "station", 620)], ["The canvas against Engineering's platform (6x)", h(0, "top", 620)], ["Label and Wallpapers chip", h(0, "label", 620)], ["Ground and right corner", h(0, "under", 620)], [None, h(0, "right", 620)], ["Books", h(0, "left", 620)], ["Steam", h(0, "steam", 620)]])
