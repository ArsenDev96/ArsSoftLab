# M1.4H.3: Creative Studio activation (`/lab-v2`, experimental)

**Scope:** Creative Studio only, in `/lab-v2`. When the spark from the A reaches it, the strips light and the painting awakens with the light of its own sunrise: from the painted sun, along the clouds, to the peak, then a glint along the ridge.

**Unchanged:**
- Engineering, Educational, Playground, Experience;
- connection geometry and spark timing;
- the central A, the foreground (with its steam), the room and the floor texture;
- the homepage;
- every earlier milestone's files (read, never written).

Creative Studio doesn't lift, tilt, rotate or resize. **M1.4H.3 is not approved; it awaits owner review.**

## 1. Which parts of the painting are illuminated

| When | What lights | Where it is in the artwork |
|---|---|---|
| First response | Amber grass at the lower left, the golden bush at the lower right, the warmest stream pixels; faintly, the easel's ledge | The lower third of the painting |
| Sunrise | Everything, in the order the light reaches it. Its front brightens the painting's highlights: the sun, the flame-edged clouds, the peak's lit face, the bright valley | The whole painting |
| Ridge | The sunlit ridge line from under the sun to the summit | A 79 px path, snapped to the ridge's own bright edge |
| Cloud edges | Warm, locally bright cloud edges just behind the sunrise's front | 1,148 px in the sky |
| Small paintings | Their own sun and lit peak, one swell each as the light reaches them | The two framed ones |

Cool lavender clouds get a quarter of the added light. It is sunlight, and at full strength they sparkled white.

Not animated: the canvas, easel, brushes, cup, frames and stone. Nothing new is painted and no light leaves the painted areas and the ledge.

## 2. How the highlight masks were generated

Generator: `scripts/m14h3-creative.py` (NumPy and Pillow). It writes `public/scene/v2/m14h3/` and `components/lab/creative-v2.ts` only.

- **Painted areas:** quads measured on the plate at 8×, inside the canvas's light rim, softened 1 px inwards, and limited to the station's opaque pixels.
- **Highlights:** luminance, times local contrast against the painted pixels around, times warmth (red above blue). The added light is each pixel's own colour.
- **The sunrise's order:** a shortest-path solve over the painted pixels (Dijkstra) starting at the painted sun. Light crosses bright warm paint about 12 times faster than dark paint, and slows across contours. So its front takes its shape from the clouds and mountains. It is paced by area, so the sky doesn't light all at once.
- **Standby:** the painting's own pixels through a tone curve (7% off the darkest, 24% off the brightest, a touch more red than blue). It is an overlay that the sunrise removes.
- **Strips:** unpowered as the approved darkened plate has the fixture. The glow on the stone is removed in the stone's own hue, because the plate's own removal leaves a grey patch at the right end.

**Drawn, not artwork:** nothing. All added light is the artwork's own pixels, brighter.

## 3. Timings

Time zero is the energy's arrival: the existing `SURGE_ARRIVE_MS.creative`, 640 ms after hover. Constants: `CRE_TIMING` in `components/lab/CreativeV2.tsx`.

| Phase | ms after arrival | Suggested |
|---|---|---|
| Spark travelling | before 0: nothing on the station changes | |
| Front strip, right to left (existing power fronts, a pulse riding each) | 19–209 | 0 |
| Left strip (existing front) | 327–412 | |
| Floor ring and strip reflections | 0–570, right to left under the strips' fronts | |
| First warm response | 100–380, peak about 210 | 100–160 |
| Sunrise | 150–590 | 150–550 |
| Mirrored objects on the floor (75% at rest) | 150–590, with the sunrise | |
| Ridge glint, cloud edges, small paintings | 350–730 | 350–700 |
| Stable | 780 | 750–850 |
| Leaving | Added light stops at once. The sunrise draws back to the sun over 100–420 ms. The strips drain (existing timing) | |

Nothing keeps moving afterwards: 0 running animations on the station, and two captures 2.5 s apart are identical (steam area excluded).

## 4. How the stable state matches the approved artwork

M1.4F's `creative.png` is always drawn, unmodified. At the end no overlay is left over it, and the strips' floor light is M1.4G.1's own `creative-light.png`.

| Compared with the scene before this milestone (always lit) | Result |
|---|---|
| The painting | max difference 0 |
| Whole scene | max 2/255, 0 px over 2 |

## 5. Is it clearly noticeable at normal desktop size?

Yes, at 1648 × 928 (1×). The painting is 14,622 px.

| | Standby | +200 | +260 | +320 | +500 | Stable |
|---|---|---|---|---|---|---|
| Mean luminance | 103 | 110 | 117 | 121 | 125 | 124 |
| Px brighter than standby by 25 | 0 | 1,548 | 3,168 | 4,879 | 5,377 | 5,362 |
| Px brighter than the approved by 15 (the moving light) | 0 | 857 | 1,417 | 576 | 133 | 0 |

- Standby keeps 83% of the painting's brightness, so it stays attractive and legible.
- The front strip goes from 57 to 151.
- The ridge glint is delicate at 1×: 133 px at its clearest.
- The sheet at 1× is `work/creative-phases-1x.png`.

## 6. Remaining visual imperfections and choices to review

