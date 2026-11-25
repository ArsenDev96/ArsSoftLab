# M1.4J.4: Experience's platform lift (`/lab-v2`, experimental)

**Implemented, awaiting visual approval.** When the spark arrives, the whole installation (stone, terrain, mountain route, ridges, flags, code panel, plant, strips) rises **10 px** as one piece and returns smoothly. The journey animation's timing and pixels are unchanged. The other four lifts and the homepage are unchanged. Not committed.

Positions are scene px (1672 × 941); times are after the spark's arrival (660 ms after the hover). Measured on the dev server, Chrome 158, RTX 4060, 60 Hz, 1648 × 928, against an untouched copy of the tree before this milestone (`ded97bf` plus M1.4J.3) served beside it ("the checkpoint").

| Question | Answer |
|---|---|
| 1. Height | **10 px** (section 2) |
| 2. Timing | Starts at 90 ms, half at **307**, full at **790 ms**. Down: **417 ms** (section 3) |
| 3. Moving and fixed layers | Section 4 |
| 4. Trail, ridges, flags, code panel | **Largest difference 1 of 255** (section 5) |
| 5. Connection and shadow | Section 6 |
| 6. Floor disc | Stays corrected: 155.6 raised, 157.0 before (section 7) |
| 7. Hover and chip | 0 failures (section 8) |
| 8. Other stations | Unchanged: max 2 of 255, 0 px above 2, with one reduced-motion note (section 9) |
| 9. Performance | 48 of 48 frames here; office GPU not measured (section 10) |
| 10. Files | Section 12 |

## 1. The artwork, and the code panel

**The code panel is attached to the installation and rises with it.** Decided before anything was moved:

- Both its posts stand in the terrain: the left one at (1389, 648), the right one at (1530, 633).
- The ridges and the upper flag stand in front of it.
- In M1.4F's recovered station it is one opaque piece with them (alpha 255 throughout; the dark floor behind the glass is in it). Keeping it still would need a new picture of the ridges without it and of the glass without them.

Other findings:

- **Nothing in the foreground overlaps the platform.** The lower-right plant and the table share 0 px with it, also 12 px up. The station holds no foreground, so unlike Creative Studio it needs no filled-in stone.
- **The plant on the stone** and its hanging vine are the station's own pixels: they rise.
- **The smooth rim** under the rock carries the strips and is part of the station: it rises.
- **The strips' floor light** (M1.4F) was recovered up to the platform's outline. Raised, its brightest rows would stay behind as a second strip. Left of the rim, part of it would be drawn onto the risen rim. Section 4 says how it is split.

## 2. Height: why 10 px

| | 8 px | **10 px** | 12 px |
|---|---|---|---|
| Dark band between the front strip and its light on the floor | 3.7 px | **5.3 px, about as thick as the strip** | 6.9 px, thicker than the strip: it starts to read as hovering |
| Terrain to the Koreez chip's middle | 20 px | **18 px** | 16 px |
| Panel to Playground's target | Beside it, 12 px apart | **The same** | The same |
| Connection, rim, right corner, flags, ridges, edges | Fine | **Fine** | Fine |

12 px breaks nothing. The gap there becomes wider than what the rim and its light can tie together, and 10 px matches Creative Studio, the platform opposite on the same depth. The height is one constant, `EXP_LIFT.rise`. `lift-height-comparison.png`.

## 3. Timing

| Event | Planned | Measured (10 runs) |
|---|---|---|
| First movement | 90 ms | 107 ms (0 px before the arrival). The first activation on a new page has one long frame: 157–190 ms |
| Quarter / half / 99 % | about 300 for half | 240 / **307** / 707 |
| Full | 750–850 | **790 ms** |
| Down: half / floor | about 420 | 150 / **417 ms** |
| Journey: 25, 50, 75 % of the route; destination | unchanged: 250, 388, 545, 712–930 | unchanged: at 3.4, 7.4, 9.3 and 10 px |

No overshoot: 0 frames fell while rising, 0 rose while sinking. Largest step in a 60 Hz frame: 1.1 px. No scale or rotation; a whole number of device pixels at full height.

## 4. What moves, what stays

One number, `--xl` (0 on the floor, 1 raised). **15 elements** carry the same `translateY` themselves (a wrapper would isolate their blending). The difference between the largest and the smallest displacement was **0** in every frame of every Chrome run.

| Moves | Stays |
|---|---|
| The recovered station: stone, rim, terrain, painted route, ridges, flags, code panel, plant | Connection, floor ring, reflections, floor texture |
| The route's standby overlay, travelling light, terrain response, flag light, destination | The strips' light on the floor (25 % weaker when raised) |
| Strips: unpowered parts, pulses, the light's rows next to them | Ground shadows |
| The departing part of the contact shadow | Label, icon, chip; the foreground plant |

