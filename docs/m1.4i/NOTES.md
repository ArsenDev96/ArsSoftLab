# M1.4I: Full laboratory integration review (`/lab-v2`)

**Recommendation: CONDITIONAL GO for production consideration.** No P0 was found. Five P1 items should be fixed or decided first. This is a reviewer's recommendation; **production approval is the owner's decision.**

Review only: no app file, asset, style or animation was changed, and no defect was fixed. Nothing was committed or pushed.

| Read next | |
|---|---|
| `defects.md` | All findings, with reproduction, evidence and a minimal correction |
| `performance.md` | Measurements |
| `full-scene-idle-default.png`, `full-scene-idle-tone.png` | Idle, both floors |
| `all-stations-powered.png` | Each station powered on its own |
| `station-switching.webm` | Switching (stepped, see section 11) |
| `connection-closeups.png` | Connections at 3×, six moments each (`connection-ends.png` and `connection-starts.png` are closer) |
| `viewport-comparison.png` | Four sizes |

Branch `feat/lab-v2`, HEAD `a5c0fc4`, with the uncommitted M1.4H.2–H.4.1 work in place.

## 1. Baseline
- All five stations are wired once: no duplicate ids, hotspots or sparks. Arrival times are as approved (460 / 620 / 650 / 640 / 660 ms).
- The M1.4H.4.1 floor disc is in use by all three of Experience's floor layers.
- `/` requests no v2 file. No console errors, failed requests or layout shift on load.

## 2. Idle composition
**Good.** Stations sit on the floor, the light direction is consistent and nothing floats or is duplicated. Labels cover no important artwork at 1648 × 928.

Small remains, all P2: unlit strips as grey bands (P2-7), faint patches around the hub (P2-8) and cutout edges at the bottom left (P2-9).

### Floor tone: recommend `?floor=approved` as the default
Same viewport, same state. The default was **not** changed.

| Mean RGB (luminance) | Default | `?floor=approved` | Homepage |
|---|---|---|---|
| Centre floor | 76, 81, 93 (80.7) | 71, 71, 78 (71.4) | 69, 71, 81 (71.2) |
| Left floor | 86, 90, 98 (89.4) | 82, 81, 85 (81.4) | 69, 57, 52 (59.4) |
| Right floor | 119, 103, 103 (106.4) | 110, 90, 87 (94.1) | 73, 63, 65 (65.3) |
| Back floor | 40, 37, 36 (37.9) | 40, 36, 34 (36.8) | 41, 54, 61 (51.8) |

- The tone removes most of the blue cast, brings the centre to the homepage's brightness and lets the warm reflections and lines read more clearly.
- It is closer to the homepage in three of these four areas. The back floor is already darker and barely changes (−1.1).
- It leaves no visible edge or patch. All five stations power correctly on it (`work/tone-powered.png`).
- Cost: one mask file, about 15% fewer frames on Playground on this GPU, nothing measurable elsewhere.

## 3. The five activations
Real time, GPU, two runs each.

| | First change at the station | Fully powered | At rest after leaving | Others changed | Returned = idle |
|---|---|---|---|---|---|
| Engineering | after arrival (620) | 1243–1351 ms | 526 ms | 0 frames | identical |
| Educational | 466–499 ms (460) | 1216–1249 | 402–408 | 0 | identical |
| Playground | 664–699 (650) | 1158–1180 | 505–529 | 0 | identical |
| Creative Studio | 647–657 (640) | 1414–1424 | 413–484 | 0 | identical |
| Experience | 680–694 (660) | 1720–1744 | 525–570 | 0 | identical |

The spark appears only on its own line. "Identical" means a pixel difference of 0 for all five. Engineering's caps become technically visible at 0 ms with nothing drawn; nothing shows before arrival on a normal hover.

## 4. Switching
73 scenarios: every ordered pair, mid-sequence, sweeps and quick returns. **Nothing got stuck, no errors, and every station that should power did.** The previous station is at rest within 0.5–0.65 s, and no frame shows two stations lit once the second spark has arrived.

15 scenarios were flagged. They come down to two real defects and intended overlaps:
- **P1-2:** Engineering's quick return.
- **P2-1:** Creative Studio's quick return.
- Intended: release fades of several sparks in fast sweeps, a 100 ms fade of Engineering's scan, and strips holding their level on a quick return.

