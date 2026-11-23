# M1.4H.4: Experience activation (`/lab-v2`, experimental)

**Scope:** Experience only, in `/lab-v2`. When the spark from the A reaches it, the strips light and the energy climbs the painted mountain route to its end.

**Unchanged:**
- Engineering, Educational, Creative Studio, Playground (and its 18 px lift);
- connection geometry and spark timing;
- the central A, the foreground, the room and the floor texture;
- the homepage;
- every earlier milestone's files (read, never written).

Experience doesn't lift, tilt, rotate or resize. **M1.4H.4 is not approved; it awaits owner review.**

## 1. Where the existing route starts and ends

Coordinates are scene px (1672 × 941).

| | Point | In the artwork |
|---|---|---|
| Start | (1410, 705) | The middle of the paving's front edge, which runs from (1396, 704) to (1423, 707); 16 px wide |
| End | (1478.5, 610) | Where the route has narrowed to 1.6 px and meets the ridge wires between the two peaks |

- **Length:** 307 px, seven bends.
- **Direction:** from the platform's front up to the mountains.
- **The end is not the summit.** The main peak is at (1497, 567), 43 px higher. The homepage's older trace (`experience-path.ts`) ends at (1490, 605). That point is on a ridge wire, past the last bend, so it wasn't used.
- **Markers:** there are none on the route itself. The lower flag stands behind its widest bend (right, 1538, 646), and the upper flag stands on the main peak's slope.

## 2. How geometry and perspective were traced

Generator: `scripts/m14h4-experience.py` (NumPy and Pillow).

- **Centreline:** 39 points with half widths, read on the artwork at 10× and joined by a centripetal spline. It is validated on `work/trace-8x.png`.
- **Pixels:** the route is the bright amber pixels along that line, so its width and irregular edges are the painting's own (1,693 px).
- **Arc length:** each route pixel takes the arc length of its nearest point on the centreline. That distance is measured from the route's edge, so neighbouring legs don't mix.
- **Perspective:** the path narrows from 16 to 1.6 px as it recedes. The energy's speed follows the local scale to the power 0.45, so it slows as it climbs away, eased slightly at both ends. No jumps between bends.

## 3. How depth and occlusion are preserved

- Nothing is drawn over the artwork. Standby only darkens painted pixels and the added light only brightens them, so whatever crosses the route stays in front of it.
- The dark break at (1488, 635), where the terrain crosses the route, stays dark. The energy's timing continues through it.
- The code panel stands behind the peaks and the plant in front of the terrain. Neither receives added light (0 px at 10 moments).

The light the route throws on the stone around it uses the same trace: each terrain pixel lights by the share of the route near it that is already lit.

## 4. Which pixels and layers are reused

| Layer | Source |
|---|---|
| Station | M1.4F's `experience.png`, always drawn, unmodified |
| Standby | Its own pixels, darkened: the route to 50%, the stone and wires it lights to 91% |
| Travelling light, start, flags, destination | Its own pixels, brighter, along the artwork's own amber to warm white ramp |
| Strips | M1.4F's light, existing power fronts (`PLATFORM_POWER`) |
| Floor light of the strips | M1.4F's `experience-light.png` |
| Ring and reflections | Experience's share of M1.4G.1's floor light, separated; every pixel outside it is identical |

**Not taken from the artwork:** the standby tone of the unlit front strip. The darkened plate's tan band read as a grey stripe here, so it is dimmed 20% and moved towards the amber stone above it.

**Code panel:** static. Its few amber glyphs are too small for an effect to read, and a brightness change over the panel was ruled out.

## 5. Timings

Time zero is the energy's arrival: the existing `SURGE_ARRIVE_MS.experience`, 660 ms after hover.

| Phase | ms after arrival | Suggested |
|---|---|---|
| Spark travelling | before 0: nothing on the station changes | |
| Front strip, left to right (existing front, a pulse riding it) | 14–217 | 0–300 |
| Right strip (existing front) | 318–408 | |
| Floor ring and strip reflections | 10–411, with the fronts | |
| Start of the route: one amber pulse | 30–320, peak 150 | 0 |
| Route | 120–750 | 120–750 |
| 25%, 50%, 75% of its length | 250, 388, 545 | |
| Terrain next to the energy | 120–840, as it passes | 250–750 |
| Lower flag | 444–619, as it passes its bend | |
| Destination: the last 26 px of route, then the ridge wires that meet it | 712–930, peak 790 | 720–880 |
| Upper flag | 760–930, peak 820 | |
| Stable | 980 | 900–1000 |
| Leaving | Added light stops at once. The trail draws back to its start, starting at 100 ms and gone by about 520 ms, as the strips drain | |

