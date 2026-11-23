# M1.4I.1B: Engineering quick return

**Fixed on `/lab-v2`** (M1.4I defect P1-2). Verified on the dev server, in Chrome and Firefox. Nothing committed or pushed. The M1.4I.1A navigation fix is in place and was rechecked.

Same probe on both versions, Chrome, real time:

| Runs with any Engineering effect before the spark arrives | Before | After |
|---|---|---|
| Leaving time × return gap (13 × 10) | 64 of 130 | **0 of 130** |
| Real pointer | 9 of 10 | **0 of 10** |
| Through Educational, several returns, interrupted second charge | 15 of 20 | **0 of 20** |
| Back in the same frame, or 1–2 frames later | 25 of 27 | **0 of 27** |
| Click during the sequence, then Escape | 3 of 7 | **0 of 7** |

**One behaviour to know about:** returning quickly to a *fully powered* Engineering used to leave the display and chart lit. They now return to standby and run their sequence again when the new spark arrives. The platform strips still hold their level, as before.

## 1. Root cause
**Stale progress, held by the activation's own delay.** Each Engineering value (scan position, eleven bars, glass, display) was one CSS transition waiting for the spark (`--arrive-now`). A transition that is waiting holds the value it interrupted. A return within about 400 ms of leaving therefore froze the previous cycle for the whole 620 ms charge.

M1.4I recorded the scan line and the bar caps. The probe found more:

| Seen before the fix, in the 130 grid runs | Runs |
|---|---|
| Display or chart held above standby through the charge | 54 |
| Bar caps showing | 35 |
| Scan line showing | 32 |
| Strip pulse frozen on the platform | 31 |
| Stale scan line still frozen *after* the real arrival | 32 |
| Scan resumed part-way down the display instead of starting at the top | 24 |
| No scan at all after the arrival | 24 |

So hiding the line and caps until arrival, as M1.4I suggested, would not have been enough.

Ruled out: overlapping timelines, failed cancellation (leaving before arrival was always clean), and activation state shared between stations.

## 2. Files changed
Only `components/lab/EngineeringV2.tsx`. No asset, geometry, timing value, other station or shared file changed. Probes and data: `docs/m1.4i1/work/eng-*`.

## 3. Minimal fix
Still CSS only, driven by the same `--arrive-now`. Each value is now two:

- **This cycle's progress** (`--x-on`, on a new box-less wrapper `.eng-cycle`): 0 until the spark arrives, and 0 at once on leaving.
- **What is shown** (`--x`, on `.eng-v2`): follows the progress. On leaving it runs back with its existing timing, and a return does not interrupt that. It always reaches standby before the next arrival.

The scan line, caps and strip pulse also need this cycle's progress to be visible.

`--eh` ("fully powered") covers Escape and Back. There the station is neither selected nor focused for an instant, and must not power down and replay. It applies only when returning from a selection whose sequence had finished.

A JavaScript timer was rejected: it would shift the approved timings and break the seeking that the capture tools rely on.

## 4. Behaviour

| | Before | After |
|---|---|---|
| Return while the scan runs | Line and half-scanned display frozen for the charge, then resumes mid-screen | Runs back to standby; scan starts at the top on arrival |
| Return while the bars rise or sink | Half-risen bars and caps held | Bars finish sinking; all eleven rise from 0 on arrival |
| Return while the platform drains | Frozen pulse; display pops to full without a scan | No pulse until that strip's front moves; full sequence on arrival |
| Return to a fully powered Engineering | Display and chart stay lit | Back to standby, then the full sequence on arrival |
| Left before any arrival | Clean | Clean |

## 5. Verification
`npm run typecheck` passes.

**After the arrival (first visits, four each).** Same on both versions, to within one 60 Hz frame:

| Event (ms after arrival) | Before | After |
|---|---|---|
| Scan first seen / last seen | 113–114 / 446–447 | 113 / 446–447 |
| Caps first seen / last seen | 180–197 / 546–547 | 196–197 / 546–547 |
| Bars done | 580 | 580 |
| Stable | 580–596 | 580–596 |

**Every return run:** all ended fully powered and then fully at rest. Nothing rose after leaving, and the scan always started at the top.

**Approved look.** 38 seeked captures of Engineering, before vs after; two captures of the original code differ by 0.
- **Identical (0):** idle, stable, idle after leaving, direct link, reduced motion, and every frame from 720 ms after hover on.
- **At most 2 of 255:** five frames before the sequence starts and nine while leaving. No pixel differs by more than 2.

**Interaction**

| Check | Result |
|---|---|
| Keyboard focus | Full sequence, once |
| Enter selects; Escape; browser Back | Stays lit, no second sequence, focus returns to the title |
| Escape with the pointer over, or away | Stays lit, as before |
| Click during the charge | Sequence keeps its schedule, as before |
| "Back to Lab" with the mouse | Powers down, at rest |
| Direct link | Powered at once, no scan; after Escape and leaving, at rest; quick return clean |
| Reduced motion, five quick returns | No scan, caps or pulse; powered, then at rest |
| Other four stations | Power and return |
| Console | No errors |
| Navigation fix | Client-side entry, reload, Back and Forward, reduced motion: 13 of 13 entries shown |

**Firefox 151:** 35 of 35 quick returns clean; first visit and the ordinary leave match the original code. The original code has the same defect there. Headless Firefox never takes focus, so its keyboard path could not be run; the same attribute changes were tested directly and Engineering stays lit.

## 6. Remaining
- **Run-back after a quick return:** in Chrome the approved fade-out may still be finishing for up to 400 ms after leaving, so it can overlap the new charge. It only goes down. Firefox goes to standby at once.
- **Platform strips** hold their level on a quick return. Existing behaviour, kept as asked.
- **"Back to Lab" with nothing focused:** the display and chart start to fade 20 ms later than before.
- **Other stations, not touched:** Educational, Creative Studio and Experience use the same ungated strip pulse, so the frozen pulse is likely there too (read in the code, not measured). Creative Studio's glint (P2-1) is also still open.
- Not tested: production build, Safari, touch.
