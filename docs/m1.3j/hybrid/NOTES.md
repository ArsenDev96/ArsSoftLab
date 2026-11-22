# M1.3J.2: hybrid Playground floor and station-edge fixes

**Result:** a hybrid floor (LaMa c2's tone plus real floor grain) is **visibly better than both the M1.3I floor and LaMa c2 at 3–4×**; at normal size the three look nearly the same. It is integrated in the **experimental build only** (`h2-s4-seamless`). Both station-edge defects from M1.3J.1 are corrected there too.

**Not claimed:** SA-1. It needs your visual review, and the gap still has one visible compositing defect that is outside the floor (§4).

The default build is untouched. Every pixel outside the 6,698 px hidden-floor mask is unchanged (checked).

## 1. Hybrid floor (`scripts/hybrid-floor.py`)

- **Low frequencies:** LaMa c2's tone, continuity and gradients (Gaussian low-pass at σ, normalised over the band and the visible floor below, never the station area above).
- **High frequencies:** copied from the **real floor directly in front of the station** (the floor the band continues), as a luminance ratio. So the grain is authentic and c2's hue is kept; no orange or blue is carried in.

**Source rules:**
- Floor visible at rest only: never the station, a connection line or its corrected window, a lit glow, the Experience panel, the central platform's rim, or the panel's reflections just under the contact line.
- Integer offsets: 65 px down; the left end 34 px right and 89 px down, joined by a power-preserving crossfade so the grain amplitude doesn't dip.
- No resampling, no mirroring, no added noise. A diagnostics image shows where each band pixel's grain came from (`candidates/*-sources.png`).

**Perspective and grain scale (measured):** the floor's grain is pixel-scale, with autocorrelation about 0.7 px vertically. The source is 30–70 px nearer the camera, roughly a 10–20 % scale difference. That is invisible at this scale, and resampling to "correct" it would only soften the grain, so the copy is pixel-exact.

**Tile joints:** none enter the band. The floor in front of the station is a dark polished area with no visible joints. The joints on the lit floor to the left stop at the foundation ring and never reach the band.

| Candidate | What | Band tone | Fine detail | Contact-line step |
|---|---|---|---|---|
| Real floor in front | | 40.1 | 0.78 | |
| M1.3I floor | | 45.3 | 0.86 | 16.4 |
| LaMa c2 | | 41.0 | 0.69 | 12.5 |
| h1-s2 | c2 below 2 px, real grain above | 41.1 | 0.74 | 17.7 |
| h2-s4 | c2 below 4 px | 41.0 | 0.74 | 18.2 |
| h3-s8 | c2 below 8 px (more real mid-scale structure) | 41.1 | 0.73 | 18.0 |
| **h2-s4-seamless** (final) | h2, with its two ends blended into the neighbouring floor (below) | 42.0 | 0.73 | 16.7 |

**Contact-line step:** the step is measured against the plate's contact highlight row. c2 lower because it carries that highlight one pixel into the band; the hybrid replaces that 1 px feature with real grain.

**Seamless ends:** the band's two ends formed a small staircase against the visible floor, the mask's stepped edge with a tone step across it. A smooth tone correction is anchored only there and fades within about 7 px (a screened membrane). Grain is untouched; nothing outside the mask changes.

There are three texture variants (σ 2/4/8) plus that one refinement of the chosen one.

## 2. Evaluation (real browser, scene px 1:1)

`scripts/hybrid-floor-compare.mjs` integrates each floor in turn and captures the experimental build lifted, at a 1672 × 941 viewport. 3× and 4× are nearest-neighbour enlargements of true pixels.

**Sheets:**
- `compare-1x-no-shadow.png` and `compare-1x-shadows-on.png`: normal size.
- `compare-3x-no-shadow.png`: the whole gap.
- `compare-4x-no-shadow.png`: left, centre and right, all candidates.
- `final-4x.png`: M1.3I, c2 and the final, shadows off and on.

| | Tone | Grain | Joints | Repetition | Blur | Banding | Silhouette | Lift gap, shadows off |
|---|---|---|---|---|---|---|---|---|
| M1.3I | Lighter, grey-blue patches | Patchy, horizontal streaks | n/a | Streaks | No | Streaky | (fixed for all, §3) | Reads as a grey band |
| LaMa c2 | Matches | **None (smooth)** | n/a | No | **Soft** | No | | Dark smear at the right end |
| h1 / h2 | Matches | Real speckle grain | n/a | Not visible | No | No | | Continuous |
| h3 | Matches | Grain plus slight mottling | n/a | Not visible | No | No | | Mottles at the left end |
| **final** | Matches; ends continue the neighbouring floor | Real grain | n/a | Not visible | No | No | | Continuous; no stepped end |

**At normal size** all four non-M1.3I versions read the same: a dark gap under the lifted platform.

**At 3–4×** the final is the most convincing:
- It has the floor's own tone and grain.
- It has no smear, no grey patches and no stepped ends.
- Its source rows lie under the reflection and the "Experience" label, so the copy isn't recognisable.

**Fake texture:** none. Every grain pixel is a real floor pixel; nothing was sharpened or generated.

**Why not "stone"?** The floor next to this gap is itself smooth, dark, polished floor. The stone flags with joints are only visible on the lit floor to the left. So the band matches its real neighbour rather than inventing tiles.

## 3. Station-edge fixes (experimental build only)

Both defects came from M1.3H's cut-out matte. It is replaced in the experimental build by `public/scene/layers25d/playground/object.png`; `playground-v2.png` is unchanged. Only the base's soft-edge pixels and 290 alpha pixels at the far-right corner differ; every opaque station pixel is the same. Movement, gameplay and the energy system are unchanged.

1. **Stepped far-right base edge.**
   - **Cause:** the matte had notches and hard 100+ → 0 cut-offs there.
   - **Fix:** alpha is rebuilt for x 1290–1380, y 525–550 only. It follows a smooth silhouette fitted to the matte's own coverage (a quadratic bottom edge, the right edge at x 1375.5, a 9 px corner radius matched to the original's coverage) with the edge's own measured ramp (229/128/26), cross-faded in over 16 px.
   - **Result:** `edge/right-corner-lifted-5x.png`. Five new edge pixels lie outside the clean background's hole.
