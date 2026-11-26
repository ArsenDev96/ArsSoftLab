# M1.4K.6: RTX 4060 verification (home)

> **Later status (2026-11-26):** D1 fixed (M1.4K.7); arcade-screen lighting fixed (M1.4K.9); D2 accepted as P3; the warmer floor tone made Cinematic's default with Lite unchanged (M1.4K.10). See `NOTES.md`.

## Result

**Cinematic and Lite both pass on the RTX 4060. No new defect.** Of the three open Playground issues, only **D1** reproduces here, and in a milder form than at the office. **D1′ and D2 do not reproduce.** The selector's delay is development-server overhead: a production build switches in 31–49 ms.

| | Result on the RTX 4060 |
|---|---|
| Cinematic default, five animations and lifts | PASS: heights 12.2 / 10.1 / 18.0 / 10.1 / 10.1 px, as approved; nothing before its spark |
| Lite | PASS: no sparks (0 fired), no lift (0 px), no camera move |
| Selector, URL, Back / Forward | PASS, 14 of 14 and 6 of 6 steps |
| Project chips | PASS: 76 of 76 clicks selected the project |
| Console errors | **0** in every run |
| Approved Cinematic appearance | Unchanged against `249d01e` in all six states (to capture noise) |
| Performance | 60 fps on every repeat activation and on switching; one long frame on each station's first use, in **both** modes |
| D1 | **Reproduces** (held light, not rising light) |
| D1′ | **Does not reproduce** (0 of 28) |
| D2 | **Does not reproduce** (54 of 54) |
| Selector delay | Dev server 115–396 ms; **production 31–49 ms** |
| Floor tone | Recommend `?floor=approved` as the Cinematic default, after one check (section 6) |

Verification only: **no application code, artwork or animation was changed, nothing was committed.** `git diff --stat HEAD -- app components data lib public scripts` is empty at the end.

## 1. Hardware and browser

| | |
|---|---|
| Computer | Intel Core i5-12400, 16 GB, Windows 11 Pro (build 26300) |
| GPU | NVIDIA GeForce RTX 4060, 8 GB, driver 32.0.16.1088 (NVIDIA 610.88) |
| Display | 1920 × 1080, 60 Hz |
| Browser | Chrome 158.0.8127.88, default flags, 1648 × 928, device scale 1 |
| Server | `next dev` on :3002 (Next 16.4.6, Turbopack), Node 22.22.3. Production check: `next build` + `next start` on :3005 |
| Branch | `feat/lab-v2` at `f233593`, working tree clean |

**Hardware acceleration.** Chrome's **default** settings use the RTX 4060 here: GPU compositing and rasterization enabled, ANGLE Direct3D 11, Skia Graphite (`docs/performance/work/results/gpu-info-home.json`). Headless and headed Chrome make the same choice. So the probes, which run headless with no GPU flags, measure what a normal visitor on this computer gets. This differs from the office, where the Radeon HD 5450 is blocklisted and Chrome composites in software.

**Method.** The probes drive Chrome through DevTools (`scripts/visual/cdp.mjs`) and read frame times and computed styles. Smoothness is judged from frame times. The appearance was checked on captures, not by watching a window.

## 2. Cinematic and Lite

### Cinematic (`k1-stations.mjs 2`)

Two runs per station:

| Station | Lift (approved) | First movement / half / full after the arrival | Down to the floor | Frames in 800 ms, first → second visit |
|---|---|---|---|---|
| Engineering | 12.2 (12) | 80 / 247 / 664 ms | 417 ms | 41 → 48 |
| Educational | 10.1 (10) | 107 / 290 / 757 | 417 | 48 → 48 |
| Playground | 18.0 (18) | 17 / 200 / 450 | 450 | 31 → 48 |
| Creative Studio | 10.1 (10) | 110 / 293 / 760 | 433 | 48 → 48 |
| Experience | 10.1 (10) | 107 / 307 / 790 | 417 | 48 → 48 |

These match the home baseline in `RESUME.md` exactly. In every run:

