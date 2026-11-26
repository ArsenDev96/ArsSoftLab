# M1.4K.4: Lightweight laboratory prototype

> Expanded to all five stations in M1.4K.5A (`lightweight-mode-five-stations.md`), approved. This report keeps the prototype's measurements.

## Result: **lite mode gives a substantial gain on hover and switching. Recommendation: EXPAND** (conditions below)

- **Engineering and Playground in lite mode respond about 4× sooner.** A hover powers the station in 185–260 ms, against 770–1040 ms in full mode. The hover runs at 28–37 fps instead of 10–12, and compositor work per hover falls by about half.
- **Switching between the two works in lite mode.** Every 900 ms visit powered its station (191–268 ms). In full mode, two of the four visits never powered at all.
- **Full mode is unchanged.** Its DOM and every inline stylesheet are byte-identical to before, and its captures match the baseline pixel for pixel (0 differing pixels).
- **At rest, lite mode looks the same as full mode.** Hovered, it matches the approved reduced-motion appearance. What it gives up is the cinematic sequence itself.
- **Not improved:** the camera move after a click (6–8 fps in both modes), and the 150–200 ms frames that any state change still costs under software compositing.

Office computer (Radeon HD 5450, driver blocklisted, so Chrome composites in software). Chrome with default settings, no GPU flags, headless, 1648 × 928, against the dev server. Two rounds per mode, alternating. Scripts, data and captures are in `work/`.

## 1. Implementation

`/lab-v2?render=lite` turns lite mode on. Without the parameter, or with `?render=full`, you get full mode. There is no detection, no stored setting and no visible toggle. `render` is an ordinary query parameter, so selections, Back and Forward and deep links keep it, and it combines with `station`, `project` and `floor`.

Lite mode is not a second implementation. It is the same components with one `lite` flag. Each lite station answers **as it already does under reduced motion**, whatever the user's preference: it powers on at once with a 150 ms cross-fade, and nothing travels or lifts. The existing reduced-motion CSS is reused, applied without its media query. On top of that, the layers only the sequence draws are not mounted:

| | Lite mode does | Reused from |
|---|---|---|
| Pulse | No spark is fired for Engineering or Playground, and their spark layers are not mounted. No arrival to wait for: `--arrive-now` is 0 | `EnergySurge` reduced-motion branch |
| Connection | Powered at once while the station is hovered | `ACTIVATION_CSS` reduced-motion rules |
| Engineering | Strips, display, chart and floor light cross-fade to powered in 150 ms; no lift. **Not mounted:** strip pulses, scan shade and band, the display's rising bars, the bar caps, the shimmer, and the lift's soft shadow | `ENG_CSS` and `ENG_LIFT_CSS` reduced-motion rules, plus `powerCss` and `globals.css` rules for its strips |
| Playground | Strips, ring and reflection cross-fade in 150 ms; no lift; the game shows one still frame (no animation loop). **Not mounted:** the lift's ambient shadow | `globals.css` reduced-motion rules (lift transform, `--lp`); `ArcadeScreen`'s still frame |
| Labels and targets | Engineering's and Playground's labels and hotspots stay at their rest outline | `LabStations` `stillLabels`; the hotspot's own rest shape |
| Educational, Creative Studio, Experience | **Unchanged** (full behaviour, spark included) | — |

The DOM under `<main>` goes from 917 to 831 elements in lite mode.

**Bug found and fixed while measuring.** At first, Engineering's hotspot still moved to its raised outline over 600 ms in lite mode, so the pointer target sat 12 px above a platform that no longer lifts. Its clip-path transition also kept the Engineering area redrawing for about 900 ms. Lite mode now gives it the rest outline only, as it does for Playground. All results below are after the fix.

### Files changed

Application:

