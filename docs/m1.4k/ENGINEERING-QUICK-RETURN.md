# M1.4K.8: Engineering quick return, and Playground's arcade screen

## Result

**Engineering's lift does not fail.** On a quick return it always reaches the approved 12 px once the new spark arrives. It did so in all 24 saved traced returns, from 60 to 260 ms into the descent.

**The reported defect was a false flag from the test probe.** `k3-switching`'s end check read Engineering's height before the new arrival had raised the station again. The fix is to that check, not to the application. **No application code was changed** in this task.

The visible part, Engineering lit while it sits at rest for about 400 ms, is the approved quick-return design:

- the platform finishes its descent;
- the strips keep their level;
- the platform rises again when the new spark lands.

**Playground's arcade screen** deliberately keeps its game running through a quick return, by an M1.3E decision. Since the D1 fix it is now out of step with its own station: it can stay lit (0.2–1.0) through the new spark's flight while the ring and strip are dark. **Recommended: reset it before the next spark**, as a separate, approved change. Not changed here.

| | Before | After |
|---|---|---|
| `k3`'s "Engineering stable → empty → back 110 ms after the drop", run alone, 8 fresh pages | **4 of 8 flagged** (height 0 px) | **0 of 8** (12.167 px) |
| Engineering's actual end height in the same scenario, traced per frame | 12.167 px in 8 of 8 | (unchanged) |

RTX 4060, Chrome 158 with default settings, 1648 × 928, dev server :3002. The working tree includes the uncommitted D1 fix (`PLAYGROUND-D1-FIX.md`). Not committed.

## Part A: Engineering

### Reproduction

`eng-return-trace.mjs` (new) replays `k3`'s scenario on a fresh page each time:

1. Hover Engineering.
2. Leave when `k3` would: once Engineering reads as "powered" and the rest are at rest.
3. Move to the empty floor.
4. Come back `gap` ms after the hover drops.

It traces each frame: the hover, the lift's numbers on all four `EngineeringLift` mounts, the station's height (the highest of its 16 `.eng-rise` layers), its lights and the spark. It also runs `k3`'s own end check unchanged: wait for "powered", wait 350 ms, read the height.

| Return after the drop | Trials | `k3`'s check: height read | Height at the end | Back on the floor | `--el-on` starts | Spark |
|---|---|---|---|---|---|---|
| 60 ms | 4 | **0 px in 4 of 4** (read 366–375 ms after the return) | **12.167 px, 4 of 4** | 316–334 ms after the return | 700–716 ms | 0–17 ms |
| 110 ms | 8 | **0 px in 4 of 8** (read 369–384 ms) | **12.167, 8 of 8** | 267–317 | 700–717 | 0–17 |
| 110 ms (second set) | 4 | 0 px in 2 of 4 | **12.167, 4 of 4** | 266–300 | 683–717 | |
| 160 ms | 4 | 0 of 4 | **12.167, 4 of 4** | 217–234 | 683–717 | |
| 260 ms | 4 | 0 of 4 | **12.167, 4 of 4** | 117 | 683–717 | |

At every gap, all four mounts end with `--el-on`, `--elh` and `--el` at 1. **24 of 24 saved returns end at 12.167 px.** Earlier trace runs in this session, overwritten by later runs with the same label, also all ended there.

### Root cause

**What the station does** (trace, 110 ms gap; times from the return):

| ms | Height | Strips (`--pw`) | Chart / display | Bars (of 11) | Scan | `--el-on` |
|---|---|---|---|---|---|---|
| −150 (left) | 12.17 | 1 | 1 / 1 | 11 | 1 | 0 |
| 16 (back) | 5.88 | 1 | 1 / 1 | 10.6 | 1 | 0 |
| 116 | 1.55 | 1 | 0.32 / 0.32 | 5.6 | 1 | 0 |
| 300 | **0** | 1 | 0 / 0 | 0 | 0 | 0 |
| 300–700 | **0** | **1** | standby | 0 | 0 | 0 |
| 750 (spark lands) | 0.53 | 1 | 0 / 1 | 0 | 0.01 | 0.04 |
| 1000 | 10.07 | 1 | 0.91 / 1 | 6.6 | 0.85 | 0.83 |
| 1300 | **12.167** | 1 | 1 / 1 | 11 | 1 | 1 |

