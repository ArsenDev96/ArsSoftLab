# Lift-gap audit: Playground against SA-1

Status: audit only. Nothing in the app was changed. Not approved.

The requirement is [SA-1 in the station animation spec](../station-animation-spec.md#sa-1-transparent-lift-gap-approval-gate). The audit checks the current Playground lift: 18 px plus 1 % scale, built in M1.3E.2–M1.3E.3 by `scripts/make-playground-layer.mjs`.

## Evidence

All captures are real-browser screenshots from the production build, at 1648 × 928 with full motion. They cover scene region x 1070–1370, y 470–570, around Playground's base.

| File | What |
|---|---|
| `rest-1x.png`, `lifted-1x.png` | Normal desktop size, at rest and lifted. |
| `rest-3x.png`, `lifted-3x.png` | The same at 3×. |
| `lifted-no-shadow-3x.png` | Lifted, with the contact shadow, penumbra and under-light hidden: the reconstructed floor as it really is. |
| `backdrop-only-3x.png` | The reconstructed backdrop alone, with the station hidden. |
| `playground-gap-3x.png` | All four 3× views stacked and labelled. |

## Findings

| # | Requirement | Result |
|---|---|---|
| 1 | Accurate cutouts | **Meets.** The cut-out is solved so the layers recompose the plate exactly (max 0.99/255 at rest). |
| 2 | No blur, smear, mirroring or colour patches | **Fails.** The exposed band is the floor below the contact line mirrored upward, column by column. At 3× this shows as mirror-image texture with vertical streaks, a stair-stepped edge at the left end, and a soft brown smear. Above the band (about 22 px up) the backdrop is a flat grey fill. The station covers that fill today, but any higher lift or sideways move would expose it. |
| 3 | Static floor | **Meets.** The backdrop, shadow and reflections do not move. |
| 4 | Grounded shadow and reflections | **Partly.** The strip's floor reflection and the floor ring stay in place. A real reflection on a polished floor would drop as the platform rises; this one stays fixed. |
| 5 | Sharp station edges | **Meets, within the source.** The lifted base edge is as sharp as the plate. The 1 % scale adds only slight resampling. |
| 6 | No concealment by shadow | **Fails.** The contact shadow reaches 0.88 opacity across the whole gap, and the under-light adds a lit rim. With both off (`lifted-no-shadow-3x.png`), the mirrored band is plainly visible. The shadow is doing the concealing. |
| 7 | Checked at 1× and 3× | Done here. At 1× the gap reads as a dark shadow and the defects are not noticeable. At 3× they are. |

## Limitation: the flat illustration can't support an 18 px gap

- **No source pixels.** The floor under the platform was never painted. Every pixel in the gap has to be invented from neighbouring floor.
- **What the floor needs.** The floor is a polished, dark surface with soft reflections that change with position. Mirroring copies the reflections the wrong way round. Smoothing loses the texture. Either way it reads as fake at 3×.
- **What the earlier methods produced.** Telea, FSR and normalized-convolution inpainting were tried in M1.2.2 and gave streaks, voids and seams. The M1.3E.2 mirror is the best of the algorithmic options so far, and it still fails SA-1.
- **Resolution ceiling.** The plate is 1672 × 941, so at 3× each source pixel covers 3 screen pixels. Even the untouched plate is soft at 3× (`rest-3x.png`). No reconstruction can be sharper than the plate around it. "Sharp at 3×" can only mean "matches the plate", unless the source resolution goes up.

More blur or a darker shadow would only hide this further, which SA-1 rules out.

## Proposal: a layered background

Recommended: produce the scene as layers instead of cutting them out of one flat image.

1. **Clean floor plate.** The same room and camera with the five station platforms removed, at 2× (3344 × 1882) so 3× zoom holds up.
   - If the reference came from a 3D scene, re-render with the stations hidden.
   - If it is a painting or a generated image, an artist paints the floor under each station's footprint plus a margin, at 2×, matching the existing texture and reflections. The user reviews each patch.
2. **Station layers with real alpha** from the same source, not solved out of the flat plate. Edges are then exact by construction.
3. **Separate floor passes** for each station:
   - a contact shadow / ambient occlusion pass;
   - a floor-reflection pass, which can move down by the lift so reflections stay physically grounded;
   - an emissive pass for the strips and connection lines. This would also replace the M1.3F/M1.3G "divide the light back out" overlays with real unlit and lit states.
4. **Composition stays as it is now.** Static floor, then shadow and reflection, then the lifting station. The current layer code (`StationLayers.tsx`, `STATION_LAYERS`) already takes per-station backdrop, shadow and light images, so only the assets change.

If no new art is possible, there are two fallbacks, both weaker:

- **Lower lift.** About 6 px keeps the exposed band inside the zone that is really shaded under the platform's overhang, where a contact shadow is legitimate rather than concealing. This gives up the approved 18 px.
- **Patch-based texture synthesis.** Sample non-mirrored floor patches from the floor in front, with perspective, to replace the mirror. It may beat the mirror, but it is still invented floor and may show repeated patches. I'd only prototype it as a comparison against option 1.

## Next decision (yours)

- Approve the lift gap as it is, or not. On this audit it does not meet SA-1 items 2 and 6.
- Choose a direction: the layered background (recommended), a lower lift, or a synthesis prototype.

Until then the technique should not be reused on other stations.
