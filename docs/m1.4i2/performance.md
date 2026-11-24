# M1.4I.2: Performance, before and after

Chrome 157 headless with the GPU (AMD Radeon HD 5450), Next.js dev server on the same machine, real time, a fresh browser profile per page. "Before" is the working tree at the start (M1.4I.1E). Both sides were measured in alternation: before, after, before, crops only, after. **7 pages before and 5 after per viewport; medians, with the range in brackets.** Scripts and data: `work/perf.mjs`, `work/perf-*.json`, `work/perfsum.mjs`.

## 1. Memory, files and layers

| | 1648 × 928, before | After | 1920 × 1080, before | After |
|---|---|---|---|---|
| Scene files transferred | 5,942 kB | **5,605 kB** (−6 %) | same | same |
| Decoded RGBA of every file loaded | 416.7 MB (109 Mpx) | **173.5 MB** (45 Mpx, −58 %) | same | same |
| Image textures on the GPU, idle | 298.1 MB | **119.4 MB** (−60 %) | 298.1 MB | **119.4 MB** |
| …after visiting all five stations | 422.7 MB | **173.5 MB** (−59 %) | 422.7 MB | **173.5 MB** |
| Tile memory, idle | 324 MB | **264 MB** (−18 %) | 363 MB | **267 MB** (−27 %) |
| Layers that draw | 86 | 86 | 86 | 86 |
| …of them full frame | 22 | **15** | 22 | **15** |
| Their total area | 40.5 Mpx | **30.1 Mpx** | 54.9 Mpx | **40.7 Mpx** |
| GPU process (private), idle | 758 MB (752–761) | **582 MB** (564–587) | 812 MB (786–836) | **561 MB** (560–562) |
| …after visiting all five | 684 MB (653–719) | **577 MB** (557–604) | 712 MB (664–724) | **537 MB** (533–543) |
| Renderer process, idle | 271 MB | 274 MB | 267 MB | 262 MB |
| …after visiting all five | 192 MB (179–223) | 221 MB (206–252) | 187 MB (180–201) | 211 MB (188–214) |

The GPU figures come from Chrome's own accounting (memory-infra dump). **The renderer process is about 25–30 MB larger after use**, against about 105–250 MB less in the GPU process.

## 2. Image decoding (traces, two pages each)

| | Before | After |
|---|---|---|
| During load | 103 / 73 decodes, 781 / 666 ms | 89 / 88 decodes, **521 / 421 ms** |
| First hover of each station, all five | 40 / 42 decodes, 191 / 178 ms | **7 / 7 decodes, 38 / 35 ms** |
| Second hover of each station, all five | 54 / 60 decodes, 174 / 226 ms | **0 decodes** |

Before, the images did not fit the browser's image budget, so it kept decoding the same files on every hover. Now they fit. Times are worker-thread totals.

## 3. Load

| | 1648, before | After | 1920, before | After |
|---|---|---|---|---|
| First paint | 1.45 s (1.08–1.66) | 1.68 s (1.15–1.92) | 1.59 s (1.27–1.84) | 1.61 s (1.56–1.87) |
| Scene shown | 2.69 s (2.25–2.95) | 2.41 s (2.16–3.56) | 2.56 s (1.65–3.02) | 2.80 s (2.15–3.05) |
| Largest paint | 4.09 s (3.77–4.50) | 3.16 s (2.85–3.82) | 3.87 s (2.12–4.49) | 3.12 s (2.81–3.58) |

**No claim is made for first paint or scene shown:** the ranges overlap and the medians go both ways. Largest paint is earlier at 1648 (the ranges barely overlap).

## 4. Frames

Frames drawn during each station's own sequence, and the longest single frame. "Crops" is the crops without the clipped wrappers (NOTES section 4).

