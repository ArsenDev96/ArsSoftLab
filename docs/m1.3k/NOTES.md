# M1.3K: Playground 2.5D artwork reconstruction (prepared; artwork not produced)

**SA-1 has failed; the current lift is not approved.**

This milestone does not produce the missing artwork. The floor and architecture hidden by Playground were never painted, and with the tools allowed here (no new models, no uploads, no procedural or hybrid synthesis) they can't be produced convincingly. **They need genuine illustration.**

What this milestone delivers:
- an exact artwork package;
- a brief;
- an inventory;
- an integration pipeline that is tested and ready for the illustration once it exists.

**No background has been completed. The experimental implementation is unchanged** (`public/` untouched), and the default build is unchanged.

## Documents

| File | For |
|---|---|
| [`ARTWORK-BRIEF.md`](ARTWORK-BRIEF.md) | The illustrator: Assets A, B and A2, priorities, what is original and what is new, rules, deliverables |
| [`ASSET-INVENTORY.md`](ASSET-INVENTORY.md) | Every existing asset and whether it is usable, to be regenerated, or replaced |
| [`INTEGRATION-PLAN.md`](INTEGRATION-PLAN.md) | How a delivery is checked, staged, applied and compared; the code changes needed |
| [`package/`](package/README.md) | Source, masks (1× and 2×), provenance map, context, guides, floor references, defect examples |
| [`selftest/`](selftest/) | Proof that the pipeline is exact (no artwork involved) |

## Measured (from the existing assets)

