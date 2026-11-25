# M1.4J.2: the review sheets from capture.mjs, align.mjs and refs.mjs.   python sheets.py <run dir> <out dir>
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
RUN, OUT = sys.argv[1:3]
EV, AL, HE = f"{RUN}/cap/j2/ev", f"{RUN}/cap/j2/align", f"{RUN}/cap/j2/heights"
F = lambda s, b=False: ImageFont.truetype("C:/Windows/Fonts/segoeui%s.ttf" % ("b" if b else ""), s)
info = json.load(open(f"{EV}/states.json"))
BG, G = (16, 17, 20), 12
def sheet(name, title, sub, rows):
    """rows: [row title or None, [[label, PIL image], ...]]"""
    W = max(sum(i.width + G for _, i in r[1]) + G for r in rows)
    W = max(W, 1100)
    H = 84 + sum((30 if r[0] else 0) + 26 + max(i.height for _, i in r[1]) + G for r in rows)
    o = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(o)
    d.text((G, 10), title, font=F(23, True), fill="white")
    d.text((G, 46), sub, font=F(15), fill=(170, 172, 178))
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
N = [("default-rest", "Rest"), ("default-0", "Spark arrival (+0 ms)"), ("default-25", "25 % (+224 ms)"), ("default-50", "50 % (+288 ms)"), ("default-full", "Full, 10 px (+770 ms on)"), ("default-leave", "Halfway returned (147 ms after leaving)"), ("default-back", "Back at rest")]
D = dict(N)
c = lambda k, r: [f"{D[k]}: {up(k)}", im(k, r)]
FROZEN = "Frames frozen at the sequence's own times, 1648 x 928, enlarged. Deterministic captures, not a real-time recording."
sheet("educational-lift-phases.png", "M1.4J.2 Educational lift: phases", FROZEN, [
    [None, [c("default-rest", "station"), c("default-0", "station")]], [None, [c("default-25", "station"), c("default-50", "station")]],
    [None, [c("default-full", "station"), c("default-leave", "station")]],
    [None, [c("default-back", "station"), ["Full, ?floor=approved: " + up("tone-full"), im("tone-full", "station")]]]])

# Globe alignment: the sequence while it rises, then the station alone on black, shift taken out.
moving = [(t, f"+{t} ms: {info[f'm{t}']['y']:.1f} px up", im(f"m{t}", "globe")) for t in (110, 230, 300, 400, 500, 740)]
def black(m, d):
    a = Image.open(f"{AL}/station-{m}-0.png").convert("RGB"); b = Image.open(f"{AL}/station-{m}-{d}.png").convert("RGB")
    A, B = np.asarray(a).astype(int), np.asarray(b).astype(int)
    still = np.abs(B - A).max(-1); moved = np.zeros_like(still); moved[: -d] = np.abs(B[:-d] - A[d:]).max(-1)
    box = (640, 240, 1000, 505)
    heat = lambda x: Image.fromarray(np.clip(x * 20, 0, 255).astype(np.uint8)).crop(box).resize((540, 397), Image.NEAREST)
    return b.crop(box).resize((540, 397), Image.LANCZOS), heat(still), heat(moved), int(moved.max()), int((moved > 2).sum())
rows = [["The globe wave and the orbit's light while the station rises (2.4x)", [[l, i] for _, l, i in moving[:3]]], [None, [[l, i] for _, l, i in moving[3:]]]]
for m, d in (("300", 5), ("500", 7), ("1500", 10)):
    s, h1, h2, mx, n = black(m, d)
    rows.append([f"The station alone on black, +{m} ms, lifted {d} device px", [["every moving layer", s], ["difference to the resting frame (x20)", h1], [f"the same, shifted back by {d} px: max {mx} of 255, {n} px above 2", h2]]])
