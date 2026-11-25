# M1.4I.2: Final regression verification (home computer)

**Recommendation: GO for the lossless rendering optimization.** Every unfinished check of NOTES section 6 has now run. Appearance, navigation, the sign, quick returns and hover continuity hold. One genuine defect was found: a click on the rounded ends of Playground's AZIZ chip can be lost (section 3). It belongs to M1.4I.1E, not to the crops, and does not block this milestone.

Commit `2728cb4`, branch `feat/lab-v2`, dev server, 2026-11-24. No application code, rendering, animation or default was changed. Nothing committed or pushed. Data: `work/home/`.

| | Result |
|---|---|
| Hover continuity (Playground, Creative Studio, Experience) | 161 moves, **0 interrupted** |
| Navigation | 51 of 51 entries shown, 28 of 28 same-document mounts, 8 of 8 slow loads, **never black** |
| Playground's sign | As in 1C; hit map **0 of 98,230 points** changed |
| Quick returns, five stations | 627 judged runs, **no reproducible defect** |
| Optimized frames at 60 Hz | All five stations from the second visit on, Playground's lift included (27 of 27) |
| GPU process, crops against full frames on this card | 1,179 → **778 MB** |
| Crops against their sources | **43 of 43 identical** |
| `npm run typecheck` | Passes |
| Console errors in any probe | 0 |

## 1. Hardware and browser

| | Home (this report) | Office (baseline) |
|---|---|---|
| GPU | NVIDIA GeForce RTX 4060, driver 32.0.16.1088 | AMD Radeon HD 5450 |
| CPU, memory | Intel i5-12400 (6 cores, 12 threads), 15.7 GB | Not recorded |
| Browser | Chrome 158.0.8127.88, headless, ANGLE D3D11 | Chrome 157, headless |
| System | Windows 11 Pro, 1920 × 1080 at 60 Hz, device scale 1 | Not recorded |
| Node, Next.js | 22.22.3, 16.4.6 (Turbopack, dev) | 22.22.3, same |

**The two GPUs are years apart. Absolute differences between the columns are hardware, not the optimization.** No Python here, so the generator's `--check` was not run; the crops were compared in the browser instead (section 6).

## 2. Previously unfinished checks

| Check | Runs | Passed | Notes |
|---|---|---|---|
| **1E, transitions:** Playground | 61 moves | 61 | 11 of them charging, 11 while lifting |
| Creative Studio | 50 moves | 50 | |
| Experience | 50 moves | 50 | |
| ...leaving into empty space | 15 | 15 | Hover gone after 105–123 ms, all back at rest |
| ...to a neighbour, 200 and 900 ms | 12 | 12 | One spark each, old station at rest |
| 1E, bridges hold, never start a hover, keep other stations' area | 5 stations | 5 | 0 points of other stations changed, 0 of 133 route points covered |
| 1E, random slow moves, all five stations | 80 | 80 | |
| 1E, through the lift: 11 positions; still pointer, 16 starts | 27 | 27 | 18 px; 12 of 24,166 px, as before; no restart |
| 1E, clicks on title, platform and chips, all five | 17 | 17 | Reached by moving. Pointer held still: section 3 |
| 1E, keyboard, direct links, reduced motion | 5 each | 5 each | |
| **1A, route entries** (all `nav.mjs` scenarios) | 51 | 51 | 31 of 31 activations powered and went back to rest |
| 1A, one document: `/` ↔ `/lab-v2`, push, Back, Forward | 28 | 28 | Same document throughout, rendered brightness checked |
| 1A, images 1.5 s and 6 s late, direct and client-side, both pages | 8 | 8 | Opens on decode, or by the 4 s fallback (4.5–4.7 s) |
| 1A, images that never arrive | 4 | 4 | Fallback opens (4.5–5.6 s). Included in the 51 |
| **1C, sign:** timing, click, hit map, game, keyboard, neighbours, reduced motion | all | all | Panel 1,311 of 1,311 px; raised 1,339 of 1,339 |
| 1C, sign paths (sign, cabinet, platform, label, chip) | 45 | 45 | At 120–1500 ms |
| 1C, return to the sign after 40–700 ms | 6 | 6 | |
| 1C, hit map against the recorded one | 98,230 points | all equal | No neighbour overlapped. Homepage: 0 changed |
| **1B, Engineering:** grid, real pointer, sequences | 160 | 160 | 0 premature scan, bars or pulse; the scan always starts at the top |
| **1D, Creative Studio:** pointer, grid, sequences, Escape | 129 | 128 | One flag, not reproducible (section 4) |
| 1D, Educational, the same | 129 | 129 | |
| 1D, Experience, the same | 129 | 129 | |
| Playground, 8 leaving times × 10 returns | 80 | 80 | Lift, sparks and sign hit area, below |
| Rapid switching, slips, sweeps, all five (`p3-switch`) | 73 | 66 | The 7 flags are an approved fade (section 4) |
| **Performance after the browser test** | 16 pages | – | Section 5 |