| | px |
|---|---|
| Station footprint (new illustration) | 42,149 |
| Blend margin (original pixels) | 5,502 |
| Floor hidden at rest | 6,698 |
| **Uncovered by the 18 px lift** | **6,779** |
| Of which, floor (crescent along the base's front edge) | 6,512 |
| Of which, wall at cabinet height | 256 (left of the marquee x 1082–1137 y 350–450, where the cabinet's top is wider than its body; a thin strip beside the right side panel) |
| Of which, near the base | 11 |
| Uncovered at 24 px (safety margin) | 8,709 |
| Station soft edge | 2,881 |

The lift exposes a little wall, not only floor, because the cabinet's outline narrows below the marquee. M1.3J.5 counted 128 px at the top of the cabinet with a different threshold; this count is only the pixels whose coverage actually drops when the station lifts.

## The pipeline: `scripts/playground-artwork.py`

- **`package`:** builds `package/` from the plate, the M1.3I/M1.3J masks and the current layers. One new mask is computed rather than traced: what the lift uncovers, from the cut-out's alpha and the exact CSS transform. Deterministic.
- **`check`:** validates a delivery. The checks are listed in `INTEGRATION-PLAN.md`. Review sheets include an offline lifted preview at 2× and 3×.
- **`stage`:** writes the layer files to `docs/m1.3k/staging/<id>/` with an `APPLY.md`. It never writes to `public/`.
- **`selftest`:** all four tests pass (`selftest/selftest.json`):
  1. **Round trip.** The current environment as a delivery (a pipeline test, not a candidate) stages to exactly today's `background.png` (identical) and `object.png` (edge re-solve: max change 0). The floor footprint matches.
  2. **The plate itself.** The station isn't removed, so it fails "station removed" (100% of the interior still the plate).
  3. **A 1 px shift.** Detected: "best shifted by dx 1".
  4. **A 2× delivery.** Downsamples onto the scene exactly.

**Calibration findings:**
- **The repetition check works.** It flags the current hybrid floor: 9 of 97 windows have near-copies, worst NCC 0.98 against 0.83 for the real floor. That is M1.3J.2's offset copies of real grain.
- **Blur can't be measured reliably here.** Local detail doesn't separate the rejected floors from the real floor:

  | Floor | Detail ratio against the real floor |
  |---|---|
  | M1.3H | 1.40 |
  | Hybrid | 1.21 |
  | LaMa c2 | 1.09 |
  | LaMa c1 | 1.73 |

  The floor in front is itself dark and soft at 1×. The sharpness check is therefore only a guard (it warns below 0.5× or above 2×), and blur is judged in the owner's 3× review. Mid-frequency and directional measures were tried and don't separate them either.
- **The at-rest check compares against the plate, not the line-free environment.** The corrections layer also rewrites pixels under the base, which the station covers. The current layers score a 99th percentile of 8.3 levels offline; the browser refine in M1.3J.2 absorbs that.

## Report

### 1. Which assets are already usable

- **Sources:** the plate, the approved reference, and the line-free environment (the paint base).
- **Masks:** all of them (M1.3I remove and floor masks, the M1.3J hidden-floor mask, the lines), plus the new lift-exposure masks.
- **Layers:**
  - the five power connections;
  - the platform strips;
  - the arcade screen;
  - the reflections;
  - the contact and ambient shadows, valid while the cut-out's bottom edge stays the same;
  - the contact-unlit method (regenerated from the new floor).
- **Interim:** the current cut-out (`object.png`), with its soft-edge colour re-solved by staging.
- **Not usable:** the synthesised `background.png` and the hybrid `floor.png`.

### 2. Which regions require genuine illustration

**Asset A:** the whole 42,149 px footprint. In order:
1. **The 6,779 px the lift uncovers:**
   - the floor crescent under the base's front edge (6,512 px);
   - wall left of the marquee and beside the right side panel (256 px);
   - 11 px near the base.
2. **The 24 px safety margin** (8,709 px in total).
3. **The rest of the hidden floor.**
4. **The wall, back step and room behind the cabinet.** The current lift never shows this, but a complete environment needs it.

**Optionally (Asset A2),** the 1,764 px of contact rows under the base, painted without the station's light.

### 3. Whether the existing cut-out needs re-matting

**Yes.** `package/03-context/station-cutout-defects.png` shows the defects.
- **Marquee:** a dark band of wall and glow a few px wide is cut out with the marquee and its right-hand box, and rides the lift as a dark halo.
- **Base bottom:** lit floor is attached along its bottom edge, with notches under the lit strip.
- **Far-right corner:** its matte was rebuilt by code (M1.3J.2) and should be checked by the artist.

Until Asset B arrives, the current cut-out works as an interim: staging re-solves its edge colour so the switch at arrival is unchanged.

### 4. Whether the new artwork can be integrated without major code changes

**Yes.**
- **Asset A (and A2):** no code change. The files keep their names; copy, regenerate the contact rows, refine the edge in the browser. No rebuild.
- **Asset B:** a small script change. `make-scene-layers.mjs` must read the station from `object.png` and stop rewriting `background.png`, so the shadows follow Asset B's bottom edge; `playground-edge.py` must skip its corner rebuild.
- **The animation system, the components and the CSS are untouched.**

### 5. What an illustrator or artwork workflow must provide

Brief, section 7:

| File | Required |
|---|---|
| `playground-environment@2x.png`: 3344 × 1882 sRGB RGB, the full flattened frame, approved pixels outside the remove mask | **Yes** (or the 1× equivalent) |
| `playground-station@2x.png`: RGBA, straight alpha | **Yes** |
| The layered working file (PSD or KRA) | Yes |
| `NOTES.txt` on what was invented | Yes |
| `playground-contact-rows@2x.png` | Optional |

Deliver in two passes: the floor crescent and exposed wall first, then the rest of the footprint.

### 6. Blockers

- **No one to paint it.** No illustrator or approved artwork workflow is engaged.
- **No permitted way to produce it here.** Every tool on this machine falls into a route the brief excludes:
  - generative models would need downloads;
  - online generators (including Photoshop's Generative Fill) would upload the artwork;
  - Photoshop's Content-Aware Fill and the earlier patch, LaMa and hybrid methods are procedural.

  Photoshop 2024 is installed locally, and an illustrator could use it to paint.
- **Owner decisions:**
  - who paints;
  - whether an AI-assisted workflow with hand review is acceptable, and if so which service may receive the artwork;
  - whether the artist also re-mattes Asset B (recommended), or it stays an interim.

**This milestone cannot produce the necessary artwork with the available tools.**

## Validation

- `selftest`: 4 of 4 pass.
- **Nothing outside `scripts/playground-artwork.py` and `docs/m1.3k/` changed.** No file in `public/`, `components/`, `app/`, `lib/` or `reference/`, nor `next.config.ts`, `tsconfig.json` or `package.json`, is newer than M1.3J.5.
- `npm run typecheck`: pass.
- **Not done** (no artwork exists): no full visual suite, no browser runs, no integration.

## Files

**New**

- `scripts/playground-artwork.py`
- `docs/m1.3k/**`
