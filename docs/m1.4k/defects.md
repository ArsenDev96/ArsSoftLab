# M1.4K: defects

## Status (2026-11-26, after M1.4K.6–M1.4K.10)

| Defect | Status | Record |
|---|---|---|
| **D1** (P2): Playground's ring and strip lit before the new spark on a quick return | **Fixed** (M1.4K.7): two-number cycle as the other stations' (`SceneV2.tsx`). Reproduced on the RTX 4060 first, then: lit at the new arrival 15 of 16 → **0 of 16** | `PLAYGROUND-D1-FIX.md` |
| **D1′**: Playground's lift restarting before the new spark | **Closed: not reproduced** on the RTX 4060 (0 of 28; the spark starts within one frame). Office GPU timing | `HOME-VERIFICATION.md` §4 |
| **D2** (P3): AZIZ chip sliding from under the pointer while Playground sinks | **Accepted as a documented P3.** Not reproduced on the RTX 4060 (54 of 54): there the platform is already low when the pointer arrives. Remains possible with a slow GPU's late frames; clicking again works | `HOME-VERIFICATION.md` §4 |
| Arcade screen lit on a quick return while the ring and strip are dark (found after D1) | **Fixed** (M1.4K.9): dark until the new spark, same game continues | `PLAYGROUND-SCREEN-LIGHTING.md` |
| Engineering "powered but not lifted" on a quick return (M1.4K.7 caveat) | **Closed: test false positive** (M1.4K.8). `k3-switching`'s end check corrected; no application change | `ENGINEERING-QUICK-RETURN.md` |

The text below is the review's original record (office computer), kept as it was.

---

Two confirmed defects, both Playground's. **No P0 or P1.** Application code was not changed.

Reproduced on the office computer (Chrome 158, AMD Radeon HD 5450, 1648 × 928, dev server on :3002). Both still have to be confirmed on the RTX 4060 (commands below). Scripts and data are in `work/` and `work/results/`.

Severity: **P2** is a visible error in a normal interaction, with no loss of function. **P3** is minor or rare, with a workaround.

---

## D1 (P2): Playground's ring and strip light up before the new spark on a quick return

**What happens.** The pointer leaves Playground shortly after its spark lands and comes back within about 150 ms. A new spark starts and travels for about 650 ms. During that travel the ring and strip light reach full strength **before** the new spark arrives. The lift itself waits for the new spark, as it should, so the light and the lift are out of step. The other four stations wait for their spark.

**Reproduce.** `node repro-pg-lights.mjs 2`. The pointer leaves 0, 40, 80 or 150 ms after the arrival, timed on the spark's own clock, and returns after one frame or 50 ms. Creative Studio is the control.

| | Valid quick returns | Light when the new spark lands | Light ≥ 90 % more than 18 ms early |
|---|---|---|---|
| **Playground** (ring + strip) | 13 | **0.73–1.00 in 13 of 13** | **7 of 13**; up to 283 ms early (50 % up to 733 ms early) |
| Creative Studio (control) | 15 | **0 in 15 of 15** | 0; its lights start 160–277 ms after the arrival |

Three runs per station were excluded: the hover's drop and return fell inside one long frame.

**Corroborating runs:**
- `k5-spark.mjs`, Playground: 20 of 28 flagged.
- The other four stations: 0 of 112.
- `k5-quick` grid (corrected analyser), Playground flagged in 18–26 of 64 per pass at ×1, ×4 and ×6 CPU:
  - **7–9 per pass are this light alone.**
  - **11–17 per pass are the lift (D1′).**

**Likely cause.** Read-only inspection, not yet confirmed by a fix. In `components/lab/SceneV2.tsx`:
- Playground's ring (`.lab-v2-power-lit`, lines 125–126) and unpowered-strip overlay (`.lab-v2-strip-off`, lines 283–284) are plain opacity transitions on the hover attribute.
- On leave they fade only **after a 160 ms delay**. A return inside that window lets the light carry on from its current level instead of waiting through `--arrive-now` for the new spark.
- The other stations' effects run on progress numbers that M1.4I.1 gave run-back handling; Playground's ring and strip never got it.

Because the mechanism is CSS timing rather than frame rate, it is expected to occur on the RTX 4060 too.

**Related, unconfirmed off the office GPU (D1′).** After a return while Playground is partly raised, its **lift** climbs again before the new spark arrives:
- `k5-spark`: 4 of 4 with the pointer leaving 300 ms after the arrival, from 5.8–11.4 px to 7–16 px.
- `k5-quick`: 11–17 of 64 per pass.

