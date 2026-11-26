# M1.4K.3: compositing optimization, Engineering prototype

## Result: **stop. No change is kept.**

- **Phase 1.** No crop or clip of Engineering's four lifted layers is pixel-equivalent. All three forms tried change the station by up to 55 of 255 levels, against a noise floor of 0. The only variant measured also left compositing time unchanged.
- **Phase 2.** Removing the no-op icon filter is pixel-equivalent but brings no measurable gain. Engineering has no expensive static filter to pre-render.
- **Not applied to the other four stations.**

The application code is back to its original state (`git diff HEAD -- app components data lib public scripts` is empty). The prototypes are kept as patches for A/B in `work/variants/`.

Office computer (Radeon HD 5450), Chrome 158, dev server, 1648 × 928 (and 1920 × 1080 for pixels). Two rounds per measurement. Scripts, data and captures are in `work/`. The captures (323 MB of PNG) are ignored by Git.

## Phase 1: Engineering's moving layers

### The layers and their bounds

| Layer (`EngineeringV2.tsx`, `Full … rise`) | Before | Non-transparent bounds, + 2 px guard (scene px) |
|---|---|---|
| `m14h1/engineering-body.png` (body while animating) | 1672 × 941, 6.0 MB decoded | **342 × 172** at (260, 382) |
| `m14f1/engineering.png` (the stable station) | 1672 × 941, 6.0 MB | **342 × 172** at (260, 382) |
| `m14h1/engineering-body-light.png` (`plus-lighter`) | 1672 × 941, 6.0 MB | **54 × 36** at (302, 456) |
| `m14h1/engineering-chart-light.png` (stable glow, `plus-lighter`) | 1672 × 941, 6.0 MB | **82 × 83** at (478, 394) |

The bounds were measured by the project's own lossless crop generator (`scripts/m14i2-crop.py`). It reported all four lossless: every visible pixel byte-identical at the same scene coordinates. Decoded size would drop from 24 MB to 0.5 MB.

### Pixel equivalence

Method:
- `work/eng-capture.mjs` freezes every animation on its own clock at five states: rest, half lift (247 ms after the arrival), mid-chart (450), full (663) and stable (2400).
- Four configurations: 1648 × 928 and 1920 × 1080, in default Chrome (software) and with the GPU forced.
- `work/compare.py` compares the captures.
- **Noise floor:** two captures of unchanged code are identical in software (0 pixels) and differ by at most 2/255 on the GPU. A third capture of the original code, taken after the trials, again matched to noise, so the environment did not drift.

| Variant | Largest difference (of 255) | Pixels > 2 | Verdict |
|---|---|---|---|
| **a. Lossless crop through `SceneImage`'s SVG** (the M1.4I.2 crop path: four entries added to the generator) | 22–55 | 3,700–12,000, all inside the station | **Rejected** |
| **b. Original `<img>`, clipped to the bounds** (`clip-path: inset`, the approach `StationLayers.tsx` uses) | 21–55 | 3,700–12,100 | **Rejected** |
| **c. As b, light layers only** (`body-light`, `chart-light-stable`) | 4–11 | 15–708 | **Rejected** |

**Why.** The best re-alignment shift between before and after is (0, 0), so nothing is misplaced. A sharpness measure moves in both directions depending on state and size. **Chrome resamples a full-frame layer differently from one that paints a small area**, whether that small area comes from a crop or a clip. On the station's sharp, high-contrast artwork that is visible (up to 55/255).

M1.4I.2's crops stayed within 6/255 because those layers were soft light and floor images. This is the same effect `StationLayers.tsx` already documents ("a cropped image would be ~0.3 px off").

Transforms, the scan and chart, shadows, the connection and the hit regions were not reached: the rendering at rest already failed.

### Performance of the rejected clip (b), for information

