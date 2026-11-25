# M1.4J.4: the review sheets from capture.mjs and align.mjs.   python sheets.py <cap dir> <out dir>
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
D = {"default-rest": "Rest", "default-0": "Spark arrival (+0 ms)", "default-25": "Quarter lift (+236 ms)", "default-50": "Half lift (+301 ms)", "default-full": "Full lift, 10 px (+790 ms on)", "default-leave": "Partial return (147 ms after leaving)", "default-back": "Fully returned"}
c = lambda k, r: [f"{D[k]}: {up(k)}", im(k, r)]
FROZEN = "Frames frozen at the sequence's own times, 1648 x 928, enlarged. Deterministic captures, not a real-time recording."
fit = lambda i, w: i.resize((w, round(i.height * w / i.width)), Image.LANCZOS)
sheet("experience-lift-phases.png", "M1.4J.4 Experience lift: phases", FROZEN, [
    [None, [c("default-rest", "station"), c("default-0", "station")]], [None, [c("default-25", "station"), c("default-50", "station")]],
    [None, [c("default-full", "station"), c("default-leave", "station")]],
    [None, [c("default-back", "station"), ["Full lift, ?floor=approved: " + up("tone-full"), im("tone-full", "station")]]]])
sheet("experience-lift-closeup.png", "M1.4J.4 Experience lift: close-up", FROZEN, [[None, [c("default-rest", "close")]], [None, [c("default-50", "close")]], [None, [c("default-full", "close")]]])

def black(s, m, d):
    a, b = [np.asarray(Image.open(f"{AL}/{s}-{m}-{k}.png").convert("RGB")).astype(int) for k in (0, d)]
    still = np.abs(b - a).max(-1); moved = np.zeros_like(still); moved[:-d] = np.abs(b[:-d] - a[d:]).max(-1)
    box = (1180, 490, 1648, 790) if s == "station" else (1360, 515, 1560, 715)
    w = 560 if s == "station" else 400
    z = lambda i, f: i.crop(box).resize((w, round(w * (box[3] - box[1]) / (box[2] - box[0]))), f)
    heat = lambda x: z(Image.fromarray(np.clip(x * 20, 0, 255).astype(np.uint8)), Image.NEAREST)
    return z(Image.fromarray(b.astype(np.uint8)), Image.LANCZOS), heat(still), heat(moved), int(moved.max()), int((moved > 2).sum())
P = {150: "start", 250: "25 % of the route", 320: "", 388: "50 % of the route", 460: "", 545: "75 % of the route", 650: "", 720: "", 790: "destination", 850: "upper flag"}
moving = [[f"+{t} ms: {info[f'm{t}']['y']:.1f} px up" + (f", {P[t]}" if P[t] else ""), fit(im(f"m{t}", "trail"), 330)] for t in P]
rows = [["The energy on the painted route, the ridges and the flags while the landscape rises", moving[:5]], [None, moving[5:]]]
for s, m, d in (("trail", "250", 3), ("trail", "388", 7), ("trail", "545", 10), ("trail", "820", 10), ("station", "388", 7), ("station", "1500", 10)):
    a, h1, h2, mx, n = black(s, m, d)
    rows.append([f"{'The whole station' if s == 'station' else 'Only the route, ridge, flag and strip layers, without the station itself,'} on black, +{m} ms, lifted {d} device px", [["every layer", a], ["difference to the same moment on the floor (x20)", h1], [f"the same, shifted back by {d} px: max {mx} of 255, {n} px above 2", h2]]])
sheet("trail-alignment.png", "M1.4J.4 trail, ridge and flag alignment", FROZEN + " Full result for 18 moments at 4 heights: work/align.txt.", rows)

sheet("connection-and-shadow.png", "M1.4J.4 the connection, the ground and the strips' light", FROZEN, [
    ["The connection (6x): it ends on the stone's upright left side, which rises along itself", [[l, fit(i, 560)] for l, i in (c("default-rest", "line"), c("default-25", "line"), c("default-50", "line"))]],
    [None, [[l, fit(i, 560)] for l, i in (c("default-full", "line"), c("default-leave", "line"), c("default-back", "line"))]],
    ["The contact shadow giving way to the soft one of the platform's own footprint", [c("default-rest", "under")]], [None, [c("default-25", "under")]], [None, [c("default-50", "under")]], [None, [c("default-full", "under")]], [None, [c("default-leave", "under")]],
    ["The strips' light in one piece on the floor (not used): a second strip stays behind, and the rim is lit twice", [["Full lift", fit(im("plain", "under"), 1130)], ["", fit(im("plain", "left"), 420)]]],
    ["The left rim and the floor beside it (M1.4H.4.1's disc), the right corner", [[l, fit(i, 420)] for l, i in (c("default-rest", "left"), c("default-50", "left"), c("default-full", "left"))]],
    [None, [[l, fit(i, 420)] for l, i in (c("default-rest", "right"), c("default-50", "right"), c("default-full", "right"))]],
    ["Floor, ring and reflections", [["Full", fit(im("default-full", "floor"), 860)], ["Full, ?floor=approved", fit(im("tone-full", "floor"), 860)]]]])

sheet("code-panel-occlusion.png", "M1.4J.4 the code panel, what stands near, what stands in front", FROZEN, [
    ["The panel rises with the terrain: both posts stand in it, the ridges and the upper flag stand before it (4x)", [[l, fit(i, 440)] for l, i in (c("default-rest", "panel"), c("default-50", "panel"), c("default-full", "panel"))]],
    [None, [[l, fit(i, 440)] for l, i in (c("default-25", "panel"), c("default-leave", "panel"), c("default-back", "panel"))]],
    ["The panel beside Playground's platform (5x)", [[l, fit(i, 440)] for l, i in (c("default-rest", "pg"), c("default-50", "pg"), c("default-full", "pg"))]],
    ["Icon, title and Koreez chip", [c("default-rest", "label"), c("default-full", "label")]],
    ["The plant on the stone (rises) and the foreground plant (stays)", [[l, fit(i, 440)] for l, i in (c("default-rest", "plant"), c("default-50", "plant"), c("default-full", "plant"))]]])

h = lambda n, r, w: [[f"{px} px" + (" (chosen)" if px == 10 else ""), fit(Image.open(f"{HE}/h{px}.{r}.png"), w)] for px in (8, 10, 12)]
sheet("lift-height-comparison.png", "M1.4J.4 lift height: 8, 10 (chosen), 12 px, fully raised", FROZEN, [
    [None, h(0, "station", 620)], ["Terrain and Koreez chip", h(0, "label", 620)], ["Ground: strip, gap and the strip's light on the floor", h(0, "under", 620)], ["Left rim", h(0, "left", 620)], ["Right corner", h(0, "right", 620)], ["Code panel", h(0, "panel", 620)], ["Beside Playground", h(0, "pg", 620)]])
