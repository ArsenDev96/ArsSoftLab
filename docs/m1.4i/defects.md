# M1.4I: Defects and observations (`/lab-v2`)

Review only. **Nothing here has been fixed.** Approved looks, timings and geometry are not listed as defects.

- **P0:** blocks any release. **P1:** fix or decide before production. **P2:** polish, or an owner decision.
- **Proven:** reproduced and measured. **Observation:** seen, but a decision or more evidence is needed.
- **Inherited:** the approved homepage `/` behaves the same way.
- Unless stated otherwise: Chrome 157, 1648 × 928, default floor. Positions are scene coordinates (1672 × 941).
- Captures without a folder are in `work/captures/`.

## Summary

| ID | Finding | Status | Origin |
|---|---|---|---|
| **P0** | none found | | |
| **P1-1** | Scene stays invisible after client-side navigation from a page without the lab | Proven; no link in today's app reaches it | Inherited (shared gate) |
| **P1-2** | Engineering: scan line and bar caps show before the spark arrives on a quick return | Proven | v2 |
| **P1-3** | Page weight and graphics memory: about 4× the files, about 2× the GPU memory | Proven (size); release budget is an owner decision | v2 |
| **P1-4** | Playground's marquee does not respond to hover or click | Proven | v2 |
| **P1-5** | "Let's Talk" links to `#contact`, which does not exist | Proven | Inherited |
| P2-1 | Creative Studio: glint held still for a moment on a quick return | Proven | v2 |
| P2-2 | Engineering's label rises 7.6 px although its platform does not lift | Proven; owner decision | v2 inherits a homepage rule |
| P2-3 | Moving from a platform to its own label can restart the activation | Proven | Inherited |
| P2-4 | First activation of each station is slower than later ones | Proven | v2 |
| P2-5 | Powered lines: Playground's is bright, the other four are flat tan bands with beads | Proven; owner decision | v2 |
| P2-6 | Line ends: small overlaps and one small gap | Proven | v2 |
| P2-7 | Unlit strips read as grey-olive bands; inconsistent between stations | Observation; owner decision | v2 |
| P2-8 | Faint patches around the hub and above Educational's line | Observation | v2 |
| P2-9 | Creative Studio and foreground cutout edges | Observation | v2 |
| P2-10 | Playground's cabinet softens slightly before the lift starts | Proven | v2 |
| P2-11 | Station titles are 20–22 px tall as targets | Proven (size) | Inherited |
| P2-12 | Small unhoverable tops: Educational's dome, Creative's easel | Proven | v2 |

---

## P1

### P1-1 Scene stays invisible after client-side navigation *(proven)*
- **Reproduce:** open any page that has no lab (a 404 such as `/nope`), then run `window.next.router.push("/lab-v2")` in the console. The same happens with `"/"`.
- **Expected:** the scene appears, as on a full load.
- **Actual:** both gated layers stay at opacity 0 (sampled for 20 s). Only the header, hero text and labels show, on black. A reload fixes it. React also logs "Encountered a script tag while rendering React component".
- **Evidence:** `client-nav-v2.jpg`, `client-nav-home.jpg`, `work/p11-gate.json`.
- **Reach today:** none found. The app has two pages, both run the gate on a full load, and `/` ↔ `/lab-v2` works in both directions, including Back and Forward. **It becomes a P0 as soon as any third page links to the lab with a Next link.**
- **Cause:** the gate in `components/lab/PlatformPower.tsx` is an inline script. React does not run scripts rendered on the client, so neither the gate nor its 4 s fallback starts.
- **Minimal correction:** open the gate from a small client effect as well (same condition, same fallback), and keep the inline script for the first load. It touches the homepage, so it needs the owner's agreement.

