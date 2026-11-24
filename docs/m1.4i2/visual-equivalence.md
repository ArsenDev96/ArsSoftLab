# M1.4I.2: Visual equivalence

**No visible difference found.** The crops hold every visible source pixel bit for bit. On screen Chrome differs by at most 6 of 255 levels at 1648 × 928, on fewer than 200 pixels; Firefox and the homepage are identical.

It is not bit-identical in Chrome: scaled artwork is now filtered from a different texture, which rounds differently by 1–2 levels.

## 1. Method
Every animation is paused and set to the same time (`work/visual.mjs`), so a frame is the same moment on both sides. 72 frames per run: idle with both floors, each station while charging, 5–7 moments of its sequence, fully powered, three moments of leaving, back at rest, selected (camera zoomed), and reduced motion. "Before" was captured in separate browsers, two or three times, so its own variation is known: **at most 2 levels** (`work/compare.py`).

The crops themselves are verified by `python scripts/m14i2-crop.py --check`: put back on an empty canvas, all 43 equal their source in every pixel with alpha > 0, and nothing else is in them.

## 2. Chrome, 1648 × 928 (GPU), 72 frames

| Largest difference in a frame | Frames | Where |
|---|---|---|
| 0–2 levels (as before vs before) | 51 | |
| 3–4 levels, at most 72 px | 15 | Single pixels; Playground charging and mid-lift; reduced motion |
| 5–6 levels, at most 196 px | 6 | Playground early in its lift (137 px) and while leaving (141 and 196 px); stations selected, under the camera zoom (10–81 px) |
| More than 6 | 0 | |

About 5,600 of 1.53 million pixels change by 1–2 levels in a typical frame; about 20,000 while Playground moves.

| Required state | Largest difference | Pixels above 2 |
|---|---|---|
| Full scene, idle (default / tone) | 2 / 2 | 0 |
| Engineering powered / during the screen scan (+280 ms) / chart shimmer (+1500 ms) | 2 / 2 / 2 | 0 |
| Educational powered / during the orbit (+450 ms) | 2 / 3 | 0 / 1 |
| Playground powered / midway through the lift (+220 ms) | 2 / 4 | 0 / 72 |
| Creative Studio powered / during the sunrise (+370 ms) | 2 / 2 | 0 |
| Experience powered / midway along the route (+430 ms) | 2 / 2 | 0 |
| All stations back at rest (after each visit) | 2 | 0 |

After the browser test (NOTES section 3) was added, 17 of these frames were captured again: the same, except Educational powered (7 levels, 26 px at x 1044–1138). That is Playground's cabinet, which Chrome resamples differently per launch, as recorded in `docs/m1.4i1/navigation-fix.md`.

## 3. Other sizes

| Viewport | Frames | Largest | Pixels above 2 |
|---|---|---|---|
| 1920 × 1080 | 55 (the leaving frames are not comparable: their "before" was taken with an older script) | 10, with two explained exceptions | At most 145 |
| 1366 × 768 | 3 | 2 | 0 |
| 1024 × 640 | 3 | 3 | 61 |
| 1536 × 864, scale 1.25 (real device scale) | 3 | 7 | 2 |
| 1280 × 720, scale 1.5 | 3 | 7 | 2 |

- **1920 × 1080:** 10 levels on 145 px is Engineering selected: a strip's edge, 3 px high, under the camera zoom. Two pixels of Creative Studio's floor ring differ by 7 in most frames. The exceptions: Educational while charging (36; its label was caught at another moment, "before" differs from itself by 197 there) and Educational powered (13; Playground's cabinet again).
- **2560 × 1080:** not captured (large screenshots are lost on the test connection, as in M1.4I).

## 4. Firefox 144
Idle and four powered stations: **0 pixels changed.** Each station powers with one spark and returns to rest.

## 5. Homepage
Markup of the station layer, focus order, accessible names, hit maps (at rest and with each station hovered): identical. Pixels: 0 changed. `/lab-v2`: focus order, accessible names and the hit map identical (0 of 95,584 points).

## 6. What was tried and rejected

| Attempt | Result |
|---|---|
| A cropped `<img>` in its own box | Not used: the browser snaps each box to device pixels by itself |
| Cropped CSS background | 23–200 levels off |
| SVG without the size rounding | 7–92 levels off, depending on the size |
| Crops of the images Chrome composites on their own (11) | Up to 49 levels: drawn through a tile, they come out 6–11 % softer. With an explicit layer instead: up to 21. Left full frame |
| Crop of Playground's spark masks (3) | Up to 68 levels at the spark. Reverted |
| Crop of the chart as the shimmer's mask | Up to 9 levels. Reverted |
| SVG crops in Firefox | Up to 0.7 px of displacement: Firefox draws the full frames |
