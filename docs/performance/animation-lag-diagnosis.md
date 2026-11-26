# Animation lag in `/lab-v2`: diagnosis

Diagnostic only. No application code, animation or artwork was changed. The three experiments were CSS injected into a single test page and were gone when that page closed.

Office computer, Chrome 158, 1648 × 928, dev server. Each figure is the median of 3 repeated activations, with the first activation listed separately. Scripts, results and traces are in `docs/performance/work/`.

## Summary

**The lag is in compositing, not in JavaScript or layout.** Two things combine:

1. **Chrome does not use this computer's GPU at all by default.** The Radeon HD 5450's driver is on Chrome's blocklist, so a normal visitor gets **software compositing**: the CPU draws every frame. Activations run at **9–11 fps**, Educational at 19.
2. **The scene composites a very large number of full-frame layers.**
   - About 35 visible **full-frame `plus-lighter` layers**, 40 full-frame masks and 14 full-frame images.
   - Station lifts move **full-scene-sized** layers, so every animated frame recomposites the whole viewport.
   - Even with the GPU forced on, the HD 5450 cannot fill that much per frame: **21–27 fps**.

The renderer's main thread is only **5–25 % busy** during an animation. Engineering's ground shadow is **not** a significant cost. Filters cost more than their size suggests, because each forces an extra render pass.

## 1. Browser and GPU

| | Chrome defaults (what a visitor gets) | Forced (`--enable-gpu --ignore-gpu-blocklist`, the flags of every review probe so far) |
|---|---|---|
| Adapter used | **Microsoft Basic Render Driver** (ANGLE D3D11 **WARP**, a CPU rasteriser) | AMD Radeon HD 5450 (ANGLE D3D11) |
| GPU compositing | **disabled_software** | enabled |
| Rasterization | **disabled_software** | enabled (Skia Graphite on Dawn/D3D11) |
| WebGL / WebGPU | software only | enabled |
| Compositor in traces | `viz` **SoftwareRenderer** | Skia on GPU |

- **Why it is blocklisted:** Chrome reports driver 8.17.10.1404 (Windows: 15.201.1151.1008), a 2015 legacy driver. It is blocklisted in both headed and headless Chrome (`work/gpu-info.json`).
- **Consequence for the review:** all M1.4 office performance figures were measured with the GPU forced, so they do not describe what a visitor on this PC sees.

## 2. Frame rate and frame time

rAF frame timing across the activation (from hover to arrival + 1 s, about 1.6 s). Idle is 60 fps in both modes.

| Action | Default: fps | Default: p95 / worst frame | GPU forced: fps | GPU forced: p95 / worst frame |
|---|---|---|---|---|
| Engineering, first hover | 8.7 | 400 / 400 ms | 15.8 | 216 / 300 ms |
| Engineering, repeated | **10.1** | 250 / 383 ms | **24.9** | 150 / 150 ms |
| Playground lift, first | 9.7 | 233 / 233 ms | 18.4 | 350 / 367 ms |
| Playground lift, repeated | **9.8** | 233 / 233 ms | **21.2** | 150 / 150 ms |
| Educational, first | 18.8 | 100 / 167 ms | 38.9 | 50 / 150 ms |
| Educational, repeated | **18.8** | 100 / 167 ms | **40.5** | 67 / 117 ms |
| Rapid switching (5 stations, 180 ms each, twice) | **8.6** | 283 / 300 ms | **16.6** | 166 / 184 ms |

**Which actions stutter.** Judged from frame timing, not by eye (headless). Treating fewer than about 30 fps, or repeated frames over 100 ms, as visible stutter:

- **Default Chrome:** every activation and switching.
- **GPU forced:** Engineering, Playground and switching (8–9 frames over 50 ms per activation, regular 133–150 ms hitches). Educational is mostly smooth, with 2–3 hitches.

**Page load** (dev server, default Chrome): DOMContentLoaded 3.9 s, load 4.8 s, 0.86 s of main-thread work, mostly script.

## 3. Main thread or GPU?

Trace of the same windows; busy time per thread, in ms, over about 1640 ms (`work/results/trace-*.json`).