- nothing moves or lights before the arrival;
- every layer moves together (spread 0), with no overshoot;
- one spark per visit, and no other station moves, lights or sparks;
- 0 of 18 floor parts move;
- at rest afterwards, no residual.

### Lite and the chips (`lite5-check.mjs`)

| | Lite | Cinematic |
|---|---|---|
| Activation, all five | Powered at 400 ms, **0 px** lift | (covered above) |
| Sparks fired | **0** | 40 |
| Camera on a chip click | **Stays** (`transform: none`) | Moves |
| Chip clicks, all five stations | 5 of 5 selected | 5 of 5 selected |
| Switching through all five, 500 ms each | Only the last one lit | |

The Lite scene was also watched through E→P→E→P switching and chip clicks in `lite-perf` (section 3).

### Selector, URL and history (`selector-check.mjs`, `selector-a11y.mjs`)

**All 14 interaction steps and all 6 accessibility steps pass, the same as at the office:**

- Cinematic is the default, with no `render` in the URL.
- Lite adds `render=lite` without a reload and keeps `station`, `project` and `floor`, the selection and the floor tone.
- Cinematic removes only `render`.
- Back and Forward follow the mode, including the lab's own entries.
- Keyboard: Tab reaches the selector in 7 stops with the 2 px amber ring, and the arrow keys switch the mode with focus kept.
- Reduced motion has no transitions.
- The accessibility tree names are correct.

### Chips and console

| Run | Chip clicks | Result |
|---|---|---|
| `lite5-check` | 10 | 10 of 10 |
| `lite-perf` (both floors) | 12 | 12 of 12; selected 2–7 ms after the click |
| `k6-pg-live` (D2) | 54 | 54 of 54 |

That is **76 of 76** clicks.

**Console errors: 0** in every probe that records them: the selector, Lite check, performance (both floors), mode switch (dev and production), `k1`, D1, D1′ and D2 runs. The capture runs do not record console output.

## 3. Performance at 1648 × 928

`lite-perf.mjs 2`: two fresh pages per mode, each with three Engineering visits, then three Playground visits, then the E→P→E→P switch. Windows are 1650 ms from the hover. "Powered" is the strips at half and full strength, measured from the hover; in Cinematic this includes the spark's 620–650 ms travel.

### Cinematic

| | fps | p95 frame | Worst frame | Frames > 50 ms | Powered, half / full |
|---|---|---|---|---|---|
| **Engineering, first** | 51.6–52.1 | 17.0 ms | **117–150 ms** | 2–3 | 720–737 / 1003 ms |
| **Engineering, repeated** | **60** | 16.9 | 17.3 | 0 | 724–746 / 990–1013 |
| **Playground, first** | 49.7–50.3 | 16.9 | **150–166 ms** | 2 | 880–896 / 929–1047 |
| **Playground, repeated** | **60** | 17.0 | 17.1 | 0 | 752–779 / 919–946 |
| **Switching E→P→E→P, 900 ms each** | **60** | 16.8 | 17.0 | 0 | each station half-powered 732–784 ms after its move; the right station lit at the end |

### Lite

| | fps | p95 frame | Worst frame | Frames > 50 ms | Powered, half / full |
|---|---|---|---|---|---|
| Engineering, first | 52.2–54.6 | 17.0 | **166–233 ms** | 1 | 214–280 / 214–280 |
| Engineering, repeated | 60 | 17.0 | 17.1 | 0 | 80–99 / 180–200 |
| Playground, first | 54.6 | 16.8 | **166 ms** | 1 | 201–207 / 201–207 |
| Playground, repeated | 59.4–60 | 17.0 | 33 | 0 | 79–82 / 179–182 |
| Switching E→P→E→P | 59.1–59.5 | 17.0 | 33 | 0 | 67–83 ms each |

### One Cinematic ↔ Lite switch (`mode-switch.mjs`, mouse on the selector)

Frames run from the click to 1.5 s after the scene changed. The first switch after load is listed first.

