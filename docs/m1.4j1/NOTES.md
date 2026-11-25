# M1.4J.1: Engineering's platform lift (`/lab-v2`, experimental)

**Implemented, awaiting visual approval.** When the spark arrives, the whole workstation rises **12 px** as one solid piece, stays connected to the floor's energy line, and returns smoothly. The approved activation, the resting scene, the other four stations and the homepage are unchanged. Not committed.

Positions are scene px (1672 × 941); times are after the spark's arrival (620 ms after the hover). Measured on the dev server, Chrome 158, RTX 4060, 60 Hz, 1648 × 928.

| Question | Answer |
|---|---|
| 1. Height | **12 px** (section 1) |
| 2. Timing | Moves at 60–80 ms, half at 247, full at **663 ms**. Down: 420 ms (section 2) |
| 3. Artwork and crops move together | Yes: 16 layers, identical position in every frame (section 3) |
| 4. Floor-mounted effects stay | Yes (section 4) |
| 5. Shadows and reflections | Tight contact 100 → 30 %, soft shadow 0 → 30 % (about 27 % darker floor), reflection −25 % (section 4) |
| 6. Connection continuous | Yes, at rest, half, full and returning (section 5) |
| 7. Hover and clicks | 0 failures (section 6) |
| 8. Defects | None blocking; four small points (section 8) |

## 1. Height: why 12 px

Measured from the artwork: silhouette x 262–599, laptop lid's top y 385, stone's underside y 528–551, connection's end (584.5, 540.6). The chips end at y 379.

| | 12 px | 13 px | 14 px | 16 px |
|---|---|---|---|---|
| Solid, no floating, no stretched hologram, connection closed | Yes | Yes | Yes | Yes |
| **Lid's rim against the SQLOrbit chip's text** (label stays) | **Clear** | Touches the baseline | On the text | Through the text |

Nothing in the platform, floor or connection limits the height before 16. The label does: it is approved as stationary, and the lid passes behind the lower part of the SQLOrbit chip. At 12 px the rim runs below the text. **To go higher, the label would have to rise too** (`lift-height-comparison.png`). The height is one constant, `ENG_LIFT.rise`; the clearance to the chip is the only thing to check again.

## 2. Timing

| Event | Planned | Measured |
|---|---|---|
| First movement | 60 ms | 60–80 ms (0 px before the arrival, every run) |
| Laptop scan | unchanged | 113–447 ms (1B: 113–447) |
| Bars done | unchanged | 563–580 ms |
| 25 % / 50 % / 99 % | | 180 / 247 / 580 ms |
| Full height | 660 ms | **663 ms** |
| Down: half / floor | 420 ms | 150 / 417 ms |

- **Curve:** `cubic-bezier(0.3, 0.02, 0.15, 1)` over 600 ms: a soft start, then a long stop. No overshoot: 0 frames fell while rising, 0 rose while sinking. Largest step in a 60 Hz frame: 1.3 px.
- **Pure translation, no scale.** At full height it is a whole number of device pixels, so the artwork stays on the pixel grid.

## 3. What moves

One number, `--el` (0 on the floor, 1 raised), drives everything. **16 layers** carry the same `translateY` themselves: body, stable station, body light, unpowered strips (2), strip pulses (2), display standby, scan shade, scan line, display bars, chart, chart light (2), caps, shimmer. Crops, masks and clips work in scene coordinates and move with their layer, so no offset changed.

**Not a wrapper, on purpose:** a transformed wrapper would isolate the light layers' blending, and a first version with wrappers brought one full-frame layer back (15 → 16). Now it is 15 and 30.07 Mpx, as in M1.4I.2.

## 4. The floor

