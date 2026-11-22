# M1.3J.3: Playground connection-layer artifact

**Result:** the dark wedge at the left end of Playground's lifted gap is gone.
- **Line:** its path, core, glow, charging and draining are unchanged, and it stays on the floor.
- **Idle:** unchanged within M1.3I's tolerance.
- **Activation:** no flash at the switch.

**Scope:**
- Experimental build only. The default build, the reference image, the hybrid floor (`h2-s4-seamless`), the station cut-out and every other station's assets are untouched.
- No code changed and no rebuild was needed: the three edited images are served from disk.

**Not claimed:** SA-1 remains pending your approval.

## 1. The artifact

The wedge is **360 px** at x 1061–1098, y 521–539:
- 263 px on the base's opaque lower-left corner;
- 97 px on its soft edge.

**Where it lives:** Playground's line part 1, in its trace and its lit image (`public/scene/layers25d/lines/playground-1-{trace,lit}.png`).

**Why:**
- **The copy:** M1.3I's generator copies the approved unpowered overlay into the trace verbatim. Near the line's end, that overlay includes the plate's base corner.
- **The erase:** the environment layer under it erased the same corner (line removal), and the line layer painted it back, so at rest the two cancelled.
- **The leftover:** the line layers are drawn above the station. When Playground lifts, the corner copy stays on the floor: the trace while the line is unpowered, the lit image once it is powered.

**Found by:**
- hiding the charge windows, which removes the wedge (M1.3J.2);
- mapping both images' alpha against the station's cut-out: they are opaque across the corner, not a thin line.

## 2. The fix (`scripts/fix-playground-connection.py`)

The corner moves from the connection layer (above the station) to the environment layer (below it).

- **Trace and lit:** transparent at exactly those 360 px, which are the station's cut-out footprint. The line's own 3,413 trace pixels and 3,528 lit pixels off the station are byte-identical, and the line ends outside the footprint. Part 0 had nothing on the station.
- **Environment layer:** those 360 px become the exact at-rest view, taken from a real browser frame of the idle scene captured before the fix (`before/rest.png`).
  - All 360 lie inside the station's clean-background hole, so whenever the station's layers show, the background covers them. The script refuses to run otherwise.
  - The browser draws these full-frame layers with a sub-pixel resampling, so seven measure-and-correct passes bring the baked pixels to the idle frame (residual max 3).

**Originals:** in `original/`. The script always starts from them.

**After `npm run layers:25d`, which regenerates the line layers:**
1. Run the script.
2. Run the `refine` passes with the evidence script.

The generator now carries a note to that effect.

## 3. Verification (real browser, scene px 1:1, experimental build)

| Sheet | What |
|---|---|
| `gap-1x.png`, `gap-3x.png`, `left-end-4x.png` | Before/after, lifted, shadows off |
| `*-shadows-on.png` | The same with shadows on |
| `arrival-3x.png` | The left end through activation, before/after, at fixed times |

**Lifted, shadows off and on:** the wedge is gone. In its place is the gap floor (`h2-s4-seamless`) and the clean background. The line still runs to its end on the floor at the contact line.

**Idle:** pixel changes only on the line's own edge, just below the corner: 16 px over 2/255, 1 px over 12, max 18. The line is drawn through a rotated window with bilinear sampling, so its edge pixels now sample a transparent neighbour where the corner copy used to be. Keeping a ring of corner pixels to avoid that would leave a 1 px outline of the wedge when lifted.

M1.3I's whole-frame idle check vs the approved build passes (< 0.03 % of px over 12, none over 50).

**Activation, deterministic** (`scripts/visual/playground-arrival-frames.mjs`): every animation and transition is paused and seeked to t = 0, 25 … 1400 ms after hover. Before and after:

| Time | What happens |
|---|---|
| 0–450 ms | Identical apart from the idle line-edge pixels above |
| 575–625 ms | The original lit the corner about 75 ms early through the line's lit layer (max 70/255 difference). Now the corner lights at the switch, with the station's own cut-out, inside the arrival surge. |
| 650 ms, the switch | Same frame (max 10/255): **no flash** |
| Lifting | The corner rises away and the gap floor shows (luminance there 37). The original kept the wedge (58). |

**M1.3I probes** (`scene25d-evidence.mjs`, into a scratch folder): all OK. That covers idle vs approved, progressive charging, drain toward the A station-end first, grounded layers (the line doesn't move), return to idle, switching station mid-lift, keyboard focus and reduced motion.

**Floor integration checks** (`compare --name h2-s4-seamless`): all OK.

**`npm run typecheck`:** pass.

The real-time capture (`before/arrival`, `after/arrival`) confirms the same sequence, but its screenshots stall around the switch. The seeked frames are the reference.

## 4. The thin bright contact line

**What it is:** the plate's own contact highlight, the floor's lit edge 1–3 rows under the hidden band.
- **Brightness:** +10–17 levels over the band with shadows off; about +20 with shadows on, where the contact shadow darkens the band but stops at the contact line.
- **Not:** the reflection layer, the foundation joint or the floor candidate (hiding each changes nothing).
- **Scope:** it lies outside the floor mask; it is visible at rest.

**Verdict: no adjustment now.**
- At 1× it is about one pixel and reads as the lit edge of the floor.
- The strips above stay lit when the station lifts, so a lit floor edge is plausible.

**If you want it softened:** fade it with the lift, like the reflection (for example to about 65 %). That needs a small lift-driven floor layer: a new asset plus one line in `StationLayers` and a rebuild, idle unchanged. Not done here.

## 5. Remaining defects

1. **The contact highlight** (§4), pending your review.
2. **The corner's glow timing:** the line's glow on the corner now appears with activation, about 75 ms later than in the original.
3. **Idle line-edge pixels:** 16 px of the line's edge under the corner differ at idle (max 18/255).
4. From M1.3J.2, unchanged:
   - small notches along the base's bottom edge under the lit strip;
   - faint resampling stripes over the station body at the switch;
   - the band's bottom rows slightly darker than the contact row.

## Files

**Changed (experimental assets only)**
- `public/scene/layers25d/lines/playground-1-trace.png`, `playground-1-lit.png`
- `public/scene/layers25d/environment-corrections.png`
- `scripts/make-scene-layers.mjs`: a comment only.

**New**
- `scripts/fix-playground-connection.py`
- `scripts/visual/playground-wedge-evidence.mjs`, `scripts/visual/playground-arrival-frames.mjs`
- `docs/m1.3j/connection/**`