This is the approved design. `EngineeringLift.tsx` (M1.4J.1) says:

> a return while it sinks lets it finish and rises again on the new arrival: nothing hangs in the air through a charge.

`EngineeringV2.tsx` (M1.4I.1B) says:

> the strips themselves keep their level until then

and the chart, display, bars and scan run back to standby and replay from the arrival.

**Why the probe flagged it.** `k3`'s end check was:

1. `stable(finalId)`: wait until Engineering is "powered" and the rest are at rest.
2. Wait 350 ms, then require the height to be 12 px.

"Powered" (`POWERED.engineering` in `lib.mjs`) covers the strips, chart, bars and scan, **but not the height**.

On a return within about 120 ms of the hover dropping, the previous visit's numbers have not yet run back: the bars begin after 120 ms, the chart and display after 160 ms, the scan after 400 ms. So "powered" is already true **15–19 ms after the return**. The height is then read about 370 ms after the return. That is after the platform has reached the floor (266–334 ms) and **before** the new spark lifts it (`--el-on` from about 700 ms). The probe read 0 px and flagged it.

Whether "powered" still holds at the return depends on a few milliseconds of timing. That explains the varying rate: 4 of 4 at 60 ms, about half at 110 ms, none at 160 ms or later. It also explains why it showed in some passes and builds and not others:

| Build | Flagged |
|---|---|
| `249d01e` | 1 of 8 |
| `f233593` | 4 of 8 |
| with the D1 fix | 4 of 8 |

The home `k3` set (165 runs) was clean. Its re-entries were not isolated on fresh pages, so they ran at different timing.

**My M1.4K.7 report was wrong** to call this "Engineering can end powered but not lifted". That caveat is corrected in `PLAYGROUND-D1-FIX.md`.

### Code changes

**Application: none.** `EngineeringLift.tsx`, `EngineeringV2.tsx` and every other app file are untouched by this task. The only app diff in the tree is the earlier D1 fix in `SceneV2.tsx`.

**Probe: `docs/m1.4k/work/k3-switching.mjs`** (and the narrowed copy `k3-pg-eng.mjs`). The end check now also waits for the final station's approved height, read with the same function that checks the height:

```diff
 const stable = (id, ms = 6000) => L.settle((s) => s.hover === id && POWERED[id](s[id]) && IDS.filter((o) => o !== id).every((o) => REST[o](s[o])), ms);
+// M1.4K.8: the end check also waits for the height. POWERED leaves it out, and a return early in the descent can still
+// read as powered (the previous visit not yet run back), so the height used to be read before the new arrival had
+// raised the station again: a false "heights" flag (ENGINEERING-QUICK-RETURN.md). A lift that never arrives still fails.
+const raised = async (id, ms = 6000) => { for (let t = 0; t < ms; t += 50) { if (Math.abs((await L.st())[id].y - HEIGHT[id]) < 0.25) return true; await sleep(50); } return false; };
+const settled = async (id) => (await stable(id)) && (await raised(id));
 ...
-  const ok = finalId ? await stable(finalId) : true;
+  const ok = finalId ? await settled(finalId) : true;
```

- `stable()` itself is unchanged, so every scenario still starts from the same moment, including the re-entry scenarios that leave while the lift is still finishing.
- A lift that never reaches its height still fails, after 6 s, both through `ok` and the height check.
- `POWERED` in `lib.mjs` is shared by other probes and was not changed.

### Before and after

