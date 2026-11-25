# M1.4J.3: Creative Studio's platform lift (`/lab-v2`, experimental)

**Implemented, awaiting visual approval.** When the spark arrives, the whole installation (stone, easel, painting, brushes, small frames, strips) rises **10 px** as one piece and returns smoothly. The resting scene, the sunrise, the other four stations and the homepage are unchanged. Not committed.

Positions are scene px (1672 × 941); times are after the spark's arrival (640 ms after the hover). Measured on the dev server, Chrome 158, RTX 4060, 60 Hz, 1648 × 928, against an untouched copy of `ded97bf` served beside it.

| Question | Answer |
|---|---|
| 1. Height | **10 px** (section 1) |
| 2. Timing | Starts at 90 ms, half at **293**, full at **760 ms**. Down: **417 ms** (section 2) |
| 3. Moving and fixed layers | Section 3 |
| 4. Sunrise and glint alignment | **Largest difference 0 of 255** for the light layers, 1 for the whole station (section 4) |
| 5. Shadow and connection | Section 5 |
| 6. Foreground | Books, steam and mug stay. **This needed new layers: please look at it** (section 6) |
| 7. Hover and chip | 0 failures (section 7) |
| 8. Other stations | Unchanged: max 2 of 255, 0 px above 2 (section 8) |
| 9. Performance | 48 of 48 frames here; office GPU not measured (section 9) |
| 10. Files | Section 11 |

## 1. Height: why 10 px

| | 8 px | **10 px** | 12 px |
|---|---|---|---|
| Canvas against Engineering's platform behind it | The baked light speck at its foot sits on the canvas's edge | **The canvas's top edge runs along the foot of its left block** | The canvas cuts into the block's face |
| Left strip against the second book | The book's corner still covers part of the strip's end | **The strip clears it** | Clears it |
| Small frames to the Wallpapers chip | 20 px | **18 px** | 16 px |
| Grounding, connection, foreground, exposed edges | Fine | **Fine** | Fine |

12 px breaks nothing, but there the painting starts to cover Engineering's stone instead of standing in front of its foot. `lift-height-comparison.png`. The height is one constant, `CRE_LIFT.rise`.

## 2. Timing

| Event | Planned | Measured (5 runs) |
|---|---|---|
| First movement | 90 ms | 110 ms (0 px before the arrival). The first activation on a new page has one long frame: 177 ms |
| Sunrise | unchanged, 150–590 | 160–577 (crest visible), complete at 593 |
| Ridge glint | unchanged, 350–730 | 360–743 |
| Quarter / half / 99 % | about 300 for half | 227 / **293** / 677 |
| Full | 700–800 | **760 ms** |
| Down: half / floor | 400–450 | 150 / **417 ms** |

Educational's curve and times. No overshoot: 0 frames fell while rising, 0 rose while sinking. Largest step in a 60 Hz frame: 1.1 px. No scale or rotation; a whole number of device pixels at full height.

## 3. What moves, what stays

One number, `--cl` (0 on the floor, 1 raised). **18 elements** carry the same `translateY` themselves (a wrapper would isolate their blending). The difference between the largest and the smallest displacement was **0** in every frame of every run.

| Moves | Stays |
|---|---|
| The recovered station (stone, easel, painting, brushes, small frames) | Connection, floor ring, reflections, floor texture |
| Strips: unpowered parts, pulses, their own bright edge, their end round the right corner | The strips' light on the floor (25 % weaker when raised) |
| Standby, warm response, sunrise crest, glints (ridge, clouds, small paintings) | Ground shadows |
| The departing part of the contact shadow | Books, mug, steam, table, both plants, the label |

**The leaves on the platform's left end move with it.** In the plate they belong to a potted plant that `/lab-v2` does not have there; what is left of them lies on the stone and continues nowhere.

## 4. Sunrise alignment

The station alone on black, frozen at 16 moments (12 of the sequence, 3 while leaving, rest), raised by 3, 5, 7 and 10 device px, against the same moment at rest with the shift taken out:

| | Largest difference | Px above 2 |
|---|---|---|
| Light layers only (standby, warm, crest, glints, strips) | **0** | 0 |
| The whole station | **1** | 0 |