**Quick returns by case.** The grids leave at 13 moments from before the arrival to after full power, and return 0, 20, 50, 100, 200, 350 and 450 ms after the hover has dropped.

| Asked for | Result |
|---|---|
| Leave before arrival, leave during startup | Clean, five stations |
| Return within 0–50 ms, after 100–200 ms, during fade-out | Clean, five stations |
| Rapid switching between neighbours | 10 of 10 pairs: the second powers, the first goes to rest |
| Engineering: early scan, bars, strip pulse | 0 of 160 |
| Educational: frozen orbit, crest, pulse | 0 of 129 |
| Creative Studio: frozen sunrise, glint | 0 of 129 |
| Experience: frozen pulse, partial trail | 0 of 129 |
| Playground: stuck lift, duplicate spark, lost sign | 0 of 80; a return inside the 90 ms grace never restarts (16 of 16) |

First-visit timings match 1B and 1D within a frame: Engineering stable at 580 ms, Creative Studio 793, Educational 807, Experience 990; Playground's lift is complete 1082–1083 ms after the hover.

## 3. Genuine defect

**Fixed since, in M1.4I.2.1: `chip-click-fix.md`.** What follows is the state found by this verification. The candidate below was almost, but not quite, sufficient.

**A click on the rounded end of the AZIZ chip can be lost (minor, M1.4I.1E).**

