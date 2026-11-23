# M1.4I.1D: Quick-return consistency

**Creative Studio's frozen glint is fixed. Educational and Experience had the same defect, reproduced first, and are fixed too.** `/lab-v2` only, verified on the dev server in Chrome with a Firefox confirmation. Nothing committed or pushed. M1.4I.1A to 1C and the email link are in place.

| Station | Defect reproduced? | Changed? | Verification (runs with a defect, before → after) |
|---|---|---|---|
| Creative Studio | Yes: glint, warm light and sunrise front freeze, then resume; strip pulse freezes | Yes | Real pointer 10 of 11 → **0**; grid 62 of 91 → **0**; sequences 12 of 20 → **0**; click then Escape 6 of 7 → **0** |
| Educational | **Yes**: strip pulse freezes; orbit light, globe crest and pool pulse freeze, then resume | Yes | 10 of 11 → **0**; 63 of 91 → **0**; 13 of 20 → **0**; 6 of 7 → **0** |
| Experience | **Yes**: strip pulse freezes; trail resumes part-way | Yes | 10 of 11 → **0**; 66 of 91 → **0**; 15 of 20 → **0**; 6 of 7 → **0** |

Two things to decide or know:
1. **A slow move from the platform to its own label now replays Creative Studio and Experience** (section 6). The hover drop is existing (M1.4I P2-3); before, the painting or route stayed lit through it.
2. **A quick return to a fully powered station** goes to standby and runs again when the new spark arrives, as required and as Engineering does since 1B.

## 1. Root cause
The same as Engineering's, independently in each station. Each effect was one CSS number whose transition waits for the spark (`--arrive-now`). A waiting transition holds the value it interrupted.

These stations already had a gate that hides their light *before* the arrival. So the defect shows elsewhere:
- **Through the charge:** the painting, globe, ring or route stays part-lit.
- **Right after the arrival:** the gate opens on the old value. The light stands still until its own delay has passed, then carries on from there. Creative Studio's glint starts 350 ms after the arrival, so it stood for up to about 310 ms. That is the known glint defect (P2-1).
- **The strip pulse** had no gate at all. It stood on the platform while the spark travelled.

| Before the fix, 91 grid runs each | Creative | Educational | Experience |
|---|---|---|---|
| Strip pulse showing during the new charge | 40 | 47 | 48 |
| Light it adds there, at most (of 255) | 63 | 138 | 40 |
| Old level held through the charge | 57 | 57 | 59 |
| Sequence resumed part-way | 45 | 45 | 51 |
| Light frozen after the arrival | glint 24, sunrise front 40, warm 17 | orbit 40, crest 36, pool 10 | trail: at most a frame (its delay is 30 ms) |
| Light showing before the arrival (gated) | 0 | 0 | 0 |

**Also found:** Escape from a finished selection left the strip pulse standing while the new spark travelled (56, 41 and 61 frames). It is the same cause.

**Not the cause:** cancellation (leaving before the arrival was always clean) and state shared between stations. The stations share a pattern, not a state.

## 2. Files changed

| File | Change |
|---|---|
| `components/lab/station-cycle.ts` | New: a small CSS generator used by the three stations (no component, no script, no timer) |
| `components/lab/CreativeV2.tsx` | Its numbers and pulse come from it; box-less wrapper for the station and its floor light |
| `components/lab/EducationalV2.tsx` | Same |
| `components/lab/ExperienceV2.tsx` | Same |

Engineering, Playground, the shared platform power, floor images, artwork and geometry are unchanged.

## 3. Correction
- **Two numbers instead of one.** *This cycle's progress* is 0 until the spark arrives and 0 at once on leaving. *What is shown* follows it; on leaving it runs back with its existing timing, and a return does not interrupt that. The arrival therefore always starts from standby.
- **Strip pulse:** each part waits for its own front to start. The strips themselves keep their level, as before.
- **Escape and Back:** a finished station keeps its power through the instant in which it is neither selected nor focused, so nothing is replayed.

## 4. Normal activation and appearance
**Timings: none changed.** First visits, four each, ms after the arrival (before and after agree to within one frame):