Unshifted, 37,000–56,000 px of the station differ, so the test would see a layer left behind. No stationary glow, doubled edge, detached glint or clipped corner. `sunrise-alignment.png`, `work/align.txt`.

With the lift held at 0, the sequence equals the checkpoint (max 2 of 255), except 7–8 px (max 9) at the left strip's end beside the books. Only that artificial state shows them. `work/liftoff.txt`.

## 5. Ground and connection

| | Behaviour |
|---|---|
| **Contact shadow** (M1.4G's own pixels) | 100 → 30 %; most of it leaves with the platform's edge |
| **Soft shadow** (new, drawn) | 0 → 30 %, in the platform's own outline: the lowest stone of each column from the left strip to the right corner, continued behind the books. Ten steps, no blur filter |
| **Floor under it** | 27–29 % darker right of the steam, 16–18 % beside the strips, 24 % at the old outline, 12 % just outside, 0 % beyond. The texture stays |
| **Connection** | Unchanged: it ends at the stone's right side, which is upright there, so the lift uncovers nothing. Continuous at rest, half, full and returning; no extension needed |
| **Reflections and ring** | Fixed |

The strip's end round the right corner was recovered in the floor light. It rises with the strip, 45 % softer when raised, because it then lies over the lit ring and the two add.

## 6. Foreground

The recovered station holds bits of the foreground, and ends where the foreground hid it. Lifted as it is, a strip of the upper book's cover and a corner of the second book rose with the stone, a gap opened above the books, and the steam tore apart (`foreground-occlusion.png`, middle column). M1.4E's steam is the plate minus this station, so each holds part of the other.

Eight derived layers fix that (`scripts/m14j3-creative.py`). On the floor the station and the steam are drawn from their old files; off the floor:

| Layer | |
|---|---|
| `creative-fill`, `-fill-off` | Rise. The stone behind the books, continued by the station's own pixels (at most 16 rows, mirrored); the strip's hidden end; the stone without the steam |
| `creative-books`, `-steam` | Stay. The books' pixels; the steam, whole |
| `creative-light-edge`/`-spill`, `creative-floor-edge`/`-rest` | M1.4G.1's and M1.4H.3's light, split into what rises and what stays |

- **On the floor the two pictures are the same.** The change-over happens within the first half px.
- **One exception:** 211 px along the stone's foot line inside the steam differ by up to 37 of 255, for those few frames.
- **The stone under the steam is an estimate** (its sides' tones, with the plate's own fine grain), always behind steam. Please judge whether "no artwork regeneration" allows it. The alternative is the torn steam above.

Findings:
- **Books, table, mug:** in front of the stone at every height, no gap. No z-index changed.
- **Steam:** stays above the mug. Its upper part is a little thinner when raised, because the stone keeps some haze.
- **Engineering:** stays behind the canvas. Its hotspot is untouched.
- **The thin dark line** between the books and the stone (x 177, in the resting scene) is gone while raised.

## 7. Hover, clicks, state

**Hotspot:** its upper points rise; its sides, foot and the canvas's right corner stay (Engineering's target is above that). It follows `--cl` and contains the resting one. Label, chip, bridge and the 90 ms grace are unchanged. No new keyboard stop.

| Check | Result |
|---|---|
| Hit map: rest, every other station powered, homepage | **0 points changed** |
| Creative Studio powered | 737 points (431 its own bridge, 306 empty), none of another station, 0 lost |
| Still pointer on the whole outline, through the lift | 51 of 51, one spark each |
| Outlines of the Wallpapers chip and the title, still pointer | 142 tested, 0 lost |
| Chip clicks: before, at four heights, lifted, sinking; 4 places | 32 of 32 |
| Keyboard Enter and Space on the chip mid-lift | Open the project |
| 1E transitions: Creative Studio, Engineering, Playground (*) | 50, 62, 61: 0 drops, 0 restarts; leaving and switching as in 1E |
| **Interrupt and return:** 8 leaving moments (before arrival, ascent, sunrise, stable) × 7 gaps | 56 of 56: no jump, no hang, no early sunrise or glint |
| **Switching** to each station and back, 4 moments | 16 of 16 |
| Keyboard, Enter, Escape (pointer over, too), browser Back, Back to Lab | Stays up through Escape and Back, no replay; lowers afterwards |
| Direct link `?station=creative` | Raised and powered at once, 0 sparks |
| Reduced motion, also by direct link | Powered, nothing rises, chip works |
| Firefox 151 (smoke) | 3 of 3: no overshoot, layers together, no errors; 5 quick returns without an early glint. Its frames are irregular when headless |
| Console errors | 0 |
| `npm run typecheck` | Pass |

