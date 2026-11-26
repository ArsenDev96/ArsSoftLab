# M1.4K.5A: Five-station lite mode

## Result: **all five stations work in lite mode. Full mode is unchanged.** Status: **approved** (checkpoint committed)

**Approved decisions:**
- lite mode covers all five stations;
- the camera zoom stays disabled in lite mode;
- full cinematic mode remains the default, with its approved visuals and animations unchanged;
- the remaining static floor shadows are not optimized.

`/lab-v2?render=lite` now covers Engineering, Educational, Playground, Creative Studio and Experience. Lite mode also skips the camera move on selection, reusing the reduced-motion rule. Full mode remains the default: its DOM and every inline stylesheet are byte-identical to the pre-lite baseline, and its captures are pixel-identical.

Office computer (Radeon HD 5450; Chrome composites in software). Chrome with default settings, headless, 1648 × 928, dev server. Only short checks were run. This builds on `lightweight-mode-prototype.md` (M1.4K.4).

## 1. Completed behaviour

Each station in lite mode answers **as it already does under reduced motion**, whatever the user's preference:
- it powers on at once, with a 150 ms cross-fade;
- the pulse sends nothing, and the station neither travels nor lifts;
- its label and hit region stay at rest;
- the layers that only its sequence draws are not mounted.

The existing reduced-motion CSS is reused without its media query.

| Station | Lite rules (reused) | Not mounted in lite mode |
|---|---|---|
| Engineering (M1.4K.4) | `ENG_REDUCED_CSS`, lift, strips | strip pulses, scan shade and band, display bars, caps, shimmer, lift shadow |
| Playground (M1.4K.4) | `PG_LITE_CSS` (lift transform, `--lp`, fades), still game frame | lift's ambient shadow |
| **Educational** | `EDU_REDUCED_CSS`, cycle, lift, strips | strip pulses, the pool's pulse, the wave's crest, the light round the ring, the shimmer |
| **Creative Studio** | `CRE_REDUCED_CSS`, cycle, lift (layers that show only while raised stay hidden), strips | strip pulses, warm details, the sunrise's crest, glints |
| **Experience** | `EXP_REDUCED_CSS`, cycle, lift (layers that show only while raised stay hidden), strips | strip pulses, the light travelling the route |
| All | `EnergySurge` `skip` for all five: no pulse is fired and no spark layer is mounted; each connection is powered while its station is hovered | the whole spark layer group, and the A's flash |
| **Camera** | Reduced motion's `.lab-camera` rule. A selection stays in the room's shot; the vignette and the hero's information still focus it | — |

Lite mode mounts 726 elements under `<main>`, against 917 in full mode.

Educational's, Creative Studio's and Experience's hit regions already follow their lift's number, which lite mode holds at 0, so they needed no change. Navigation, chips, keyboard handling, deep links and the URL are untouched.

## 2. Files changed (this step)

| File | Change |
|---|---|
| `components/lab/station-lift.ts` | `liftReducedCss(cls, v)` extracted from `liftCss` (same output) |
| `components/lab/station-cycle.ts` | `cycleReducedCss(cls)` extracted from `cycleCss` (same output) |
| `components/lab/PlatformPower.tsx` | `powerReducedCss` extracted from `powerCss` (same output); `powerLiteCss(id)`, the strips' lite rules (previously written inside Engineering's) |
| `components/lab/EducationalLift.tsx`, `CreativeLift.tsx`, `ExperienceLift.tsx` | `EDU_`, `CRE_` and `EXP_LIFT_REDUCED_CSS`. The "visible only while raised" rule is extracted in Creative Studio and Experience (same output) |
| `components/lab/EducationalV2.tsx`, `CreativeV2.tsx`, `ExperienceV2.tsx` | Reduced-motion block extracted as `*_REDUCED_CSS` (same output); `*_LITE_CSS`; `lite` prop: sequence-only layers not mounted |
| `components/lab/EngineeringV2.tsx` | `ENG_LITE_CSS` uses `powerLiteCss` (same output) |
| `components/lab/SceneV2.tsx` | Passes `lite` to the three stations |
| `components/lab/LabScene.tsx` | `LITE_STATIONS` covers all five (pulse skipped; labels still); `LITE_CAMERA_CSS` |