rows.append(["Top of the great sphere against the label (5x): rest, full", [[f"Rest", im("default-rest", "top")], ["Full, 10 px: sphere clear of the icon and of AriMap's outline", im("default-full", "top")]]])
rows.append(["Height candidates (5x): 8, 10 (chosen), 12 px", [[f"{h} px", im(f"h{h}", "top", HE).resize((640, int(im(f'h{h}', 'top', HE).height * 640 / im(f'h{h}', 'top', HE).width)), Image.LANCZOS)] for h in (8, 10, 12)]])
sheet("globe-alignment.png", "M1.4J.2 globe and orbit alignment", FROZEN + " Full result for 15 moments at 4 heights: work/align.txt.", rows)

sheet("connection-and-shadow.png", "M1.4J.2 the connection and the ground", FROZEN, [
    ["The connection (4x): the floor run stays; the run in the stone's channel rises with it", [c(k, "lineRow") for k in ("default-rest", "default-25", "default-50")]],
    [None, [c(k, "lineRow") for k in ("default-full", "default-leave")]],
    ["Contact shadow (rest) giving way to the soft one (3x)", [c("default-rest", "under")]], [None, [c("default-25", "under")]], [None, [c("default-50", "under")]], [None, [c("default-full", "under")]], [None, [c("default-leave", "under")]],
    ["Corner strips (8x): their bright edge rises, their spill stays on the floor", [["Left, rest", im("default-rest", "left")], ["Left, full", im("default-full", "left")]]], [None, [["Right, rest", im("default-rest", "right")], ["Right, full", im("default-full", "right")]]],
    ["Floor, ring and reflections (2.4x)", [["Full", im("default-full", "floor")], ["Full, ?floor=approved", im("tone-full", "floor")]]]])

# Hit regions from the recorded maps (every 2 px, whole scene), the raised one over the raised frame.
a, b = [json.load(open(f"{RUN}/out/j1-refs-{l}.json")) for l in ("after", "before")]
K = 1648 / 1672; Z = 2.0; X0, Y0, X1, Y1 = 636, 214, 1044, 520
COL = {"d": (0, 230, 120, 105), "D": (80, 150, 255, 130), "1": (255, 200, 0, 95), "e": (255, 60, 120, 110), "p": (255, 60, 120, 110), "N": (255, 255, 255, 50)}
def panel(frame, m, base=None):
    f = Image.open(f"{EV}/{frame}.png").convert("RGB").crop((int(X0 * K), int(Y0 * K), int(X1 * K), int(Y1 * K))).resize((int((X1 - X0) * Z), int((Y1 - Y0) * Z)), Image.LANCZOS).convert("RGBA")
    o = Image.new("RGBA", f.size); d = ImageDraw.Draw(o); n = 0
    for j, r in enumerate(m):
        y = 100 + 2 * j
        if not Y0 <= y < Y1: continue
        for i, v in enumerate(r):
            x = 2 + 2 * i
            if not X0 <= x < X1: continue
            col = COL.get(v)
            if base is not None: col = (255, 120, 0, 200) if base[j][i] != v else None
            if col: d.rectangle([(x - X0) * Z - Z, (y - Y0) * Z - Z, (x - X0) * Z + Z - 1, (y - Y0) * Z + Z - 1], fill=col)
    f.alpha_composite(o); return f
cnt = sum(v != b["educational"][j][i] for j, r in enumerate(a["educational"]) for i, v in enumerate(r))
kinds = {}
for j, r in enumerate(a["educational"]):
    for i, v in enumerate(r):
        q = b["educational"][j][i]
        if q != v: kinds[f"{q}>{v}"] = kinds.get(f"{q}>{v}", 0) + 1
sheet("hit-region-comparison.png", "M1.4J.2 hit regions", "green: Educational's target   blue: its label and chips   yellow: the hover bridge (holds only)   Recorded with elementFromPoint every 2 px.   Changes: " + ", ".join(f"{k} {v}" for k, v in kinds.items()) + "   ( . empty, 1 bridge, d target )", [
    [None, [["At rest (0 points changed)", panel("full-rest", a["rest"])], ["Powered and raised, now", panel("full-raised", a["educational"])]]],
    [None, [["Powered, before the lift", panel("full-raised", b["educational"])], [f"Orange: the points that changed, {cnt} of {sum(len(r) for r in a['rest']):,}", panel("full-raised", a["educational"], b["educational"])]]]])
