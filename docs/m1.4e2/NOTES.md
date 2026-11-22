# M1.4E.2: Playground connection endpoint (`/lab-v2`, experimental)

**Scope:** Playground in `/lab-v2` only. The homepage `/`, the other four stations, the lift, the shadows and the power timing are unchanged. **SA-1 is not approved.**

**Problem reported:** when Playground rises, the glowing line ends abruptly on open floor, visibly short of the lifted station.

## 1. Diagnosis

Rendered positions were measured in the browser (`work/captures/checks.json`). The station's silhouette at rest and at full lift was computed from the asset with the lift's own transform (`scripts/m14e2-geometry.py`, `work/geometry.json`). All values are in scene px.

| Item | Position |
|---|---|
| Line end E (rendered; last point of the line's path) | (1088.95, 537.80). The route's last point is (1088.96, 537.81) |
| Spark arrival point (598–612 ms) | (1088.93, 537.81), the same point |
| Original ground contact at x 1089 (footprint ellipse) | y 536.4. First floor row below the base: 538 |
| Lifted base at x 1089 (−18 px, ×1.01 about (1218, 547)) | first floor row below it: 520 |
| Ambient shadow at full lift | (1066.8, 502.7), 301 × 40; alpha at E 0.22 |

**The line does not end short. It is exposed.**
- **At rest:** E sits on the base's ground edge, and the floor along the line is covered by the base from 2 px past E. The line meets the station.
- **At full lift:** the base's lower edge is 17.8 px above E. Along the line's own direction, 50 px of floor beyond E is uncovered (the lifted base covers the floor from t = 52 px).
- **The result:** the line stops in the middle of that uncovered strip, so it reads as a broken line.
- **Not the cause:** the shadow does not hide the end; at E it is 0.22.

## 2. Variants tested

Everything added is on the floor, drawn beneath the station (inside Playground's ground layer, after its shadows). So:
- the base hides it at rest, and the lift uncovers it;
- it never moves, never stretches and can never draw on the stone face.

It is charged with the line: the same strokes and colours as the line (`PG_LINE`).
- **On:** when the charge front reaches E (`--arrive-now − 50 ms`, i.e. 600 ms).
- **Off:** as the drain passes E, 380 ms after leaving.

| | Endpoint when lifted |
|---|---|
| **A** (M1.4E.1, before) | The line stops on the open, uncovered floor |
| **B** floor contact | The line runs 18 px past E into a small recessed contact set into the stone. Details:<ul><li>13 × 3 px, at the footprint's perspective</li><li>dark recess, faint near lip, crisp amber centre</li><li>a brief brightening on arrival (900 ms), then a restrained glow</li><li>dims over the 420 ms lowering</li></ul>It is 5 px inside the ground contour (hidden at rest) and 13 px below the lifted base |
| **B2** | The same contact, 40 px past E, just under the lifted base's edge |
| **C** extension | The line continues past E to 62 px, under the station. The lifted base covers the floor from 52 px, so the end is never seen: the line runs through the open gap and passes beneath the platform |

**Choice: C.** See `endpoint-before-after-1x.png` and `endpoint-closeup-3x.png`.
- **B:** at desktop size the contact reads as a small bright bead ending on open floor, with a visible gap to the hovering station. The energy still appears to stop short, and the socket looks added on.
- **B2:** reads as the line ending just shy of the platform rather than as a socket.
- **C:** the power line passes under the station it feeds: no broken end, no decorative object, nothing new in the room. At rest it is identical to M1.4E.1, apart from the ≤ 2 px end detail noted under "Remaining".
- **Switching to B:** the contact is kept as a tested alternative. One constant switches it on: `PG_ENDPOINT` in `components/lab/SceneV2.tsx`.

## 3. Power sequence (C, measured, `work/captures/checks.json`)

**Power-up:** central A → spark travels → endpoint activates → strips light → Playground rises.

| Time | State |
|---|---|
| 293 ms | Spark half way (x 985) |
| 598 ms | Spark at E. Lift 0, strips unpowered, extension uncharged, no shadow: nothing has started |
| 612 ms | Landing burst at E (0.36); extension charging under the still-grounded base (0.06); strips unpowered; lift 0 |
| 700 ms | Burst at E; strips lighting (unpowered layer 0.70); extension 0.44; lift 0.7 px |
| 850 ms | Lift 9.6 px; the line visible running into the opening gap; extension 0.90 |
| 1000 ms | Lift 17.4 px; extension 1.0 |
| Full lift | Lift 18 px; ambient shadow 0.9 |

**On leave, half way down (147 ms):** lift 9 px; the extension is still charged and is being covered as the base lowers. It dims at 380 ms, as the drain passes E, by which time the station is down.

**Behaviour:**

| Check | Result |
|---|---|
| Interruption | Leaving at 300 ms: at 800 ms and 2000 ms, lift 0, strips unpowered, extension 0. Nothing switches on late |
| Keyboard | 15 Tabs. Focus powers and lifts it; Enter selects it (`/lab-v2?station=playground`); Escape clears the selection, and the focused station stays powered (as before) |
| Deep link | Powered and lifted on load; extension charged |
| Reduced motion | No lift, so the extension stays hidden under the base. The contact's flash is disabled for reduced motion |
| Console | No errors |

## 4. Gap verification (`work/gap-checks.json`; full lift, the floor the lift uncovers, line pixels excluded)

| Check | Result |
|---|---|
| Real floor remains visible | Luminance with shadow ÷ without: 0.46. Fine texture ÷ without: 0.56, so the joints and reflections survive in proportion |
| No black patch | Darkest 1 % of the uncovered floor: 14.6 with shadow, 18.0 without. B's recess never drops below the bare floor (darkest ratio 1.01) |
| Shadow doesn't cover the endpoint | The line's core is equally bright with and without shadows from t = 2 to t = 46, peak ≈ 239. At t = 50 it begins to pass under the base |
| Nothing on the stone face | The endpoint layer against the same page with it hidden, inside the station's silhouette (eroded 1 px): max difference 2.2 at rest and 3.9 lifted (out of 255; edge antialiasing), so nothing is drawn on the stone. The layer is beneath the station in depth order |
| No stretching | Rendered line end, extension and contact are identical at rest and at full lift (`fixed_while_lifting`: all true) |

## Evidence (`docs/m1.4e2/`)

| File | Shows |
|---|---|
| `endpoint-before-after-1x.png` | At normal desktop size (1×), same camera as M1.4E.1. Rows: A (true M1.4E.1 captures), B, B2, C. Columns: rest, spark arriving, fully lifted, returning |
| `endpoint-closeup-3x.png` | The endpoint at 3×. Rows: A (the live page with the endpoint layer hidden), B, B2, C. Columns: rising, fully lifted, lifted with shadows off, returning |
| `playground-lifted.png` | The whole scene at full lift (C); below it, M1.4E.1 vs M1.4E.2 at 2× |
| `connection-arrival.webm` | Real time, 2× close-up of the line and station (9 s). Hover → spark → landing → strips → rise → hold → leave → lower → dim; then the same again |
| `work/` | All captures per variant (`captures/{none,contact,contact-deep,extension,default}/`), `checks.json`, `geometry.json`, `gap-checks.json` and the station silhouettes used for the checks |

## Remaining

- **Faint joint at 3×.** At 3× a faint joint is visible where the line meets its extension at E. The line is drawn through its charge window (a rotated, composited layer) and lands about ⅓ scene px off its exact path; the extension is drawn on the exact path. It is not visible at 1×. Correcting it by hand would depend on the renderer, so it was left.
- **Line end at rest.** At rest the line's end now runs right to the base's edge with a square end, instead of M1.4E.1's round cap. This changes 17 pixels at E by up to 41 levels.
- **Unchanged.** The other stations' lines and the v2 asset differences noted in M1.4E.1 are unchanged.

## Validation

- `npm run typecheck`: pass.
- **ESLint** could not run: its configuration needs migrating, which is pre-existing and not touched here.
- **Targeted browser checks:** `scripts/visual/m14e2-capture.mjs` (variants, phases, timing, interruption, keyboard, deep link, reduced motion, homepage probe).
- **Homepage untouched:** `/` requests nothing from `/scene/v2/`, has no endpoint layer and no v2 lines.
- **Not run:** full visual suite, production build.
- **Server:** captures used the `next dev --port 3002` server already running on this machine (not started by this milestone; left running). `tsconfig.json` is unchanged.

## Files

**New**
- `scripts/m14e2-geometry.py`: the diagnosis
- `scripts/m14e2-sheets.py`: sheets and pixel checks
- `scripts/visual/m14e2-capture.mjs`
- `docs/m1.4e2/**`

**Changed**
- `components/lab/SceneV2.tsx`: `PlaygroundEndpoint` (extension and the optional contact, their charge CSS) inside Playground's ground layer.
- `components/lab/ChargeLine.tsx`: `PG_LINE` exported; Playground's v2 line drawn with butt ends, so the extension continues it.
- `scripts/visual/record.mjs`: optional `crop` (a scaled close-up region); existing callers are unchanged.
