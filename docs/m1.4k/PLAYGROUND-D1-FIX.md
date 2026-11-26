# M1.4K.7: Playground lighting reset (D1 fix)

## Result

**D1 is fixed.** After a quick return, Playground's ring, its reflection and its strips:

- finish the previous visit's normal fade;
- stay dark until the new spark lands;
- light up from dark, as on a normal activation.

The fix is one file, `components/lab/SceneV2.tsx`, and is CSS only. Nothing else changes:

- Playground's normal activation and its 18 px lift;
- the other four stations;
- Lite and reduced motion;
- the artwork, reflections, connection and chip;
- the homepage `/`.

| | Before | After |
|---|---|---|
| Ring or strip lit when the new spark lands (`repro-pg-lights`) | **15 of 16** runs (median 0.59) | **0 of 16** |
| Lit in the last 200 ms before the arrival (`d1-check`) | **8 of 12** | **0 of 12** |
| Playground → Engineering → Playground, 120 ms (`k3-pg-eng`) | D1 flagged in 1 of 2 passes | Clean in 3 of 3 |
| Normal activation, lift | 18.0 px; ring and strip 17–250 ms after the arrival | **Identical** |

RTX 4060, Chrome 158 with default settings (GPU compositing on), 1648 × 928, dev server on :3002. The machine is described in `HOME-VERIFICATION.md`. Not committed.

## Root cause

The ring, its reflection's lit share (`.lab-v2-power-lit`) and the unpowered-strip overlay (`.lab-v2-strip-off`) were plain opacity transitions on the hover:

```css
.lab-v2-power-lit { opacity: 0; transition: opacity 240ms var(--ease-glow) 160ms }          /* leaving */
:is([data-lab-hover="playground"], [data-lab-selected="playground"]) .lab-v2-power-lit {
  opacity: 1; transition: opacity 260ms var(--ease-glow) var(--arrive-now) }                /* arriving */
```

(`.lab-v2-strip-off` was the same, inverted.)

These are CSS transitions, so an interrupted transition starts from the value it has reached:

1. **Leaving** reverses the rising transition. The light **holds its current level L** through the 160 ms leave delay.
2. **Returning inside that delay** reverses it again: a new L → 1 transition, which waits `--arrive-now`, the new spark's ~650 ms flight.
3. So **the light sits at L for the whole flight** and is still at L when the spark lands. L is 0.3 after leaving 40 ms after the arrival, 0.6 after 80 ms and 0.9 after 150 ms.

On the office GPU, late frames let it climb further.

**Why the other four stations don't have this.** Their effects run on two numbers (`station-cycle.ts`, M1.4I.1D; Engineering's own, M1.4I.1B):

- a cycle number, which drops to 0 on leaving and rises only at the arrival;
- a shown number, which follows it but runs back with its own timing.

A return then never carries the previous cycle's level into the next one. Playground's ring and strip never got that treatment.

## Code changes (`components/lab/SceneV2.tsx`)

**1. `PG_POWER_CSS` now holds the whole light, on registered numbers.** `PG_STRIP_CSS` is removed; the strip overlay's rule is in here, inverted.

```js
const PG_RETURN_HOLD = 20;
const PG_ON = ':is([data-lab-hover="playground"],[data-lab-selected="playground"])';
const PG_POWER_CSS =
  ["--pgl-on", "--pglh", "--pgl"].map((v) => `@property ${v}{syntax:"<number>";inherits:true;initial-value:0}`).join("") +
  ".pg-cycle{--pgl-on:0;--pglh:0;transition:none}" +
  `[data-lab-returning="playground"] .pg-cycle{transition:--pglh 0ms linear ${PG_RETURN_HOLD}ms}` +
  `${PG_ON} .pg-cycle{--pgl-on:1;--pglh:1;transition:--pgl-on 260ms var(--ease-glow) var(--arrive-now),--pglh 0ms linear calc(var(--arrive-now) + 260ms)}` +
  ":is(.lab-v2-power-lit,.lab-v2-strip-off){--pgl:max(var(--pgl-on),var(--pglh));transition:--pgl 240ms var(--ease-glow) 160ms}" +
  `${PG_ON} :is(.lab-v2-power-lit,.lab-v2-strip-off){transition:--pgl 0s}` +
  ".lab-v2-power-lit{opacity:var(--pgl)}.lab-v2-strip-off{opacity:calc(1 - var(--pgl))}" +
  `@media (prefers-reduced-motion: reduce){.pg-cycle{transition:none!important}${PG_ON} :is(.lab-v2-power-lit,.lab-v2-strip-off){transition:--pgl 260ms var(--ease-glow)}}`;
```

