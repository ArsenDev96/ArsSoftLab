# M1.4J.2: Educational's platform lift (`/lab-v2`, experimental)

**Implemented, awaiting visual approval.** When the spark arrives, the whole installation (stone, island, church, spheres, orbit, strips) rises **10 px** as one piece and returns smoothly. The resting scene, the globe and orbit activation, the other four stations and the homepage are unchanged. Not committed.

Positions are scene px (1672 × 941); times are after the spark's arrival (460 ms after the hover). Measured on the dev server, Chrome 158, **Radeon HD 5450** (the office GPU), 1648 × 928, against HEAD `5d7d98f` served beside it.

| Question | Answer |
|---|---|
| 1. Height | **10 px** (section 1) |
| 2. Timing | Starts at 90 ms, half at about 300, full at **770 ms**. Down: 420 ms (section 2) |
| 3. Moves together | 23 layers, one displacement (section 3) |
| 4. Floor stays | Yes (section 4) |
| 5. Connection | Continuous at rest, 25 %, 50 %, full and returning (section 5) |
| 6. Globe and orbit alignment | **Largest difference 1 of 255** over 15 moments × 4 heights (section 6) |
| 7. Hover and chips | 0 failures (section 7) |
| 8. Firefox, reduced motion | Pass (section 8) |
| 9. Concerns | Frame rate on this GPU, and four small points (section 9) |
| 10. Files | Section 10 |

## 1. Height: why 10 px

Measured from the artwork: great sphere's top y 272 (its glow 269), icon's lower edge about y 256, AriMap x 824–897, y 253–279.5, stone's foot y 485–496.

| | 8 px | **10 px** | 12 px |
|---|---|---|---|
| Great sphere to AriMap's rounded corner (ridge to outline) | 3.8 | **2.1** | 0.4: touches |
| Sphere's glow to the icon | 5 | **3** | 1: runs into the icon's glow |
| Dome to the chips' lower edge | 11 | **9** | 7 |
| Connection closed, no exposed cutout | Yes | **Yes** | Yes |

10 px is the most that keeps the stationary label free. `globe-alignment.png` shows all three. The height is one constant, `EDU_LIFT.rise`.

## 2. Timing

| Event | Planned | Measured (5 runs) |
|---|---|---|
| First movement | 90 ms | 107–123 ms (0 px before the arrival, every run) |
| Globe wave | unchanged, 120–500 | 123 to 473–490 (crest visible) |
| Half | about 300 ms | 290–307 (340 in one run with a long frame) |
| Full | 770 ms | 757–773 ms |
| Stable swap | unchanged, 800 ms | 808–826 |
| Down: half / floor | 420 ms | 150–217 / 433–467 |

- **Curve:** Engineering's, `cubic-bezier(0.3, 0.02, 0.15, 1)`, over 680 ms. No overshoot: 0 frames fell while rising, 0 rose while sinking. Largest step in a 60 Hz frame: 1.02 px.
- The artwork is at full height before the stable swap, so nothing moves across it.
- Pure translation, no scale or rotation. At full height a whole number of device pixels.

## 3. What moves

One number, `--dl` (0 on the floor, 1 raised). **23 elements** carry the same `translateY`: the summed body, globe and ring; the stable station and its light; the globe's and ring's light; unpowered strips (4) and their pulses (4); the corner strips' bright edge (4); pool, crest, orbit light; shimmer; and two parts of the contact shadow that belong to the station's edge. `spread` (largest minus smallest displacement) was **0** in every frame of every run.

The station light was one image holding floor light too. It is empty in y 428–480, so the globe's light splits off cleanly. Below that it holds the **corner strips**: a bright edge just outside the stone's outline, and its spill on the floor. The edge rises, the spill stays. The same image is drawn through two complementary gradients, added; no image was added or changed.

## 4. The floor