- **The rest state is new.** Until now Creative Studio was always lit. Standby is `STANDBY` in the generator, `FLOOR_STANDBY` and `FLOOR_TOP_STANDBY` in the component.
- **The sun clips briefly.** At +220 ms, 99 px (2×) at the painted sun are pure white.
- **Right end of the platform:** the approved strip end is itself whitish, with a slight cool fringe from the blue floor. That is M1.4G.1's approved state and is unchanged. During the sequence, 27 px there are up to 12 levels cooler than both end states at +80 ms, and none at any other captured phase. 7 of them are actually blue (blue above red by at most 16; the approved image reaches 10).
- **Right face in standby:** a slightly darker amber area next to the strip, visible at 3×. The plate's glow there is baked into the stone.
- **Settling:** the fronts' floor light and the approved layer differ on 141 px along the strip's 1 px edge (max 55), because a masked layer resamples edges differently. A 160 ms additive cross-fade hides it; the difference is the two ends, not a jump.
- **Frame steps:** the sunrise has 23 steps in 440 ms and the glints 21 in 380 ms, about one per frame at 60 Hz.
- **Browser support:** the sprites use CSS `round()` and `mod()`, as M1.4H.2 (Chrome 125+, Safari 15.4+, Firefox 118+).

## 7. Verification

Scripts: `scripts/visual/m14h3-capture.mjs` (`before`, then without) and `scripts/m14h3-sheets.py`. Results: `work/measurements.json`, `work/captures/after/checks.json`.

| Check | Result |
|---|---|
| Rest vs approved, outside Creative Studio's box | max 0 |
| Easel, brushes, cup, frames, stone at rest vs approved | max 0 over 36,565 px |
| Back at rest vs rest (whole scene) | max 0 |
| Added light, 7 moments with and without it | 0 px outside the painted areas and ledge; 0 px darkened |
| Engineering, Educational, Playground, Experience: 29 seeked captures before and after, including leaving | max 3, 1 px over 2 (one Playground capture while its spark travels). Engineering's crop excludes the top of the painting, which lies in it |
| Their numbers (strips, scan, bars, globe, orbit, lift, arcade, reflection) at every seeked state | identical |
| Pointer leave before arrival | 80 frames logged: sunrise 0, no added light |
| Pointer leave mid-sunrise and mid-glint | 0 frames with added light afterwards; the sunrise only falls (no flicker); settled |
| Return while it draws back | 0 frames with added light before the energy arrives, then powered |
| Fast sweeps ending on Creative Studio, elsewhere, and away | powered, at rest, at rest |
| Keyboard | Tab 17 reaches it and powers it; Enter selects (`?station=creative`); Escape returns (`/lab-v2`): 87 frames logged, the sunrise stays complete, 0 frames with added light; blur returns to rest |
| Click while charging | selected and powered |
| Direct link | powered in the first frame; 90 frames logged including the pointer passing over it and off: 0 mid-sequence, 0 with added light |
| Reduced motion | a 150 ms cross-fade; no travelling light, pulse or glint |
| Homepage | 0 requests for `/scene/v2/` |
| Console | no errors |
| `npm run typecheck` | pass |

**Found by these checks and fixed:** Escape replayed the glints (10 frames), because one frame has neither hover nor selection and a number reset at once. The resets now wait 300 ms.

**Frame pacing:** Radeon HD 5450, headless Chrome with the GPU on, 850 ms activation (about 51 frames at 60 Hz). Final run: 30, 33 and 33 frames; earlier runs of this version's layers: 25–42. Engineering in the same test: 15. A current GPU wasn't measured.

**Not run:** full visual suite, production build, browsers other than Chrome.

## Deliverables

| File | Shows |
|---|---|
| `creative-phases.png` | Twelve moments, rest to back at rest |
| `creative-painting-closeup.png` | The measured geometry, the sunrise's order, the light maps, then the painting at 6× |
| `creative-activation.webm` | 2×: real speed (hover, stable, leave), then the activation at quarter speed |
| `full-scene-powered.png` | The whole scene, Creative Studio powered |

**The video is frame-stepped, not a screencast.** The local GPU can't screencast the page smoothly. The video seeks the real page's own animations 1/60 s at a time and encodes every frame at its true time. It shows the timing exactly, but not this machine's real frame rate.

`docs/**/*.png` and `*.webm` are git-ignored, so the sheets are local unless an exception is added.

## Files

**New**
- `components/lab/CreativeV2.tsx`
- `components/lab/creative-v2.ts` (generated)
- `scripts/m14h3-creative.py`
- `scripts/m14h3-sheets.py`
- `scripts/visual/m14h3-capture.mjs`
- `public/scene/v2/m14h3/*.png` (about 500 KB)
- `docs/m1.4h3/**`

**Changed**
- `components/lab/SceneV2.tsx`: Creative Studio's branch, its floor share, and the floor light's path. Its old entry in the recovered-station map is now unused and left in place.

No shared infrastructure changed. `scripts/visual/encode-webm.mjs` (M1.4H.2) is reused as is.

**Environment:** `D:\ArsSoftLab`, branch `feat/lab-v2`, on top of the uncommitted M1.4H.2. Assets were built with Python 3.14, NumPy 2.5.2 and Pillow 12.3.0, not the pinned versions in `scripts/requirements.txt`. Nothing is committed or pushed.
