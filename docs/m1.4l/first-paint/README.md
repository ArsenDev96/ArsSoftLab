# M1.4Q evidence: session A (the main investigation)

This folder holds the compact results and scripts behind [`../FIRST-PAINT-INVESTIGATION.md`](../FIRST-PAINT-INVESTIGATION.md), the authoritative report. Session B's evidence, the independent run, is in `../work/first-paint*.mjs` and `../work/results/first-paint-*.json`, and is described in [`../FIRST-PAINT-SUPPLEMENT.md`](../FIRST-PAINT-SUPPLEMENT.md).

**Both sessions measured the same commit (`f724729`)**, but from two separate production builds.

**Times below are local (UTC+4).**

- **Contended:** recorded while session B was also running Chrome, or building.
- **Clean:** nothing else measuring at the time.

**Not kept:** Chrome traces (about 2 MB each), screenshots, Chrome profiles, server logs and build output. Only the summaries derived from them are kept.

## Results (`results/`)

| File | What it holds | Report section | Collected | Contention |
|---|---|---|---|---|
| `baseline-cold-warm.json` | FCP, LCP, navigation timing, hydration proxy, resources and long tasks. 5 routes × 7 trials × 3 conditions: cold, warm, warm-cache | §3a, §3b, §4 | 13:19–13:25 | Clean |
| `conditions.json` | FCP, `load` and hydration. 5 routes × 5 trials × 6 conditions: cold, cold-idle, primed-other, warm-profile, ganesh, swgpu | §3c, §5A | 13:27–13:37 | Clean |
| `scene-visible.json` | FCP and scene-visible timing from trace screenshots, with each frame's luminance. 3 routes × 5 trials × 4 conditions | §3d | about 13:48–13:54 | Clean, except the software-rendering cells, which overlapped session B's production build (13:52:46–13:54:12) |
| `plate-gate.json` | When `PlateGate` opens, against the last gated image's arrival. `/` and Cinematic × 4 conditions × 5 trials | §4 | about 13:55–13:58 | Contended |
| `throttled-50mbps-20ms.json` | Warm browser, first visit, 50 Mbps / 20 ms: FCP and scene visible, 5 routes × 5 | §3e | about 13:58–14:03 | Contended |
| `throttled-12mbps-70ms.json` | The same at 12 Mbps / 70 ms | §3e | 14:03–14:09 | Contended |
| `throttled-12mbps-70ms-repeat-visit.json` | Repeat visit (warm HTTP cache) at 12 Mbps / 70 ms. `/`, Cinematic and Lite × 5 | §3e | 14:20–14:22 | Contended |
| `feature-diagnostic.json` | FCP with one drawing feature class disabled by injected CSS. 3 routes × 5 variants × 3 trials | §5A | 14:09–14:13 | Contended. **Excluded from the conclusions** (see `inject-check.mjs`) |
| `trace-summaries/*.summary.json` | Per-thread self time before FCP, plus frame-pipeline counts. One warm and one cold trace per route. `cin-cold-1` is the first, exploratory, cold trace | §4 | `cin-cold-1` 13:26 (clean); the rest about 14:13–14:18 | No recorded session-B run in that window |

## Scripts (`scripts/`)

Run them from this folder against a production server (`npm run build`, then `npm run start`). The first argument is the server's base URL.

| File | Purpose |
|---|---|
| `fp-measure.mjs` | Cold, warm and warm-cache FCP, LCP and timing measurement. Produced `baseline-cold-warm.json` |
| `summarize.mjs` | Median, min–max and SD tables from `fp-measure.mjs` output |
| `fp-cond.mjs` | The controlled-condition matrix (§2). Produced `conditions.json` |
| `fp-visual.mjs` | Scene-visible timing from trace screenshots. Supports the `cold`, `primed-other`, `warm`, `warmcache` and `swgpu` conditions, plus network throttling (`THROTTLE=mbps,rtt`). Produced `scene-visible.json` and the three `throttled-*.json` |
| `fp-gate.mjs` | `fp-cond.mjs` plus the gate-opening time and gated-image arrival. Produced `plate-gate.json` |
| `fp-trace.mjs` | One traced navigation: a DevTools-loadable trace (not kept), plus the summary kept in `trace-summaries/` |
| `fp-inject.mjs` | The excluded feature diagnostic. It injects its style only when the MutationObserver first delivers after `<html>` exists |
| `inject-check.mjs` | Method check: checks whether `fp-inject.mjs`'s style applies and survives hydration. It does, but it arrives 73–447 ms after navigation start, too late to be certain it preceded the first frame. That is why `feature-diagnostic.json` is excluded |
| `cdp2.mjs` | The repository's `scripts/visual/cdp.mjs`, plus two launch options: a persistent `profileDir` and `extraArgs`. Note: `close()` kills Chrome 0.3 s after `Browser.close` (a possible factor in the reused-profile discrepancy; report §9) |