| Stays | Connection, ring, reflections, floor, room |
|---|---|
| **Contact shadow** (M1.4G's own pixels, Engineering's share split off) | Eases to 30 % |
| **Soft shadow** (new, a drawn shape: the platform's own ground contour, blurred) | 0 → 30 %, up to 3 % wider and 12 % deeper |
| **Strips' reflection** at the base | 25 % weaker |
| **Ring's lit disc**, right end | Fades towards the platform. It had been recovered only up to the resting stone (x 599), which the lift would show as a straight 12 px edge. The ring itself is unchanged |

| Floor luminance when raised | Without shadow | With | Darker |
|---|---|---|---|
| Gap: left, middle, right | 34, 52, 123 | 25, 37, 90 | 27–28 % |
| Directly under the stone | 49 | 35 | 30 % |
| Old contour / just outside | 57 / 99 | 44 / 86 | 23 / 13 % |

The texture stays (its contrast falls with its brightness). A first version at 45 % was too dark and was cut back: M1.3J.4 had found 46 % to read as a black band.

## 5. The connection

Raised, the platform uncovers about 48 px of floor past the old end. The line now runs on there: **the same curve, continued straight along its last stretch for 68 px**, on the floor beneath the station. The station hides it at rest and covers its far end when raised, so there is no mask and nothing moves. It hands over to the existing line by a cross-fade of identical strokes on open floor (8–30 px before the old end), only while the platform is off the floor. No bead, seam or gap at real pixels. Its power is the line's own. At rest the line is drawn as before.

The existing line is snapped to device pixels by its moving windows (0.2–0.65 px, depending on the window size); the new run is not. The cross-fade hides it; at 6× magnification a trace can be seen.

## 6. Hover, clicks, state

**Hotspot:** its upper points rise with the station; its lower points stay, so a pointer resting at the platform's foot keeps it. Label, chips, bridges and the 90 ms grace are unchanged. `hit-region-comparison.png`.

| Check | Result |
|---|---|
| Hit map: at rest; every other station powered; homepage at rest and hovered | **0 points changed** |
| Engineering powered | 918 points (850 were its own bridge, 68 empty), none of another station or the central A |
| Still pointer along the whole hotspot, through the lift (56 points) | 56 held, one spark each |
| Outlines of both chips and the title, still pointer, whole pixels (200 of 664) | 0 lost |
| Chip clicks: before, at four heights, lifted, sinking; 4 places × 2 chips | 64 of 64 |
| 1E transitions, Engineering (artwork, platform, label, chips, repeats, still) | 62 of 62; leaving 5 of 5; switching 4 of 4 |
| Raised lid; wall above the resting lid; foot of the raised platform | Holds and selects; nothing starts; holds and selects |
| **Interrupt and return:** 8 leaving moments × 7 gaps | 56 of 56: no jump, no hang, no early scan, always from the floor |
| **Switching** to each station and back, 4 moments | 16 of 16, one spark per visit, Engineering on the floor in between |
| 1B quick return, real pointer and sequences | 30 runs, 0 premature |
| Keyboard, Enter, Escape (also with the pointer over), browser Back, Back to Lab | Stays up through Escape and Back, no second sequence; lowers afterwards |
| Click then Escape at five moments, charge and rise included | Raised, then on the floor, largest step 1.3 px |
| Direct link | Raised and powered at once, 0 sparks, raised hit region |
| Reduced motion, also by direct link | Powered, nothing rises, hotspot unchanged, chip works |
| Bridges, random moves, clicks, keyboard, all five stations | As in 1E |
| Playground: lift, sign, AZIZ chip | 18 px; sign 1,311 and 1,339 px, 45 of 45 paths; chip 0 of 110 lost; 44 of 44 moves |
| Route entries `/`, `/lab-v2`, client-side | 12 of 12 shown |
| Console errors | 0 |

**Quick returns.** As with 1B, `--el` is two numbers: this cycle's rise, and what is shown. A return while the platform sinks lets it reach the floor and rises again on the new arrival. Leaving during the rise turns back from that height.

**Firefox 151 (smoke test):** same timeline, all layers together, 3 of 3. A quick return there first dropped the platform in one frame (Firefox ends a running transition that Chromium keeps). **Fixed:** outside Chromium, `--el` is one plain transition: a quick return keeps the height it has and rises on the new arrival, as Playground does. 5 of 5 without a jump.

## 7. Resting scene and performance

| Against the scene before this change | Largest difference |
|---|---|
| Idle (4 window sizes, both floors), all other stations mid-sequence, powered and back at rest, Engineering back at rest | **2 of 255**, 0 pixels above 2 |
| Homepage | 0 |

Playground's cabinet is left out of these: Chrome resamples it in two variants, before and after alike.

| | Before | Now |
|---|---|---|
| Full-frame layers, area; files; decoded | 15, 30.07 Mpx; 84; 173.5 MB | **the same** |
| Engineering's frames, first → later (of 36) | 36 → 36 (first visits 33–36) | 30 → 36 |
| Frames at 1/4 and 1/8 CPU speed, lift off / on | 23–28 / 12–16 | 20–27 / 12–14 |
| Raster tasks and GPU time per activation (800 ms) | 412, 58 ms | 880, 74 ms |
| Playground's lift, other stations | 12 → 27; full | 13 → 26–28; full |

**Not measured: the office GPU.** Main-thread cost is within noise, but the lift adds about 28 % GPU work here, so on that card Engineering's 34–35 frames may fall. `will-change` would halve the extra raster work, but changes the artwork's sharpness from the hover on; not used.

## 8. Known points
- **Sharpness:** raised, the display is about 15 % softer than at rest (stone 2–9 %), because Chrome draws a moved image through a shared tile (M1.4I.2 measured 6–11 % for the same reason). Hard to see at 1:1.
- **SQLOrbit's chip** overlaps the lid's upper edge by 6 px while raised. Legible; intended by the stationary label.
- **Baked highlights:** two small light specks at the stone's lower edge (x 299 and x 580) are in the artwork and rise with it.
- **First visit** on a new page keeps its long frame (67 ms), as before.
- The contact share (`CONTACT`) is a fixed box, x 250–620, y 515–571. If M1.4G's contact image changes, check that nothing else lies in it.
- Not tested: production build, Safari, touch.

## 9. Files

| File | Change |
|---|---|
| `components/lab/EngineeringLift.tsx` | New: constants, state, ground, line end, hotspot |
| `EngineeringV2.tsx`, `EngineeringScreen.tsx` | The layers' class; reflection; disc fade |
| `SceneV2.tsx` | Contact shadow split; ground and line end |
| `ChargeLine.tsx` | Engineering's line end hands over (`/lab-v2` only) |
| `LabScene.tsx`, `LabStations.tsx`, `scene-layout.ts` | Its hotspot, with its own timing |
| `PlatformPower.tsx` | Optional class on a strip part (empty elsewhere) |
| `docs/m1.4i2/NOTES.md`, `final-verification.md` | AZIZ chip recorded as fixed |

No image was added or changed. `LabStations.tsx` also still contains M1.4I.2.1's chip fix.

**Evidence:** `engineering-lift-phases.png`, `engineering-lift-closeup.png`, `connection-and-shadow.png`, `hit-region-comparison.png`, `lift-height-comparison.png` (frozen at the sequence's own times, 1648 × 928, enlarged), `engineering-lift.webm` (a real-time screencast: 648 frames in 14.9 s, resampled to 60 fps). Images and video are local only. Data and probes: `work/`.
