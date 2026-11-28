# M1.4Q: production first-paint investigation (28 Nov 2026)

**Status:** the authoritative M1.4Q report. It reconciles two independent investigations that ran at the same time on the same machine:

- **Session A,** this report's original work. Its evidence is in `docs/m1.4l/first-paint/`, with a file-by-file guide in its `README.md`.
- **Session B,** an independent run with its own scripts, server and build. It is summarised in [`FIRST-PAINT-SUPPLEMENT.md`](FIRST-PAINT-SUPPLEMENT.md); its evidence is in `docs/m1.4l/work/first-paint*.mjs` and `docs/m1.4l/work/results/first-paint-*.json`.

The numbers from the two sessions are reported side by side, each with its conditions. **They are never averaged together.**

**Branch:** `feat/lab-v2` at `f724729`. Measurement and diagnosis only: no application code, artwork, animation, Static Lite asset or dependency changed.

## Summary

**1. In the test environment, the earlier "1.0–1.2 s first paint" is mainly fresh-profile GPU initialisation in Chrome.**

- **Both sessions reproduced it.**
  - Cinematic cold FCP: 1052 ms (A) and 988 ms (B).
  - **Session B also reproduced it in headed Chrome,** with a visible window: 996 ms. So it is not a headless artefact.
- **The page is ready long before its first frame.** By ~100–300 ms the HTML, scripts and images have arrived and hydration has started. The first frame then waits a further ~650–980 ms, while the GPU process starts up and compiles its rendering pipelines (Skia Graphite on Dawn, Direct3D 11):
  - Session A traced 1.2–2.1 s of Dawn worker CPU before FCP.
  - Session B traced 50–57 pipeline-compile tasks (1.7–2.2 s) on Cinematic and Lite.
- **Each lever removes most of it:**
  - Software rendering: 130–185 ms on the site's pages (A and B).
  - A profile whose GPU cache had already drawn the pages: 124–264 ms (B, headless and headed).
  - A browser that is already running: 28–145 ms (A and B).

**2. Even so, it may still affect some real visitors.** Mainly:

- the first page drawn by a new or freshly reset Chrome profile;
- possibly after events that invalidate GPU caches;
- a first visit in a browser whose GPU cache has never drawn similar content.

How often real visits pay it is unknown (§9).

**3. FCP and scene visibility are different events.**

- **Cinematic and `/` first paint text on black.** `PlateGate` reveals the scene after its images have loaded and decoded, then fades it in over 240 ms.
- **Lite has no gate.** Its first frame already contains the scene.
- **So similar FCPs hide different presentations.** Warm browser on localhost, scene visible:
  - Lite: 124 ms (A).
  - Cinematic: 420 ms (A, 90 % luminance); fully faded in by 487–491 ms (B, gate opacity).

**4. Under realistic network conditions, delivering the scene is the larger, user-facing cost** (A only):

- **Cinematic, warm browser, first visit:** the scene is visible after 1.6 s at 50 Mbps / 20 ms, and 4.4 s at 12 Mbps / 70 ms. At 12 Mbps the gate's 4 s fallback fires first.
- **Repeat visits** re-check every scene image, because `/scene/**` is served with `Cache-Control: public, max-age=0`. Cinematic takes 2.6 s at 12 Mbps / 70 ms with everything cached; Lite, with 7 images, 0.14 s.

**5. Not contributors:** server response, HTML parsing, CSS, fonts, JavaScript and hydration (§4).

**Conclusion:**

1. Fresh-profile GPU initialisation is the principal cause of the reported first paint in the test environment.
2. Warm-browser rendering is substantially faster.
3. The first-paint figure alone does not justify changing approved visuals.
4. Scene delivery under constrained networks is the more useful next target.

**Candidates, not approved changes (§7):**

1. caching for `/scene/**`;
2. a lossless re-encode of the 2.29 MB environment PNG;
3. a review of what the Cinematic gate waits for;
4. visual-effect simplification only if later evidence supports it.

**No change should be made only to improve the synthetic empty-profile first-paint score.**

## 1. Test environment

