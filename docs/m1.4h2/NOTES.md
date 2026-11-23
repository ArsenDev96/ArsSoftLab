# M1.4H.2: Educational globe activation (`/lab-v2`, experimental)

**Scope:** Educational only, in `/lab-v2`. When the spark from the A reaches it, the strips light, the pool at the globe's foot pulses, a wave awakens the glass bubbles, and a narrow light runs once round the painted ring and behind the island.

**Unchanged:**
- Engineering, Playground, Creative Studio, Experience;
- connection geometry and spark timing;
- the central A, the foreground, the room and the floor texture;
- the homepage;
- every earlier milestone's files (read, never written).

Educational doesn't lift. **M1.4H.2 is not approved; it awaits owner review.**

## 1. Exact timings

Time zero is the energy's arrival: the existing `SURGE_ARRIVE_MS.educational`, 460 ms after hover. Constants: `EDU_TIMING` in `components/lab/EducationalV2.tsx`.

| Phase | ms after arrival | Suggested |
|---|---|---|
| Spark travelling | before 0: nothing on the station changes | |
| A. Main strip, from the middle outwards (existing power fronts, with a pulse riding each) | 0–165 | 0 |
| A. Corner strips (existing fronts) | 196–309 | |
| A. Floor ring, warm reflections, strips' floor light | 0–310, from the middle outwards | |
| A. Cyan pulse at the globe's foot | 70–240, peak about 130–160 | 70–180 |
| B. Globe wave | 120–500 | 120–500 |
| B. The globe's cyan reflection on the floor | 120–500, with the wave | |
| C. Light round the ring | 200–750 | 200–750 |
| D. Stable: the approved files themselves | 800 | 750–850 |
| D. Faint light on the ring (opacity 0.3) | from 2600, then every 8 s | optional |
| Leaving | Crest and light stop at once. The wave runs back to the foot and the ring drains over 100–380 ms. The strips drain towards the connection (existing timing) | |

The pulse fades out to 240 ms instead of 180, so the pool hands over to the wave.

## 2. Original assets reused

Generator: `scripts/m14h2-educational.py` (NumPy and Pillow). It writes `public/scene/v2/m14h2/` and `components/lab/educational-v2.ts` only.

| Layer | Source |
|---|---|
| Stable state | M1.4F.1's `educational.png` and `educational-light.png`, unmodified |
| Body, globe, ring | M1.4F.1's station, split additively (see §3) |
| Globe light, ring light layer, strips' floor light | M1.4F.1's light layer, split (additive) |
| Unpowered strips | The approved plate with the strips darkened (M1.3K), at exactly the pixels where the station took the lit plate |
| Strip pulse | Lit plate minus darkened plate |
| Wave's crest | The globe's own pixels, added again where the wave is passing |
| Pool pulse | The globe's own pixels at its foot |
| Floor | M1.4H.1's floor light within x 652–1026, y 474–580, split by hue: warm follows the strips, cyan follows the globe. Every pixel outside that box is byte-identical |

**Drawn, not artwork** (light only, inside artwork-derived masks):
- the light round the ring (white-hot point, amber tail), through the ring's own pixels;
- a faint blue shell inside the two main bubbles, visible only under the passing crest.

## 3. How it is built

**No seams.** The station is split in premultiplied colour and alpha, `station = body + globe + ring`, and the browser adds the parts back (`plus-lighter`, inside one isolated group). Addition survives resampling, so the parts can't show a seam where they meet. Dimming the globe lets the room show through the glass.

**The wave is spherical.** Three bubbles were fitted to the rim ridges:

| Bubble | Centre | Radius | Fit |
|---|---|---|---|
| Great bubble | 786.2, 352.9 | 77.4 | RMS 0.2 px |
| Dome over the church | 841.0, 372.8 | 73.7 | RMS 0.57 px over 77% of the arc; loose on the right |
| Small dome (Ararat) | 916.0, 368.7 | 41.2 | RMS 0.14 px on the right limb |

- For each pixel, the script finds the front and back surface points it looks through. Each lights when a wave spreading over that sphere from its foot reaches it, so the front curves with the glass.
- Rims follow their own sphere; interiors mix every surface they look through.
- The order is the great bubble, the dome, the small dome, left to right around the island. The bowl fills from the pool up.
- The result is a 23-frame mask sprite.

**The ring follows the paint.** The painted ring is not an ellipse: a fitted one misses it by up to 34 px. It was traced on the plate's own ridge (407 points, RMS 0.51 px), starting from the homepage's hand trace. It runs out of the pool, up the island's front, round the right end, behind, out at the left and under the ivy: 630 px.

**The light is a 42-frame sprite** drawn along that path.

## 4. Masking and occlusion

- **Ring mask:** a band about 2 px wide, weighted by the ring's own brightness, times a visibility along the path.
- **Hidden span:** 312–458 px along the path (behind the dome's glass, the mountains and the church). Through the great bubble's glass on the way out the light is at 75%. It fades into the pool and the ivy at its two ends.
- **Island:** beyond 8 px from the front arc, the ring's light never draws over the island, mountains or church.
- **Globe:** standby keeps 42% of the blue and 50% of the ring. Sky inside M1.4F.1's hard outlines (beside the church's drum, between the left shrubs, along the left ridge) goes with the globe, or it would stay lit.

Measured on 2× captures of the same paused moment, with and without the layer (pixels changed by more than 4):

| Layer | Moments | Outside its mask | Over the island or church, away from the front arc |
|---|---|---|---|
| Light | +280, +350, +410, +480, +570 ms | 0 | 0 |
| Crest | +230, +300 ms | 0 | not measured |