| Server | Radio shows the choice | Scene in the new mode | fps | Worst frame |
|---|---|---|---|---|
| Dev | 12–15 ms | to Lite **296**, 115, 115 ms; to Cinematic 149, 180, 162 ms | 57.6–60 | 67 ms (1 frame > 50 ms in 6 switches) |
| **Production** | 1–15 ms | to Lite **49**, 32, 31 ms; to Cinematic 31, 48, 34 ms | 59.3–60 | 33 ms |

### What it means

- **After the first visit, everything runs at the display's 60 fps.** That covers repeated activations, switching between stations, chip clicks and mode switches, in both modes. The hover registers in 18–33 ms.
- **Each station's first activation on a page has one long frame**: Engineering 117–150 ms, Playground 150–166 ms.
  - **The lifts do not cause it.** Lite, which has no lifts and no sparks, has the same frame, and a longer one (166–233 ms).
  - It is first-use GPU upload of the station's lit layers (`docs/performance/animation-lag-diagnosis.md`, cause 4). It is visible as one hitch on the first hover only.
  - Engineering's comes as its spark starts. Playground's comes as its spark lands, when the lift and the ring start.
- **Compared with the office**, where software compositing gives 9–11 fps, the RTX 4060 runs Cinematic at full rate. Lite matters for blocklisted or weak GPUs, not for this class of machine.
- **The release criterion in `NOTES.md` is met:**
  - no lift adds a long frame beyond the known first-visit frame;
  - from the second visit, frames in the 800 ms after the arrival are 48 for all five stations.

## 4. Playground defects

### D1: ring and strip lit before the new spark on a quick return. **Reproduces.**

`repro-pg-lights.mjs 2` (Creative Studio as control) and `k5-spark.mjs home 1 playground`.

| | Runs | Light while the new spark travels | ≥ 90 % more than 18 ms early |
|---|---|---|---|
| **Playground** (`repro-pg-lights`) | 16 | **0–0.92, median 0.59** at the arrival | **3 of 16** (office: 7 of 13) |
| Creative Studio (control) | 16 | **0 in 16 of 16**; lights 160 ms after the arrival | 0 |
| **Playground** (`k5-spark`, 28 timings) | 28 | **≥ 0.5 in 12 of 28**; up to 1.0 | 8 of 28 |

**How it differs from the office.** Here the ring and strip **hold** the level they had when the pointer left, through the whole ~650 ms flight of the new spark. They do not climb during it: in 28 of 28 runs, the level before the arrival equals the level at the drop.

| Pointer leaves after the arrival | Light held through the flight |
|---|---|
| 0 ms | 0 |
| 20 ms | 0.15–0.30 |
| 40 ms | 0.46 |
| 80 ms | 0.59–0.69 |
| 150 ms | 0.91–0.95 |
| 300 ms | 1.0 |

At the office they rose to full strength during the flight. The other four stations drop to 0 and relight after their spark.

**Visible result:** on a quick return, Playground stays lit while a new spark is still on its way. It does not wait for the spark like the other four. The cause in `defects.md` (a plain CSS opacity transition with a 160 ms leave delay) explains the hold, and does not depend on the GPU.

**Class: P2 stands.** The probe's analyser flags 0 of 28 runs because it flags *rises*, not held light (office: 20 of 28). The inconsistency with the other four stations is still there.

### D1′: lift restarting before the new spark. **Does not reproduce.**

`k5-spark.mjs home 1 playground`, 28 runs: the leave lands from 60 ms before to 300 ms after the arrival, with four return gaps.

- **The lift rose before the new spark in 0 of 28 runs.** It holds the height it had at the drop (0–15.9 px) and climbs only after the arrival. It ends at 18.0 px every time.
- The new spark starts **16.4–17.0 ms** after the return, one frame. At the office it started 100–200 ms late.

This confirms the office attribution: D1′ comes from the office GPU's late spark clock. **It does not join D1.** It stays a slow-GPU timing note, not a release condition.

### D2: AZIZ chip sliding from under the pointer while Playground sinks. **Does not reproduce.**

