# M1.4E.3: Playground connection seam and icon cleanup (`/lab-v2`, experimental)

**Scope:** `/lab-v2` only. The homepage `/`, the other four stations and their icons, station artwork, shadows, floor, the lift and all station animations are unchanged. No scroll work. **SA-1 is not approved.**

**No screenshot was attached to the request.** The issues were located from the code and the M1.4E.1 / M1.4E.2 captures.

## 1. The junction near the central A

### What was there

Up to M1.4E.2, Playground's line was drawn in **three separately rendered pieces**:
1. **Part 0:** from the A's ring across its platform to the rim, at (963.5, 570.2).
2. **Part 1:** from the rim down to the floor and on to the station's ground contact E.
3. **The M1.4E.2 floor extension** beneath the station.

Parts 0 and 1 were each drawn inside their own rotated charge window. They met at the rim, where the traced route turns by 26°, as two strokes ending at an angle:
- **M1.4E.1 (round ends):** a sharp V with a bead where the two ends overlapped.
- **M1.4E.2 (butt ends):** a sharp V with a notch on the outside of the corner. Changing to butt ends, done for the E joint, made this junction worse.

The E joint between the line and the floor extension was the faint ⅓ px joint noted in M1.4E.2.

Measured along the line at 3× (`work/continuity.json`, M1.4E.1 captures), the junction shows:

| State | Largest brightness step | Lowest core brightness |
|---|---|---|
| Idle | 8.8 levels per px | |
| Powered | 31 levels per px | 208 (elsewhere 239) |

### What changed

**One continuous path** (`components/lab/playground-line-v2.ts`; drawn by `PlaygroundLineV2` in `components/lab/ChargeLine.tsx`) runs from the A's ring to 62 px beneath the station.

**Geometry.** The same accurate route points (`playground-route.ts`) plus M1.4E.2's extension point, as one quadratic B-spline.
- The rim corner is rounded over about 9 px; the line moves by 0.5 px there and by less than 0.1 px elsewhere.
- So the floor perspective is unchanged, and the spark's route masks (2.4 px core) still sit on the line.
- No part boundaries, no overlapping ends, one stroke set (spill, glow, core) for the whole line.

**Charge.** Two masks along the path, each a single dash: powered (boost) from the start to the charge front, unpowered (dim) after it.
- Their dash offset is animated from the same charge position `u` that drives the route's windows: `chargeAnimations` now also writes it.
- So the spark, the charge behind it, the power ramp and the drain run exactly as before.
- The windows themselves are kept, empty, as the charge position's drivers. EnergySurge reads them on leave, so the drain logic is unchanged.
- The masks are softly blurred (2.2 px), like the windows' soft edge.
- Selected and reduced-motion states power the line through CSS, as for the windows.
- Past E, the whole run beneath the station is powered as one. The windows read a full line back at anything from E to `full`, so a front there would have left part of it unpowered on leave.

**Beneath the station.** The line continues under the station in the same path; there is no separate floor layer any more.
- The station's own silhouette hides what is under it: the station image's alpha, used as a mask.
- That silhouette is moved exactly as the lift moves the station, by the lift's own progress `--lp` (measured equal to the lift: −0.7, −9.64, −17.39 and −18 px at the same moments).
- The line itself never moves.

**Removed: M1.4E.2's floor-layer extension and its optional floor contact** (`PG_ENDPOINT`). The extension is now part of the path. No new endpoint decoration.

### Result (`work/continuity.json`, 3×, along the path every 1 px, station-covered points skipped)

| | Core brightness along the visible line | Largest step | Rim junction (±12 px) |
|---|---|---|---|
| M1.4E.3 idle (rest) | 181.5–194.7 (median 187.6) | 1.7 per px | 185.3–192.1, step 1.7; glow width 1.0–1.3 px |
| M1.4E.3 powered (lifted) | 239.2 throughout | 0 | 239.2, step 0; glow width 1.3–2.7 px |
| M1.4E.1 idle, for comparison | 180.4–194.7 | 8.8 per px (at the junction) | step 8.8 |
| M1.4E.1 powered, junction | | | 208.1–239.2, step 31.1 |

The idle variation (181–195) follows the floor beneath the line's soft glow; the core itself is uniform.

- **Fixed to the floor:** the line's rectangle and all 258 sampled path points are identical at rest and at full lift.
- **The E joint:** the faint ⅓ px joint from M1.4E.2 is gone, because there is no second piece.

## 2. The floating gamepad icon

`/lab-v2` passes `hideIcons={["playground"]}` to `LabStations`, so Playground's floating HTML icon (`.lab-station-icon`) is not rendered. The icon was absolutely positioned, so nothing else in the label moves.

Measured (`checks.json`):