| | Default: Engineering | Default: Playground | GPU forced: Engineering | GPU forced: Playground |
|---|---|---|---|---|
| Compositor / GPU thread | **viz 1447–1511** (`SoftwareRenderer::DoDrawQuad` 1349–1378) | **viz 1481–1501** (`DoDrawQuad` 1405) | **GPU main 1240–1502** (`SwapBuffers` 852–1100) | **GPU main 1506–1560** (`SwapBuffers` 642–1344) |
| Renderer main thread | 272–360 (style 187–200, JS 140) | 197–199 (style 94–116, JS 107–140) | 365–422 (style 247–253) | 226–275 |
| Raster workers | 187–225 | 160–227 | 25–108 | 16 |
| Image decode | 8 (first hover only) | under 5 | under 5 | under 5 |

- **Default:** the compositor thread is **88–92 % busy drawing quads in software**. Everything else is small. **CPU-bound in compositing.**
- **GPU forced:** the GPU process's main thread is 75–95 % busy, most of it in `SwapBuffers`, which is waiting for the GPU to finish each frame. **GPU fill-bound.**
  - The HD 5450 has about 2.6 Gpixel/s of fill (4 ROPs × 650 MHz).
  - One 1648 × 928 frame is 1.5 Mpx, so roughly 35 blended full-frame layers alone are about 54 Mpx per frame, before anything else is drawn.
- **Not main-thread-bound:** the main thread is 5–25 % busy, with 0 long tasks during activations. Style recalculation is its biggest share (Educational 155–281 ms per window), yet Educational is the smoothest station.

## 4. Expensive effects (read-only inventory)

| What | Count | Note |
|---|---|---|
| Overdraw at rest | **about 123 viewport-equivalents** (upper estimate: nested layers count twice) | Images, SVGs, masked and blended elements |
| `mix-blend-mode: plus-lighter` | 99 elements; **66 full-frame** (35 visible, 31 hidden) | Each needs its own blend over everything below it |
| Masks | 129 elements; **40 full-frame** | Some masks use animated numbers (e.g. `ENG_DISC_FADE` depends on `--el`), so they repaint while those change |
| Full-frame images | 14 of 16 (24 Mpx decoded) | |
| CSS / SVG filters | 13: 4 icon `drop-shadow`, 4 no-op `brightness(1)`, 3 Playground line blurs, Engineering's foot blur, 1 colour matrix | All under 1 % of the frame, but each forces an extra render pass |
| `backdrop-filter` | none in the scene | |
| Registered `@property` numbers | 128, `inherits: true` | Transitioned on scope containers; the whole subtree's style is recalculated each frame |
| During one Engineering activation | 61 animations on 41 elements, **10 of them full-frame** | The `eng-rise` station layers are `inset-0`, sized to the whole scene. The lift moves whole-scene layers, so each frame recomposites the full viewport. Not compositor-only: `transform: translateY(calc(… var(--el)))`, `--pw`, `--eb*`, 25 WAAPI for the spark |

## 5. Controlled experiments (temporary, per page)

| Experiment (injected CSS) | Engineering, default | Engineering, GPU | Playground, default | Playground, GPU |
|---|---|---|---|---|
| Baseline | 10.1 fps | 24.9 | 9.8 | 21.2 |
| **A.** Engineering's soft ground shadow off (`[data-v2-ground="engineering"]`) | 11.0 (+9 %) | 24.9 (**0 %**) | 11.4 | 21.3 |
| **B.** Floor reflections and floor light off (`[data-v2-floor]` except contact, tone, rings, occlusion; 9 full-frame blended layers fewer) | 10.7 (+6 %) | 26.3 (+6 %) | 11.3 (+15 %) | 21.8 (+3 %) |
| **C.** Every CSS/SVG filter off | **13.4 (+33 %)** | **27.4 (+10 %)** | 11.7 (+19 %) | **25.7 (+21 %)** |

- **Engineering's ground shadow is not a significant cost.** No change with the GPU; within noise in software. This rules out M1.4J.2's suspicion.
- No single effect explains the lag. Together A, B and C are worth +10–35 %, against the 2.5× (software) to 6× (GPU) needed for 60 fps.

## 6. First hover against repeated hovers

- **GPU forced:** the first activation is clearly worse. Engineering 15.8 against 24.9 fps; Playground 18.4 against 21.2. The worst frame is 300–367 ms.
  - The trace shows 600–1000 ms of extra GPU-process work on the first hover (`GPUTask` and GPU worker threads): uploading textures and creating tiles for layers drawn for the first time.
  - Image decoding is negligible (8 ms).
- **Default Chrome:** first and repeated hovers are about equal (8.7 against 10.1 fps). The per-frame software compositing cost hides the first-use cost.