While the energy travels, the trail behind it stays at 87% of its way to the approved brightness. The last 13% comes with the destination, as the landscape settles.

One number (`--xs`) drives the trail, the travelling light and the destination. They cannot drift apart, and an interrupted destination cannot play late.

## 6. Stable state against the approved artwork

| Compared with the scene before this milestone (always lit) | Result |
|---|---|
| Route, terrain, flags, code panel | max difference 0 |
| Whole scene | max 2/255, 0 px over 2 (before section 10, which changes the floor disc on purpose) |

Nothing keeps moving: 0 running animations, and two captures 2.5 s apart are identical.

## 7. Visibility at normal desktop size (1648 × 928, 1×)

| | Standby | 25% | 50% | 75% | Destination | Stable |
|---|---|---|---|---|---|---|
| Route luminance (1,652 px) | 104 | 148 | 167 | 183 | 201 | 209 |
| Px brighter than standby by 25 | 0 | 1,671 | 2,294 | 3,000 | 3,993 | 3,731 |
| Px brighter than the approved by 10 (the moving light) | 0 | 189 | 94 | 210 | 448 | 0 |

- The progressive trail is clear: the route doubles in brightness along its length.
- The energy's head is restrained, because most of the painted route is already close to white.
- At the destination, the brightest gain over the approved is 55 levels.
- The sheet at 1× is `work/experience-phases-1x.png`.

## 8. Visual defects and performance

- **The rest state is new.** Until now Experience was always lit. Levels are in the generator (`ember`, `k_spill`, `k_wire`) and `FLOOR_STANDBY`, `FLOOR_TOP_STANDBY` in the component.
- **Standby looks a little matte at 6×.** A dim rim 1 to 2 px wide surrounds the unlit route, and its edges are slightly uneven close to the head. Not visible at 1×.
- **Front edge pixels:** up to 55 of 54,138 route pixels (6×) light more than 14 px ahead of the front, at the inside of bends. None stay dark behind it.
- **Standby, 13 px** along the base's 1 px edge are 4 or more levels brighter than the approved.
- **Floor disc at the left:** corrected after review (section 10).
- **Settling:** the fronts' floor light and the approved layer differ on 139 px along the strip's 1 px edge (max 52). A 160 ms cross-fade hides it, as in M1.4H.3.
- **Quick return:** coming back while the trail is still drawing back holds it where it is until the new spark arrives; it continues from there. No added light before the arrival.
- **Frame steps:** 71 steps in 950 ms, 13 ms each.
- **Browser support:** CSS `round()` and `mod()`, as M1.4H.2 and H.3 (Chrome 125+, Safari 15.4+, Firefox 118+).
- **Frame pacing:** Radeon HD 5450, headless Chrome with the GPU on, the 1000 ms after arrival (about 60 frames at 60 Hz). Final run: 20, 37 and 35 frames; earlier runs: 36–38, and 16, 39, 38. The first activation after loading was the slow one in the last two. A current GPU wasn't measured.

## 9. Verification

Scripts: `scripts/visual/m14h4-capture.mjs` (`before`, then without) and `scripts/m14h4-sheets.py`. Results: `work/measurements.json`, `work/captures/after/checks.json`.

