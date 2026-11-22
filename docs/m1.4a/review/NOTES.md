# M1.4A: generated 2.5D assets for Playground (A/B test)

**Result: the candidates fail validation and can't enter the pipeline. This is an experimental comparison only. Nothing is enabled, `public/` and both builds are unchanged, and SA-1 is not approved.**

The generated pair is a **re-render of the whole lab**, not an edit of the approved plate. So it can't be used as Asset A/B:
- every pixel differs slightly;
- geometry drifts by up to 0.9 px;
- the floor around Playground is relit.

**Seen on its own, the visual-only variant gives the most convincing lift so far.** The gap is open and sharp, and there's no black band or blur. But that is only because the whole lab is the generated image, which is a different picture from the approved one.

## What was tested

| Variant | How | Pixel-preserving |
|---|---|---|
| **Approved** | Default build, :3000 | yes |
| **M1.3J** | Experimental build, :3001, as it is | yes |
| **M1.4A strict** | :3001 with the M1.3K pipeline's own staging of the pair, run with `--force` despite the failures. The approved plate is kept outside Playground's footprint; the candidate is used inside it. | no: fails validation |
| **M1.4A visual-only** | :3001 with the generated frame (environment + station) replacing the whole plate. The existing connection, strips, shadows, reflections, 18 px lift and arcade are unchanged. | **no**: the whole lab changes |

**How the variants are isolated:**
- The candidate files are served only to a headless browser, by request interception (CDP `Fetch`), from `docs/m1.4a/preview/`.
- The served files were checked: every candidate file was requested and replaced.
- The default build requested no `layers25d` file.
- All four variants use the same viewport (1648 × 928), the same pointer positions and the same camera rect (asserted equal).
- Phases are paused and seeked:

  | Phase | Time | Lift |
  |---|---|---|
  | B. arrival | 667 ms | 0.1 px |
  | C. half way up | 841 ms | 8.9 px |
  | D. full lift | | 17.75 desktop px |
  | F. half way down | 147 ms after hover ends | 8.9 px |
  | G. live hold | 3 s, real time | arcade running |

## 1. Inspection

**Formats:** all three are 1672 × 941 PNG, RGBA, 8-bit, with no ICC or gamma chunk.

**`environment.png`**
- Fully opaque, but it is a **new image everywhere**:
  - 1,382,331 of the 1,525,701 px outside the remove mask (90.6%) differ from the plate by more than 2 levels;
  - mean difference 15.5, 99th percentile 113;
  - local shifts of 0.1–0.9 px that vary across the frame, so this is a local warp, not one offset.
- The power lines are gone everywhere.
- The floor around Playground is relit: luminance 86 against 67, mean difference 46.
- Other stations: mean difference 19–27 levels each.

**`playground.png`**
- Has real alpha, but:
  - **only 100 px are fully opaque.** The body is alpha 250–254, so 1–2% of the background shows through the whole cabinet;
  - **102 stray pixels** lie far from the station (x 41–1625, y 56–922), all at alpha 1, so invisible;
  - 248 px fall outside the remove mask.
- **It is also a re-render:** only 15.5% of the interior is within 3 levels of the plate (median difference 9).
- The silhouette is close but not the same:
  - IoU 0.925 with the current cut-out;
  - bottom edge 0.5 px lower on average (−2 to +6);
  - content shifted about 0.8 px to the right.
- **The marquee now reads "Playground".** The approved design's marquee is illegible stylised lettering.

**`connection-reference.png`**
- No opaque pixels; 11,815 faint (alpha ≤ 11) stray pixels.
- **A different route from the approved line:**
  - it starts at the hub's front rim and ends on the platform's stone face, not the floor;
  - x 820–1219 against 894–1099;
  - about 25 px lower.
- **Not used.** The preview keeps the existing connection layers.

**Details:** `inspection.json`.

## 2. The artwork checker (`scripts/playground-artwork.py check`)

Full report: `checker/report.md` (also at `docs/m1.3k/deliveries/m1.4a-generated/`). Nothing was relaxed.