| 1648 × 928, first visit → later visits | Frames possible at 60 Hz | Before | Crops | **After** | Longest frame before | **After** |
|---|---|---|---|---|---|---|
| Engineering | 36 | 12 → 12 | 17 → 17 | **34 → 35** | 150 → 150 ms | **50 → 33 ms** |
| Educational | 49 | 33 → 37 | 48 → 49 | **48 → 49** | 100 → 100 ms | **33 → 17 ms** |
| Playground | 54 | 11 → 14 | 12 → 16 | **12 → 22** | 317 → 117 ms | 333 → 83 ms |
| – its lift (450 ms) | 27 | 9 → 10 | 9 → 10 | 8 → 11 | 117 → 117 ms | **84 → 67 ms** |
| Creative Studio | 48 | 30 → 33 | 41 → 44 | **43 → 44** | 83 → 83 ms | 67 → 59 ms |
| Experience | 60 | 41 → 43 | 54 → 54 | **55 → 55** | 83 → 83 ms | 67 → 67 ms |

| 1920 × 1080, first → later | Before | Crops | **After** | Longest frame before | **After** |
|---|---|---|---|---|---|
| Engineering | 13 → 14 | 16 → 16 | **29 → 34** | 133 → 133 ms | **67 → 50 ms** |
| Educational | 23 → 28 | 38 → 47 | **38 → 49** | 133 → 117 ms | **33 → 17 ms** |
| Playground | 9 → 11 | 9 → 12 | 10 → 15 | 317 → 150 ms | 317 → 100 ms |
| – its lift | 7 → 8 | 7 → 8 | 8 → 9 | 167 → 133 ms | 117 → 83 ms |
| Creative Studio | 25 → 27 | 33 → 39 | **40 → 43** | 100 → 83 ms | 83 → 67 ms |
| Experience | 28 → 31 | 38 → 47 | **51 → 53** | 117 → 100 ms | 67 → 67 ms |

## 5. Comparison (the brief's table, 1648 × 928)

| Metric | Before | After | Change |
|---|---|---|---|
| Transferred image bytes | 5,942 kB | 5,605 kB | −337 kB (−6 %) |
| Decoded RGBA memory | 416.7 MB | 173.5 MB | −243 MB (−58 %) |
| GPU-process memory, idle / after use | 758 / 684 MB | 582 / 577 MB | −176 / −107 MB |
| First hover: frames while charging, all five | 144 | 162 | **+13 %** |
| …longest frame, Educational / Playground | 150 / 200 ms | 83 / 117 ms | shorter |
| …first frame after the input | 3–10 ms | 5–11 ms | no change |
| Steady-state frame pacing, idle | 16.7 ms | 16.7 ms | no change (nothing moves) |
| Playground lift, frames of 27, first / later | 9 / 10 | 8 / 11 | **no reliable change** |
| …longest frame, first / later | 117 / 117 ms | 84 / 67 ms | shorter |
| Engineering activation, frames of 36 | 12 / 12 | 34 / 35 | **almost three times** |
| Educational activation, frames of 49 | 33 / 37 | 48 / 49 | **+45 % / +32 %** |

## 6. What is hardware and what was ours
- **Ours, now fixed:** repeated decoding (section 2), and Engineering's seven screen-sized layers for a 146 × 85 px display. Four stations now run close to 60 Hz on this old card.
- **Still limited by the card:** Playground. Its first visit still has one frame of about 320 ms (the cabinet is drawn at a new scale when the lift begins; it was there before), and its lift stays at 8–11 of 27 frames. The drop in memory does not change that.
- **Not measured:** a production build, a real network, other GPUs, touch.

## 7. Floor tone (after the optimization; 5 pages default, 3 pages `?floor=approved`)

| 1648 × 928 | Default | `?floor=approved` |
|---|---|---|
| Files | 84, 5,605 kB | 85, 5,614 kB |
| Image textures on the GPU, idle | 119.4 MB | 125.4 MB (+6 MB: its mask) |
| GPU process, idle / after use | 582 / 577 MB | 589 / 585 MB |
| Engineering, frames first → later | 34 → 35 | 35 → 35 |
| Educational | 48 → 49 | 46 → 49 |
| Playground | 12 → 22 | 12 → 20 |
| Creative Studio | 43 → 44 | 43 → 44 |
| Experience | 55 → 55 | 56 → 56 |

At 1920 × 1080 the tone costs a few frames on some first visits (Creative Studio 40 → 35, Experience 51 → 45) and 8 MB; later visits differ by at most 4 frames.