### P1-2 Engineering shows light before the spark arrives on a quick return *(proven)*
- **Reproduce:** hover Engineering, leave during the scan (about 0.9 s in), and return within about 0.4 s.
- **Expected:** nothing lights before the new spark arrives, as with the other four stations.
- **Actual:** the stopped scan line and the white bar caps show while the new spark is still travelling: 7–21 frames, from 0 ms to between 457 and 900 ms.
- **Evidence:** `slip-engineering-before-arrival.png`, `work/slip.json`.
- **Cause:** `.eng-scan-band` and `.eng-caps` in `EngineeringV2.tsx` have no arrival gate; their progress value resets only after 400 ms. The other stations use `.edu-gate`, `.cre-gate` and `.exp-gate`.
- **Minimal correction:** put those two elements behind the same kind of gate (shown at `--arrive-now`). No change to timing or artwork.

### P1-3 Page weight and graphics memory *(size proven; the budget is an owner decision)*
- **Actual:**

| | `/` | `/lab-v2` |
|---|---|---|
| Scene files | 75 files, 1.4 MB | 83 files, 5.9 MB |
| Decoded images (`<img>` + CSS) | 94 + 81 MB | 343.6 + 79 MB |
| Chrome GPU process | 349 MB | 676–844 MB |
| Largest paint (dev server) | 1.7–1.9 s | 3.0–3.5 s |

- **Cause:** nearly every v2 layer is a full 1672 × 941 frame, mostly transparent. The background PNG alone is 2.3 MB.
- **Evidence:** `performance.md`, `work/baseline.json`, `work/perf-load.json`.
- **Minimal correction:** crop the layers losslessly to their content and place them by their own rectangles; re-encode the background and compare it pixel by pixel. No visual change is intended.
- **Still to measure:** a production build, over a real network, on current hardware.

### P1-4 Playground's marquee does not respond *(proven)*
- **Reproduce:** hover or click the "ArsSoftLab" sign on the cabinet, about (1190, 335).
- **Expected:** Playground activates.
- **Actual:** nothing. The hotspot starts at y 352 and the cabinet at y 320. It covers 85.6% of the station's artwork; the other four cover 95–99%.
- **Evidence:** `work/small-idle-hit-label-escape-gate-nav.json` (`playground_marquee`), `work/hit.json`, `work/hit-playground.png`.
- **Minimal correction:** raise the hotspot's top edge over the cabinet for v2 only. The polygon is shared with the homepage through `scene-layout.ts`, so it needs a v2 override.

### P1-5 "Let's Talk" does nothing *(proven, inherited)*
- **Reproduce:** click "Let's Talk" in the header on `/` or `/lab-v2`.
- **Expected:** a contact section or page. **Actual:** the target `#contact` does not exist on either page.
- **Note:** not a v2 regression. It is here because it is the main call to action of a page being considered for production.
- **Minimal correction:** the owner supplies the target (for example a mail link or a contact section).

---

## P2

### P2-1 Creative Studio's glint is held for a moment *(proven)*
Leave during the glint and return within 0.3 s: right after the new arrival, the glint and warm light stand still for 4–14 frames (up to about 310 ms), then continue. Educational (4 frames) and Experience (2 frames, about 50 ms) show a trace of the same. **Evidence:** `work/slip.json`. **Correction:** start the progress from 0 at the new arrival.

### P2-2 Engineering's label rises, its platform does not *(proven; owner decision)*
On hover, Engineering's label moves up 7.6 px and widens 1.3 px. Its v2 platform stays still. Educational, Creative Studio and Experience: 0 px. Playground: 19.9 px, with its 18 px lift. **Evidence:** `work/small-idle-hit-label-escape-gate-nav.json` (`label_rise`), `work/look1.png`. **Cause:** the homepage rule for `.lab-lift[data-lift="engineering"]`. **Correction, if wanted:** switch that rule off in v2.

### P2-3 Platform to own label restarts the activation *(proven, inherited)*
Moving in a straight line from platform centre to label in 400 ms or longer drops the hover for 2–5 frames at Playground, Creative Studio and Experience. The station then starts again. At 200 ms, and at any speed for Engineering and Educational, it holds. The homepage does the same (3–15 frames). **Evidence:** `work/p13.json`. **Correction, if wanted:** extend those three hotspots towards their labels, or lengthen the 90 ms grace.