| File | Change |
|---|---|
| `app/lab-v2/page.tsx` | Reads `render=lite` and passes `lite` to `LabScene` |
| `components/lab/LabScene.tsx` | `lite` prop. In lite mode: `data-lab-render="lite"` on the stage, rest-only hotspots for both stations, both labels still, `EnergySurge` `skip` |
| `components/lab/SceneV2.tsx` | `lite` prop. `PG_LITE_CSS` (Playground's reduced-motion rules, scoped to it). Passes `lite` to `EngineeringV2`, `EngineeringGround`, `PlaygroundGround` and `ArcadeScreen` (`still`) |
| `components/lab/EngineeringV2.tsx` | Reduced-motion rules extracted as `ENG_REDUCED_CSS` (same output). `ENG_LITE_CSS`. `lite` prop: the sequence-only layers are not mounted |
| `components/lab/EngineeringLift.tsx` | Reduced-motion rule extracted as `ENG_LIFT_REDUCED_CSS` (same output). `EngineeringGround` `lite`: soft lift shadow not mounted |
| `components/lab/EnergySurge.tsx` | Connection rules extracted as `poweredLine` and `hoverPoweredLineCss` (same `ACTIVATION_CSS`). `skip` prop: no pulse, no spark layers, and the station answers at once with its connection powered |
| `components/lab/ArcadeScreen.tsx` | `still` prop: the existing reduced-motion still frame |

**Unchanged:** all artwork, `app/globals.css`, the homepage `/`, `LabStations`, `ProjectStation`, project data, floor tone and station positions. The diff is 208 insertions and 114 deletions; most of it re-indents layers that are now conditional.

Probes, in `work/`: `lite-capture.mjs`, `lite-perf.mjs`, `lite-interact.mjs`, `lite-anim.mjs`, `lite-switch-anims.mjs` and `lite-frames.mjs` are new. `eng-capture.mjs` gained a `QUERY` option.

## 2. Full mode unchanged

| Check | Result |
|---|---|
| `<main>` DOM and all inline stylesheets, `/lab-v2` and `?render=full`, against a baseline taken before any edit | **Byte-identical** (`captures/lite/before`, `after-default`, `after-full`) |
| Pixels: rest, Engineering hovered, Playground hovered (frozen 2.4 s after arrival) | **0 differing pixels**, both URLs |
| Pixels: Engineering's sequence at rest, half lift, mid-chart, full lift and stable, against M1.4K.3's reference | **0 differing pixels** (`results/compare-k4-full-eng-states.json`) |

## 3. Performance, full against lite

Default Chrome, software compositing. Each cell is the range over 2 rounds. Hover scenarios have 3 hovers per round (first and two repeats), each recorded over 1.65 s.

| | Engineering hover, full | Engineering hover, **lite** | Playground hover, full | Playground hover, **lite** |
|---|---|---|---|---|
| Frame rate in the 1.65 s window | 9.9–11.9 fps | **33.6–37.0 fps** | 10.3–11.5 fps | **28.2–33.6 fps** |
| Median / longest frame | 67–83 / 183–367 ms | **17 / 167 ms** | 50–83 / 200–383 ms | **17 / 183–217 ms** |
| Frames > 50 ms / > 100 ms | 9–13 / 5–7 | **5–6 / 4–5** | 7–11 / 4–6 | **5 / 5** |
| Hover registered | 19–36 ms | 18–32 ms | 18–37 ms | 16–43 ms |
| Station's strips half lit | 769–836 ms | **185–229 ms** | 941–1037 ms | **217–260 ms** |
| Strips fully lit | 1029–1136 ms | **210–349 ms** | 961–1141 ms | **217–260 ms** |
| Compositor busy, one traced hover (viz thread) | 1589–1599 ms | **796–821 ms** | 1558–1569 ms | **827–844 ms** |
| Once settled (hovered, after 2.5 s) | 57 fps; shimmer keeps running | **60 fps, nothing running** | 29 fps; the game loop runs | **60 fps, nothing running** |

| Switching E → P → E → P, 900 ms each | Full | **Lite** |
|---|---|---|
| Frame rate / median frame | 8.5–9.6 fps / 67–100 ms | **18.3–19.3 fps / 17 ms** |
| Longest frame; frames > 100 ms | 333–350 ms; 15–17 | **200 ms; 19** |
| Station powered (half) during its own visit | Visits 1 and 4 only: 792–833 and 1327–1460 ms. **Visits 2 and 3 never powered** | **All 4: 191–268 ms** |
| Compositor busy over the run (≈4.3 s) | 4205–4219 ms | **3294–3499 ms** |
| End state | Playground lit, Engineering off | the same |

| Project chips | Full | Lite |
|---|---|---|
| Hover, then click the first chip of Engineering (SQLOrbit) and Playground (AZIZ) | 4/4 selected, 3–46 ms; Playground's chip had risen 19.5 px under the hover | 4/4 selected, 3–42 ms; the chip stays put (0 px) |
| Frames during the camera move after the click | 6.2–7.0 fps | 6.4–8.4 fps (**no material change**) |
| Escape back | `?render=full`, 0 errors | `?render=lite`, 0 errors |

What the numbers mean in use:
- **Hover response is about 4× faster.** In full mode, the first thing that moves is the spark, and the station answers after about 0.8–1.0 s. In lite mode the station is lit after one or two frames.
- **Lite mode goes idle; full mode does not.** After a lite hover, the page renders at 60 fps with no animation running. In full mode it keeps compositing while hovered (Playground's game, Engineering's shimmer).
- **Switching works.** Full mode is fluid when moving between stations no faster than its own sequence (about 1 s per station). Lite mode keeps up.

**What lite mode does not fix: each state change still costs about 3–5 frames of 150–200 ms.**
- **Cause.** Software compositing redraws every full-frame layer the change touches. Playground's ring and reflection lights are 1649 × 928, and so are Engineering's display overlay and chart. The 150 ms cross-fades all end within 500 ms of a hover, and the last slow frames come about 450 ms after that.
- **The floor.** With every transition forced to 0 ms (a measurement-only CSS injection), a hover still costs 3–4 such frames. So the short cross-fades cost one or two frames, and removing them isn't worth the extra code.
- **The camera move after a click is a whole-stage transform.** It recomposites everything in either mode.

## 4. Visual differences

The comparison sheets are `work/captures/lite/sheet-engineering.png` and `sheet-playground.png`: full rest, lite rest, full hovered and lite hovered, side by side.

| State | Lite against full | Lite against full under reduced motion |
|---|---|---|
| Rest | Largest difference 9/255; 43 px over 2/255, all in Engineering's chart hologram | the same chart pixels |
| Engineering hovered | No 12 px lift, no scan, no rising bars, no shimmer, no spark; strips, display, chart, floor light and connection powered | **Largest difference 4/255, 3 px over 2/255:** the approved reduced-motion look |
| Playground hovered | No 18 px lift (label included), no spark, the game shows a still frame; strips, ring, reflection and connection lit | the same, except the Engineering chart pixels above |

**Cause of the rest difference:** the chart's standby is drawn without its mask, as under reduced motion, and the sequence-only layers are absent. A masked layer resamples sharp edges slightly differently, as `EngineeringV2.tsx` notes. Nothing is misplaced, broken or disconnected:
- connections meet their stations;
- floor light and reflections follow the strips;
- labels and chips are unchanged and readable.

**The visual compromise is acceptable for a fallback.** At rest the laboratory looks the same. Hovered, lite mode shows the appearance already approved for reduced motion. What it gives up is the cinematic sequence: the spark, the lifts, the screen and chart sequence, and the live game.

## 5. Interaction results (`results/lite-interact.json`: all PASS)

| Check | Result |
|---|---|
| **Keyboard, both modes.** Real Tab order to each title: the station lights. Enter selects it, Tab and Enter on its first chip select the project, Escape returns | PASS. In lite mode the station is fully powered 500 ms after focus; full mode is still waiting for the spark. The URL keeps `render`. After Escape, focus lands in the same place in both modes |
| **Deep links.** `?station=engineering&render=lite`, `?station=playground&project=aziz&render=lite`, `?render=lite&station=engineering&project=sqlorbit` (rewritten to the canonical order), `?floor=approved&render=lite` (tone present) | PASS. Each renders in its state, powered and not lifted, with no errors |
| **Reduced motion with lite mode** | PASS. Both stations power on hover; nothing lifts |
| **The other three stations in lite mode** | PASS. Educational, Creative Studio and Experience still fire the pulse; Engineering and Playground fire none |
| **Navigation and chips** | 4/4 per mode (§3). The URL returns to `?render=<mode>` |
| **Console** | No errors in any run |

## 6. Remaining limitations

1. **Each state change still costs 3–5 frames of 150–200 ms here.** That is the floor for this scene under software compositing. Going lower means changing fewer full-frame layers per state change, which means re-exporting or re-cropping artwork. That changes pixels and needs your re-approval (M1.4K.3 found no pixel-equivalent crop).
2. **The camera move after selecting a station or project is not improved** (6–8 fps). Lite mode could also skip it, as reduced motion does. That changes navigation presentation, so it is your call.
3. **Educational, Creative Studio and Experience are unchanged in lite mode.** Hovering them still sends the spark and runs their full sequence and lift, so a lite page is only partly light.
4. **Lite mode is opt-in through the URL only.** There is no toggle, no stored setting and no detection, as the brief required. Real users can't reach it yet. In-lab navigation keeps it; leaving `/lab-v2` drops it.
5. **Measured only on the office computer.** Full mode can't be affected on the RTX 4060: it is byte-identical by construction and verification. Lite mode has not been measured there.
6. **Full mode's open defects are untouched.** In lite mode, M1.4K's D1 can't occur: there is no spark to arrive early. D2 doesn't occur either: the AZIZ chip doesn't move.

## 7. Recommendation: **EXPAND**

The prototype meets the decision criteria.

- **Substantial improvement:** yes. Hover frame rate is about 3× (28–37 against 10–12 fps). The station responds about 4× sooner (185–260 ms against 770–1040 ms). Compositor work per hover is about half. Switching works in lite mode and breaks down in full. The scene is idle once it has settled. None of these gains is within measurement noise.
- **Perceived responsiveness:** better. The station answers on the next frame or two instead of after a 0.8–1 s wait, and switching no longer leaves stations dark.
- **Visual compromise:** acceptable for a fallback. At rest the laboratory looks the same, and hovered it is the already-approved reduced-motion appearance.
- **A complete five-station lite mode:** justified. The mechanism is in place and each remaining station already has its reduced-motion rules. Expanding means listing the station in `LITE_STATIONS`, adding its reduced-motion rules as `lite` CSS, and not mounting its sequence-only layers. It would also make a lite page fully free of the spark.

Conditions and next steps:
1. **Expand to Educational, Creative Studio and Experience** behind the same parameter, with the same checks: full mode byte- and pixel-identical, and lite captures and interactions as in §2–§5.
2. **Your decisions:** whether lite mode skips the selection camera move (limitation 2), and how users get to lite mode (a visible toggle, or detection). Neither is in this prototype.
3. **On the RTX 4060:** confirm full mode is unchanged (`node work/lite-capture.mjs` and `compare.py`), and measure lite mode there once (`node work/lite-perf.mjs`).

## Files

- **Report:** this file.
- **Data:**
  - `work/results/lite-perf.json`, the final run; an earlier run, before the hotspot fix, was overwritten.
  - `work/results/lite-interact.json`, `lite-anim.json`, `lite-switch-anims-lite.json` and `lite-switch-anims-lite-idle.json`.
  - Pixel comparisons: `compare-lite-full-default.json`, `compare-lite-full-renderfull.json`, `compare-lite-vs-full.json`, `compare-lite-vs-full-reduced.json`, `compare-full-vs-full-reduced.json` and `compare-k4-full-eng-states.json`.
- **Captures:** `work/captures/lite/` (`before`, `after-default`, `after-full`, `full-reduced`, `lite`, and the two comparison sheets) and `work/captures/k4-full-after/`.
  - The PNGs (about 34 MB) are **ignored by Git** (`docs/**/*.png`).
  - The DOM and stylesheet snapshots (`dom.html`, `styles.txt`) were not kept; `lite-capture.mjs` writes them again on every run.