| | First–last visible |
|---|---|
| Creative Studio | warm 110–360/377, sunrise 160–577, glint 360–727, stable 793 |
| Educational | pool 73–223, crest 123–490, orbit 207–740, stable 807 |
| Experience | trail 40–973, stable 990 |

**Pixels: 32 seeked frames per station** (idle, 18 of the activation, stable, 8 of leaving, idle after, direct link, reduced motion). Two captures of the original code were the reference.

| | Identical | 1–2 of 255 | More |
|---|---|---|---|
| Creative Studio | 32 | 0 | 0 |
| Educational | 26 | 6, all while leaving | 0 |
| Experience | 22 | 5 | 5 |

The five "more" are explained. Three are Playground's base, which reaches into the crop (x 1061–1376, y ≤ 547): its cabinet is resampled differently per launch, on the original code too (see `navigation-fix.md`). In the other two, 2 px of the label's briefcase icon differ by 3. Nothing of Experience itself differs by more than 2. The original two captures differ from each other by up to 2 as well (Creative and Educational), and by the same Playground variants in Experience's crop.

Comparison sheets (local only, images are not in Git): `quick-return-creative.png`, `quick-return-educational.png`, `quick-return-experience.png`.

## 5. Verification
`npm run typecheck` passes. No console errors.

| Check | Result |
|---|---|
| Leaving before arrival, during the strips, sunrise or globe or trail, glint or orbit or destination, just after full power; return after 0, 20, 50, 100, 200, 350, 450 ms | 0 of 273 with a defect |
| Via another station (Creative → Engineering, Educational → Playground, Experience → Educational), four returns in a row, interrupted second charge, left before arrival | 0 of 60 |
| Real pointer | 0 of 33 |
| Click, then Escape, during the charge or the sequence | 0 of 21; a new charge starts from standby |
| Every run | Ended fully powered, then at rest; nothing rose after leaving |
| Keyboard Tab, Enter; focus order | One full sequence; selection; focus order untouched |
| Escape (keyboard, pointer over), browser Back, from a finished selection | Stays lit, no replay, focus on the title; strip pulse at most 1 frame |
| Back to Lab with the mouse | Powers down, at rest |
| Direct links | Powered at once, no startup; after Escape, at rest; quick return clean |
| Reduced motion, five quick returns each | No travelling light or pulse; powered, then at rest |
| Experience's floor disc (left of the platform), 54 moments of quick returns | Never above the powered level (82.86 mean, 146.6 at the 99th percentile) |
| Firefox 151 | 0 of 54 with a defect; Escape's hand-over keeps power; no errors |
| Engineering, Playground, 1A, 1C rechecks | Engineering 10 of 10 clean; Playground's sign, timing and 18 px lift unchanged; 4 of 4 route entries shown; all five stations power and return |

## 6. Remaining limitations
- **Platform to own label (M1.4I P2-3, not touched).** A slow straight move still drops the hover for a few frames. Hover drops are as before; what is seen during them has changed:

| Move | Frames without hover, before / after | Lowest level before | After |
|---|---|---|---|
| Creative, 400 ms | 0 / 1 | 1 | 0 |
| Creative, 800 ms | 3 / 3 | 1 | 0 |
| Creative, 1500 ms | 12 / 11 | 0.86 | 0 |
| Experience, 800 ms | 8 / 6 | 0.89 | 0 |
| Experience, 1500 ms | 18 / 18 | 0.27 | 0 |

  At 200 ms, and at any speed for Educational, the hover holds. The correction, if wanted, is P2-3's own: extend those hotspots towards their labels, or lengthen the 90 ms grace.
- **Run-back:** in Chrome the normal fade-out may overlap the new charge (up to 420, 380 and 520 ms after leaving). It only goes down. Firefox goes to standby at once.
- **Strips** hold their level on a quick return (existing, kept). On Escape they can be a little drained until the new spark arrives, as before.
- **Back to Lab with nothing focused:** the fade-out starts 20 ms later than before.
- Not tested: production build, Safari, touch. Headless Firefox never takes focus, so its keyboard path was tested through the same attribute changes.

Probes and data: `docs/m1.4i1/work/qr-*`.