2. **Edge colour at the arrival switch.**
   - **Cause:** the cut-out's soft-edge colour carried an orange fringe from the strip at the right corner, and the strip reflection was drawn *under* the station's background, so the switch hid its top rows.
   - **Fixes:**
     - The reflection layer now draws above the station group (`LabScene.tsx`). It renders nothing in the default build, and the idle frame is pixel-identical.
     - The edge colour is solved from real browser frames (`scripts/playground-edge.py`, `scripts/playground-edge-frames.mjs`). The target is the idle frame; the edge pixels are rendered black and white with the layers switched on, giving the linear response through every layer. The browser resamples the cut-out by a sub-pixel amount, so six measure-and-correct passes follow.
   - **Result** (base's bottom edge, at-rest switch; `edge/switch-difference-3x.png`):

     | | Pixels > 12/255 | Max |
     |---|---|---|
     | Before | 312 | 60 |
     | After | 91 | 49 |

   - **Left over, and why:**
     - 38 px would need a colour outside 0–255.
     - The ring at the left end (the max) comes from the connection line's layer (§4).
     - The faint horizontal stripes over the station body are pre-existing and small; M1.3H documented them.
   - **Records:** `edge/alpha.json`, `edge/solve.json`. The integration record's `restEdgeMaxDiff` is a file-only model, superseded by this browser measurement (see its `restEdgeNote`).

**The colour solve depends on the floor under the edge.** After integrating another floor, run it again:

```bash
P=E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe
node scripts/playground-edge-frames.mjs black=docs/m1.3j/hybrid/edge/object-black.png white=docs/m1.3j/hybrid/edge/object-white.png
$P scripts/playground-edge.py solve
for i in 1 2 3 4 5 6; do node scripts/playground-edge-frames.mjs fixed && $P scripts/playground-edge.py refine; done
```

## 4. Remaining defects

1. **Fixed in M1.3J.3** ([`../connection/NOTES.md`](../connection/NOTES.md)). The left end of the gap showed a floating wedge: a dark-brown piece of the base's lower-left corner.
   - **What it is:** not floor. It is drawn by **Playground's connection-line layer** (hiding the charge windows removes it). Near its end, the line's trace image re-adds the plate's base-corner pixels that the line-free environment layer had replaced. That layer is above the station, so the piece stays when the station lifts. It also causes the ring at the switch (§3).
   - **Why it's not fixed:** it belongs to the energy-line layers, which this milestone must not change.
   - **Fix:** in `make-scene-layers.mjs`, keep the environment correction and the trace off the station's cut-out pixels.
2. **The contact-highlight row is a little brighter than the band's bottom rows** (step 16.7). At 4× it reads as a thin light line along the contact.
3. **Small notches along the base's bottom edge under the lit strip.** They are pre-existing, present in every version, and small.

## 5. Verdict and recommendation

- **Best:** `h2-s4-seamless` is visibly better than both M1.3I and LaMa c2. It is integrated in the experimental build for your review.
- **Automated floor reconstruction should stop here.** What's left in the gap is not floor texture: the line-layer wedge (§4.1) and the contact highlight. If, after review, the gap still doesn't read as convincing floor, the next step is targeted manual artwork: paint the 6,698 px band at 2× (brief: `../../m1.3i/background-requirements.md`; inputs in `../inpaint/`).

**Go back to the M1.3I floor:**

```bash
npm run inpaint:playground -- clear
```

Then re-solve the edge (§3).

## Validation

- **Integration (`integrate` / `compare`), every candidate:** 6,698 px composited; identity outside the mask exact; idle unchanged with the candidate on vs off; lifted, nothing outside the mask changes; the default build never references the candidate. All OK.
- **`npm run typecheck`:** pass.
- **Rebuilt the experimental build** (`npm run build:layered`), needed for the code change, and ran the M1.3I 2.5D probes (`scene25d-evidence.mjs`, into a scratch folder): all OK, none BAD.
- **Default build:** not rebuilt. Its HTML references neither cut-out, and the code changes are inert there.
- **Full visual suite:** not run.

## Files

**New**
- `scripts/hybrid-floor.py`, `scripts/hybrid-floor-compare.mjs`
- `scripts/playground-edge.py`, `scripts/playground-edge-frames.mjs`
- `public/scene/layers25d/playground/object.png`
- `docs/m1.3j/hybrid/**`

**Changed**
- `components/lab/LabScene.tsx`: reflection after the station layers.
- `components/lab/scene-layout.ts`, `components/lab/scene-25d.ts`: the layered Playground's cut-out path.
- `scripts/inpaint-playground.mjs`: the edge metric uses the build's cut-out, and gains its note.
- `public/scene/layers25d/playground/floor.png`: the final candidate.

The Python scripts run in the isolated LaMa venv (numpy and Pillow only). Nothing was downloaded or uploaded.