| | Session A | Session B |
|---|---|---|
| Machine | Home computer: NVIDIA GeForce RTX 4060 (driver 32.0.16.1088), Windows 11 Pro (build 26300) | The same |
| Browser | Chrome 158.0.8127.88, headless (`--headless=new`), via `scripts/visual/cdp.mjs` | Chrome 158.0.8127.88. Headless, and headed for one set of runs (§3f) |
| GPU path | ANGLE / Direct3D 11. Raster through Skia Graphite on Dawn | The same |
| Viewport | 1648 × 928, device scale 1, motion on | The same |
| Build | `next build` of `f724729` into `.next`; `next start` on port 3100 | `next build` of `f724729` into a separate directory, since removed; `next start` on port 3014 |
| Server | localhost, HTTP/1.1, gzip | The same |
| Runtime | Node 22.22.3, Next.js 16.4.6 (Turbopack) | The same |

## 2. Methodology

### Metrics: kept apart throughout

| Metric | Session A | Session B |
|---|---|---|
| FCP, LCP | Paint Timing; LCP observer (last candidate) | The same |
| Navigation and resources | Navigation and Resource Timing | The same |
| Hydration | Proxy: React's fiber key on the first `<a>`, polled every 5 ms | Not measured |
| **Scene visible** | Trace screenshots: the first frame whose lower band (55–95 % of the height) reaches 90 % of its final luminance. Previous-document frames are excluded | Frame-polled: the gated layer's computed opacity (Cinematic: first visible, and fully visible at opacity 1), or when Lite's plate image has been drawn |
| Gate open | `MutationObserver` for `PlateGate`'s style | The time that style was inserted |
| Breakdown | Chrome trace: self time per thread before FCP | Chrome trace: busy time per thread, and the Dawn compile tasks before FCP |

**The scene is never the LCP element.** LCP is the hero text, or a project paragraph; once it was `unpowered.png` on warm `/`. So LCP can't stand in for scene visibility.

**A's and B's scene metrics have different definitions** (90 % luminance against full opacity). They are reported separately.

### Conditions

A new Chrome process per trial unless stated.

