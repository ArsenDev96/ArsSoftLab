"""M1.4F.1: Engineering and Educational for /lab-v2, recovered from the approved
artwork, as full-frame (1672 x 941) transparent layers, by M1.4F's method
(scripts/m14f-extract.py, whose helpers are imported; its outputs are not
touched). Writes public/scene/v2/m14f1/ only.

Sources (nothing is painted or generated; every visible pixel is the approved
artwork's own):
  docs/m1.3k/package/01-source/environment-lines-removed.png
      the approved plate without the power lines (strips darkened)
  docs/m1.3k/package/01-source/lab-plate.png
      the approved plate: the strips lit, as approved
  The station layer is the line-free plate, with the plate's own lit strips
  where the two differ on the station (the connection's own segment
  excluded: /lab-v2 draws it). The strips' light on the floor is the
  difference of the two plates, kept as light only (plus-lighter).

Mattes. The v2 floor and window view are other renders than the plate's, so a
difference against them is unusable:
  hard   stone, laptop, keyboard deck, island body (with its trees, church and
         diorama mountains): measured outlines, anti-aliased at 4x
  soft   the holograms (Engineering's chart and cube, Educational's globe,
         its cyan glow and the amber orbit) and the plants: B is the plate's
         own background, diffused in from just outside the outline. Holograms
         are light, so the pixel is split into
             a solid part   alpha a = smoothstep of how much brighter than B the
                            pixel is (bright lines, bars, the diorama's sky)
             a light part   G = (1 - a) * max(I - B, 0), added (plus-lighter)
         with F = I where I >= B, so on the plate a F + (1 - a) B + G = I
         exactly. Over the v2 room the faint glass and glow are added to the
         new background instead of carrying the plate's (no dark patches);
         where the plate is darker than B the pixel is simply transparent.

Writes public/scene/v2/m14f1/{engineering,educational}.png (normal) and
{engineering,educational}-light.png (plus-lighter: hologram light + floor light),
docs/m1.4f1/work/extract.json and check sheets.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14f1-extract.py
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("m14f", ROOT / "scripts/m14f-extract.py")
m14f = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m14f)
W, H = m14f.W, m14f.H
SRC_DIR = m14f.SRC_DIR
ENV = m14f.ENV
OUT = ROOT / "public/scene/v2/m14f1"
WORK = ROOT / "docs/m1.4f1/work"
RADII = (1, 2, 3, 5, 8, 12, 18, 27, 40, 60, 90, 135, 200)

# ---------------------------------------------------------------- Engineering (scene px, measured on the plate at 5-8x)
ENGINEERING = dict(
    hard=[
        # The platform: left end (the raised block, the lower slab), the top behind the laptop, the right
        # block, the plinth's rounded right end, the bottom edge (the left corner lies behind Creative's painting).
        [
            (262.5, 538), (262.3, 512), (264, 507), (268, 504.8), (276, 503.6), (286.5, 502.8), (288.3, 497),
            (289.5, 492), (293, 490.2), (300, 489.4), (317, 489), (342, 488.2), (353.5, 488), (579, 489.6),
            (583, 490), (587, 489.8), (588.8, 492), (588.8, 517.5), (595, 518.5), (598.5, 521), (599.3, 525),
            (598.7, 530), (597, 533.8), (590, 536.8), (583, 538.3), (567, 540.8), (550, 543), (517, 545.6),
            (500, 548.3), (480, 550.2), (440, 551.2), (400, 551.2), (360, 550.8), (330, 549.5), (305, 547.5),
            (285, 544), (270, 541),
        ],
        # The laptop lid: rounded top corners, the left edge down to the hinge, the right edge.
        [
            (340.5, 388), (341.5, 386), (343.5, 384.6), (474, 384.6), (477, 386), (479, 389), (479.6, 392),
            (490.7, 453), (492.6, 473), (492.6, 476), (354.5, 490), (353.5, 488),
        ],
        # The keyboard deck to its right end.
        [(353.5, 480), (492.6, 474.2), (552, 474.4), (560, 474.8), (570, 475.5), (576, 476.4), (578.5, 478),
         (578.8, 491), (353.5, 491)],
        # The dark puck on the deck.
        [(518, 476), (519.5, 471.8), (523, 470.8), (545, 470.6), (548, 472), (549, 476)],
        # The plant's pot (its shaded side is as dark as the background behind it).
        [(317.8, 478.4), (319, 477.4), (340, 477.4), (341, 478.6), (341, 492), (317.8, 492)],
    ],
    soft=[
        # The potted plant (left of the lid).
        dict(poly=[(304, 491), (305, 482), (310, 470), (317, 462), (326, 458.5), (335, 460), (343, 465),
                   (349, 471), (352.5, 480), (353.5, 489)], t=(8, 40)),
        # The holographic chart panel with its bars, and the small cube on the deck.
        dict(poly=[(479, 396), (492, 405), (541, 405), (546, 409), (546, 447), (555, 447), (557.5, 452),
                   (557.5, 475), (493, 476.5)], t=(20, 90)),
    ],
    # The strips' light on the floor, below the base's front.
    light_box=(296, 538, 532, 572),
    # The Engineering connection's end (at the plinth's right end): /lab-v2 draws it.
    line_box=(555, 520, 640, 575),
)

# ---------------------------------------------------------------- Educational (scene px, measured on the plate at 3-6x)
EDUCATIONAL = dict(
    hard=[
        # The platform: the two tiers at the left and right ends, the top surface's back edge (behind the
        # island in the middle), the bottom edge (its front lowest in the middle).
        [
            (682.5, 488.3), (682.5, 451), (684, 448), (692, 447.5), (692.5, 430), (693.5, 427), (697, 425.3),
            (710, 424.6), (730, 424.2), (760, 424), (900, 424), (940, 423.5), (960, 423.8), (975, 424.8),
            (985, 426.5), (987.5, 429), (987.5, 448), (993.3, 448.5), (994.2, 451), (994.2, 485), (993.3, 487),
            (985, 490), (970, 492.3), (950, 494), (920, 495.5), (880, 496.3), (840, 496.6), (800, 496.3),
            (760, 495.5), (720, 493.5), (700, 491.6), (690, 490.2),
        ],
        # The island's body (kept whole): the grass and its trees, the diorama mountains' ridge, the church,
        # Ararat, the grass's right end, the rock down to the platform (the cyan glass bowl at the right is soft).
        [
            (717, 392), (720, 384), (723, 378), (728, 375), (733, 368), (739, 367), (743, 371), (748, 364),
            (756, 358), (765, 353), (772, 348), (785, 345), (795, 338), (803, 333), (810, 331.5), (818, 334),
            (828, 340), (838, 344), (846, 340), (852, 326), (856, 316), (861, 306), (865, 301.5), (869, 306),
            (874, 316), (876, 326), (884, 334), (895, 341), (905, 343), (920, 337), (936, 334), (948, 340),
            (956, 350), (962, 360), (967, 370), (966, 377), (950, 381), (936, 390), (926, 402), (918, 415),
            (913, 427), (745, 427), (735, 420), (727, 410), (721, 401),
        ],
    ],
    soft=[
        # The globe (both bubbles), the diorama's sky, the cyan glass and glow, the orbit's right half.
        dict(poly=[(706, 402), (705, 360), (707, 330), (712, 307), (722, 291), (738, 280), (758, 272), (785, 269),
                   (812, 271), (830, 279), (845, 290), (860, 293), (878, 296), (895, 304), (920, 305), (950, 302),
                   (975, 302), (990, 304), (997.5, 311), (997.5, 322), (990, 340), (982, 362), (979, 385),
                   (975, 405), (968, 422), (960, 431), (720, 431), (712, 420)], t=(20, 80)),
        # The orbit's left arc, in front of the window pillar (a narrow band, so the plate's background
        # plant beside it is not taken).
        dict(poly=[(722, 344), (708, 359), (695, 369), (682, 381), (671, 393), (666, 404), (667, 415), (674, 423),
                   (687, 427), (705, 428.5), (726, 428.5), (726, 415), (705, 415), (691, 413), (683, 410),
                   (680.5, 404), (683, 397), (691, 388), (702, 379), (713, 370), (722, 361)], t=(20, 80)),
    ],
    light_box=(664, 478, 1006, 512),
    # The Educational connection runs up the platform's face to the strip: /lab-v2 draws it.
    line_box=(826, 462, 851, 512),
)


def in_box(b):
    x0, y0, x1, y1 = b
    yy, xx = np.mgrid[0:H, 0:W]
    return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)


def station(spec, plate, clean):
    hard = m14f.union_mask(spec["hard"])
    softs = [(m14f.polygon_mask(s["poly"]), s["t"]) for s in spec["soft"]]
    outer = np.zeros_like(hard)
    for m, _ in softs:
        outer = np.maximum(outer, m)
    region = np.maximum(hard, outer)
    diff = np.abs(plate - clean).sum(2)
    strip = (diff > 6) & (region > 0) & ~in_box(spec["line_box"])
    src = np.where(strip[..., None], plate, clean)
    known = m14f.box((region > 0).astype(float), 1) == 0
    B = m14f.diffuse(clean, known, RADII)
    pos = np.clip(src - B, 0, None)
    dp = np.sqrt((pos ** 2).sum(2))
    soft_a = np.zeros_like(hard)
    for m, (t0, t1) in softs:
        soft_a = np.maximum(soft_a, m14f.smooth(dp, t0, t1) * m)
    a = np.clip(np.maximum(hard, soft_a), 0, 1)
    in_soft = outer > 0
    G = np.where(in_soft[..., None], (1 - a)[..., None] * pos, 0)
    # F: a F + (1 - a) B + G = I  (F = I where I >= B); hard-only edges keep the source colour (as M1.4F).
    F = (src - (1 - a)[..., None] * B - G) / np.maximum(a, 1e-3)[..., None]
    F = np.where(((a > 0.999) | ~in_soft)[..., None], src, np.clip(F, 0, 255))
    stats = dict(
        alpha_px=int((a > 0.02).sum()), opaque_px=int((a > 0.98).sum()), partial_px=int(((a > 0.02) & (a < 0.98)).sum()),
        hologram_light_px=int((G.max(2) > 2).sum()), strip_px=int(strip.sum()),
    )
    return F, a, G, B, src, stats


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    plate = m14f.load(SRC_DIR / "lab-plate.png")
    clean = m14f.load(SRC_DIR / "environment-lines-removed.png")
    env = m14f.load(ENV)
    rep = {}
    for name, spec, crop in (("engineering", ENGINEERING, (240, 370, 625, 575)), ("educational", EDUCATIONAL, (650, 255, 1015, 515))):
        F, a, G, B, src, rep[name] = station(spec, plate, clean)
        m14f.save_rgba(F, a, OUT / f"{name}.png")
        floor, _ = m14f.floor_light(spec, plate, clean, a)
        light = np.clip(G + floor, 0, 255)
        la = light.max(2) / 255
        m14f.save_rgba(np.where(la[..., None] > 0, light / np.maximum(la, 1e-6)[..., None], 0), la, OUT / f"{name}-light.png")
        rep[name]["floor_light_px"] = int((floor.max(2) > 2).sum())
        # Check: the plate rebuilt from the layers over B (should match the plate), and the layers over the v2 room.
        rebuilt = np.clip(B * (1 - a[..., None]) + F * a[..., None] + G, 0, 255)
        err = np.abs(rebuilt - src).max(2)[a > 0.02]
        rep[name]["rebuild_vs_plate_in_station"] = dict(mean=round(float(err.mean()), 3), max=round(float(err.max()), 1))
        comp = np.clip(env * (1 - a[..., None]) + F * a[..., None] + light, 0, 255)
        c = Image.fromarray(comp.astype(np.uint8)).crop(crop)
        al = Image.fromarray((a * 255).astype(np.uint8)).crop(crop).convert("RGB")
        gl = Image.fromarray(np.clip(light * 2, 0, 255).astype(np.uint8)).crop(crop)
        sh = Image.new("RGB", (c.width, c.height * 3 + 12))
        sh.paste(c, (0, 0))
        sh.paste(al, (0, c.height + 6))
        sh.paste(gl, (0, 2 * c.height + 12))
        sh = sh.resize((sh.width * 2, sh.height * 2), Image.LANCZOS)
        sh.save(WORK / f"check-{name}.png")
    (WORK / "extract.json").write_text(json.dumps(rep, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(rep, indent=1))


if __name__ == "__main__":
    main()