`k6-pg-live.mjs 3`: three moments in the descent × three press delays × left end and centre.

| Moment in the descent | Opened | Height when the pointer arrives | Chip moved under the pointer |
|---|---|---|---|
| 120 ms | **18 of 18** (office: 11 of 18) | 12.4–14.2 px (office: 17.3–18.0) | ≤ 4.0 px (office: up to 13.8) |
| 260 ms | 18 of 18 | 1.8–2.9 px | ≤ 1.5 px |
| 360 ms | 18 of 18 | 0.2–0.5 px | ≤ 0.3 px |

**54 of 54 clicks opened AZIZ**, including the pill's left end, and the chip was under the pointer at every press.

At the office, a late frame meant that 120 ms into the descent Playground had **not yet started** sinking. So the whole 14 px of travel happened after the pointer arrived. Here the platform is already most of the way down, and the remaining ≤ 4 px stays inside the pill.

**Class: P3, slow GPUs only.** The mechanism still exists (the lift waits for the new spark, so the chip keeps sinking), but it needs late frames to matter. **Recommended: accept.**

## 5. Selector latency

| | Office, dev (M1.4K.5B) | **Home, dev** | **Home, production** |
|---|---|---|---|
| First switch after load | 1.1–1.9 s | 296–396 ms | 49 ms |
| Warm switch (arrow keys) | 654–913 ms | 131–301 ms | **33–43 ms** |
| Radio shows the choice | at once | 12–15 ms | 1–15 ms |

- **The 0.65–1.9 s delay does not appear at home.** The dev server takes 115–396 ms here.
- **In production a switch takes 2–3 frames.** The delay is development-server overhead (on-demand compilation and the dev render of the soft navigation), not the application.
- **Not a release issue.** The control already updates at once, so no change is needed.
- Production was built from a clean export of `f233593` in a temporary folder. The build, including TypeScript, passed. The repository's `.next` was not touched.

## 6. Visual comparison and floor tone

### The approved Cinematic appearance is unchanged

**Method:**

1. Six frozen states (rest, and each station 2.4 s after its arrival) were captured with `lite-capture.mjs`.
2. The approved build, `249d01e` ("complete five lifts", before Lite and the selector), was captured from a temporary export on :3004, twice.
3. HEAD was captured from :3002, twice.
4. Each pair was diffed over the scene below the header, with `capture-compare.py`. The header differs by design, because the selector was added.

**Capture noise.** Two captures of the *same* build differ by up to 66 of 255, in two places:

- the edges of Playground's platform (a sub-pixel offset at rest; about 12k px, x 1024–1418, y 256–604);
- a thin strip at y 496–529 (max 14, about 420 px).

They come and go between repeat captures of either build.

**Best approved × HEAD pair per state:**

| State | Result |
|---|---|
| Rest, Educational, Playground, Creative Studio | **identical** (max 0–2, 0 pixels over 2) |
| Experience | Only the y 496–529 strip (max 14, 426 px). The same strip appears between two captures of the approved build |
| Engineering | Every pair differs **only** in Playground's platform edges, the same footprint, cell for cell, as the noise between two HEAD captures of Creative Studio. **Engineering's own region: max 1, 64 px** |

The `?floor=approved` set agrees. The office result for rest, Engineering and Playground (M1.4K.5A, pixel-identical) holds on this GPU.

### Floor tone: default against `?floor=approved`

The tone is one full-frame layer: a masked `multiply` fill under the floor lights (`components/lab/SceneV2.tsx`, `FloorTone`).

| | Default | `?floor=approved` |
|---|---|---|
| Floor (y ≥ 600), mean luminance | 63.5 | 58.6 (−8 %) |
| Floor, mean RGB | 73.5 / 61.2 / 56.2 | 70.5 / 56.1 / 49.0 (warmer: blue −7, green −5, red −3) |
| Bright reflections (95th percentile) | 144 | 133 |
| Room above the stations | — | **byte-identical** |
| Cinematic, repeated activations / switching | 60 fps, worst frame 17 ms | **60 fps, worst frame 17 ms** |
| Cinematic, first visits, worst frame | 117–166 ms | 133–150 ms |
| Compositor time per activation (viz) | 124–135 ms | 122–129 ms |