### P2-4 First activation is slower *(proven; size depends on the hardware)*
Station images decode on the first hover (16–58 decodes, 117–361 ms on worker threads), mostly none on the second. Playground's first charge had one frame of 303–402 ms in four of four fresh pages, then about 200 ms. **Correction, if wanted:** decode the station layers while idle, after the scene is shown. See also P1-3.

### P2-5 Powered line style *(proven; owner decision)*
Playground's powered line is bright and crisp. The other four show a flat, semi-opaque tan band with visible dots where its segments join. Clear at 3×, noticeable at 1× on Creative Studio and Experience. **Evidence:** `connection-closeups.png` (powered column). Each station has passed visual review on its own, so this is raised only as a consistency question. **Correction, if wanted:** one continuous path, with Playground's core and glow.

### P2-6 Line ends *(proven)*
Rounded ends overlap the stone by about 5 px at Experience and about 3 px at Creative Studio, and the hub's rim at the starts. There is a small gap at Engineering's end. All are visible only when enlarged, at rest and powered. **Evidence:** `connection-ends.png`, `connection-starts.png`. **Correction:** clip the caps to the stone's edge; endpoints unchanged.

### P2-7 Unlit strips *(observation; owner decision)*
At rest, the strips of Playground (most), Engineering and Educational read as soft grey-olive bands. Experience's is cleaner. Approved earlier; now visible as a difference. **Evidence:** `work/idle-pg.png`, `idle-eng.png`, `idle-edu.png`, `idle-exp.png`.

### P2-8 Faint patches *(observation)*
- Right of the hub, near (1040, 598): a small rectangle.
- Hub arc, where Educational's line crosses, near (838, 527): a gap with a patch.
- Above Educational's line, (808–860, 459–466): a T-shaped patch.
- Beside Educational's powered line: straight vertical edges in the floor spill, visible at 3×.

**Evidence:** `work/idle-hub.png`, `connection-closeups.png` (first row). **Correction:** local retouch of those layers.

### P2-9 Cutout edges, bottom left *(observation)*
Creative's platform ends in a straight vertical cut at x 97. There is a faint haze by the easel's right leg (322–332, 670–690), a faint ghost left of the mug (225–240, 800–815), a pale strip at the table's right end (437–443, 885–941) and a white fringe on the book edges. **Evidence:** `work/idle-cre.png`. **Correction:** feather or retouch the masks.

### P2-10 Playground softens before the lift *(proven)*
While the lift is pending, Chrome redraws the cabinet through a transformed layer: 5,262 of 26,400 px change by more than 4 levels (maximum 78, GPU) and edges look slightly softer. Barely visible at 1×. **Evidence:** `work/reraster-look.png`. **Correction, if wanted:** keep the layer promoted at rest (costs memory, see P1-3).

### P2-11 Title targets *(proven size, inherited)*
The five station titles are 20–22 px tall, below the 24 px guideline. Chips are 26 px and platforms are far larger, and they lead to the same stations. Whether the guideline's spacing exception applies was not assessed. **Evidence:** `work/a11y.json` (`hit.too_small`).

### P2-12 Small unhoverable tops *(proven)*
Educational's dome extends 14 px above its hotspot, and Creative's easel and brushes 39 px. Coverage is still above 95%. **Evidence:** `work/hit.json`.

---

## Needs further investigation (not defects)

| Item | Why it is open |
|---|---|
| Smoothness on current hardware | Only a Radeon HD 5450 (2010) was available |
| Production build timings | The brief excluded a production build; no finding required one |
| Firefox chip borders | Fainter than in Chrome; not compared on the homepage |
| Safari, high-density displays, touch | Not available or out of scope |
| Frame rate above 1920 px wide | Layout checked at 2560 × 1080; frame pacing not measured there |

## Intended behaviour, documented so it is not reported again
- In fast sweeps up to four sparks can be visible. Earlier ones are in their 280 ms release fade, one per station.
- A leaving station drains for about 0.4–0.65 s while the next spark is already travelling. No station is still lit once the next one arrives.
- On a quick return, strips and trails hold their level until the new arrival.
- Playground has no floating icon (M1.4E.3).
- At 1280 × 800 and 2560 × 1080 the scene is cropped by its cover fit, exactly as on the homepage.