| Number | Where | What it does |
|---|---|---|
| `--pgl-on` | `.pg-cycle` | This cycle's progress. **0 until the new spark arrives, back to 0 at once on leaving.** Arriving uses the old timing: 260 ms after `--arrive-now` |
| `--pgl` | the lit layers themselves | What is shown, `max(--pgl-on, --pglh)`. While hovered it follows at once. On leaving it runs back with the old timing (240 ms after 160 ms). A return doesn't restart that run-back, because its target is still 0 until the spark lands. So **the new spark always lights from dark** |
| `--pglh` | `.pg-cycle` | Fully powered. It keeps the light through the moment Escape or Back leaves with neither hover nor selection (`data-lab-returning`, 20 ms), as `station-cycle.ts` does for the other stations |

- **Reduced motion:** no spark to wait for, so the cycle follows at once and `--pgl` keeps the previous cross-fade (260 ms in, 240 ms out after 160 ms).
- **Opacity and blending stay on the same elements as before**, so the composited result is unchanged.

**2. Three cycle anchors**, each an ancestor that carries Playground's `--arrive-now`:

| Light | Anchor |
|---|---|
| Ring | The ring's own `div` (`data-v2-ring="playground"`) gets `pg-cycle`. It had no transitions |
| Reflection's lit share | A new `<span className="pg-cycle contents">` (`display: contents`, no box) around the existing span. The parent `.lab-depth` already transitions `--lp`, so a `transition` there would break the reflection's motion |
| Strip overlay | The same wrapper around the `<img>` inside the lift. The lift itself transitions `transform` |

`display: contents` creates no box, stacking context or containing block, so painting, blending, the image's position and `PlateGate`'s `img[data-gate]` lookup are unchanged.

**3. `PG_LITE_CSS`:** Lite now cross-fades the number instead of the opacity. The timing is the same as before: 150 ms with `--ease-glow`, no delay, both ways.

```diff
- `:is(.lab-v2-strip-off,.lab-v2-power-lit){transition-duration:150ms!important;transition-delay:0ms!important}` +
+ `.pg-cycle{transition:none!important}:is(.lab-v2-strip-off,.lab-v2-power-lit){transition:--pgl 150ms var(--ease-glow)!important}` +
```

**Not changed:**

- the arcade's game screen;
- the lift, the descent and the reflection's motion;
- the shadows and the connection;
- every other station;
- Lite's other rules;
- `globals.css`;
- the homepage, which renders the plate scene and contains none of this markup (checked: no `pg-cycle`, `lab-v2-strip-off` or v2 scene in `/`).

`npm run typecheck` passes.

## Before and after: the reproduction

### `repro-pg-lights.mjs 2`

The office reproduction from `defects.md`. The pointer leaves 0, 40, 80 or 150 ms after the spark lands, timed on the spark's own clock, and returns after one frame or 50 ms. Before is this morning's home run (`f233593`); after is the fix. Each Playground frame is analysed from the return.

| Leave after the arrival | Level at the return | **Before:** at the new arrival | **After:** dark at | **After:** at the new arrival | After: 50 % / 90 % |
|---|---|---|---|---|---|
| 0 ms | 0–0.05 | 0–0.05 | 667–533 ms before | **0** | 83 / 167 ms after |
| 40 ms | 0.30–0.46 | 0.30–0.46 | 333–383 ms before | **0** | 83 / 167 |
| 80 ms | 0.59–0.69 | 0.59–0.69 | 317–367 ms before | **0** | 83 / 167 |
| 150 ms | 0.88–0.92 | 0.88–0.92 | 316–350 ms before | **0** | 83 / 167 |

**Summary:**

