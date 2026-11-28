# M1.4Q supplement: the independent first-paint measurement (session B, 28 Nov 2026)

**Status:** a supporting record. The authoritative M1.4Q report, with the reconciled conclusions, is [`FIRST-PAINT-INVESTIGATION.md`](FIRST-PAINT-INVESTIGATION.md), referred to below as "the report". This file keeps what is specific to session B: how it differed in method, its own measurements, and the points where it agrees or disagrees with session A.

Measurement only: no application code, artwork, animation, Static Lite asset or dependency changed.

## 1. Methodological differences from session A

| | Session B | Session A |
|---|---|---|
| Build and server | A separate build directory (since removed), `next start` on port 3014 | `.next`, port 3100 |
| Script | `docs/m1.4l/work/first-paint.mjs`, its own CDP launcher | `docs/m1.4l/first-paint/scripts/`, based on `scripts/visual/cdp.mjs` |
| Scene visibility | The gated layer's computed opacity (first visible, and fully visible at opacity 1); Lite: the time its plate image is drawn | Trace screenshots: 90 % of the final luminance of the lower screen band |
| Trace breakdown | Busy time per thread, plus the Dawn compile tasks | Self time per thread and event |
| Reused profile | One profile that had drawn every route; Chrome given 1.5 s after `Browser.close` before it is killed; routes interleaved across trials | One profile per route, seeded with that route; killed 0.3 s after `Browser.close`; consecutive trials per route |
| Extra conditions | Headed Chrome; a fresh profile seeded with the app's 404; CSS diagnostics | Fresh profile with 3 s idle first, or an unrelated page first; network throttling; gate timing |

**Common to both:** the same commit (`f724729`), machine, Chrome 158.0.8127.88, viewport (1648 × 928 at scale 1) and motion setting.

**Results:** median [min–max] in ms from navigation start; 7 trials for baselines, 3–5 for variants.

**Times:** below are local (UTC+4). The JSON files record UTC.

## 2. Key independent measurements

**Cold and warm FCP** (`first-paint-cold.json`, `first-paint-warm.json`; contended, §6). LCP equals FCP except occasionally on `/`.

| Route | Fresh profile | Warm process | Warm cache |
|---|---|---|---|
| 404 | 452 [372–568] | 28 [24–56] | 52 [28–80] |
| Project | 924 [812–1472] | 60 [44–96] | 40 [36–56] |
| Cinematic | 988 [884–1164] | 136 [92–248] | 120 [104–144] |
| Lite | 1204 [1132–2764] | 72 [64–112] | 92 [80–104] |
| `/` | 1196 [968–1260] | 132 [120–168] | 180 [116–216] |

**Fresh-profile timing** (medians per route):

- TTFB 6–44 ms, DOM interactive 31–98 ms, `load` 96–302 ms.
- FCP then lands 723–1019 ms after `load` on the site's pages, and 344 ms after it on the 404.
- Rare slow responses inside fresh browsers: TTFB 719 ms on the project page and 1540 ms on Lite. They explain the maxima.

**Controlled variants** (FCP, 5 trials; contended):

| Route | Fresh profile | Reused profile | `--disable-gpu` | No Graphite |
|---|---|---|---|---|
| 404 | 452 | 124 | 80 | 240 |
| Project | 924 | 180 | 144 | 512 |
| Cinematic | 988 | 264 | 184 | 524 |
| Lite | 1204 | 212 | 156 | 540 |
| `/` | 1196 | 264 | 164 | 648 |

**Fresh profile seeded with the 404** (3 trials per route, own profile each; contended):

- Cinematic 780 ms, Lite 980 ms, `/` 724 ms, project 532 ms.
- This agrees with session A's `primed-other`.

**Cold traces** (2 per route, `first-paint-coldtrace.json`; contended):

| Route | FCP | Dawn worker time before FCP | Pipeline-compile tasks |
|---|---|---|---|
| Cinematic | 832–940 | 1.94–2.19 s | 50 |
| Lite | 1124–1248 | 1.67–1.91 s | 57 |
| 404 | 440–460 | 0.47–0.51 s | 22 |

- The GPU main thread sits inside one raster flush until FCP.
- Renderer main thread busy before FCP: 77–378 ms.

**Warm traces** (3 per route, `first-paint-trace-warm.json`; clean):

- No Dawn compile work.
- Main thread busy before FCP: 18 ms (404) to 113 ms (Cinematic). Script 9–61 ms, parsing 1–17 ms; style, layout and paint together 2–52 ms.

**Scene visibility:**

- **Cinematic, warm process:** the gate opens at ~230 ms, the scene first shows at 258 ms, and it is fully visible at 491 [485–647] ms (contended). Clean warm traces give 487 [473–514] ms.
- **Cinematic, fresh profile:** fully visible at 1352 [1216–1565] ms (contended).
- **Lite:** the plate is drawn by its first frame in every condition.

## 3. Headed-browser validation

`first-paint-headed.json` and `first-paint-headed-reused-profile.json`: 3 trials each, clean (14:25–14:27).

| Route | Fresh profile | Reused profile |
|---|---|---|
| Cinematic | 996 [904–1024] (fully visible 1296) | 224 [204–232] (fully visible 515) |
| Lite | 1140 [1108–1160] | 216 [216–224] |
| 404 | 400 [380–1020] | 124 [124–128] |

**A visible Chrome window pays the same fresh-profile cost as headless,** and loses it the same way on a reused profile. The cost is not a headless artefact.