| Check | Result |
|---|---|
| size | OK |
| **alignment** | **FAIL**: around the station the delivery differs from the plate by 36.2 levels (tolerance 1); repainted or regraded |
| **outside-mask** | **FAIL**: 1,270,094 px outside the remove mask differ from the plate (the whole frame) |
| **object-extent** | **FAIL**: 184 px of the station outside the remove mask |
| station-removed | OK (0.2% of the interior still the plate) |
| station-light | WARN: 483 px of neon or strip colour in the footprint (a lamp in the new back wall, and glow) |
| sharpness | WARN: uncovered floor detail 11.7 against the plate's floor 2.4 (×4.8). Against the candidate's *own* floor in front it is 11.8 against 13.9, so it is consistent within the new image, not blurred. |
| tone | INFO: uncovered floor luminance 90 against the plate's 36 (the candidate's own floor in front: 89) |
| seam | OK (step at the footprint's edge 4.4 against 7.0) |
| repetition | WARN: 11 of 97 floor windows have a near-copy (worst NCC 0.91; the real floor's own worst is 0.83) |
| **at-rest** | WARN: station over this environment against the plate, at the switch: mean 20.4, 99th percentile 140 (current layers: 8.3) |

**The checker's verdict stands: the pair fails.** The failures aren't fixable by re-grading. The station and floor were redrawn, not preserved.

## 3. Comparison (`idle-comparison.png`, `lifted-comparison.png`, `lifted-no-shadow.png`, `station-edges-3x.png`)

| | Approved | M1.3J | M1.4A strict | M1.4A visual-only |
|---|---|---|---|---|
| At rest vs approved (mean difference: other stations / Playground) | 0 / 0 | ≤0.05 (hub 0.33) / 0.09 | same as M1.3J | **12–17 / 25**: a different picture |
| Switch at arrival (B) | none | invisible | **visible pop**: marquee, floor and edges change | invisible (consistent with its own rest) |
| Gap open at 18 px | yes | yes | yes | yes |
| Floor in the gap, normal size | | dark, soft, reads as a step | bright glossy patch inside dark approved floor | **sharp, glossy flagstone, continuous with the floor around it** |
| Floor in the gap, 3× | | soft, hybrid grain | hard seams and stepped outline at the footprint's edge, specks | joints and window reflections continue; slightly soft in places, no smearing |
| Black bands | no | no | no | no |
| Blurry patches | | yes (the gap) | no | no |
| Station outlines | | dark marquee halo | stray dark wall pixels left of the marquee (footprint mismatch) | **clean, no halo** |
| Arcade screen | works | works | works | works; the canvas sits inside the new bezel |
| Strips, reflection | aligned | aligned | aligned | aligned |
| Connection line | | | approved | **mismatched**: the existing line layer carries the plate's floor, showing as a darker stepped patch left of the base at rest and lifted |
| Other four stations | | unchanged | unchanged | **all changed** (re-rendered) |

**Videos:**
- `playground-test.webm`: visual-only, real time; idle, arrival, lift, hold, return.
- `playground-test-strict.webm`: the strict variant.

## Report

**1. Which assets passed.**
- None passed as a whole.
- Format and size pass for all three. The environment is opaque and the station has real alpha.
- The station is removed from the environment, and the seam step is OK.

**2. Which failed, and why.**
- **The environment:**
  - alignment and outside-mask fail: it is a full re-render, relit around Playground, with sub-pixel warps;
  - repetition warns;
  - the floor is 2.5× brighter than the approved floor.
- **The station:**
  - object-extent fails;
  - it is also a re-render (only 15.5% of the interior near the plate);
  - near-opaque body (alpha 250–254);
  - changed marquee lettering;
  - invisible stray pixels.
- **The connection reference:** a different route from the approved line; not usable.

**3. Is the new background visibly better?**
- **As a 2.5D floor, yes:** in the visual-only variant the gap is a sharp, convincing continuation of the floor.
- **As a replacement for the approved background, no:**
  - it changes the whole lab;
  - it relights Playground's surroundings;
  - inside the approved plate (strict) it is a bright, mismatched patch.

**4. Is the station cut-out usable?**
- **Its matte is good:** clean edges, no dark halo or floor fragments.
- **It isn't the approved station:** redrawn pixels, new marquee lettering, a slightly different outline. It only matches the generated environment, not the approved plate, so the strict variant pops at arrival.
- It would also need a fully opaque body and the stray pixels cleared.

**5. Does the 18 px gap look convincing?**
- **Visual-only: yes**, the most convincing so far, at normal size and with shadows off.
- **Strict: no**, because of the seams.

**6. Remaining defects (visual-only variant):**
- every station and the hub differ from the approved design;
- the existing connection layer's plate floor shows as a stepped dark patch at the base's left corner;
- the marquee lettering has changed;
- the base's lit strip and the cabinet glow are baked into the generated station;
- the floor is noticeably brighter and glossier than approved;
- the floor shows mild repetition (NCC 0.91).

## What would make this usable

**Option A: keep the approved plate.**
- The same generation would have to preserve the approved pixels outside the mask:
  - environment: an inpaint restricted to `02-masks/6-remove-with-6px-margin.png`, with the plate composited back outside it;
  - station: the approved plate's own pixels inside the matte.
- The floor's tone would have to match the approved dark flagstone.
- Then re-run the checker.

**Option B: adopt the generated lab as the new design.**
- That is a redesign, and the owner's decision.
- It would need:
  - all five connection layers, strips, reflections and masks rebuilt from it;
  - a new approved reference.

## Validation

- `scripts/playground-artwork.py check`: run as above (4 FAIL, 4 WARN).
- `npm run typecheck`: pass (tsc exit 0).
- Targeted browser checks: `scripts/visual/m14a-preview-capture.mjs` (4 variants, 9 captures each, 2 recordings).
- **No build.** No implementation change needed one.
- **Not run:** the full visual suite.
- **Untouched:**
  - nothing in `public/`, `components/`, `app/`, `lib/` or `reference/`, nor `next.config.ts`, `package.json` or `tsconfig.json`, is newer than M1.3K;
  - both servers are unchanged.

## Files

**New**
- `scripts/m14a-preview.py`:
  - inspection;
  - forced staging and visual-only assets into `docs/m1.4a/preview/`;
  - `sheets` builds the comparisons.
- `scripts/visual/m14a-preview-capture.mjs`: captures and recordings, by request interception.
- `docs/m1.4a/preview/`:
  - preview assets and `manifest.json`;
  - `strict-stage/` has a `NOT-FOR-APPLY.txt` and no `APPLY.md`.
- `docs/m1.4a/review/`:
  - this file, the four sheets and two videos;
  - `inspection.json`, `rest-diff-vs-approved.json`;
  - `checker/`;
  - `captures/<variant>/` with `meta.json`.

**Changed**
- `scripts/visual/record.mjs`: an optional `setup` hook before navigation (backward-compatible).

**Finding about an earlier script**
- `scripts/visual/playground-depth-evidence.mjs` seeks the return 30 ms after the pointer leaves. Hover ends only after LabState's ~100 ms grace period, so its "returning" frame is really the full lift.
- The M1.4A script waits for hover to clear. The old script is not changed.