Together with M1.4K.4: 16 application files, 414 insertions and 229 deletions, all uncommitted. **Unchanged:** artwork, `app/globals.css`, the homepage `/`, `LabStations`, `ProjectStation`, data.

New probe: `work/lite5-check.mjs`. `work/lite-capture.mjs` gained a `STATES` option.

## 3. Validation (short, default Chrome)

| Check | Result |
|---|---|
| 1. All five activate in lite mode | **PASS.** Each one is hovered, with its strips fully powered within 400 ms (`results/lite5-check.json`) |
| 2. All five stay still | **PASS.** Largest lift of any station layer, label or Playground wrapper: 0 px, while hovered and after selection (full mode: 10–18 px) |
| 3. Project chips clickable | **PASS, 5/5** in lite mode (and 5/5 in full mode). Each selects its project (SQLOrbit, AriMap, AZIZ, Wallpapers, Koreez). Lite: the chip doesn't move (0 px) and the camera stays (`transform: none`). Full: the camera moves as before |
| 4. Switching | **PASS.** All five hovered in turn, 500 ms each: only the last (Experience) is lit at the end |
| 5. Full mode unchanged | **PASS.** `<main>` DOM and inline styles byte-identical to the baseline; rest and the Engineering and Playground hovers pixel-identical (0 px) (`results/compare-k5a-full-vs-before.json`) |
| 6. Console | **PASS.** No errors in either mode. No pulse fired in lite mode (full mode: 40 spark animations, as before). The URL returns to `?render=<mode>` |
| Look (`work/captures/lite/sheet-k5a-three.png`) | At rest, lite against full: largest difference 9/255, 46 px over 2/255, 43 of them in Engineering's chart (known from M1.4K.4). Hovered, Educational, Creative Studio and Experience match full mode's reduced-motion appearance, except those 43 chart pixels (`compare-k5a-lite-vs-full-reduced.json`). They are lit, on the floor and intact |

## 4. Unresolved and not done

- **Not re-measured this step:** performance with all five lite stations, keyboard for the three new stations, and the camera's frame rate.
  - The M1.4K.4 measurements for Engineering and Playground stand.
  - Keyboard code is untouched; M1.4K.4 checked it for two stations.
  - The camera move no longer runs in lite mode, so selection no longer pays the 6–8 fps whole-stage move. This is expected from the CSS, not measured.
- **Each state change still costs a few 150–200 ms frames** under software compositing (M1.4K.4, §3). Lite mode doesn't change that floor.
- **Lift shadows on the floor stay mounted:** Educational's, Creative Studio's and Experience's grounds. They are transparent at rest and static in lite mode. **Decision: not optimized.**
- **Camera: approved.** Lite mode keeps reduced motion's camera: no zoom on selection; the vignette and the hero's information focus the station.

## 5. Pending

1. **Mode selector:** there is no way into lite mode except `?render=lite`. No UI and no detection yet; how users choose lite mode is the next step.
2. **Home GPU (RTX 4060):**
   - confirm full mode is unchanged: `node work/lite-capture.mjs` (and `STATES=...`), then `compare.py` against a baseline captured there;
   - measure lite mode once: `node work/lite-perf.mjs`;
   - run `node work/lite5-check.mjs`.
3. **Not re-measured:** performance with all five stations in lite mode, keyboard for the three new stations, and the selection without the camera move (§4). Worth a short run with the selector or on the RTX 4060.

## Files

- **Data:**
  - `work/results/lite5-check.json`;
  - comparisons: `compare-k5a-full-vs-before.json`, `compare-k5a-lite-vs-full.json` and `compare-k5a-lite-vs-full-reduced.json`.
- **Captures:** `work/captures/lite/k5a-full`, `k5a-lite`, `k5a-full-reduced` and `sheet-k5a-three.png`.
  - The PNGs are ignored by Git (`docs/**/*.png`).
  - `dom.html` and `styles.txt` were not kept; `lite-capture.mjs` writes them again on every run.