| Check | Before (old end check) | After |
|---|---|---|
| `k3`'s Engineering 110 ms case, alone, 8 fresh pages (`results/k3-eng110-ab.txt`, `k3-eng110-fixed.txt`) | 4 of 8 flagged | **0 of 8**; 12.167 px, 2 sparks, no frame flagged by `analyse.mjs` |
| `eng-return-trace` (`results/eng-return-before.*`, `eng-return-sweep-*`) | `k3`'s read: 0 px in 10 of 24 (all at 60–110 ms) | End height 12.167 px in **24 of 24** |

### Focused checks

| Check | Probe | Result |
|---|---|---|
| **Engineering, normal activation** | `k1-stations.mjs 2` | 12.167 px (approved 12). First / quarter / half / full 80 / 180 / 246 / 663 ms after the arrival, down 150 / 417 ms, as before. Nothing before the arrival; layers together; no other station affected; 0 floor parts moved; back at rest. The first run's median half-height reads 280 ms because the known first-visit frame (117 ms) fell on it |
| **Quick return at the failing timing** | `eng-return-trace.mjs`; `k3-pg-eng.mjs reenter`, 8× alone | 24 of 24 traced returns reach 12.167 px; 8 of 8 clean |
| **Engineering → Playground → Engineering** | `k3-pg-eng.mjs pairs,reenter` (`results/k3-pg-eng-m148.txt`) | Pairs at four phases **8 of 8**; re-entries **10 of 10**, including Engineering → Playground for 120 or 260 ms → Engineering; one spark per visit; 0 errors |
| **Playground D1 regression** | `d1-check.mjs m148 1` | **12 of 12**: ring and strip dark in the last 200 ms before every new arrival; 18.0 px; back at rest |
| **Engineering chip** | `lite5-check.mjs` | Cinematic: SQLOrbit selected, camera moved, lift 12 px. Lite: SQLOrbit selected, camera still, 0 px. All 10 chips pass |
| **Lite** | `lite5-check.mjs` | All five stations powered at 400 ms with 0 px lift; 0 sparks; 0 errors |
| **Reduced motion** | `eng-reduced.mjs` (new) | Engineering fully lit 400 ms after the hover and 400 ms after a 110 ms quick return; **0 px lift** throughout; 0 errors |
| **TypeScript** | `npm run typecheck` | Pass |

## Part B: Playground's arcade screen (inspection only)

### What controls it

| Part | Where | On a quick return while the screen is fading |
|---|---|---|
| **Visibility**: the wrapper's opacity | CSS. `.lab-arcade` (`globals.css`): `opacity: 0`, fading out at once over 340 ms. When hovered (`ACTIVATION_CSS`, `EnergySurge.tsx`): `opacity: 1` over 160 ms, **after `--arrive-now` + 50 ms** | A plain opacity transition, the shape that caused D1. The new transition starts from the current level and waits for the new arrival, so **the level reached is held through the whole flight** |
| **Content**: the game | JS, `ArcadeScreen.tsx`. A game clock (a Web Animation) and one rAF loop, started on hover. The screen boots (a 200 ms wipe) 50 ms after the arrival. The loop ends once the fade-out reaches 0 | **Deliberately kept:** "A quick return during the fade keeps the same loop and game: no restart, no duplicate", and "The wrapper's CSS transition, already waiting for arrival, keeps its delay too, so both stay in step." No new boot: the game continues |
| Left before the game switched on | `ArcadeScreen.tsx` | Stops at once: nothing held |
| Reduced motion, Lite | `ArcadeScreen` `still`; 150 ms cross-fade | One still frame, no spark to wait for |

### Measured (`d1-check.mjs m148`, with the D1 fix)

| Pointer leaves after the arrival | Screen at the return | Screen when the new spark lands | Ring and strip then |
|---|---|---|---|
| −60 to 40 ms (before the game switched on) | 0 | 0 | 0 |
| 80 ms | 0–0.27 | 0–0.27 | 0 |
| 150 ms | 0.20–0.89 | 0.20–0.89 | 0 |
| 300 ms | 0.49–1.0 | 0.49–1.0 | 0 |