A warm-process headed condition was not measured.

## 4. The reused-profile discrepancy (unresolved)

On a reused profile, `/` and Lite measured very differently:

| Session | `/` | Lite | Contention |
|---|---|---|---|
| Session B | 264 [112–280] | 212 [204–224] | Contended (14:03:47–14:05:48) |
| Session A | 796 | 712 | Clean (13:27–13:37) |

**For Cinematic, the project page and the 404, the two sessions agree.**

**This file's first version said contention might explain session A's higher values. That is withdrawn:**

- session A's run finished before session B started measuring;
- contention would inflate session B's values, not lower them.

**The set-ups differ in the three ways listed in §1:** what the profile had drawn, the shutdown delay before Chrome is killed, and the trial order. The shutdown delay is the most specific candidate, since pipeline-cache writes may complete on exit, but it was not tested.

**What was checked:** session A's profiles all held a populated persistent Graphite cache.

**Status:** see the report, §9. Neither result is treated as the settled value for `/` and Lite.

## 5. CSS diagnostics: which first-frame features cost the most

Diagnostic CSS was injected into the test browser only, at document start, into `<head>`. The application files were not changed. Each run recorded the style as present. Fresh profile, 4 trials, FCP in ms:

| Diagnostic CSS | Cinematic | Lite | Collected | Contention |
|---|---|---|---|---|
| None (control) | 1096 [896–1932] | 1088 [1048–1904] | 14:23:31 | Clean |
| Only the hero text visible (no glow or gradient) | **378** | **384** | 14:22:47 | Clean |
| No `backdrop-filter`, no gradients | 776 | 682 | 14:24:03 | Clean |
| No `backdrop-filter` | 868 | 792 | 14:21:10 | Contended |
| No gradients (`background-image`) | 870 | 848 | 14:21:41 | Contended |
| No images | 974 | 1044 | 14:20:08 | Contended |
| No `filter` | 1002 | 1084 | 14:20:39 | Contended |
| No SVG | 1088 | 910 | 14:22:13 | Contended |

- **Text alone costs the cold floor** (~380 ms, as on the 404). That also shows the style was in place for the first frame.
- **The rest costs ~600–800 ms,** spread over many features.
- **The largest single one is `backdrop-filter`.** On desktop it comes only from the project chips (`.lab-chip`, `app/globals.css:80`); the other uses are the compact menu and the mobile dock, which aren't drawn on desktop. Gradients come next.
- **Contention caveat:** the clean control, hero-text and combined rows are the most reliable comparison. The single-feature rows ran during session A's repeat-visit run.

**An invalid experiment, excluded from the conclusions:**

- **Session B's first diagnostic attempt** inserted its style before `<head>` existed, and the style never applied. It was discarded and rerun; its results are not among the retained files.
- **Session A's own feature diagnostic is also excluded,** for a different reason given in the report (§9): its style arrived too late to be certain it preceded the first frame.

## 6. Concurrent-session limitations

Session B measured while session A was running Chrome on the same machine. The full timeline is in the report, §2.

| Session B dataset | Local time | Overlapped |
|---|---|---|
| Production build (separate build directory) | 13:52:46–13:54:12 | The end of A's scene-visible run |
| Fresh-profile baseline | 13:55:55–13:58:13 | A's gate timing |
| `disable-gpu`, `no-graphite` | 13:59:37–14:02:51 | A's 50 Mbps throttled run |
| `reused-profile`, cold traces | 14:03:47–14:06:56 | A's 12 Mbps throttled run |
| Warm | 14:07:17–14:11:06 | A's 12 Mbps throttled run, then its feature diagnostic |
| Seeded with the 404 | until 14:13:32 | A's feature diagnostic |
| Single-feature CSS diagnostics | 14:20:08–14:22:47 | A's repeat-visit run |
| Hero-text, control and combined diagnostics; headed; warm traces | 14:22:47–14:28:12 | Nothing (clean) |

**Comparisons between conditions were run back to back within this session,** so differences between them are more reliable than the absolute values.

## 7. Evidence and housekeeping

| File | Purpose |
|---|---|
| `docs/m1.4l/work/first-paint.mjs` | The measurement script. Plans: `cold`, `warm`, `headed`, `coldtrace`, `trace`, `cold-seeded-404`. Variants via `EXTRA_FLAGS`, `KEEP_PROFILE`, `CLEAR_CACHE` and `INJECT_CSS` |
| `docs/m1.4l/work/first-paint-summary.mjs` | Median, min–max and IQR tables from its results |
| `…/results/first-paint-cold.json`, `…-warm.json` | §2 baselines |
| `…/results/first-paint-cold-disable-gpu.json`, `…-cold-no-graphite.json`, `…-cold-reused-profile.json`, `…-cold-seeded-404.json` | §2 controlled variants |
| `…/results/first-paint-coldtrace.json`, `…-trace-warm.json` | §2 trace summaries |
| `…/results/first-paint-headed.json`, `…-headed-reused-profile.json` | §3 |
| `…/results/first-paint-cold-diag-*.json` (8 files) | §5 |

**Compact form:** every timing is kept for every trial. Resource lists are kept for the first trial of each cell only. About 1.2 MB in total.

**Not kept:** traces (about 10 MB), Chrome profiles, server logs and the separate build directory.

**`tsconfig.json`:** `next build` with a custom build directory rewrites this file to add that directory's type paths. The change was reverted at once, and the file is unchanged in Git. Use the default `.next`, or restore the file after such a build.
