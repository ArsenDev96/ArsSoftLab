# M1.3J.1: local LaMa inpainting of Playground's hidden floor

**Result:** LaMa ran locally on the GPU, and its output went through the existing pipeline into the experimental build only. **No candidate was convincing**, so the experimental build is back on the M1.3I floor (`floor.png` cleared). The best candidate (c2) can be switched on with one command for your own look.

Setup, sizes and licences: [`SETUP.md`](SETUP.md).

## What was run

- **Inputs:** the prepared 512 × 192 crop at scene (962, 432) and its 2× version, and the exact mask of the **6,698 px hidden at rest**.
- **No station in the input:** the station is replaced in the context (0 px of arcade, controller or platform left).
- **No artwork changed:** the approved artwork was not altered. The candidates differ only in the context and mask LaMa was given.

**Pilot (rejected; `pilot/`).** The context was built on the plate. LaMa carried the plate's orange strip reflection and line end, which sit just under the contact line, up into the band as an orange smear (`pilot/raw-outputs-3x.png`).

In the 2.5D build that reflection and the lines are separate layers. So the honest context is the **environment layer** (plate without lines and without the strip reflection), which is what really surrounds the gap. `prepare` now also writes `context-env.png` and its 2× version.

**Candidates** (`candidates/`; all on the environment context):

| | Input | Mask |
|---|---|---|
| c1 | 1×, 512 × 192 | The floor band |
| c2 | 2×, 1024 × 384 (averaged back to 1× on integration) | The floor band |
| c3 | 2× | The whole hidden area (so LaMa doesn't lean on M1.3I's synthesis above the band); only the band is composited back |

Each was integrated with `scripts/inpaint-playground.mjs` and checked in the browser (`records/<name>/`).

## Checks (all three, all OK)

- Only the 6,698 hidden pixels were written. **Identity outside the mask: exact** (the script fails otherwise).
- Idle: the candidate changes nothing at rest (0 px).
- Lifted, shadows off: **nothing outside the floor mask changes** (max 0). The connection, reflection, foundation and station are untouched, so their alignment is unchanged.
- The default build never references the candidate.
- `npm run typecheck`: pass. No production build was needed: no app code or configuration changed for this run, only data in `public/` and `docs/`.

## Measurements

| | Band tone | Fine detail | Step at the contact line | Station edge at the arrival instant (max /255) |
|---|---|---|---|---|
| Real floor in front of the station | 40.1 | 0.78 | | |
| M1.3I floor (current) | 45.3 | 0.86 | 16.4 | 47 |
| c1: LaMa 1×, band | 46.0 | 1.05 | 8.6 | 81 |
| **c2: LaMa 2×, band** | **41.0** | **0.69** | 12.5 | 38 |
| c3: LaMa 2×, whole hidden area | 36.4 | 0.83 | 12.3 | 81 |

Band tone is mean luminance; fine detail is mean |Laplacian| per pixel. A higher detail value can also mean blotches or smears, so it only counts together with the images.

## Visual findings

Sheets:
- `lift-gap-3x-no-shadow.png`: 3×, lifted 18 px, shadows off.
- `lift-gap-1x-no-shadow.png`: normal size.
- `gap-texture-4x.png`: 4×, shadows **and** the foundation joint hidden, to judge texture alone.

| Candidate | Verdict | Why |
|---|---|---|
| c1 | **Rejected** | A warm orange wash across the band: LaMa spreads the floor's lit arc round the base. Muddy at 3×. |
| c3 | **Rejected** | Too dark: the band reads as a black recess or shadow. A lighter horizontal streak runs through it, and there's a notch at the left end. |
| **c2** | **Best LaMa candidate; not convincing** | The most continuous and the closest tone to the floor in front: no orange, no blotches, no mirroring, no invented rings, objects or lights. But it is **soft**: no grain and no tile seams, a smooth dark-stone band. It trades the M1.3I floor's patchiness for softness, which the brief and SA-1 rule out. |

**At normal size** (1648 × 928) the four look almost the same: the gap reads as a dark band under the lifted platform. The differences only show at 3–4×.

## Why LaMa falls short here

LaMa reconstructs **structure and low frequencies** well, but over a thin band it fills with smooth, averaged texture. Here the "texture" to match is the fine, noisy grain of a painted, polished floor. That grain is barely above the noise at 1×; at 2× LaMa still smooths it. It also has no tile seam to continue, because the floor's seams under the station run behind the platform and never appear in the context.

## SA-1

**Not met.**
- **c2:** meets "no mirroring, no artificial colour patches, no orange smears, static floor, verified at 1× and 3× with shadows off". It **fails** "without visible blur": the band is visibly smoother than the floor at 3×.
- **The M1.3I floor:** still fails on patchiness (M1.3H findings).

## Recommendation

**Keep the M1.3I floor.** If you want to judge c2 yourself in the experimental build:

```bash
npm run inpaint:playground -- integrate docs/m1.3j/lama/candidates/c2-env-2x-floor.png --name c2-env-2x-floor --root docs/m1.3j/lama/records
# back to the M1.3I floor:
npm run inpaint:playground -- clear
```

**Next approach, in order:**

1. **Hybrid (no new download).** Take c2's tone and continuity (its low frequencies) and add real floor grain (high frequencies) copied from the floor in front, M1.3H-style. That targets the one thing c2 lacks without bringing back the blotches. It's a quick experiment with the existing pipeline.
2. **Photoshop Content-Aware Fill** (installed, local), using `inpaint/mask-floor.png` and `mask-sampling.png`.
3. **An illustrator** paints the 6,698 px at 2× (brief: `../../m1.3i/background-requirements.md`). The surest route to "sharp, continuous, believable".
4. **Diffusion inpainting** (for example SDXL inpaint, about 7 GB, low denoise on the 2× input) adds real grain, but risks invented seams and objects. Only with your approval.

The experimental 2.5D build stays off by default. Nothing here is approved.

## Files

**New**
- `scripts/lama-inpaint.py`
- `docs/m1.3j/lama/**`
- `docs/m1.3j/inpaint/context-env.png` and `2x/context-env@2x.png`

**Changed**
- `scripts/inpaint-playground.mjs`: `--root`, and the environment context in `prepare`.

**Outside the repo:** `E:\ArsSoftLab-tools\` (Python, venv, model).

**Unchanged:** the approved build, `floor.png` (cleared), all application code and configuration.