- It never rises before the spark (rise 0 in 12 of 12). It holds.
- In 4 of 12 runs it is lit through the whole flight.

### Does it match the approved activation design?

- **It matches its own approved design, M1.3E**, which is explicit about keeping the game on a quick return.
- **It no longer matches the station-wide rule** set by M1.4I.1 and confirmed for Playground by D1: each activation lights from its own spark.

  | Part | On a quick return |
  |---|---|
  | Playground's ring and strip (since D1) | Dark until the new spark |
  | Engineering's display, the closest analogue | Runs back to standby and replays its scan from the arrival |
  | Playground's game screen | Keeps playing, at up to full strength, on an otherwise unpowered station |

  M1.3E predates both rules.

### Should it reset before the next spark?

*(Done in M1.4K.9, the light only and without restarting the game: `PLAYGROUND-SCREEN-LIGHTING.md`.)* **Recommended: yes, as its own small change, with the owner's approval** (it reverses a documented M1.3E decision):

1. **Visibility:** give `.lab-arcade` the same two-number cycle as the ring (`--pgl`, `PG_POWER_CSS`). Its leave fade stays as it is (340 ms, at once), but a return no longer holds it, and it relights from 0 at arrival + 50 ms.
2. **Content:** in `ArcadeScreen.update()`, on a return whose game is already past its switch-on, start a new clock and boot time, instead of keeping the old one. The boot wipe then replays at the new arrival, as Engineering's scan does.

Then check it with `d1-check.mjs`: the arcade should be dark in the last 200 ms before the arrival in 12 of 12. The alternative is to keep it as designed and accept the mismatch. Either way it is cosmetic, P3 at most.

## Remaining risks

1. **The corrected end check no longer catches a late lift, only a missing one.**
   - A station reaching its height up to 6 s late now passes `k3`'s end check. Before, a height read at 350 ms could flag it, at the cost of these false flags.
   - Lift timing is still measured by `k1-stations.mjs` and judged frame by frame by `analyse.mjs` (nothing before the arrival).
   - If lateness should be caught in `k3` too, bound `raised()` to the arrival plus the lift's own duration after the last move.
2. **Earlier `k3` results used the old check.** It could only add false "heights" flags, never hide a failure, so the earlier clean sets (165 of 165 at home) still stand.
3. **Two quick-return policies now coexist.**
   - Engineering's strips (and, through `powerCss`, the other three stations' strips) **keep their level** through a quick return, by design.
   - Playground's ring and strip **go dark** until the new spark (D1, as requested).
   - Both are deliberate. If the owner wants one rule, it should be decided before the arcade change above.
4. **Engineering in browsers other than Chromium** uses one plain transition (`EngineeringLift.tsx`: a quick return keeps its height until the new arrival). Not tested here.
5. **Scope:** short targeted runs on the RTX 4060 against the dev server only. No production build, office GPU, Firefox or Edge.

## Evidence

All in `docs/m1.4k/work/` unless noted.

| What | Files |
|---|---|
| Trace probe and results | `eng-return-trace.mjs`; `results/eng-return-before.*`, `eng-return-sweep-60/110/160/260.json`, `eng-return-sweep.txt` |
| `k3` case, old and new end check | `results/k3-eng110-ab.txt` (M1.4K.7: 249d01e, f233593, D1 fix); `results/k3-eng110-fixed.txt` |
| Switching | `results/k3-pg-eng-m148.*` |
| Stations | `results/k1-m148.txt`, `k1-stations-m148.json` |
| D1 regression, arcade | `results/d1-check-m148.*` |
| Chips and Lite | `docs/performance/work/results/lite5-check-m148.*` |
| Reduced motion | `eng-reduced.mjs`; `results/eng-reduced-m148.txt` |
| Probe fix | `k3-switching.mjs` (diff above), `k3-pg-eng.mjs` |