| Stays | Connection's floor run, ring, reflections, floor, room |
|---|---|
| **Contact shadow** (M1.4G's own pixels, Educational's share split off) | 100 → 30 %. Most of what goes leaves with the platform's edge and fades with height, so freshly uncovered floor is never lighter than the floor beside it |
| **Soft shadow** (new, drawn) | 0 → 30 %. The plinth is round: its measured ground contour is an ellipse (centre 839.5, 486.3; radii 156.5, 10.3) to about 0.5 px, and that is the shape used |
| **Corner strips' spill** | 25 % weaker |
| **Floor light at the old outline** | Gives way near the corners and the two streaks beside the connection; it had been recovered only up to the resting stone |

| Floor luminance when raised | Without shadow | With | Darker |
|---|---|---|---|
| Gap: left, middle left, middle right, right | 91, 135, 125, 125 | 71, 98, 92, 91 | 21–27 % |
| Directly under the stone | 123 | 90 | 27 % |
| Old contour / just outside | 139 / 138 | 106 / 116 | 24 / 16 % |

Engineering's is 27–28 %. The texture stays.

## 5. The connection

Unlike Engineering's, this line does not end at the foot: it runs over the floor to the stone (y 496), then up a channel in the stone's face to the strip (y 461.5). The **floor run stays**; the raised stone uncovers its next 10 px, which run on under the platform. The **run in the channel belongs to the stone and rises with it**. Both are the same straight vertical stroke one above the other, so together they are the line with its upper end 10 px higher: one path, no joint, no seam. At rest it is the approved line.

## 6. Globe and orbit alignment

The station alone on black, frozen at 15 moments (11 of the sequence, 3 while leaving, rest), forced to 3, 5, 7 and 10 device px, against the same moment at rest with the shift taken out:

- **Largest difference 1 of 255, 0 pixels above 2**, in all 60 comparisons (unshifted: 36,000–55,000 px above 8). No stationary halo, separated orbit, doubled edge, seam or clipping; island and church do not move against each other. `work/align.txt`.
- With the lift held at 0, the whole sequence, selected and reduced motion equal HEAD: **max 2 of 255, 0 px above 2** (18 frames, twice). `work/liftoff.txt`. One of the 36 is corrupted by the GPU fault in section 9.

## 7. Hover, clicks, state

**Hotspot:** its upper points rise; its sides and foot stay. The raised region contains the resting one. It follows `--dl` itself and has no transition of its own (section 9). Label, chips, bridges and the 90 ms grace are unchanged.

| Check | Result |
|---|---|
| Hit map: rest; every other station powered; homepage at rest and hovered | **0 points changed** |
| Homepage image | Chrome draws its plate in two variants, on HEAD and now alike (2 of 5 each): `work/home.txt` |
| Educational powered | 825 points (735 were its own bridge, 90 empty), none of another station, 0 lost |
| Still pointer on the whole outline, through the lift | 59 of 59, one spark each |
| Outlines of both chips and the title, still pointer | 225 tested, 0 lost |
| Chip clicks: before, at four heights, lifted, sinking; 4 places × 2 chips | 64 of 64 |
| Keyboard Enter and Space on a chip mid-lift | Open the project |
| 1E transitions: Educational, Engineering, Playground | 62, 62, 61: 0 drops, 0 restarts |
| Bridges: hold, ownership, clicks, direct, reduced, all stations | As in 1E |
| **Interrupt and return:** 8 leaving moments × 7 gaps | 56 of 56: no jump, no hang, always from the floor |
| **Switching** to each station and back, 4 moments | 16 of 16, one spark per visit |
| 1D quick return (mouse, grid, sequences) | 122 runs: globe and orbit light 0 premature; 2 flagged (section 9) |
| Keyboard, Enter, Escape (pointer over, too), browser Back, Back to Lab | Stays up through Escape and Back, no replay; lowers afterwards |
| Direct link | Raised and powered at once, 0 sparks, raised hit region |
| Engineering: timing, switching, direct, reduced | As approved: 12 px, 16 of 16 |
| Playground: sign paths, label, chip, neighbours, 18 px | 49 of 49 moves, 0 drops |
| Other stations: 14–15 frozen frames each, selected, reduced, idle at 4 sizes, both floors | Max 2 of 255, 0 px above 2 |
| Console errors | 0 |
| `npm run typecheck` | Pass |