| Page | Floating icons per station |
|---|---|
| `/lab-v2` | educational 1, engineering 1, **playground 0**, creative 1, experience 1 |
| `/` (homepage) | all five 1 (unchanged) |

**Kept:**
- the Playground title;
- the AZIZ chip;
- the cabinet and its own marquee decoration (a small gamepad painted on the cabinet, part of the station artwork);
- the physical controller;
- the animated screen.

## 3. Timing and behaviour (`work/captures/checks.json`)

**Hover:**

| Time | State |
|---|---|
| 255 ms | Spark at the rim (964.2, 570.0), on the rounded corner |
| 293 ms | Spark half way |
| 598 ms | Spark at E. Lift 0, strips unpowered |
| 612 ms | Line fully charged behind the spark (mask offset 100 = full); power ramp 0.77 |
| 700 ms | Strips lighting; lift 0.7 px |
| 850 ms | Lift 9.6 px |
| 1000 ms | Lift 17.4 px |

These are identical to M1.4E.2.

**Leave:**

| Time after leaving | State |
|---|---|
| 20 ms | Still fully powered |
| 360 ms | Station down (0.2 px); still powered |
| From 380 ms | The drain |
| After | Back to the rest state |

**Behaviour:**

| Check | Result |
|---|---|
| Interruption | Leaving at 300 ms: draining at 800 ms, at rest by 2000 ms; nothing switches on late |
| Keyboard | 15 Tabs. Focus powers and lifts it; Enter selects it (`/lab-v2?station=playground`); Escape clears the selection and it stays powered while focused (as before) |
| Deep link | Lifted (−18) and powered on load |
| Reduced motion | No lift; the line is powered at once; the under-station run stays hidden |
| Console | No errors |
| Homepage | No `/scene/v2/` requests, no v2 line nodes, icons unchanged |

## Evidence (`docs/m1.4e3/`)

| File | Shows |
|---|---|
| `connection-near-a-3x.png` | The connection near the central A, 3×, idle and powered. Rows: M1.4E.1, M1.4E.2 (only 1× captures exist, enlarged), M1.4E.3 (plus the spark crossing the rim) |
| `connection-junction-3x.png` | The rim junction, 3×, same rows and columns |
| `playground-rest.png` | Playground at rest, 1×: M1.4E.2 vs M1.4E.3 |
| `playground-lifted.png` | Playground fully lifted, 1×: M1.4E.2 vs M1.4E.3 |
| `playground-hover-sequence.png` | 1× frames of the hover sequence |
| `playground-hover-sequence.webm` | The hover sequence in real time, 2× close-up of Playground and its whole connection (9 s): hover → spark → charge → strips → rise → hold → leave → lower → drain, twice |
| `work/` | All phase captures (1×, the whole line at 3×, near the A at 3×, the junction at 4×), `checks.json` with the path samples, and `continuity.json` |

**Capture-script fix.** The M1.4E.1 / M1.4E.2 capture scripts resumed animations with `play()`, which restarts finished ones. So their "returning" frames re-ran part of the charge. `m14e3-capture.mjs` finishes them in place instead. This affected only those evidence frames, not the page.

## Validation

- `npm run typecheck`: pass.
- **Targeted browser checks:** `scripts/visual/m14e3-capture.mjs --checks --webm`.
- **Sheets and profile:** `scripts/m14e3-sheets.py`.
- **Not run:** full visual suite, production build.
- **Server:** captures used the `next dev --port 3002` server already running on this machine (left running). `tsconfig.json` is unchanged.
- **Stale script:** `scripts/visual/m14e2-capture.mjs` reflects the M1.4E.2 DOM (floor extension and contact variants) and no longer matches `/lab-v2`.

## Files

**New**
- `components/lab/playground-line-v2.ts`
- `scripts/visual/m14e3-capture.mjs`
- `scripts/m14e3-sheets.py`
- `docs/m1.4e3/**`

**Changed (homepage behaviour unchanged)**

| File | Change |
|---|---|
| `components/lab/ChargeLine.tsx` | `PlaygroundLineV2` (v2 only); Playground's v2 windows render no content; `chargeAnimations` also drives the path's masks; `pgV2PoweredCss` |
| `components/lab/EnergySurge.tsx` | The power ramp and the release also address the path's masks; selected / reduced-motion CSS for them. Nothing matches these on `/` |
| `components/lab/SceneV2.tsx` | M1.4E.2's floor-layer extension and contact removed |
| `components/lab/LabStations.tsx`, `components/lab/ProjectStation.tsx` | Optional `hideIcons` / `showIcon` (default: shown) |
| `components/lab/LabScene.tsx` | `/lab-v2` passes `hideIcons={["playground"]}` |