The spark's clock started 100–200 ms late in those runs. Home's k3 "re-entering during descent" set (55 runs) had 0 such flags, and Playground's lift is not driven by the same CSS number as the other four. So until the RTX 4060 run says otherwise, this is attributed to the office GPU's late spark clock: the lift keeps time with the hover's `--arrive-now` while the drawn spark is late. **If it reproduces on the RTX 4060, raise it to P2 with D1.**

**Verify on the RTX 4060:** `node repro-pg-lights.mjs 2` and `node k5-spark.mjs home 1 playground`.

---

## D2 (P3): the AZIZ chip can slide out from under the pointer while Playground sinks

**What happens.** In the first ~150 ms of Playground's descent, the pointer lands on the chip where it is drawn and the station is hovered again (one new spark). The lift waits for that spark, so it keeps sinking, and the chip moves 11–14 px down in the next frames. At the pill's rounded **left end** the pointer is then above the chip, on the label. A click there does nothing. The centre of the chip is not affected.

**Reproduce.** `node k6-pg-live.mjs 3`: three moments in the descent × press 0, 30 or 150 ms after arriving × left end or centre, 54 clicks.

| Press after the pointer arrives | Left end | Centre |
|---|---|---|
| 0 ms | 7 of 9 opened | 9 of 9 |
| 30 ms | 7 of 9 | 9 of 9 |
| 150 ms | 6 of 9 | 9 of 9 |

- All 7 failures came 120 ms into the descent: chip moved 11.2–13.8 px, and the element under the pointer at the press was the label.
- The first, smaller run (`k6-pg-live-office-first.txt`) failed 2 of 6 and 1 of 6.
- `k6-hits chips`: 166 of 168. The 2 misses are this case: Playground, left end, sinking at 120 and 260 ms.

**Not the M1.4I.2.1 defect.** That fix covers a chip that **rises** under a still pointer: its hover strip extends below the pill. Here the chip **sinks** away from the pointer. M1.4I.2.1 left out runs where "the chip had moved from under the pointer before it arrived".

**Impact.** Only the outer few pixels of one chip, and only in the first part of the descent. Clicking again works. The slow office frames widen the window; expect it to be rarer on the RTX 4060.

**Verify on the RTX 4060:** `node k6-pg-live.mjs 3`.

---

## Not defects (office GPU timing, recorded for the RTX 4060 comparison)

These appear only on the Radeon HD 5450. None shows light or movement that the eye would place before its spark, except where noted as a single frame.

| Observation | Evidence | Why it is not classed as a defect |
|---|---|---|
| The spark's clock starts **50–417 ms** after the hover (home: ≤ 17 ms). Starting a spark costs one **133–150 ms frame** | `k5-*-office.txt`, `k5-diag-*-office.json` | GPU load. Feeds the performance check on the RTX 4060 |
| Engineering, Educational, Experience: 1–4 flags in 64 per pass, each a **single frame**: sub-pixel lift, scan light 0.09, Educational's strip pulse (the M1.4J.2 office case), or a progress number (`--xs`, `--gp`) moving with nothing visible | `k5-again/x4/x6-office.txt` | One frame of 133–267 ms against an 18 ms allowance |
| Click, then Escape: the sequence resumes part-way (Educational 4 of 7; home M1.4I.1: 0 of 7) | `qr-educational-office.txt` | **A/B, lifts held at 0: 13 of 21 against 10 of 21 with the lifts.** Not caused by the lifts; slow frames delay the run-back |
| Creative Studio, Experience, Engineering: "held through charge" in 1–17 of 91–130 runs; "scan not from the top" 10 of 130; "not at rest" at the log's end 11 of 130 | `qr-*-office.txt` | Run-back finishing one long frame past the probe's window; 0 premature light; at rest at the next run |

## Test-script defect (fixed)

`work/analyse.mjs` dropped a visit's spark when the first frame showing it came more than 40 ms after the spark started. That happens on every long frame. The whole visit was then judged as "before arrival", giving false "rises before its spark" flags: 17 of the 40 flags in `k5-b-office`.

- Reproduced 6 of 6 (`k5-diag.mjs`).
- Fix: a visit that is opened *because* a new spark appeared owns that spark.
- Re-checked: 4 of 4 clean, and the re-runs have 0 such flags.
- The change can only add a spark to a visit that had none. Home's k3 and k5 had 0 flags.