## 8. Firefox and reduced motion

- **Firefox 144:** 3 of 3 runs, same timeline, all layers together (within 0.009 px), no errors. Quick returns, 5 of 5: no jump; a quick return keeps the height it has and rises on the new arrival (as Engineering and Playground there).
- **Reduced motion**, also by direct link: powered, nothing rises, hotspot unchanged, chip works.

## 9. Concerns

- **Frame rate on the office GPU.** Frames in the 800 ms after the arrival: **24 against 28–29** before (median of 6, twice; 24–26 against 30–31 in an earlier pair) (layers 15 / 30.05 Mpx and 84 files: the same). A first version ran at 14: a blur filter redrawn every frame. It was replaced by stepped ellipses, and the strip masks limited to the corners.
- **Approved Engineering runs at 12 frames here**, before and after this milestone. Its ground shadow still uses a blur filter; the same replacement should help. Not touched (Educational only).
- **Late spark on an overloaded GPU.** An immediate return can start the spark's clock up to about 80 ms after the sequence that waits for it. HEAD: 0 of 122 for Educational. First version: 8. The cause found was the hotspot's `clip-path` transition, now gone for Educational: **2 of 122** remain (the strips' pulse or the pool, about one frame; the spark lands 50 ms before the "arrival", so most of it is covered). Engineering, which keeps that transition, shows the same (5 of 36). Not seen on the RTX 4060 in M1.4J.1; worth one look there.
- **This GPU corrupts raster tiles in headless captures**, before this milestone too (a black bar across the station in one of two HEAD runs). Real hovers: 0 of 60 on each version. A second fault, a dark box behind AriMap in scaled captures after a frozen leave, appears on HEAD too (2 of 2; now 1 of 2; `work/dark-box-ab.txt`). The "Back at rest" panel is from a clean retake.
- **Selected view (1.09× zoom), raised:** Chrome resamples the room's image by a fraction of a pixel (max 15–20 of 255 on about 0.5 % of pixels). Unzoomed: max 1.
- At 20 % standby strength, a few specks of floor light at the old corners remain when raised; visible at 8× only.
- Not tested: production build, full visual suite, Safari, touch.

## 10. Files

| File | Change |
|---|---|
| `components/lab/EducationalLift.tsx` | New: constants, ground, connection, hotspot |
| `components/lab/station-lift.ts` | New: the lift's state (as Engineering's), contact split, masks |
| `components/lab/EducationalV2.tsx` | The layers' class; corner strips' light split; floor light's fade |
| `components/lab/SceneV2.tsx` | Contact split for both stations; Educational's ground |
| `components/lab/ChargeLine.tsx` | Educational's line end |
| `components/lab/LabScene.tsx`, `LabStations.tsx`, `scene-layout.ts` | Its hotspot, which can follow a lift number |
| `components/lab/EngineeringLift.tsx` | Its contact rectangle is exported and its clip comes from the shared helper (same output) |

No image was added or changed. `globals.css`, the routes and the homepage are untouched.

**Evidence:** `educational-lift-phases.png`, `globe-alignment.png`, `connection-and-shadow.png`, `hit-region-comparison.png`: **deterministic frames** frozen at the sequence's own times, 1648 × 928, enlarged. `educational-lift.webm`: **frame-stepped**, the real page's own animations moved 1/60 s at a time and encoded at their true times (640 frames, 12.0 s); its smoothness is not a performance result. Images and video are local only (Git ignores them). Data and probes: `work/`.