## 7. Ranked bottlenecks

1. **Software compositing on this computer (driver blocklist).** Accounts for the drop from 21–27 fps (GPU) to 9–11 fps (default). Not fixable in the page. It affects any visitor whose GPU or driver Chrome blocklists.
2. **Compositing volume.** About 35 visible full-frame blended layers and 40 full-frame masks, plus station layers sized to the whole scene. Any lift therefore damages the full frame, and the full stack is drawn again each frame. **The main cause on both paths:** about 90 % of the compositor or GPU time.
3. **Render passes from small filters** (icon glows, no-op `brightness(1)`, SVG blurs). Worth +10–33 % (experiment C).
4. **First-use GPU uploads** on the first activation of each station (GPU path).
5. **Main-thread style recalculation** from inherited animated `@property` numbers. 5–25 % of the main thread today. Not limiting now, but it will cap the frame rate on fast GPUs once compositing is lighter.

Not significant: Engineering's ground shadow, image decoding, layout, JavaScript.

## 8. Recommended optimizations (smallest first; none changes the approved look)

| # | Change | Expected impact | Visual risk |
|---|---|---|---|
| 1 | **Crop the station and lift layers to their bounding boxes** instead of full-frame `inset-0` images. Same pixels, same positions. Today Engineering's lifted layers are four full-scene PNGs (`engineering-body.png`, `engineering.png`, `engineering-body-light.png`, `engineering-chart-light.png`, each 1672 × 941), and Educational and Creative Studio lift many full-scene boxes | Largest. The lift's damage and recompositing shrink from the whole viewport to the station's area (a fraction of the frame). Expected well over 2× on the GPU path, and similar on software | None if pixel-exact. Verify with the existing 0/255 equivalence captures |
| 2 | **Bake the static blended layers.** Layers that are not animating (standby light, reflections at rest, hidden `opacity: 0` ones) go into pre-composited images; only what animates stays live. Unmount layers while at opacity 0 | Large: fewer full-frame blends per frame | Low. `plus-lighter` composites exactly into a baked image; check the 2-of-255 tolerance |
| 3 | **Remove the filters' render passes:** drop the no-op `brightness(1)`; use pre-rendered glow images instead of icon `drop-shadow`; replace the SVG `feGaussianBlur` on Playground's line and Engineering's foot with pre-blurred images or stepped gradients (as M1.4J.2 did for Educational) | +10–33 % (experiment C) | Low. Same look from pre-rendered pixels |
| 4 | **Software-compositing tier.** When the page detects software rendering (e.g. WebGL with `failIfMajorPerformanceCaveat: true` returns no context, or `WEBGL_debug_renderer_info` reports a software renderer), use the reduced-motion presentation or a lighter one | Avoids 9–11 fps stutter for blocklisted visitors | Medium. Those visitors see a simpler scene; needs an owner decision |
| 5 | **Pre-warm first activations:** after load, while idle, draw each station's lit layers once (e.g. one frame at near-zero opacity) so textures are uploaded before the first hover | Removes the first-hover drop on the GPU path (15.8 → about 25 fps for Engineering) | Low. Must not show; costs memory earlier |
| 6 | **Lighter style recalculation:** register the animated numbers with `inherits: false` and set them on the elements that use them, or animate `transform` and `opacity` directly (compositor-driven) | Small now; matters after 1–3 | Medium. Touches the approved timing; the switching and quick-return suites must run again |

**Do 1–3 first.** They keep the cinematic look pixel-for-pixel and address what the traces show.

## Method and limits

- **Probes:** `lag-probe.mjs` (frame timing and main-thread split by CDP `Performance.getMetrics`; 3 repeats), `trace.mjs` (4 short traces), `gpu-info.mjs`, `inventory.mjs`, `lag-css.mjs` (the three experiments). Results in `work/results/`. The raw traces (13 MB) were not kept: `trace.mjs` regenerates them, and their summaries are in `work/results/trace-*.json`.
- **Headless Chrome.** Same GPU decision as headed (checked). Stutter is inferred from frame times, not watched.
- **Dev server, not a production build.** Script time is an upper bound; it is not the bottleneck.
- **One machine, few repeats.** Differences under about 10 % (experiments A and B) are within run-to-run noise.
- **Not measured here:** the RTX 4060. Recommendations 1–3 should be checked there as well.