Five derived layers (`scripts/m14j4-experience.py`). **No artwork: only the alpha of existing light is split, pixel for pixel, and each pair adds up to its source.**

| Layer | |
|---|---|
| `experience-light-edge` / `-light-spill` | M1.4F's strip light: the rows next to the strips rise; the rest stays, now under the station |
| `experience-floor-edge` / `-floor-rest` / `-floor-lit-rest` | M1.4H.4's floor light: 181 px of specks along the outline rise; everything else stays |

On the floor the approved `experience-light.png` itself is still what is drawn once powered.

## 5. Trail, ridge and flag alignment

The station alone on black, frozen at 18 moments (14 of the sequence, with 25, 50 and 75 % of the route and the destination, 3 while leaving, rest), raised by 3, 5, 7 and 10 device px, against the same moment at rest with the shift taken out:

| | Largest difference | Px above 2 |
|---|---|---|
| The route's and strips' layers only (standby, travelling light, terrain, ridges, flags, destination, strips) | **1** | 0 |
| The whole station, with the code panel | **1** | 0 |

Unshifted, 46,000–67,000 px of the station differ, so the test would see a layer left behind. `trail-alignment.png`, `work/align.txt`.

With the lift held at 0, the sequence equals the checkpoint (max 2 of 255; 3 on 2 px in one of two runs), except 26–33 px (max 24) along the stone's soft left edge beside the rim while the strips' fronts are running. That can only show for the first 90 ms after the arrival. Letting those pixels rise instead left a row of specks on the raised rim, so it was rejected. `work/liftoff.txt`.

## 6. Connection and ground

| | Behaviour |
|---|---|
| **Connection** | Unchanged. It ends on the stone's left side (1213, 697), which is upright there, so the lift uncovers nothing. Continuous at rest, 25 %, 50 %, full and half returned; no extension needed. Its rounded end lies over the stone's edge, as approved |
| **Contact shadow** (M1.4G's own pixels) | 100 → 30 %; most of it leaves with the platform's edge |
| **Soft shadow** (new, drawn) | 0 → 30 %, in the platform's own outline: the lowest pixel of each column from the rim's left end to the right corner. Ten steps, no blur filter |
| **Floor in the gap** | 26 % darker in the middle, 24 % at the right strip, 23 % at the left rim, 20 % under the front strip; 27 % at the old outline, 18 % just outside, 0 % beyond. The texture stays |
| **Reflections and ring** | Fixed |

## 7. The floor disc (M1.4H.4.1)

The 1,898 px left of the platform that M1.4H.4.1 corrected, never covered by the platform:

| Mean luminance | Rest | +250 ms | Powered | Brightest px |
|---|---|---|---|---|
| Checkpoint | 149.0 | 156.9 | 157.0 | 215 |
| Now (powered is raised) | 149.0 | 156.8 | **155.6** | 215 |

It is slightly darker raised, because the soft shadow reaches it. In 56 frames of four quick returns nothing was brighter than before. No oval, no new disc. `work/disc.txt`.

## 8. Hover, clicks, state

**Hotspot:** its upper points rise; its left corner and foot stay. It follows `--xl` and contains the resting one. Label, chip, bridge and the 90 ms grace are unchanged. No new keyboard stop (38, same order).

| Check | Result |
|---|---|
| Hit map: rest, every other station powered, homepage | **0 changed**, but for 3 sample points that lie exactly on the resting outline's straight edge (rounding) |
| Experience powered | 1,072 points (385 its own bridge, 687 empty), none of another station, 0 lost |
| Still pointer on the whole outline, through the lift | 48 of 48, one spark each |
| Outlines of the Koreez chip and the title, still pointer | 147 tested, 0 lost |
| Chip clicks: before, at four heights, lifted, sinking; 4 places | 32 of 32, twice |
| Keyboard Enter and Space on the chip mid-lift (5.9, 5.4 px) | Open the project |
| 1E transitions: Experience, Playground | 50, 61: 0 drops, 0 restarts; leaving and switching as in 1E |
| Empty lab left of, right of and above the station | Leaves, platform on the floor |
| **Interrupt and return:** 8 leaving moments (before arrival, ascent, along the route, stable) × 7 gaps | 56 of 56: no jump, no hang, no early trail light |
| **Switching** to each station and back, 4 moments | 16 of 16, twice |
| Keyboard, Enter, Escape (pointer over, too), browser Back, Back to Lab | Stays up through Escape and Back, no replay; lowers afterwards |
| Direct link `?station=experience` | Raised and powered at once, 0 sparks, no trail run |
| Reduced motion, also by direct link | Powered, nothing rises, hit geometry as at rest, chip works |
| Firefox 151 (smoke) | 3 of 3: no overshoot, layers together, no errors; 5 quick returns without early trail light. On a quick return the platform waits where it is (up to 1.3 px) until the new spark, as the other lifts do there. Its frames are irregular when headless (steps up to 6 px) |
| Console errors | 0 |
| `npm run typecheck` | Pass |

## 9. The rest of the scene

| Against the checkpoint | Largest difference |
|---|---|
| Idle at 4 window sizes and both floors; Engineering, Educational, Playground, Creative Studio at 8 frozen moments each | **2 of 255**, 0 px above 2 |
| Everything outside Experience while it is **raised** (real hover) | **1** |
| Whole scene back at rest | **2** |
| Homepage: 8 loads each | **1**, same markup, no `/scene/v2/` request |
| Reduced motion | **36, in Experience's own artwork only** (below) |

- **Reduced motion:** the checkpoint drew Experience's artwork softer there than in normal mode (Chrome's resampling). It is now drawn exactly as sharp as in normal mode (mean edge step 5.77; before 5.20, normal 5.77). With Creative Studio powered, 32 px differ by up to 6. I did not set out to change this.
- **Selected view** (zoomed camera), lift held at 0: 4,255 px of Experience above 2 (max 12), from Chrome's resampling. M1.4J.3 recorded the same kind of variant for the checkpoint against itself.
- Playground's cabinet is left out of these, as in M1.4J.1 to J.3 (Chrome resamples it in two variants).
- The homepage plate's second variant (37 of 255) appeared once for "now" and once for the untouched checkpoint: the same picture (`work/home.txt`).