- Lit at the new arrival: before **15 of 16**, after **0 of 16**.
- Lit in the last 200 ms before it: before 15 of 16, after 0 of 16.
- Rising before it: 0 of 16, both before and after.

Creative Studio, the control, is unchanged: 0 at the arrival in 16 of 16.

**What the visitor sees now:** the previous visit's light fades out on its usual leave timing and has gone dark at least ~320 ms before the new spark lands. The new spark then lights it from dark.

### `d1-check.mjs` (new)

12 timings: the pointer leaves from 60 ms before to 300 ms after the arrival, and returns after one frame or 150 ms. It reads the ring, the strip and the arcade screen separately. Before ran on a production build of `f233593` (:3005); after, on the fix (:3002).

| | Before | After |
|---|---|---|
| Runs clean (ring and strip dark in the last 200 ms, no rise, 18 px, back at rest) | 4 of 12 | **12 of 12** |
| Ring or strip lit in the last 200 ms before the arrival | **8 of 12**, up to 1.0 | **0 of 12** |
| Ring / strip after the arrival, half / full | (held level) | 83 / 233 ms, every run |
| Arcade screen lit in the last 200 ms (not in scope; see Caveats) | 5 of 12 | 5 of 12 |

### `k5-spark.mjs d1fix 1 playground`

The 28-timing set: 0 flagged, the lift never rises before the spark, 18.0 px and back at rest in 28 of 28. It was also 0 flagged before, because its analyser flags rising light, not held light.

## Focused validation

| Check | Probe | Result |
|---|---|---|
| **Normal Playground activation** | `k1-stations.mjs 2` | **Identical to before:** ring and strip 17–250 ms after the arrival; lift first / half / full 17 / 200 / 450 ms to **18.0 px**; down 167 / 450 ms; arcade 67–217 ms (before 66–216). Nothing before the arrival; layers together; no other station affected; 0 floor parts moved; back at rest, no residual |
| | `lite-perf.mjs 1` | Strips half / full 881 / 1047 ms after the hover on the first visit, 764–766 / 931–932 ms on repeats (before 880 / 1047, 765–779 / 932–946). 60 fps on repeats |
| **Playground ↔ Engineering, rapid** | `k3-pg-eng.mjs pairs,reenter` (new; `k3-switching` narrowed to these two stations) | Pairs at four phases: 8 of 8 clean. Re-entry: 10 runs per pass, 3 passes after the fix, see the next rows |
| | Playground → Engineering for 120 ms → Playground | **Before: D1 flagged in 1 of 2 passes** (ring and strip rising before the spark). That pass's JSON was overwritten before the probe took a label; the saved pass, `k3-pg-eng-before`, was clean. **After: clean in 3 of 3 saved passes** |
| | Engineering → empty → back after 110 ms | Flagged in some passes, before and after. Later found to be a false flag from the probe (Caveat 4, `ENGINEERING-QUICK-RETURN.md`) |
| | `lite-perf` E→P→E→P, 900 ms each | 60 fps; only Playground lit at the end, in both modes |
| **AZIZ chip** | `lite-perf` | Cinematic: selected 3 ms after the click (`?station=playground&project=aziz`, `aria-pressed` true). Lite: 5 ms |
| | `d1-escape.mjs` (new) | AZIZ, then Escape, 3 times: the ring and strip stay at 1.0 through the return |
| **Other four stations** | `k1-stations.mjs 2` | Heights and timings as before, within one frame (17 ms). Nothing before any arrival; 0 errors |
| **Lite** | `d1-modes.mjs` (new), before (:3005) against after | Ring, reflection and strip, measured from the hover drop, are **identical to three decimals**: in 81 / 165 ms (half / full); out from 16–17 ms after the drop, dark at 133–134 ms; a quick return stays lit (no spark in Lite) |
| | `lite-perf` | Strips half / full 80–98 / 180–198 ms (before 79–81 / 179–181), 0 lift |
| **Reduced motion** | `d1-modes.mjs` | **Identical:** in 111 / 261–262 ms; out from 167 ms after the drop, dark at 383 ms; a quick return stays lit |
| **Appearance** | Frozen captures, `capture-compare.py` | Playground hovered: identical (max 1 of 255). Lite rest: identical (0); Lite Playground: identical (max 1). Rest and Engineering: identical to a pre-fix build captured in the same session (max 1, 0 pixels over 2). This morning's captures differ from both by the Playground-edge sub-pixel patch that `HOME-VERIFICATION.md` §6 documents as capture-session noise |
| Console errors | all of the above | 0 |
| Typecheck | `npm run typecheck` | Pass |