| Engineering, 3 repeats × 2 rounds | Before | Clip (b), rejected |
|---|---|---|
| Default Chrome (software): fps | 10.4–11.1 | 12.5–13.2 |
| GPU forced: fps | 23.4–24.4 | 25.7 |
| Compositing, one traced activation (viz thread in software / GPU main thread) | 1526–1620 / 1394–1457 ms | 1533–1570 / 1425–1431 ms: **unchanged** |
| Raster | 258–281 ms | 118–176 ms |
| Tile memory (`cc/tile_memory`), software / GPU | 157–164 / 203–211 MB | 132 / 161–165 MB |
| Decoded images (`cc/image_memory`) | 144 / 141 MB | 144 / 141 MB (the `<img>` still decodes the full frame) |
| First hover: response / fps | 34–66 ms; 10.9–12.1 (software), 14.6–15.6 (GPU) | 41–55 ms; 12.4–12.5, 16.0–17.8 |

Even accepted, it would add about 20 % in software and 7 % on the GPU. The compositor stays saturated: about 1.5 s of drawing per 1.6 s activation. **These four layers are not what limits Engineering.**

## Phase 2: filter cleanup

| Filter | Where | Finding |
|---|---|---|
| `brightness(1)` at rest | every station icon (`app/globals.css`, `.lab-station-icon`) | **The only no-op.** It is the rest value of the approved +30 % hover brighten |
| `drop-shadow` × 2 | every station icon (`StationIcon.tsx`) | An approved visible glow: kept. Turning it off gained nothing measurable (within noise) |
| SVG `feGaussianBlur` | Engineering's foot shadow | Experiment A (`animation-lag-diagnosis.md`): 0 % on the GPU, within noise in software. **Not expensive: no pre-rendered prototype is justified** |
| SVG blurs | Playground's line | Not Engineering (out of scope) |

**Prototype** (`work/variants/icon-filter-rest-none.patch`): no filter at rest; `brightness(1.3)` from the per-station rules in `LabState.tsx` while hovered or selected.

| | Before | Prototype |
|---|---|---|
| Pixels, 15 states | | at most 1/255 on 261–469 px in software (the filter pass's own rounding), GPU within noise; the hovered icon brightens as before |
| Behaviour | | 260 ms brighten and fade, keyboard focus and selection: as before |
| Software fps (2 rounds) | 10.4–11.1 | **10.7–10.9** |
| GPU fps | 23.4–24.4 | **24.3–25.4** |
| Compositing time | 1526–1620 / 1394–1457 ms | 1536–1568 / 1392–1417 ms |

**No measurable benefit: reverted.** A single earlier round had suggested +7–10 %; two rounds did not confirm it.

## Remaining costs

The compositor's load is unchanged by everything tried here. It comes from the scene as a whole:

- about 35 visible full-frame `plus-lighter` layers and 40 full-frame masks;
- an activation that redraws most of the frame (the spark crosses the floor, and strips, floor light and connections change across the scene);
- on this computer, Chrome's software compositing (the driver is blocklisted).

Engineering's own moving layers are a small share of it.

## Recommended next step

1. **Do not roll this approach out to the other stations.** It cannot keep the approved pixels, and the gain it could bring is small.
2. **Measure what is redrawn per frame before optimizing further:** the damaged area and render passes per frame (Chrome's paint flashing / layer borders, or the `viz` trace's damage rects) during one Engineering activation. That shows whether the full frame is invalidated, and by which layers. If a few full-frame layers that change per frame (floor light, connection, standby light) cause it, those are the candidates.
3. **Anything that changes resampling needs an owner decision.** Baking the static blended layers or re-exporting the stations means re-approving the look at a new pixel reference.
4. **For this computer, the biggest single lever remains the software-compositing tier** (recommendation 4 in `animation-lag-diagnosis.md`). It is an owner decision.
5. **Repeat the "before" measurement on the RTX 4060** (`work/eng-perf.mjs`) so later work has a reference on the target GPU.

## Files

- **Application:** unchanged.
- **Probes:** `work/eng-capture.mjs` (frozen captures; `ONLY` and `INJECT` options), `work/compare.py` (pixel comparison), `work/eng-perf.mjs` (frames, traced compositing time, memory-infra, first hover; `INJECT` option).
- **Data:** `work/results/compare-*.json` and `work/results/eng-perf-{before,clip-rejected,icon-filter,p1-icon-brightness-off,p2-icon-glow-off}.json`.
- **Variants:** `work/variants/engineering-clip-all.patch` (b) and `work/variants/icon-filter-rest-none.patch`. Variant a is four lines in `scripts/m14i2-crop.py`'s source list; it was reverted together with its generated files.