## 10. Performance

| | Checkpoint | Now |
|---|---|---|
| Drawn layers, full-frame layers, area | 84, 15, 30.05 Mpx | 85, 15, 30.21 Mpx |
| Scene files | 90 | 93 |
| Frames in 800 ms: all five stations | 48 | **48** |
| GPU time per activation: Experience | 43 ms | 66 ms |
| Creative Studio; Engineering; Educational; Playground | 65; 74; 59; 47 | 68; 74; 59; 47 |

What is only seen off the floor is out of the picture until Experience is used.

**Concern:** the office GPU (Radeon HD 5450) was not measured. Experience's raster tasks double during the lift (221 → 476), as the other lifts' did, and it ran 20–37 of 60 frames there in M1.4H.4. It has no blur filter. Worth one look there.

## 11. Known points
- Raised, the artwork is drawn through a moved layer, so it is marginally softer (as M1.4J.1).
- The panel's glass shows the approved plate's floor, baked in; that piece of floor rises with it.
- The dark wedge and the cyan speck under the right corner are baked into the station and rise; raised, the wedge reads as the recess above the rim.
- The hole in the recovered station behind the plant (floor visible through the leaves) is the approved state and rises.
- Raised, the connection's rounded end covers about 2 px more of the stone, whose side leans by that much over 10 px.
- The interruption, still-pointer, outline and other-stations runs were made before a last change to one light image (tried and taken back, section 5); timing, switching, clicks, direct link, reduced motion, alignment, disc and everything outside Experience were run again after it.
- Not tested: ESLint (the project has no configuration for the installed version), production build, full visual suite, Safari, touch.

## 12. Files

| File | Change |
|---|---|
| `components/lab/ExperienceLift.tsx` | New: constants, ground, hotspot |
| `components/lab/ExperienceV2.tsx` | The layers' class; strip light and floor light split |
| `components/lab/SceneV2.tsx` | Contact split; its ground |
| `components/lab/LabScene.tsx` | Its hotspot |
| `components/lab/scene-crops.ts`, `docs/m1.4i2/crop-map.json` | Generated: 5 entries added |
| `scripts/m14j4-experience.py` | New: writes the 5 layers |
| `scripts/m14i2-crop.py` | 5 sources added |
| `public/scene/v2/m14j4/` (5), `public/scene/v2/m14i2/m14j4-*` (5) | New files. No existing image changed |
| `docs/m1.4j4/` | This record, its evidence and probes |

`station-lift.ts`, Engineering's, Educational's, Playground's and Creative Studio's code (M1.4J.3, uncommitted) are byte for byte as before, and so are `ChargeLine.tsx`, `globals.css`, the routes and the homepage. `package-lock.json` was already marked modified (line endings only).

**Evidence:** the six `.png` sheets are **deterministic frames** frozen at the sequence's own times, 1648 × 928, enlarged. `experience-lift.webm` is **frame-stepped**: the real page's animations moved 1/60 s at a time and encoded at their true times (689 frames, 12.8 s); its smoothness is not a performance result. Images and video are local only (Git ignores them). Data and probes: `work/`. The probes write to `work/probes/out/`, which has to exist.
