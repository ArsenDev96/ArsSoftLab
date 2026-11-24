# M1.4I.1E evidence: ../hit-regions.png and ../playground-lift-hit-region.png (real hit maps of the running page over its own captures).
# Needs geometry.mjs after and shots.mjs first (the kept geometry-after.json has the boxes only).
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
g = json.load(open("geometry-after.json")); k, cx, cy = g["cam"]["k"], g["cam"]["x"], g["cam"]["y"]
S = 2; Y0 = 180
def scene(f): return Image.open(f).convert("RGB").transform((1672 * S, 941 * S), Image.AFFINE, (k / S, 0, cx, 0, k / S, cy), Image.BICUBIC)
def arr(s): return np.frombuffer("".join(g["map"][s]).encode(), np.uint8).reshape(len(g["map"][s]), -1)
font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22); big = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 26)
IDS = dict(engineering="e", educational="d", playground="p", creative="c", experience="x")
GREEN, BLUE, AMBER, GREY = (40, 230, 140), (80, 160, 255), (255, 176, 40), (150, 150, 150)
def paint(img, a, me, extra=None):
    ov = np.zeros((941, 1672, 4), np.uint8)
    def put(m, c, al): ov[Y0:Y0 + a.shape[0]][m] = (*c, al)
    put(np.isin(a, [ord(c) for c in "edpcx" if c != me]), GREY, 70); put(np.isin(a, [ord(c) for c in "EDPCX" if c != me.upper()]), GREY, 70)
    put(a == ord(me), GREEN, 80); put(a == ord(me.upper()), BLUE, 125); put(a == ord("1"), AMBER, 120)
    if extra is not None: put(extra & (a == ord(".")), AMBER, 120)
    return Image.alpha_composite(img.convert("RGBA"), Image.fromarray(ov).resize(img.size, Image.NEAREST)).convert("RGB")
def outline(img, pts, c, w=3): ImageDraw.Draw(img).line([(x * S, y * S) for x, y in [*pts, pts[0]]], fill=c, width=w)
B = json.load(open("bridges.json"))
box = dict(engineering=(240, 300, 640, 570), educational=(650, 205, 1020, 510), playground=(1040, 285, 1420, 570), creative=(80, 535, 600, 795), experience=(1180, 500, 1672, 795))
rest, up = scene("scene-rest.png"), scene("scene-playground.png")
W = 820
def panel(img, b, title, sub):
    c = img.crop(tuple(v * S for v in b)); h = round(c.height * W / c.width); c = c.resize((W, h), Image.LANCZOS)
    p = Image.new("RGB", (W, h + 76), (17, 18, 20)); p.paste(c, (0, 76)); d = ImageDraw.Draw(p)
    d.text((4, 4), title, font=big, fill=(240, 240, 240)); d.text((4, 40), sub, font=font, fill=(190, 190, 190)); return p
def legend(w):
    p = Image.new("RGB", (w, 56), (17, 18, 20)); d = ImageDraw.Draw(p); x = 8
    for c, t in ((GREEN, "hotspot (unchanged)"), (BLUE, "label: icon, title, chips"), (AMBER, "bridge: holds the hover, only while this station is active"), (GREY, "other stations")):
        d.rectangle((x, 16, x + 24, 40), fill=c); d.text((x + 34, 12), t, font=font, fill=(225, 225, 225)); x += 60 + d.textlength(t, font=font) + 20
    return p
def stack(rows, f):
    w = max(sum(p.width for p in r) + 14 * (len(r) - 1) for r in rows); h = sum(max(p.height for p in r) + 14 for r in rows)
    o = Image.new("RGB", (w, h), (17, 18, 20)); y = 0
    for r in rows:
        x = 0
        for p in r: o.paste(p, (x, y)); x += p.width + 14
        y += max(p.height for p in r) + 14
    o.save(f)
ps = []
names = dict(engineering="Engineering", educational="Educational", playground="Playground (lifted)", creative="Creative Studio", experience="Experience")
for id, c in IDS.items():
    a = arr(id); im = paint(up if id == "playground" else rest, a, c); outline(im, B[id], AMBER)
    n = int((a == ord("1")).sum()); ps.append(panel(im, box[id], names[id], f"bridge {n:,} px = {100 * n / (1672 * 941):.1f}% of the scene; at rest 0 px"))
tot = legend(W * 2 + 14)
a = arr("rest"); whole = paint(rest, a, "?"); ov = whole
for id in IDS: outline(ov, B[id], AMBER, 2)
wp = panel(ov, (0, 180, 1672, 800), "Whole scene at rest", "outlines = bridges (not there at rest: the hit map is identical to before)")
stack([[tot], [ps[0], ps[1]], [ps[2], ps[3]], [ps[4], wp]], "../hit-regions.png")
# Playground at rest (active, charging) and lifted.
def mask(pts):
    im = Image.new("1", (1672, 621)); ImageDraw.Draw(im).polygon([(x, y - Y0) for x, y in pts], fill=1); return np.array(im)
a0 = arr("rest"); r0 = paint(rest, a0, "p", mask(B["playground"])); outline(r0, B["playground"], AMBER)
a1 = arr("playground"); r1 = paint(up, a1, "p"); outline(r1, B["playground"], AMBER)
R = g["rest"]["playground"]; A = g["active"]["playground"]
def rect(img, b, c): ImageDraw.Draw(img).rectangle([v * S for v in b], outline=c, width=2)
for b in (R["title"], R["chips"][0]): rect(r1, b, (255, 255, 255))
b = (1045, 285, 1415, 565)
stack([[legend(W * 2 + 14)], [panel(r0, b, "At rest, activated (spark on its way)", "the label's resting place and the 18 px above it are one region"), panel(r1, b, "Fully lifted (18 px)", "white boxes: where title and chip were; a still pointer there keeps the hover")]], "../playground-lift-hit-region.png")