(*) Run before two last changes that move nothing interactive (hiding unused layers; the books' layer moved to the foreground).

## 8. The rest of the scene

| Against the checkpoint | Largest difference |
|---|---|
| Idle at 4 window sizes and both floors; Engineering, Educational, Playground, Experience at 8 frozen moments each | **2 of 255**, 0 px above 2 |
| Everything outside Creative Studio while it is **raised** (real hover) | **1** |
| Whole scene back at rest; reduced motion | **1; 2** |
| Homepage: 8 loads each | **1**, same markup, no `/scene/v2/` request |

- Playground's cabinet is left out of these, as in M1.4J.1 and J.2 (Chrome resamples it in two variants).
- The homepage's plate has a second variant too (37 of 255), drawn now and then after a dev-server recompile. The untouched checkpoint draws exactly the same one (`work/home.txt`).
- **Found and fixed:** the stationary books layer, placed after the station, made Chrome resample Experience while Creative Studio was raised (36 of 255). It now lies with the foreground.

## 9. Performance

| | Checkpoint | Now |
|---|---|---|
| Drawn layers, full-frame layers, area | 84, 15, 30.05 Mpx | **the same** |
| Scene files | 84 | 90 (decoded size of the new crops: 0.7 MB) |
| Frames in 800 ms: Creative Studio, Engineering, Educational | 48, 48, 48 | **48, 48, 48** |
| GPU time per activation: Creative Studio | 46 ms | 63 ms |
| Engineering; Educational | 74; 59 ms | 79; 62 ms (runs vary by about 8) |

What is only seen off the floor is out of the picture until Creative Studio is used.

**Concern:** the office GPU (Radeon HD 5450) was not measured. Creative Studio's raster tasks double during the lift (223 → 443), as Engineering's did; it ran 30–33 of 51 frames there in M1.4H.3, and may fall. It has no blur filter. Worth one look there.

## 10. Known points
- Raised, the artwork is drawn through a moved layer, so it is marginally softer (as M1.4J.1).
- Slivers of floor baked between the easel's arms and legs rise with it.
- The white and cyan tip at the right end of the strip is the approved state, and rises.
- Selected view (1.09× zoom): Chrome resamples parts of the scene in variants, before and after alike (checkpoint against itself: 863 px).
- Not tested: production build, full visual suite, Safari, touch.

## 11. Files

| File | Change |
|---|---|
| `components/lab/CreativeLift.tsx` | New: constants, ground, steam and books, hotspot |
| `components/lab/CreativeV2.tsx` | The layers' class; fill; strip light split |
| `components/lab/SceneV2.tsx` | Contact split; its ground; the steam through `CreativeFront` |
| `components/lab/LabScene.tsx` | Its hotspot |
| `components/lab/scene-crops.ts`, `docs/m1.4i2/crop-map.json` | Generated: 8 entries added |
| `scripts/m14j3-creative.py` | New: writes the 8 layers |
| `scripts/m14i2-crop.py` | 8 sources added; leaves a crop alone if it already holds the same pixels (all existing crops byte for byte as before) |
| `public/scene/v2/m14j3/` (8), `public/scene/v2/m14i2/m14j3-*` (8) | New images. No existing image changed |
| `docs/m1.4j3/` | This record, its evidence and probes |

`station-lift.ts`, Engineering's, Educational's and Playground's code, `globals.css`, the routes and the homepage are untouched. `package-lock.json` was already marked modified before this milestone (line endings only).

**Evidence:** the six `.png` sheets are **deterministic frames** frozen at the sequence's own times, 1648 × 928, enlarged. `creative-lift.webm` is **frame-stepped**: the real page's animations moved 1/60 s at a time and encoded at their true times (685 frames, 12.8 s); its smoothness is not a performance result. Images and video are local only (Git ignores them). Data and probes: `work/`.