## 5. Verification

Scripts: `scripts/visual/m14h2-capture.mjs` (`before`, then without), `scripts/m14h2-sheets.py`. Results: `work/measurements.json`, `work/captures/after/checks.json`.

| Check | Result |
|---|---|
| Stable state vs the approved scene (whole scene, pointer away) | max difference 2/255, 0 px over 2 |
| Rest vs approved, outside Educational's box | max 0 |
| Landscape, church, stone in standby | max 1 over 25,809 px |
| Back at rest vs rest | max 0 |
| Engineering, Playground, Creative Studio, Experience: 15 seeked captures before and after | max 1, 0 px over 2 (Playground's crop compared right of x 1030, because Educational's own floor ring reaches into its left edge) |
| Their numbers (strips, scan, bars, lift, arcade, reflection) at every seeked state | identical |
| Before arrival | nothing moves; leaving before arrival leaves every number at 0 |
| Leaving mid-globe and mid-orbit | 0 frames drew the light or crest afterwards; back at rest within 1.6 s |
| Returning while it drains | 0 frames drew the light or crest before the energy arrived, then powered |
| Fast sweeps ending on Educational, elsewhere, and away | powered, at rest, at rest |
| Keyboard | Tab 9 reaches it and powers it; Enter selects (`?station=educational`); Escape returns (`/lab-v2`) with no dip or replay; blur returns to rest |
| Click while charging | selected and powered |
| Deep link | powered in the first frame; 53 frames logged, 0 mid-sequence, 0 with the light visible |
| Reduced motion | 150 ms cross-fade; no wave, crest, light, pulse or shimmer |
| Homepage | 0 requests for `/scene/v2/` |
| Console | no errors |
| `npm run typecheck` | pass |

Not run: full visual suite, production build, browsers other than Chrome.

**Visible at 1× (1648 × 928).** At its brightest the ring's light reaches 250–255, against 170 for the resting ring. The sheet is `work/educational-phases-1x.png`. Mean luminance, rest to stable:

| Area | Rest | Stable |
|---|---|---|
| Front strip | 65 | 155 |
| Pool | 93 | 136 |
| Dome sky | 97 | 111 |
| Great bubble | 76 | 83 |

The globe's change reads as colour and edges more than brightness, because the room shows through the dimmed glass.

## 6. Performance

Captured on a Radeon HD 5450 (a 2009 entry-level card), headless Chrome with the GPU on, over the 850 ms activation (about 51 frames at 60 Hz):

| Version | Frames |
|---|---|
| Educational, first version | 8–9 |
| Educational, final | 23–37 across runs |
| Engineering (approved), same test | 13–14 |

Two changes made the difference: every moving layer is clipped to the station, so a frame no longer repaints the whole scene, and the light is a sprite instead of SVG strokes. It still drops frames on this card; pacing on a current GPU wasn't measured.

Added assets: 739 KB of PNG (756,409 bytes), of which `floor-light.png` replaces one of 96 KB.

## 7. Remaining defects and choices to review

- **The rest state is new.** Until now Educational was always lit. Standby levels are `GLOBE_STANDBY`, `ORBIT_STANDBY` and `FLOOR_STANDBY`.
- **The room shows through the dormant dome.** In standby the forest and fog behind are visible through the glass above the mountains.
- **Small dome's rim in standby:** a faint grey edge right of Ararat, at 3–4× only.
- **The swap at +800 ms:** the layers differ from the approved image by more than 2 levels on 134 px (max 12), so it isn't exact until then.
- **The ring inside the glass** (left, and where it crosses the bowl's lip) brightens with the globe, not with the passing light.
- **Frame steps:** the wave has 22 steps and the light 41, both about 60 per second. Above 60 Hz they stay at 60.
- **Browser support:** the sprites use CSS `round()` and `mod()` (Chrome 125+, Safari 15.4+, Firefox 118+).
- **Already there before this milestone:** two short vertical amber streaks beside the connection on the floor, and the unlit stem housing under the strip.

## Deliverables

| File | Shows |
|---|---|
| `educational-phases.png` | Twelve moments, rest to back at rest |
| `educational-orbit-closeup.png` | The traced ring and the fitted bubbles, then the light at 4× |
| `educational-activation.webm` | 2×: real speed (hover, stable, leave), then the activation at quarter speed |
| `full-scene-powered.png` | The whole scene, Educational powered |

**The video is frame-stepped, not a screencast.** This machine's live screencast caught only about 56 frames in 10 s. The video seeks the real page's own animations 1/60 s at a time and encodes every frame at its true time (`scripts/visual/encode-webm.mjs`). It shows the timing exactly, but not this machine's real frame rate.

`docs/**/*.png` and `*.webm` are git-ignored, so the sheets are local unless an exception like M1.4H.1's is added.

## Files

**New**
- `components/lab/EducationalV2.tsx`
- `components/lab/educational-v2.ts` (generated)
- `scripts/m14h2-educational.py`
- `scripts/m14h2-sheets.py`
- `scripts/visual/m14h2-capture.mjs`
- `scripts/visual/encode-webm.mjs`
- `public/scene/v2/m14h2/*.png`
- `docs/m1.4h2/**`

**Changed**
- `components/lab/SceneV2.tsx`: Educational's branch, its floor share, and the floor light's path. No shared infrastructure changed.

**Environment:** worked in `D:\ArsSoftLab` (this machine has no E: drive), branch `feat/lab-v2`. Assets were built with Python 3.14, NumPy 2.5.2 and Pillow 12.3.0, not the pinned versions in `scripts/requirements.txt`. Nothing is committed.