## 5. Connections
**Geometry is correct; no new geometry defect.** Lines meet their stations at rest, charging, powered and returning. Sparks travel from hub to station. Playground stays connected throughout its 18 px lift.

Style and edges only: P2-5 (powered line style differs) and P2-6 (end caps).

## 6. Performance
See `performance.md`. The frame rate here is limited by the GPU: 12 plain full-screen layers already run at 12 fps. The app's own share is the page weight (P1-3) and decoding on the first hover (P2-4). No leak over 240 switches.

## 7. Interaction and accessibility

| Check | Result |
|---|---|
| Tab order | 21 stops, all visible, all with a 2 px outline, no trap |
| Focus powers the station; Enter selects; focus moves to the panel title | 5 of 5 |
| Escape or "Back to Lab" | Closes and returns focus to the station's title |
| Escape after tabbing out of the panel | Closes; focus stays where it was |
| Project chips, live announcement, `aria-expanded`, `aria-pressed` | Correct |
| Click during charging, second click, click on another station, browser Back | Correct |
| Direct links: 5 stations, 5 with a project, 4 invalid or mixed | Correct; invalid values are dropped or ignored, and no spark plays |
| Reduced motion | No spark, no one-shot light, no lift; stations fade to powered and return |
| Platform to own label | Playground, Creative Studio and Experience can restart (P2-3, inherited) |
| Target size | Titles 20–22 px (P2-11, inherited) |
| Playground's marquee | Not interactive (P1-4) |
| "Let's Talk" | Target missing (P1-5, inherited) |

Creative Studio → Experience was read at 1.6 s, before Experience's normal 1.7 s; its state was correct in all other runs.

## 8. Browsers and viewports

| | Result |
|---|---|
| 1280 × 800, 1648 × 928, 1920 × 1080, 2560 × 1080 | No scrollbars, no clipped or overlapping labels, all panels inside, lift 18 px, correct hover |
| Crop | 84 scene px at each side at 1280 × 800; 118 px at top and bottom at 2560 × 1080. Same as the homepage |
| Edge 158 | All five power and return; sparks on the right lines; no errors |
| Firefox 144 | All five power and return; deep link works; no errors. Looks the same except fainter chip borders |
| Safari, touch, mobile | Not tested (unavailable or out of scope) |

## 9. Production isolation
- `/` loads no v2 asset and has no tone elements, even with `?floor=approved`.
- `/` ↔ `/lab-v2` works by full load, Back, Forward and client navigation.
- **Client navigation from a page without the lab leaves the scene invisible (P1-1).** No link in today's app does that.
- On `/lab-v2`, the logo and "Lab" lead to `/`. Expected while v2 is separate; to be settled at rollout.

## 10. Findings and recommendation
- **P0:** none.
- **P1:** scene invisible after client-side navigation; Engineering's quick return; page weight and GPU memory; Playground's marquee; "Let's Talk".
- **P2:** twelve, in `defects.md`.

**CONDITIONAL GO.** Suggested conditions:
1. Fix P1-1, P1-2 and P1-4. Each is small and changes no approved look.
2. Decide P1-3: crop the layers first, or accept the weight.
3. Supply the target for P1-5.
4. Decide the floor default (recommended: approved tone), P2-2, P2-5 and P2-7.
5. Before release, measure a production build on current hardware.

## 11. How this was checked, and its limits
- **Video:** this GPU cannot record smoothly, so `station-switching.webm` steps the real page's own animations 1/30 s at a time (501 frames, 17.9 s). Its smoothness is not a performance result. All timings above are from real-time runs.
- **Corrections during the review:** an early run with competing browsers was discarded. A hang at 2560 × 1080 was traced to the probe (large PNG replies never arrive through Node's WebSocket), not to the page. Two probes that started their frame logger repeatedly were rerun.
- **Edge:** one check sampled two sparks at the wrong moment; the per-frame rerun saw all five.
- **Validation:** `npm run typecheck` passes. 350 app files have the same checksums as at the start (`work/baseline.md5`). The full visual suite and a production build were not run, as instructed; no finding required them.
- Images and video are ignored by Git. Probes and data are in `work/`; the probes are untracked, like the rest of this folder.
