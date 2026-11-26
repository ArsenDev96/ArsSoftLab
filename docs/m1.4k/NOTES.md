# M1.4K: integration review of the five platform lifts (`/lab-v2`)

## Recommendation: **CONDITIONAL GO**

The five approved lifts, their timing and station switching are verified. **No P0 or P1.** There are two Playground defects:

- **D1 (P2):** the ring and strip light up before the new spark on a quick return.
- **D2 (P3):** the AZIZ chip can slide out from under the pointer while Playground sinks.

Both are in `defects.md`. The release conditions are below. Review only: no application code was changed and nothing was committed.

## Scope and machines

- **Home** (RTX 4060, Chrome 158, 1648 × 928): baseline, `k1`, `k3` and a partial `k5`. Completed before the pause; kept unchanged.
- **Office** (AMD Radeon HD 5450, Chrome 158, same window, dev server :3002):
  - the rest of `k5` and the quick-return probes;
  - part of section 6;
  - then, on the owner's instruction, risk-based checks only.

**Office timing results are not mixed with the home results**: every office file is labelled `-office`. No Radeon performance figures are reported; section 8 runs on the RTX 4060.

Start state at the office: `git diff --stat HEAD -- app components data lib public scripts` empty; `npm run typecheck` passed (`results/typecheck-office.txt`). Both are unchanged at the end.

## Evidence

| Area | Result | Where |
|---|---|---|
| Lift heights, timing, layers (home) | Playground 18 / Engineering 12 / Educational, Creative Studio, Experience 10 px, as approved. 25 of 25: nothing before the arrival, layers together (spread 0), no overshoot, no other station affected | `results/k1*` |
| Switching (home) | **165 of 165**, 0 flagged: pairs, re-entry during descent, sweeps, random walks | `results/k3*` |
| Quick returns, all five (office) | 4 × 320 runs (×1 twice, ×4, ×6 CPU). Engineering, Educational, Creative Studio and Experience: 0–4 per 64, each a single long frame (`defects.md`, "Not defects"). Playground: D1 and D1′ | `results/k5-*-office*` |
| Quick returns timed on the spark's clock | Playground 20 of 28 (D1); the other four **0 of 112** | `results/k5-spark-*-office*` |
| 1D quick returns (`qr-run`, `eng-return`) | Educational mouse, grid and sequences **0 of 122**. No premature light at any station. Office-only run-back timing notes | `results/qr-*-office*` |
| Click then Escape | Part-way resume on this GPU. **A/B: the same with the lifts held at 0** (13 of 21 off, 10 of 21 on) | `results/qr-edge-ab-educational-office*` |
| Chip clicks, 7 chips × 3 places × 8 moments, real navigation | **166 of 168**; the 2 misses are D2 | `results/k6-chips-office.txt` |
| Still pointer through the whole lift | **197 of 197**, one spark each | `results/k6-still-office.txt` |
| Outlines of titles and chips (Engineering, Educational) | 193 sampled pixels, 0 lost. Stopped by instruction before Playground's title | `results/k6-outline-office.txt` |
| Smoke test: navigation, keyboard, viewport (1366 × 768, 1920 × 1080) | See the list below | `results/smoke-office.txt`, `smoke-enter-check-office.txt` |
| Console errors | 0 in every run above | |

The smoke test found:

- **Layout:** no scroll, nothing clipped or unreachable.
- **Tab:** reaches all 5 triggers with a visible ring.
- **Enter and Escape:** Enter opens and powers each station (10 of 10, powered in 0.97–1.49 s); Escape returns focus to the trigger.
- **Navigation:** chip and browser Back work; the direct link is powered at once.
- **Homepage:** `/` requests nothing under `/scene/v2/`; the "Let's Talk" mail link is correct.

## Release conditions

1. **D1 fixed, or explicitly accepted by the owner.** It is visible on an ordinary quick return to Playground, and its CSS cause does not depend on the GPU. Recommended: fix before release. Playground's ring and strip should wait for the new spark like the other four stations.
2. **RTX 4060 checks (home).** Each check's command is in its defect entry.
   - **D1:** reproduce with `repro-pg-lights.mjs`.
   - **D1′:** decide with `k5-spark.mjs home 1 playground`. If the lift still leads the spark there, it joins D1.
   - **D2:** measure with `k6-pg-live.mjs`. It may be accepted as P3.
3. **Section 8 performance on the RTX 4060**, floor tone included. Run from `work/` (`RESUME.md`, section 3):
   - `k8-perf.mjs`, plain and with `?floor=approved`;
   - `perf.mjs`, plain and toned;
   - `decode.mjs`;
   - `p4-perf.mjs load` and `growth`.

   Accept if no lift adds a long frame beyond the known first-visit frame, and frames in the 800 ms after the arrival stay at the approved 47–49 (Playground) and 48 (others) from the second visit.
4. **Any fix to D1 or D2** must be followed by the switching set (`k3-switching.mjs`), Playground's quick returns (`k5-quick.mjs <label> 1 1 playground`) and `k6-hits.mjs chips`, on the RTX 4060.

## Not run (stopped by instruction; risk judged low)

These items have no failure signal from any related test:

- Captures, comparison sheets and the video (section 7, scripts not written).
- Firefox and Edge (section 12).
- `k6b-map`, `transitions`, the rest of the outlines.
- `k9-viewport` at 2560 × 1080 (1366 × 768 and 1920 × 1080 are covered by the smoke test).
- Radeon performance benchmarks.

## Probe changes

- **`analyse.mjs`:** fixed a spark-attribution bug that produced false flags under long frames (`defects.md`, last section).
- **New probes:** `k5-diag.mjs`, `k5-spark.mjs`, `qr-edge-ab.mjs`, `k6-pg-live.mjs`, `repro-pg-lights.mjs`, `smoke-office.mjs`, `smoke-enter-check.mjs`.
- **No changes** under `app`, `components`, `data`, `lib`, `public` or `scripts`.
