# M1.3K asset inventory: Playground 2.5D

What exists for Playground's layered lift, whether it is usable, and what new artwork must replace. All sizes are full frame, 1672 × 941, aligned to the plate. Pixel counts were measured by `scripts/playground-artwork.py package` (`package/package.json`).

**Key:**
- ✅ usable as is
- 🟡 usable now, to be regenerated or replaced when the new artwork arrives
- ❌ not acceptable; needs new illustration

## Sources (never modified)

| Asset | Path | Status | Notes |
|---|---|---|---|
| Approved design | `reference/approved-lab-design.png` | ✅ reference | The authority on look. Contains interface labels; not a paint base. |
| Artwork plate | `public/scene/lab-plate.webp` | ✅ | The approved illustration without the interface. Lossless PNG in `package/01-source/lab-plate.png`. |
| Environment, lines removed | plate + `public/scene/layers25d/environment-corrections.png` | ✅ | The five power lines and Playground's strip reflection removed (M1.3I). **The paint base:** `package/01-source/environment-lines-removed.png`. |

## Masks (existing, reused; nothing re-traced)

| Mask | Source | px | Status |
|---|---|---|---|
| Remove (footprint + 6 px margin) | `docs/m1.3i/masks/playground-remove.png` | 47,651 | ✅ Exact (from the M1.3H cut-out alpha) |
| Station footprint (hole) | alpha of `public/scene/layers25d/playground/background.png` | 42,149 | ✅ Exact. Every pixel the station covers. |
| Floor band (24 px) | `docs/m1.3i/masks/playground-floor.png` | 10,676 | ✅. 3,978 px of it are visible at rest. |
| Floor hidden at rest | alpha of `public/scene/layers25d/playground/floor.png` (= `docs/m1.3j/inpaint/mask-floor.png` in the frame) | 6,698 | ✅ |
| **Uncovered by the 18 px lift** | **new in M1.3K**, computed from the cut-out's alpha and the lift transform (−18 px, ×1.01 about x 1218, y 546) | **6,779** | ✅. 6,512 floor; 256 wall at cabinet height (left of the marquee, beside the right side panel); 11 near the base. |
| Uncovered at 24 px (safety) | same | 8,709 | ✅ |
| Connection lines | `docs/m1.3i/masks/lines.png` | 14,226 | ✅ reference |

The package's `02-masks/` holds them all, plus 2× versions.

## Playground's experimental layers (`public/scene/layers25d/playground/`)

| Layer | File | Origin | Status | Why |
|---|---|---|---|---|
| A: environment under the station | `background.png` (42,149 px) | M1.3H patch synthesis, reflection light removed in M1.3I | ❌ **replace** with Asset A | Behind the cabinet: a smeared ghost of the station. In the gap: rejected as soft and grey. |
| A: floor in the gap | `floor.png` (6,698 px) | M1.3J.2 hybrid `h2-s4-seamless` (LaMa c2 tone + real floor grain) | ❌ **retire** | SA-1 failed. Built from offset copies of real floor: the new repetition check flags 9 of 97 windows (NCC up to 0.98, against 0.83 for the real floor). Staging writes Asset A's own pixels here. |
| A2: contact rows, unlit | `contact-unlit.png` (1,764 px, y 526–553) | M1.3J.5, code: darkens the plate's own pixels, no texture generated | 🟡 | Regenerate from the new floor after applying (`scripts/playground-contact-unlit.py`), or replace with the optional painted Asset A2. |
| D: station | `object.png` (42,072 px, 2,881 soft-edge) | M1.3H re-matte; far-right corner and edge colour by M1.3J.2 | 🟡 **re-matte (Asset B)** | Usable as an interim: staging re-solves its soft-edge colour against Asset A, so the switch at arrival stays as today. Defects that need the artist: a dark wall-and-glow band around the marquee; lit floor and notches along the base's bottom edge (`package/03-context/station-cutout-defects.png`). |
| F: contact shadow | `shadow-contact.png` | `make-scene-layers.mjs`, from the station's bottom edge | ✅ / 🟡 | Valid while the cut-out's bottom edge stays. Regenerate if Asset B changes it (see the integration plan). |
| F: ambient shadow | `shadow-ambient.png` | same | ✅ / 🟡 | same |
| G: reflection, unpowered and powered | `reflection-dim.png`, `reflection-lit.png` | `make-scene-layers.mjs`, solved from the plate | ✅ | Independent of the background. They sit outside the footprint (y 543–562). |
| B: foundation joint | none | removed in M1.3J.5 | ✅ (none) | No ring or joint. The brief forbids painting one. |

## Other layers it depends on (unchanged)

| Asset | Status | Notes |
|---|---|---|
| Power connections, all five stations (`public/scene/layers25d/lines/*-trace.png`, `*-lit.png`, SVG cores in `scene-25d-data.ts`) | ✅ | Grounded and independent of the environment. Playground's base-corner copy was removed in M1.3J.3. |
| Platform strips (`public/scene/power/light-lift.png`, `unpowered-lift.png`, `PLATFORM_POWER`) | ✅ | Ride the lift; drawn over the station. |
| Arcade screen (`ArcadeScreen` canvas) | ✅ | Rides the lift. |
| Approved default-build layers (`public/scene/layers/playground*.png`, `engineering*`) | ✅ untouched | Not part of the experimental stack. |

## Earlier reconstruction attempts (all rejected; evidence only)

| Attempt | Evidence |
|---|---|
| M1.3E: mirror under the contact line | `docs/m1.3e*/` |
| M1.3H: PatchMatch completion | `docs/m1.3h/clean-background.png`, `lift-gap-3x.png` |
| M1.3J.1: LaMa c1, c2, c3 | `docs/m1.3j/lama/` |
| M1.3J.2: hybrid h1, h2, h3 | `docs/m1.3j/hybrid/` |
| M1.3J.3 to M1.3J.5: compositing fixes (connection wedge, shadows, false step) | `docs/m1.3j/connection/`, `black-gap/`, `depth/` |

`package/06-defects/defects-to-avoid.png` gathers them.

## Summary

| Question | Answer |
|---|---|
| Usable now | Plate, approved reference, environment corrections, all masks, power connections, strips, arcade screen, reflections, shadows (while the bottom edge stays), the contact-unlit method. |
| Needs genuine illustration | Asset A inside the 42,149 px footprint. **First:** the 6,779 px the lift uncovers (6,512 floor in a crescent along the base's front edge; 256 wall left of the marquee and beside the right side panel), with a 6 px safety margin. **Then:** the wall, back step and room behind the cabinet. |
| Needs re-matting | Asset B: the marquee's dark halo and the base's bottom edge (lit floor, notches). Interim: the current cut-out with its edge colour re-solved by staging. |