| Profile and browser state | Session A | Session B |
|---|---|---|
| **Fresh profile, navigate at once** | `cold` | `cold` |
| Fresh profile, 3 s idle first | `cold-idle` | — |
| Fresh profile, an unrelated page drawn first | `primed-other` (a `data:` text page) | `cold-seeded-404` (the app's 404, in its own profile) |
| **Reused profile,** HTTP cache cleared (on-disk GPU caches carry over) | `warm-profile`: a profile per route, seeded with that route | `reused-profile`: one profile that had drawn every route |
| **Warm process** (same browser, HTTP cache cleared) | `warm` | `warm-process` |
| Warm process, HTTP cache kept (a repeat visit) | `warm-cache` | `warm-cache` |
| Software rendering (`--disable-gpu`) | `swgpu` | `disable-gpu` |
| Ganesh instead of Graphite (`--disable-features=SkiaGraphite`) | `ganesh` | `no-graphite` |
| **Headed** (visible window), fresh and reused profile | — | `headed` |
| **Network throttling,** DevTools emulation, warm process | 50 Mbps / 20 ms and 12 Mbps / 70 ms, first and repeat visits | — |

**Routes:** `/`, `/lab-v2` (Cinematic), `/lab-v2?render=lite` (Static Lite), `/lab-v2/projects/sqlorbit`, and a 404.

**Trials:** 7 per cell for baselines; 3–5 for variants. Results are median [min–max] in ms from navigation start.

### The two sessions shared the machine

Times are local (UTC+4). Session B's JSON records UTC.

| Window | Session A | Session B | Effect |
|---|---|---|---|
| 13:19–13:37 | Baseline (§3a–b), condition matrix (§3c) | — | **Clean** |
| ~13:48–13:54 | Scene-visible run (§3d) | Production build, 13:52:46–13:54:12 | The software-rendering cells of §3d ran during B's build; the rest were clean |
| 13:55–14:13 | Gate, both throttled first-visit runs, feature diagnostic | Cold baseline, `disable-gpu`, `no-graphite`, `reused-profile`, cold traces, warm, `cold-seeded-404` | **Both contended** |
| ~14:13–14:20 | Traces (§4), server restarts | No recorded run | Probably clean |
| 14:20–14:22:36 | Repeat-visit throttled run | CSS diagnostics: no images, no `filter`, no `backdrop-filter`, no gradients, no SVG | **Both contended** |
| 14:22:47 onward | Idle; server stopped ~14:23 | Hero-text-only, control, no backdrop and no gradients; **headed** and headed-reused; warm traces | **Clean** |

**What contention does:** it adds CPU and GPU load, so it tends to inflate times and widen ranges.

**How the conclusions are protected:** they rest on findings reproduced in clean data, or in both sessions under different contention. Contended-only values are marked.

## 3. Results by route and rendering mode

### 3a. Cold vs warm browser: FCP (= LCP unless noted), 7 trials

| Route | A cold (clean) | B cold (contended) | A warm (clean) | B warm process (contended) | A warm cache (clean) | B warm cache (contended) |
|---|---|---|---|---|---|---|
| 404 | 416 [228–492] | 452 [372–568] | 36 [28–56] | 28 [24–56] | 40 [36–56] | 52 [28–80] |
| Project | 872 [820–996] | 924 [812–1472] | 60 [56–84] | 60 [44–96] | 36 [36–68] | 40 [36–56] |
| Cinematic | 1052 [1020–1096] | 988 [884–1164] | 116 [88–140] | 136 [92–248] | 120 [104–132] | 120 [104–144] |
| Lite | 1180 [1032–2000] | 1204 [1132–2764] | 88 [72–124] | 72 [64–112] | 88 [84–112] | 92 [80–104] |
| `/` | 1288 [1044–2092] | 1196 [968–1260] | 144 [104–228] | 132 [120–168] | 192 [148–212] | 180 [116–216] |

**Reproduced independently:** cold 0.4–1.3 s, and warm 28–192 ms.

**Browser launch** (spawn to DevTools ready, A) took 256–283 ms, and is not part of any page time.

### 3b. Cold: the page is ready long before its first frame (A, clean; medians)

| Route | Response end | DCL | Hydration (proxy) | `load` | FCP | FCP − max(load, hydration) |
|---|---|---|---|---|---|---|
| 404 | 7 | 27 | — | 82 | 416 | 338 |
| Project | 14 | 34 | 219 | 195 | 872 | 657 |
| Cinematic | 58 | 93 | 266 | 262 | 1052 | 784 |
| Lite | 18 | 46 | 170 | 159 | 1180 | 985 |
| `/` | 31 | 61 | 311 | 298 | 1288 | 962 |

**Session B, cold, contended** (medians per route): TTFB 6–44 ms, DOM interactive 31–98 ms, `load` 96–302 ms. FCP then lands 723–1019 ms after `load` on the site's pages, and 344 ms after it on the 404.

**Long tasks (A):** 3 of 105 runs had any; the largest before FCP was 82 ms.

### 3c. Isolating the cause: FCP, 3–5 trials, median

| Condition | Session | 404 | `/` | Cinematic | Lite | Project |
|---|---|---|---|---|---|---|
| Fresh profile | A (clean) | 388 | 1192 | 980 | 1160 | 848 |
| Fresh profile, 3 s idle first | A (clean) | 148 | 880 | 816 | 964 | 632 |
| Fresh profile, unrelated page first | A `primed-other` (clean) | 132 | 832 | 764 | 980 | 680 |
| Fresh profile, 404 drawn first | B `cold-seeded-404` (contended, 3 trials) | — | 724 | 780 | 980 | 532 |
| **Reused profile** | A `warm-profile` (clean) | 136 | **796** | 296 | **712** | 260 |
| **Reused profile** | B `reused-profile` (contended) | 124 | **264** | 264 | **212** | 180 |
| `--disable-gpu` | A (clean) | 44 | 136 | 176 | 148 | 128 |
| `--disable-gpu` | B (contended) | 80 | 164 | 184 | 156 | 144 |
| No Graphite | A (clean) | 244 | 604 | 568 | 560 | 544 |
| No Graphite | B (contended) | 240 | 648 | 524 | 540 | 512 |

**Reproduced independently:**

- software rendering removes almost all of the delay;
- Ganesh roughly halves it;
- a browser that has drawn something else still pays 0.5–1.0 s on the site's pages: A's `primed-other` and B's `cold-seeded-404` agree within noise.

**Not reproduced (discrepancy, §9):** on a reused profile, `/` and Lite stayed at 0.7–0.8 s in A but fell to 0.21–0.26 s in B. Cinematic, the project page and the 404 agree.

### 3d. Scene visibility vs FCP

**Session A** (trace screenshots, 90 % luminance; 5 trials; median [min–max]; clean except the `swgpu` rows):

| Condition | Route | FCP | Scene visible | Scene − FCP |
|---|---|---|---|---|
| Fresh profile | `/` | 1054 | 1236 [1151–1266] | 163 |
| Fresh profile | Cinematic | 858 | 1160 [1135–1222] | 301 |
| Fresh profile | Lite | 1087 | 1084 [1041–1120] | ≈ 0 |
| `primed-other` | `/` | 702 | 902 [856–1021] | 200 |
| `primed-other` | Cinematic | 706 | 1096 [1005–1140] | 385 |
| `primed-other` | Lite | 893 | 898 [867–903] | ≈ 0 |
| Warm | `/` | 121 | 351 [339–363] | 232 |
| Warm | Cinematic | 139 | **420** [402–484] | 276 |
| Warm | Lite | 123 | **124** [112–138] | 0 |
| `swgpu` (during B's build) | `/` | 130 | 470 [408–483] | 332 |
| `swgpu` (during B's build) | Cinematic | 164 | 729 [584–760] | 571 |
| `swgpu` (during B's build) | Lite | 144 | 144 [141–199] | 0 |

**Session B** (gate opacity for Cinematic and `/`, plate drawn for Lite):

- **Cinematic, warm process:** the gate opens at ~230 ms, the scene first shows at 258 ms, and it is fully visible at 491 [485–647] ms (contended). The clean warm traces give 487 [473–514] ms.
- **Cinematic, fresh profile:** fully visible at 1352 [1216–1565] ms (contended).
- **Lite:** the plate has been drawn by the first frame in every condition.

**Agreed by both sessions:** Lite's first frame is its scene; Cinematic's first frame is text, and its scene follows later.

- A measures 276–385 ms from FCP to 90 % luminance.
- B, warm, measures ~120 ms from FCP until the scene first shows, and ~355 ms until it is fully visible.

### 3e. Scene delivery over emulated networks (A only, contended; warm process; 5 trials)

| Route | 50 Mbps / 20 ms, first visit | 12 Mbps / 70 ms, first visit | 12 Mbps / 70 ms, repeat visit |
|---|---|---|---|
| 404 (FCP) | 104 | 223 | — |
| Project (FCP; no scene) | 130 | 275 | — |
| `/` (scene) | 705 [663–763] | 1754 [1681–2829] | 1036 [983–1276] |
| Cinematic (scene) | **1577** [1433–1681] | **4435** [4372–4515] | **2642** [1759–2930] |
| Lite (scene) | 657 [612–1120] | 2233 [2218–2960] | **142** [136–165] |

**FCP stays at 104–334 ms throughout.**

**At 12 Mbps, Cinematic's 4.4 s is the gate's 4 s fallback.** The fallback fired before the 4.5 MB it waits for had arrived, then the fade followed.

**The repeat visit downloads almost nothing,** but revalidates each scene image: `max-age=0`, ~95 requests on Cinematic, six HTTP/1.1 connections.

**On contention:** these values are seconds, network-bound and repeatable (narrow ranges). Contention can't plausibly account for them, though it may add tens of milliseconds.

### 3f. Headed Chrome (B, clean; 3 trials)

| Route | Fresh profile | Reused profile |
|---|---|---|
| Cinematic | 996 [904–1024] (fully visible 1296) | 224 [204–232] (fully visible 515) |
| Lite | 1140 [1108–1160] | 216 [216–224] |
| 404 | 400 [380–1020] | 124 [124–128] |

**Headed matches headless** on a fresh profile, and drops the same way on a reused one. A warm-process headed condition was not measured.

## 4. Timing breakdown

### Server and network

- **TTFB:** 3–58 ms (A medians, every condition); 6–44 ms cold (B).
- **First request after a server restart:** 10–190 ms (A: three restarts, two route orders). Repeats: 2–50 ms.
- **Rare slow responses inside just-launched browsers.** A saw ~850 ms in two of 35 cold trials; B saw TTFBs of 719 ms and 1540 ms. They explain the cold maxima (A: 2.0–2.1 s on `/` and Lite; B: 2.76 s on Lite), and likely M1.4M's 1.9 s and 2.3 s outliers. They come from the fresh browser, not the server.
- **The server is not a contributor.**

### HTML

| Route | Uncompressed | Transferred (gzip) |
|---|---|---|
| Cinematic | 699 KB (mostly the RSC payload) | 81 KB |
| `/` | 324 KB | 36 KB |
| Lite | 88 KB | 16 KB |
| Project | 58 KB | 13 KB |
| 404 | 9 KB | 3 KB |

`ParseHTML` before FCP: 8–17 ms (A); 1–17 ms (B, warm). **Not a contributor.**

### CSS and fonts

- **CSS:** one stylesheet, 11 KB, received by ~130 ms cold.
- **Fonts:** Outfit via `next/font`, `display: swap`. One 32 KB woff2, received by ~118 ms cold.
- **Not contributors.**

### JavaScript and hydration

- **Bundles:** 6–9 files, 134–185 KB.
- **Main thread before FCP, warm:**
  - A: 10–80 ms of self time (parse, style, layout, script).
  - B (clean traces): 18 ms (404) to 113 ms (Cinematic) busy, of which script is 9–61 ms.
- **Hydration proxy (A):** 50–190 ms warm, 170–310 ms cold. In warm loads it lands within ~20–40 ms of FCP, in either order; in cold loads it finishes 600+ ms before FCP.
- **Not on the first frame's critical path.**

### Images

| | Requests | Image bytes | Gate waits for |
|---|---|---|---|
| Cinematic | 95 | 5.7 MB | 66 files, 4.5 MB. `environment/lab-background.png` alone is 2.29 MB (51 %) |
| Lite | 7 | 2.6 MB | No gate (`plate.webp` 1.66 MB) |
| `/` | 74 | 1.4 MB | 13 files, 533 KB |
| Project | 1 | 1 KB | — |

**On localhost the bytes are fast.** In a warm browser, everything has arrived by ~220 ms. The gate opens 6–200 ms after the last gated image (the `decode()` wait). Image decoding before FCP is ≤ 80 ms in every A trace.

**Gate timing** (A, mostly contended; 5 trials; medians):

| Condition | Route | FCP | Gated images received | Gate opens |
|---|---|---|---|---|
| Fresh profile | Cinematic | 972 | 203 | 301 |
| Fresh profile | `/` | 1160 | 102 | 295 |
| Warm | Cinematic | 164 | 220 | 241 |
| Warm | `/` | 164 | 100 | 189 |
| `swgpu` | Cinematic | 180 | 230 | 250 |

**In a cold browser the gate opens long before the first frame,** so there the GPU's first draw sets the timing.

**In a warm browser on localhost,** scene visible ≈ gate + most of the 240 ms fade.

### Style, layout, paint and the GPU process

**A's traces** (self time before FCP, ms, warm / cold):

| Route | FCP | Dawn workers | GPU raster flush | Renderer main |
|---|---|---|---|---|
| 404 | 25 / 219 | 0 / 169 | 0 / 182 | 0 / 48 |
| Project | 197 / 564 | 0 / 2131 | 3 / 521 | 12 / 88 |
| Lite | 79 / 897 | 0 / 1266 | 5 / 796 | 21 / 85 |
| `/` | 132 / 515 | 0 / 1190 | 5 / 480 | 77 / 121 |
| Cinematic | 129 / 830 | 26 / 1638 | 32 / 352 | 66 / 145 |

- Dawn worker time is summed over several threads.
- Traced cold runs include ~300 ms of idle time before navigating, so their FCPs sit between "fresh profile" and "3 s idle first".

**B's cold traces** (2 per route, contended):

| Route | FCP | Dawn worker time before FCP | GPU main thread |
|---|---|---|---|
| Cinematic | 832–940 | 1.94–2.19 s | Inside one `DoEndRasterCHROMIUM` flush until FCP |
| Lite | 1124–1248 | 1.67–1.91 s | The same |
| 404 | 440–460 | 0.47–0.51 s | The same |

The supplement counts the pipeline-compile tasks: 50, 57 and 22. The compact files keep times, not counts.

B's renderer main thread was busy 77–378 ms before FCP in these cold traces, measured as busy time, not A's self time.

B's warm traces (clean) show **no** compile work.

## 5. Root-cause assessment

### A. Fresh-profile GPU initialisation: the principal cause of the reported first paint in the test environment

**Supported in both sessions:**

- **Readiness:** the page is ready ~650–980 ms before its first frame (§3b), with no long tasks.
- **Software rendering:** removes the delay (§3c).
- **Pipeline compilation:** the traces show Dawn compiling before FCP, and none in warm loads (§4).
- **Two components:**
  - GPU-process start-up: ~240 ms (A: fresh vs 3 s idle, on the 404);
  - first-use pipeline compilation, which depends on the content: 404 text ~130 ms, site pages ~0.5–1.0 s (A `primed-other`, B `cold-seeded-404`).
- **The on-disk cache helps:** a profile that has drawn the pages before reduces it substantially. B: 124–264 ms on every route, headless and headed. A: Cinematic 296 ms, project 260 ms, 404 136 ms. A's `/` and Lite are the discrepancy in §9.
- **Headed Chrome shows the same,** so it is not a headless artefact (B, §3f).

**Which content costs the most** (B's validated CSS diagnostic: fresh profile, 4 trials, FCP in ms):

| Diagnostic CSS | Cinematic | Lite | Contention |
|---|---|---|---|
| None (control) | 1096 [896–1932] | 1088 [1048–1904] | Clean |
| Only the hero text visible | **378** | **384** | Clean |
| No `backdrop-filter`, no gradients | 776 | 682 | Clean |
| No `backdrop-filter` | 868 | 792 | Contended |
| No gradients | 870 | 848 | Contended |
| No images | 974 | 1044 | Contended |
| No `filter` | 1002 | 1084 | Contended |
| No SVG | 1088 | 910 | Contended |

- **Text alone costs the browser's cold floor** (~380 ms, as on the 404). That also shows the injected style was in place for the first frame.
- **Everything else costs ~600–800 ms,** spread over many features. The largest single contributor is `backdrop-filter`, which on desktop is used only by the project chips (`.lab-chip`, `app/globals.css:80`). Gradients come next.
- **Session A's own feature diagnostic is excluded** (§9). Its style can arrive as late as 73–447 ms after navigation start, and it ran under contention. Its direction is consistent with B's.

**What this means for visitors:**

- In a browser that is already running, with a populated GPU cache, the cost is small or absent: 28–145 ms FCP.
- It can still be paid:
  - by a new or reset profile;
  - possibly after a Chrome or driver update invalidates GPU caches (not tested);
  - in part, on the first visit to content whose pipelines the cache has never compiled.

How often that happens in real visits is not measurable here. It is **a real but intermittent cost, not one every visit pays**, and **not a reason on its own to change approved visuals**.

### B. Scene visibility: gated by design, and governed by image delivery

- **The gate:** Cinematic and `/` deliberately show nothing of the scene until their gated images have loaded and decoded, then fade it in (`PlateGate`).
- **On localhost** that costs ~280–390 ms over FCP to 90 % luminance (A), or ~355 ms to full opacity (B, warm).
- **Over emulated networks** (A only) image bytes dominate:
  - Cinematic waits for 4.5 MB: 1.6 s at 50 Mbps;
  - at 12 Mbps it reaches the 4 s fallback;
  - on repeat visits it re-checks ~95 images (`max-age=0`): 2.6 s at 70 ms RTT. Lite re-checks 7: 0.14 s.

This is the cost a visitor with a warm browser actually waits for, and it scales with connection quality.

### C. Why Cinematic and Lite report similar first-paint times

They present different first frames:

- **Lite's first frame already contains the scene,** so its FCP is its scene time.
- **Cinematic's first frame is text,** and its scene follows later.
- **On a fresh profile,** Lite's first frame needs its large images drawn, so its FCP is somewhat later than Cinematic's text-only frame.

**By scene visibility, Lite is faster:**

- 124 vs 420 ms warm (A);
- 0.66 vs 1.6 s at 50 Mbps (A);
- 0.14 vs 2.6 s on a repeat visit (A).

**None of this measures Lite's purpose,** which is smoother interaction on weak GPUs (`docs/performance/STATIC-LITE-INTEGRATION.md`).

## 6. Comparison with earlier measurements

| | M1.4M (27 Nov, `c03d97b`), headless, fresh profile | A, fresh profile | B, fresh profile | Warm process (A / B) |
|---|---|---|---|---|
| 404 | ~0.4 s | 0.39–0.42 s | 0.45 s | 0.04 / 0.03 s |
| Project | 0.8–1.0 s | 0.85–0.87 s | 0.92 s | 0.06 / 0.06 s |
| `/lab-v2` (both modes) | 1.0–1.2 s (one 1.9 s) | 0.98–1.18 s | 0.99–1.20 s | 0.07–0.14 s |
| `/` | 1.2–2.3 s | 1.19–1.29 s | 1.20 s | 0.14 / 0.13 s |

**The earlier numbers reproduce.** The repository's harness gives every launch a new, throwaway profile, so it always measures the fresh-profile condition.

**M1.4M's conclusion ("browser-side work before the first frame, not serving") stands,** refined:

- the work is GPU-process start-up and pipeline compilation;
- the number is a fresh-profile figure, not typical warm-browser behaviour.

**No historical build was measured.** The `f724729` numbers match `c03d97b`'s, and no commit since touches loading or rendering. Every number here is production; development and production are not compared.

## 7. Prioritised improvement candidates

These are **candidates for a follow-up experiment, not approved changes.** None is implemented.

| # | Candidate | Expected impact | Confidence | Complexity | Visual risk | Static Lite fingerprint risk | Homepage risk |
|---|---|---|---|---|---|---|---|
| 1 | **Caching for `/scene/**`** (at least `scene/v2` and `scene/static-lite`) | **High on repeat visits:** Cinematic 2.6 s at 12 Mbps / 70 ms, Lite 0.14 s. None on first visits | High: headers verified; Lite is the control | Low–medium. **It must handle invalidation:** the files are not content-hashed, so a long `max-age` needs versioned URLs or a build-time asset version; otherwise a moderate `max-age` with `stale-while-revalidate`. The deployment's own headers, CDN and HTTP version may differ from `next start`, so check them first | None | None: config isn't watched, and assets don't change | Positive if it covers the homepage's `/scene/*`; can be scoped to `/lab-v2`'s folders |
| 2 | **A lossless re-encode of `scene/v2/environment/lab-background.png`** (2.29 MB, 51 % of the Cinematic gate's bytes) | **Medium–high on first visits** (Cinematic 1.6 s at 50 Mbps; the fallback at 12 Mbps). The saving is to be measured | High on the bytes; medium on the saving | Low–medium | **None only if lossless:** decoded pixels must be verified bit-identical | **Yes, and must not be silent:** `public/scene/v2` is watched by `static-lite:check`. Re-record the manifest only after showing the bake output unchanged, or keep the original as the bake source | None (`/` uses `lab-plate.webp`) |
| 3 | **Review the Cinematic gate:** which layers it must wait for to prevent the lit-strip flash it exists for, against all 66. On slow links it already times out and layers pop in | Medium–high on slow first visits | Medium | Medium | **Medium:** the order layers appear in is a design decision | Depends on the file: `LabScene.tsx` is watched, `PlateGate.tsx` is not | `PlateGate` is shared with `/`, so a change must be scoped to `/lab-v2` |
| 4 | **Visual-effect simplification,** only if later evidence supports it. The narrowest test: the project chips without `backdrop-filter` (B: about −300 ms Lite, −100–230 ms Cinematic, fresh profile only) | Only fresh or reset GPU caches; no warm-browser gain | Medium (B, 4 trials, partly contended) | Low as code, but it changes the approved look | **High:** needs the owner's approval | Possible: chips are drawn in the layered scene | Chips also exist on `/` |
| — | **Reporting:** future verifications state warm-browser FCP, scene visibility and throttled scene delivery, and quote fresh-profile FCP as such | Prevents optimising a synthetic figure | High | Low | None | None | None |
| — | Lite's `plate.webp` (1.66 MB): a lighter encoding | Lite first visit 0.66 s (50 Mbps) / 2.2 s (12 Mbps) | Medium | Medium | Changes pixels (lossy), or a re-bake | Yes | None |

**Not recommended**, because no meaningful cost was measured:

- HTML or RSC payload size;
- JavaScript, hydration, fonts or CSS;
- the server.

**No candidate should be pursued only to improve the empty-profile first-paint score.**

## 8. Success criteria for a follow-up experiment

**General rules:**

- Same harness, conditions and routes, on this machine, **with no other measurement running**.
- At least 7 trials per cell; report median, min–max and spread.
- Use warm-process and throttled conditions as the targets. Report fresh-profile FCP only for reference, labelled as such.

**For candidate 1 (caching):**

- Repeat visit at 12 Mbps / 70 ms: Cinematic scene visible **≤ 0.6 s** (median; now 2.64 s), `/` **≤ 0.4 s** (now 1.04 s).
- Zero 304 revalidations for `/scene/*` while within the cache lifetime.
- A demonstrated content update: a changed asset is served after deployment, within the stated window or at once with versioned URLs.
- First visits unchanged within noise.
- Reduced-motion screenshots and layout fingerprints identical; `static-lite:check` current.

**For candidate 2 (lossless background):**

- Decoded pixels identical to the PNG (0 differing).
- Cinematic first visit: scene visible **≤ 1.2 s** at 50 Mbps / 20 ms (now 1.58 s). At 12 Mbps / 70 ms, the gate opens before its fallback in 7 of 7 trials.
- `/lab-v2` reduced-motion screenshots pixel-identical.
- The Static Lite manifest re-recorded only with evidence that the bake output is unchanged.

**For candidate 3 (gate scope):**

- A frame-by-frame review at 12 Mbps shows no lit-strip flash and no layer appearing out of the approved order.
- The room appears **≤ 2.5 s** at 12 Mbps / 70 ms.
- `/` unchanged.

**For candidate 4 (effect simplification), only after the owner approves the look:**

- Fresh-profile FCP falls by at least 200 ms on the affected routes, in at least 7 clean trials.
- No warm-browser regression.

**For any of them:**

- FCP and hydration do not regress by more than 10 %.
- No console errors.
- The homepage's composition is unchanged.

## 9. Remaining uncertainty

- **Real-world frequency of the fresh-profile cost.** Real visitors' GPU caches can't be observed. The trigger list in §5A is reasoned, not measured. In particular, cache invalidation after Chrome or driver updates was not tested.
- **The reused-profile discrepancy is unresolved.** On a reused profile, `/` and Lite measured 796 and 712 ms in A (clean) but 264 and 212 ms in B (contended). Cinematic, the project page and the 404 agree.
  - **Contention can't explain it:** A's run was the clean one, and contention would inflate B's, not lower it.
  - **The set-ups differ in three ways:**
    - A seeded one profile per route with that route only; B's profile had drawn every route.
    - A's launcher kills Chrome 0.3 s after `Browser.close`; B's waits 1.5 s, which may let pipeline-cache writes complete on exit.
    - A ran consecutive trials per route; B interleaved routes.
  - **What was checked:** all of A's profiles had a populated persistent Graphite cache (1.0–3.7 MB). So "no cache written" is ruled out; "incomplete cache" is not.
  - **No longer favoured:** the earlier WebP hypothesis. B's result doesn't need it, though it isn't disproven.
  - **To resolve it:** rerun both set-ups back to back on an idle machine, varying the shutdown delay.
- **Contention.** See §2. The core conclusions rest on findings reproduced in clean data, or across both sessions. Single-session contended values are marked: §3e, the gate timing, B's fresh-profile baseline and most of B's diagnostic.
- **Session A's feature diagnostic is excluded.** A method check found that its style applies and survives hydration, but is inserted 73–447 ms after navigation start, which cannot be guaranteed to precede the first frame, and it ran under contention. A first attempt of B's diagnostic, whose style never applied, was discarded by B and is not among the retained files. B recorded only that its style was present after load, not when it was inserted; the hero-text-only result implies it was in place for the first frame.
- **Network emulation.**
  - DevTools throttling approximates bandwidth and latency per request.
  - `next start` serves HTTP/1.1 (six connections per host). A CDN with HTTP/2 or HTTP/3 would reduce the per-request latency cost, so the repeat-visit figure is an upper bound there.
  - The deployment target's own cache headers were not checked.
  - Only A measured throttled delivery.
- **Metric definitions.**
  - A's scene-visible time is a luminance heuristic, and B's is a computed opacity, so they aren't interchangeable.
  - A's hydration time is a proxy.
  - Screenshots are taken on visual change only, so milestones are accurate to about one frame.
- **Not measured:**
  - a warm-process headed condition;
  - Firefox and Safari (Graphite and Dawn are Chrome-specific);
  - other GPUs (the office computer's AMD HD 5450 would differ);
  - mobile devices;
  - interaction smoothness.
- **Sample sizes.** 3–7 trials per cell, and rare cold outliers of 0.6–0.9 s. Medians are robust to them; the ranges show them.

## Evidence

| Location | Contents |
|---|---|
| `docs/m1.4l/first-paint/README.md` | Session A: every retained file, its purpose, collection window and contention |
| `docs/m1.4l/first-paint/results/` | Session A's compact results (JSON) and trace summaries |
| `docs/m1.4l/first-paint/scripts/` | Session A's measurement scripts, including the method check that excludes its feature diagnostic |
| `docs/m1.4l/FIRST-PAINT-SUPPLEMENT.md` | Session B: methods, key measurements, and where its evidence lives |
| `docs/m1.4l/work/first-paint.mjs`, `first-paint-summary.mjs` | Session B's measurement and summary scripts |
| `docs/m1.4l/work/results/first-paint-*.json` | Session B's results, in compact form: every timing for every trial; resource lists for the first trial of each cell |

**Not kept in the repository:** Chrome traces (about 2 MB each in A; about 10 MB in total in B), screenshots, Chrome profiles, server logs and build output.