**Recommendation: make `?floor=approved` the Cinematic default.** *(Adopted in M1.4K.10: Cinematic's default, Lite untoned, `?floor=original` for the old floor.)*

- It does what M1.4G made it for. It pulls the floor's cool grey towards the amber of the approved atmosphere and deepens it slightly, so the platforms and their light strips read more clearly against it.
- It changes nothing above the floor and nothing in any animation.
- It costs nothing measurable on the RTX 4060.

**Two cautions before switching it:**

- **Look at it once in a real window.** This judgement is made from still captures.
- **Decide Lite separately.** The tone adds one more full-frame blended layer, and full-frame blending is the main cost on software compositing (`animation-lag-diagnosis.md`). Either leave Lite untoned, or measure `lite-perf` with the tone once on the office computer before toning Lite too.

**Not changed here.**

## 7. Remaining release conditions

| # | Condition | State after this verification |
|---|---|---|
| 1 | **D1: fix, or explicit owner acceptance** | **Fixed in M1.4K.7.** At this verification: **open.** Reproduces on the RTX 4060. Recommended: fix. Playground's ring and strip should drop and wait for the new spark like the other four stations. |
| 2 | D1′ on the RTX 4060 | **Closed: not reproduced** (0 of 28). Not a release condition |
| 3 | D2 on the RTX 4060 | **Not reproduced** (54 of 54). **Accepted as P3** (M1.4K.10), slow GPUs only |
| 4 | Section 8 performance on the RTX 4060 | **Met** for activations, switching, chips, mode switch and floor tone (section 3). Not run (judged non-blocking): the lifts-at-0 A/B (`k8-perf`), image decode (`decode`), page load and memory growth (`p4-perf`). The Lite-against-Cinematic comparison already shows that the first-visit frame is not the lifts' |
| 5 | **After any D1 or D2 fix**, on the RTX 4060 | **Still applies:** `k3-switching.mjs`, `k5-quick.mjs <label> 1 1 playground`, `k6-hits.mjs chips`, plus `repro-pg-lights.mjs 2` and `k5-spark.mjs <label> 1 playground`. D1 passes when Playground's light before the new arrival stays at 0 in all runs |
| 6 | Selector latency | **Closed:** 31–49 ms in production |
| 7 | **Floor-tone default** | **Approved and done (M1.4K.10).** At this verification: owner's decision (section 6). If adopted: one look in a real window; Lite's tone decided or measured on the office computer |

On the RTX 4060, nothing else found blocks release.

## Evidence

All results are labelled `-home`. Committed office results were restored where a probe writes to a fixed name.

| What | Where |
|---|---|
| GPU status | `docs/performance/work/results/gpu-info-home.json` |
| Selector | `docs/performance/work/results/selector-check-home.*`, `selector-a11y-home.*`, `selector-a11y-home-prod.json` |
| Lite and chips | `docs/performance/work/results/lite5-check-home.*` |
| Performance | `docs/performance/work/results/lite-perf-home.*`, `lite-perf-tone-home.*` (the same probe with `&floor=approved` added to its URL) |
| Mode switch | `work/results/mode-switch-home-dev.txt`, `mode-switch-home-prod.txt`; probe `work/mode-switch.mjs` (new) |
| Cinematic stations | `work/results/k1-home.txt`, `k1-stations-home.json` |
| D1, D1′ | `work/results/repro-pg-lights-home.*`, `k5-spark-home.*` |
| D2 | `work/results/k6-pg-live-home.*` |
| Captures and comparison | `docs/performance/work/captures/lite/home-*/` (PNGs ignored by Git, `info.json` kept); `work/results/capture-compare-home.txt`; script `work/capture-compare.py` (new; Python with NumPy and Pillow, see `docs/python-setup.md`) |
