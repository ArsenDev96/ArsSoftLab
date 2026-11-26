# M1.4K: integration review of the five platform lifts (`/lab-v2`)

## Status after M1.4K.6–M1.4K.10 (2026-11-26): **GO for the desktop laboratory checkpoint**

| Item | Outcome | Record |
|---|---|---|
| RTX 4060 verification (Cinematic, Lite, selector, performance, defects, visuals) | **Completed.** Both modes pass; 60 fps from the second visit; the selector takes 31–49 ms in production (its 0.65–1.9 s delay was the dev server's) | [`HOME-VERIFICATION.md`](HOME-VERIFICATION.md) |
| **D1** (P2): Playground's ring and strip lit before the new spark | **Fixed** (M1.4K.7): they stay dark until it arrives, 0 of 16 / 0 of 12 lit before it | [`PLAYGROUND-D1-FIX.md`](PLAYGROUND-D1-FIX.md) |
| **D1′**: Playground's lift before the new spark | **Closed: not reproduced** on the RTX 4060 (0 of 28). Office GPU timing (late spark clock) | `HOME-VERIFICATION.md` §4 |
| **Arcade screen** lit on a quick return while the ring and strip are dark | **Fixed** (M1.4K.9): dark until the new spark; the same game continues (no restart) | [`PLAYGROUND-SCREEN-LIGHTING.md`](PLAYGROUND-SCREEN-LIGHTING.md) |
| Engineering "powered but not lifted" on a quick return | **Closed: test false positive** (M1.4K.8). The lift reaches 12 px in every traced return; `k3-switching`'s end check read the height too early and now waits for it. No application change | [`ENGINEERING-QUICK-RETURN.md`](ENGINEERING-QUICK-RETURN.md) |
| **D2** (P3): AZIZ chip sliding from under the pointer while Playground sinks | **Accepted as a documented P3.** Not reproduced on the RTX 4060 (54 of 54); needs the late frames of a slow GPU | `defects.md`; `HOME-VERIFICATION.md` §4 |
| **Floor tone** | **Approved for Cinematic** (M1.4K.10): the warmer M1.4G tone is now `/lab-v2`'s default. **Lite keeps its untoned floor.** `?floor=original` and `?floor=approved` choose either in both modes | below |

**Outstanding (owner's choice not to run a full regression):** after the D1 and screen fixes, release condition 4 below is only partly done.

- **Run:** `k3-switching` (narrowed to Playground and Engineering: `k3-pg-eng.mjs`), `d1-check`, `k1`, Lite and reduced-motion checks.
- **Not run:** the full `k3-switching`, `k5-quick … playground` and `k6-hits chips` on the RTX 4060.

### M1.4K.10: floor tone

- **Change:** one line in `app/lab-v2/page.tsx`. It reuses M1.4G's `FloorTone` layer; no new effect, artwork or texture.

  | `floor` | Cinematic | Lite |
  |---|---|---|
  | (none) | **tone** (new default) | untoned (unchanged) |
  | `approved` | tone | tone (as before) |
  | `original` (new) | untoned | untoned |

- The homepage `/` is unchanged: it renders the plate scene, which has no tone layer.
- **Checks** (RTX 4060, Chrome 158, 1648 × 928, dev server):
  - **Server:** the right floor for 7 URL forms.
  - **Browser:** `work/floor-check.mjs`, **16 of 16**:
    - direct links;
    - Cinematic ↔ Lite through the selector, keeping station, project and floor, with no reload;
    - Back and Forward across mode and lab entries;
    - Escape;
    - explicit `original` and `approved` kept through both modes;
    - 0 console errors.
  - **Selector:** the M1.4K.5B pass, 14 of 14.
  - **Appearance** (frozen captures, `work/results/capture-compare-m1410.txt`), every state matching an earlier capture to max 1 of 255:
    - the new default against the old `?floor=approved`: rest, Engineering, Playground;
    - `?floor=original` against the old default;
    - Lite against earlier Lite captures and against a pre-change build captured in the same session.

    Remaining differences are the documented Playground-edge sub-pixel patch, which switches between captures independently of the build.
  - TypeScript passes.

## Original recommendation (M1.4K review): **CONDITIONAL GO**

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

## Release conditions (as set by the review; status at the top)

1. **[Done: fixed, M1.4K.7]** **D1 fixed, or explicitly accepted by the owner.** It is visible on an ordinary quick return to Playground, and its CSS cause does not depend on the GPU. Recommended: fix before release. Playground's ring and strip should wait for the new spark like the other four stations.
2. **[Done, M1.4K.6]** **RTX 4060 checks (home).** Each check's command is in its defect entry.
   - **D1:** reproduce with `repro-pg-lights.mjs`.
   - **D1′:** decide with `k5-spark.mjs home 1 playground`. If the lift still leads the spark there, it joins D1.
   - **D2:** measure with `k6-pg-live.mjs`. It may be accepted as P3.
3. **[Done in substance, M1.4K.6: `lite-perf`, tone included; `k8-perf`, `decode` and `p4-perf` not run]** **Section 8 performance on the RTX 4060**, floor tone included. Run from `work/` (`RESUME.md`, section 3):
   - `k8-perf.mjs`, plain and with `?floor=approved`;
   - `perf.mjs`, plain and toned;
   - `decode.mjs`;
   - `p4-perf.mjs load` and `growth`.

   Accept if no lift adds a long frame beyond the known first-visit frame, and frames in the 800 ms after the arrival stay at the approved 47–49 (Playground) and 48 (others) from the second visit.
4. **[Partly done: Playground and Engineering switching, `d1-check`, `k1`; the full sets not run]** **Any fix to D1 or D2** must be followed by the switching set (`k3-switching.mjs`), Playground's quick returns (`k5-quick.mjs <label> 1 1 playground`) and `k6-hits.mjs chips`, on the RTX 4060.

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