- **When:** the pointer comes to rest on the outer 6–7 px of the chip (left) or 5–6 px (right), stays perfectly still while Playground rises, and clicks without moving. The click then lands on the bridge and does nothing. Playground stays active.
- **How often:** 29 of 87 still clicks, sampled mostly at the ends. Between x 1294 and 1339 (scene px, about 45 of the chip's 59 px) 54 of 56 opened AZIZ. **Reached by moving, 24 of 24 clicks opened AZIZ**, ends included.
- **Cause:** the strip that keeps the hover (`risingLabelCss`, `LabStations.tsx`) starts below the chip's box (`top:100%`). The chip is a pill, so beside its curved ends there is a notch that belongs to neither. The rising chip carries that notch across the pointer, the hover ends, and the strip with it.
- **Not the optimization.** With the crops replaced by the full-frame files in the same page, the loss is the same (14 of 15 points; with crops 15 of 15).
- **Why the office saw less of it:** it depends on the frame rate. Slowed to 26 frames per second, 8 of the 15 kept the chip. 1E's own run lost none at x 1292; the optimized office run lost 2 of 3 there. So a faster lift makes it show more often, on any build.
- **Smallest correction (not applied, not tested):** start the strip inside the pill: `top:50%;height:calc(50% + var(--u) * 20)`, one line in `risingLabelCss`.
- Evidence: `chip-edge.json`, `chip-cause.json`.

## 4. Test artifacts (no application change needed)

| Symptom | What it was |
|---|---|
| Office: `nav.mjs` "invalid URL" | Git Bash turned `OTHER=/nope` into a Windows path. Run with `MSYS_NO_PATHCONV=1` |
| `nav.mjs` `deep`: "reading 'router'" | Back to a 404 is a full load, and the probe pushed before Next's router existed. With the probe's own `ready()` before the push: 8 of 8 entries shown |
| Office: `qr-run` "reading 'stop'", "No element" | Did not occur here with the same code: the page or the server had gone away |
| `p3-switch`: Engineering's scan line without hover, 7 scenarios | Its approved 100 ms fade on leaving, 6–7 frames at 60 Hz. The office has the same flags with 2–3 frames. Measured frame by frame: 18 of 18 runs only fall, at most 116 ms |
| `p3-switch`: 5 sparks at once | 40 ms sweeps over all five stations; one fading spark per station (office: 3–4) |
| 1D, Creative Studio: "not powered" after Escape (1 of 7) | Click at 200 ms, Escape 100 ms later, first action of a new page. Nothing lit early or froze, and it was at rest at the end. **Not reproduced in 25 repeats of the same case** (10 of them new pages). Most likely a stall that cut the probe's fixed wait: new pages show one frame of 180–270 ms there. Not proven |
| Own probe: scene "shown" after 217 ms | It read the opacity before the stylesheet was there. Corrected and rerun |
| Own probe: lift "rose" after leaving (40 of 80) | It joined the frames before the visit to those after it. Corrected and rerun: 0 of 80 |
| Capture: Playground's cabinet differs by up to 66 levels (11,799 px) | Chrome resamples it in two variants, as recorded in 1A. The same page differs from itself by the same amount |
| Capture: homepage, images 6 s late, 37 levels (1 of 4 such loads) | The homepage draws no crops. 1A recorded the same variant (37) on the original code |

The one-frame flags that 1E reported for Engineering and Educational at the office did not occur here (0 of 10 and 0 of 11 with the real pointer).

## 5. Performance

Same script, viewports and order as the office baseline (`perf.mjs`): 5 pages per viewport, fresh profile each, medians with ranges in brackets. 1648 × 928 unless stated.

| Metric | Office, before | Office, optimized | **Home, optimized** |
|---|---|---|---|
| Decoded image memory | 416.7 MB | 173.5 MB | **173.5 MB** |
| Scene files | 5,942 kB | 5,605 kB | **5,605 kB** |
| Image textures on the GPU, idle | 298.1 MB | 119.4 MB | **114.9 MB** (114.9–119.4) |
| ...after visiting all five | 422.7 MB | 173.5 MB | **169 MB** (169–173.5) |
| Tile memory, idle | 324 MB | 264 MB | **265 MB** |
| Full-frame layers | 22 | 15 | **15** |
| GPU process, idle | 758 MB | 582 MB | **780 MB** (774–838) |
| ...after visiting all five | 684 MB | 577 MB | **734 MB** (664–737) |
| Renderer process, idle | 271 MB | 274 MB | 267 MB |
| Engineering frames, first → later (of 36) | 12 → 12 | 34 → 35 | **36 → 36** |
| Educational (of 49) | 33 → 37 | 48 → 49 | **49 → 49** |
| Playground, whole sequence (of 54) | 11 → 14 | 12 → 22 | **39 → 54** |
| Playground's lift (of 27) | 9 → 10 | 8 → 11 | **12 → 27** |
| Creative Studio (of 48) | 30 → 33 | 43 → 44 | **48 → 48** |
| Experience (of 60) | 41 → 43 | 55 → 55 | **60 → 60** |
| Longest frame, later visits | 83–150 ms | 17–83 ms | **17 ms**, every station |
| Decodes on the second hover, all five | 54–60 | 0 | **0** |

**GPU-process memory on one card.** 780 MB is more than the office's "before" figure, so it was checked here: in the same build, the app's own fallback draws the full-frame files instead of the crops (3 pages each, in turn, wrapper clips the same on both sides).

| Home, 1648 × 928 | Full-frame files | Crops |
|---|---|---|
| GPU process, idle | 1,179 MB (1,177–1,374) | **778 MB** (773–844) |
| ...after visiting all five | 893 MB | **688 MB** |
| Image textures, idle | 293.8 MB | **114.9 MB** |

So the saving holds here (−401 MB idle), and the higher level is this card and its driver. The fallback is not the pre-optimization code; it is a like-for-like check of the crops only.

| Responsiveness and stability | Home |
|---|---|
| First frame after the input, first visits / later visits | Medians 4–16 / 6–15 ms, at most 17 ms (one 60 Hz frame) |
| First hover on a new page, whichever station | One frame of 83–117 ms while charging, 10 of 10 pages. Then 17 ms |
| Playground's first visit | One frame of 134–167 ms as the lift starts (office: about 320), 12 of 27 frames. From the second visit 27 of 27 |
| 240 switches in a row | Rounds 2–6: longest frame 17.1 ms, none over 50. Heap 11.1 → 11.3 MB, DOM nodes and listeners constant, GPU process 681–758 MB without a trend |
| Scene shown / largest paint | 1.19 s / 1.58 s |
| 1920 × 1080 | The same frames (lift 11 → 27), GPU process 924 MB idle |
| `?floor=approved` | +6 MB image memory, one file more (5,614 kB), frames unchanged (at most one fewer on a first visit), GPU process 802 MB idle |

## 6. Visual inspection, 1648 × 928

**The office comparison images are not on this computer, so no new before/after comparison is claimed.** The recorded evidence (at most 6 of 255 levels against the original) is in `visual-equivalence.md` and is not repeated here. What was done here:

| Check | Result |
|---|---|
| 72 frozen frames captured (`visual.mjs`): idle, charging, sequences, powered, leaving, selected, reduced motion | No errors. Key frames looked at: idle (both floors), five powered, lift and route midway, Playground selected |
| Missing layers, displaced artwork, visible crop edges | None seen |
| 43 crops against their sources, pixel by pixel in the browser | 43 identical |
| Same page, crops against full-frame files with M1.4I.2's clips removed, 14 frames | At most **2 of 255**, 0 pixels above 2. One idle frame shows 66 in Playground's cabinet, as it does against itself (section 4) |
| Connections, floor rings, shadows, reflections, strips | In place in all powered frames, and part of the 2-of-255 result |
| Playground's lift | 18 px; cabinet, sign, platform, label and floor shadow move together (2× crop looked at) |
| Back at rest after each visit | Within 1 of 255 of idle. Playground: the cabinet variant again |

**Default against `?floor=approved`:** only the floor changes (below y 423), toned down and slightly warmer, less blue in the reflections; by up to 43 levels, mean brightness 60.4 → 57.7. Objects, labels, sky and walls look the same, powered and lifted too. The default is unchanged.

## 7. Remaining limitations
- **The chip's rounded ends** (section 3): fixed in M1.4I.2.1 (`chip-click-fix.md`).
- **Dev server, Chrome only.** No production build, Firefox, Safari or touch in this session. Firefox and the other sizes: office evidence only.
- **Navigation starts from a 404** (no test route was added), so Back to it is a full load. Repeated mounts in one document were covered by `/` ↔ `/lab-v2`.
- **First hover and first lift** on a new page still have one long frame each (about 100 and 150 ms here).
- **A fast card hides marginal cases.** The office numbers remain the reference for slow hardware; the lift there is still 8–11 of 27 frames.
- **Creative Studio's Escape flag** is explained but not proven.
- Captures (`work/home/captures/`) are local only, images are not in Git.

## 8. Recommendation

**GO.** The optimized laboratory keeps the approved appearance and behavior, and the remaining M1.4I.2 checks pass apart from the narrow 1E chip case above. That case exists without the crops and has a one-line candidate correction. It is worth a small follow-up, since a smoother lift makes it show more often.

Probes added for this session (the existing scripts did not cover these): `work/home/probes/`. Run them from an empty folder that contains `out/` and `cap/`.