| Check | Result |
|---|---|
| Rest vs approved, outside Experience's box | max 0 |
| Flags, code panel text, and the stone and plant outside the standby areas, at rest vs approved | max 0 |
| Back at rest vs rest (whole scene) | max 0 |
| Added light, 10 moments with and without it | 0 px off the station, 0 on the code text, 0 on the plant, 0 darkened, 0 clipped to white, 0 turned blue |
| Engineering, Educational, Creative Studio, Playground: 33 seeked captures before and after, including leaving | max 3, 1 px over 2 (one Playground capture while its spark travels). Playground's crop excludes the left ridge wires, which lie in it |
| Their numbers (strips, scan, bars, globe, orbit, sunrise, glints, lift, arcade, reflection) at every seeked state | identical |
| Pointer leave before arrival | nothing starts, no added light |
| Leave during the journey (to a station, and to nothing) and at the destination | 0 frames with added light afterwards; the trail only falls; settled |
| Return while it draws back | 0 frames with added light before the arrival, then powered |
| Fast sweeps ending on Experience, elsewhere, and away | powered, at rest, at rest |
| Keyboard | Tab 19 reaches it and powers it; Enter selects (`?station=experience`); Escape returns (`/lab-v2`): 72 frames logged, no replay; blur returns to rest |
| Click while charging | selected and powered |
| Direct link | powered in the first frame; 98 frames logged including the pointer passing over it and off: 0 mid-sequence, 0 with added light |
| Reduced motion | a 150 ms cross-fade; no travelling light, pulse or destination |
| Homepage | 0 requests for `/scene/v2/` |
| Console | no errors |
| `npm run typecheck` | pass |

**Not run:** full visual suite, production build, browsers other than Chrome.

**Found and fixed on the way:**
- the head's light looked cyan over the unlit route;
- the destination read as a yellow starburst;
- the unlit strip had a grey band and a pale edge line;
- standby brightened dark pixels beside thin wires (535 px);
- standby dimmed one code glyph.

## 10. Correction after review: the floor disc left of the platform

**Source:** the ring spill in M1.4G's floor light (`floor-light.png`), in Experience's share (`experience-floor.png`). Inside the ring line it adds about 130 levels over an already bright window reflection, so the stone washed out to near white.

**Change:** the powered fronts use a copy, `experience-floor-lit.png`, with that light scaled down (`DISC` in the generator): 46% next to the base, falling to the standby's 20% at the far edge, with the thin ring line at 42%. Only existing light is scaled, so nothing is blurred or painted. The standby image, timings and every other layer are unchanged (files byte-identical).

| | Rest | Powered before | Powered after |
|---|---|---|---|
| Disc luminance | 161.3 | 230.0 | 170.5 |
| Stone texture (standard deviation) | 22.7 | 20.5 | 23.6 |

Seeked captures at rest, +100, +250 and +1500 ms: 0 px changed around Experience outside the disc's box (x 1141–1213, y 696–754). Rest is identical.

`floor-disc-before-after.png` shows +100, +250 and fully powered at 1×. `full-scene-powered.png` is updated. The other sheets, the video and the measurements above predate this correction.

## Deliverables

| File | Shows |
|---|---|
| `experience-phases.png` | Twelve moments, rest to back at rest |
| `experience-trail-closeup.png` | The trace and masks, then the route at 6× |
| `experience-activation.webm` | 2×: real speed (hover, stable, leave), then the activation at quarter speed |
| `full-scene-powered.png` | The whole scene, Experience powered |
| `floor-disc-before-after.png` | The floor disc, before and after its correction |

**The video is frame-stepped, not a screencast.** The local GPU can't screencast the page smoothly. The video seeks the real page's own animations 1/60 s at a time and encodes every frame at its true time. It shows the timing exactly, but not this machine's real frame rate.

`docs/**/*.png` and `*.webm` are git-ignored, so the sheets are local unless an exception is added.

## Files

**New**
- `components/lab/ExperienceV2.tsx`
- `components/lab/experience-v2.ts` (generated)
- `scripts/m14h4-experience.py`
- `scripts/m14h4-sheets.py`
- `scripts/visual/m14h4-capture.mjs`
- `public/scene/v2/m14h4/*.png` (about 610 KB)
- `docs/m1.4h4/**`

**Changed**
- `components/lab/SceneV2.tsx`: Experience's branch, its floor share, and the floor light's path. The recovered-station map and its branch are now unused by any station and left in place.

No shared infrastructure changed. `scripts/visual/encode-webm.mjs` (M1.4H.2) is reused as is.

**Environment:** `D:\ArsSoftLab`, branch `feat/lab-v2`, on top of the uncommitted M1.4H.2 and M1.4H.3. Assets were built with Python 3.14, NumPy 2.5.2 and Pillow 12.3.0, not the pinned versions in `scripts/requirements.txt`. Nothing is committed or pushed.