## Caveats

1. **The previous visit's light is still seen fading on a quick return.**
   - It is the normal leave fade (160 ms hold, then 240 ms), now never interrupted. A return 150 ms after the arrival shows it at 0.9, falling to dark within ~400 ms of leaving, before the new spark lands.
   - It never holds or rises without its spark.
   - The alternative, cutting it off at the return, would be a visible snap.
   - The other four stations run back the same way.
2. *(Fixed later, in M1.4K.9: `PLAYGROUND-SCREEN-LIGHTING.md`.)* **The arcade's game screen is unchanged** and can still hold through the flight after a quick return: in 5 of 12 runs, at 0.26–1.0.
   - Its fade (`.lab-arcade`, `ACTIVATION_CSS`) has the same transition shape. `ArcadeScreen` documents keeping the same game on a quick return as deliberate.
   - The brief scoped D1 to the ring and strip.
   - If it should wait too, give `.lab-arcade` the same cycle as a separate change.
3. **The light keeps time with the hover's `--arrive-now`, not with the drawn spark.**
   - On the RTX 4060 the spark starts within one frame, so the two agree.
   - On a GPU that starts the spark late (the office: 100–200 ms), the light can still come up that much ahead of the drawn spark. This is the D1′ class, shared by all five stations; it was not re-run at the office.
4. **Corrected by M1.4K.8: Engineering does *not* end powered but un-lifted.**
   - This report first listed it as a pre-existing Engineering defect: `k3-pg-eng`'s "Engineering → empty → back after 110 ms" flagged in 1 of 8 runs at `249d01e` and 4 of 8 at `f233593` and with this fix (`results/k3-eng110-ab.txt`).
   - **It was a false flag from the probe's end check.** The check read the height before the new arrival had raised the station again. Every traced return reaches 12.167 px.
   - The end check is corrected. See [`ENGINEERING-QUICK-RETURN.md`](ENGINEERING-QUICK-RETURN.md).
5. **The Escape / Back hold (`--pglh`) matches the other stations' mechanism, but its 20 ms window was not exercised.** In `d1-escape` the pointer stays on the chip, so there is never a frame with neither hover nor selection. The light stayed at 1.0 in 3 of 3.
6. **Scope of validation:**
   - Short targeted runs on the RTX 4060 only, against the dev server.
   - The before runs for `d1-check` and `d1-modes` used a production build of `f233593`, because the CSS timing is the same in both.
   - Not re-run (as briefed): the full `k3-switching`, `k5-quick` and `k6-hits chips` that `NOTES.md` release condition 4 lists after any D1 fix. `k5-quick <label> 1 1 playground` and `k6-hits chips` are the closest remaining checks before release.

## Evidence

All in `docs/m1.4k/work/` unless noted; committed office and home results were left as they were.

| What | Files |
|---|---|
| Reproduction, before / after | `results/repro-pg-lights-home.*` / `results/repro-pg-lights-d1fix.*` |
| Per-light check | `d1-check.mjs`; `results/d1-check-before.*`, `d1-check-after.*` |
| 28 timings | `results/k5-spark-home.*`, `k5-spark-d1fix.*` |
| Switching | `k3-pg-eng.mjs`; `results/k3-pg-eng-before.*`, `k3-pg-eng-d1fix*.*`, `k3-eng110-ab.txt` |
| Stations | `results/k1-home.txt`, `k1-d1fix.txt`, `k1-stations-*.json` |
| Lite and reduced motion | `d1-modes.mjs`; `results/d1-modes-before.*`, `d1-modes-after.*` |
| Escape | `d1-escape.mjs`; `results/d1-escape-after.txt` |
| Performance, chips | `docs/performance/work/results/lite-perf-d1fix.*` |
| Captures | `docs/performance/work/captures/lite/d1*/` (PNGs ignored by Git); `results/capture-compare-d1fix.txt` |
