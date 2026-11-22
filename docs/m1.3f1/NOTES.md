# M1.3F.1 — Sharp, precise platform lighting

Status: implemented and awaiting your review (not approved). This refines M1.3F (`docs/m1.3f/`).

## Evidence (this folder; browser screenshots at 1648×928)

| File | What |
|---|---|
| `idle.png` | Normal-size screenshot, all platforms unpowered. |
| `<station>-powered.png` (×5) | Each platform fully powered while hovered. |
| `closeups/educational-idle-vs-powered.png` | Close-up from the browser screenshots (3×). Top: idle. Bottom: powered. |
| `closeups/creative-idle-vs-powered.png` | Same, 3×. |
| `closeups/experience-idle-vs-powered.png` | Same, 2×. |
| `platform-power.webm` | Real time, 16.5 s, all five platforms powering up and down. |
| `probes.txt` | Real-time probes; all pass. |
| `geometry-diagnostic.png` | Diagnostic only. Detected cores (white), dimmed halo (magenta), bands (yellow), the arrival point, and each piece's direction (cyan arrow). Judge the result from the screenshots, not this sheet. |

## What changed

**1. Sharp idle state.** The M1.3F overlay divided the plate by a smooth light estimate. That turned each strip into a soft pale bar and flattened lit surfaces. Now:

- **Core:** each strip's painted core is detected per pixel at full resolution. A core pixel must be:
  - near-white and well above the unlit surface
  - within 70% of the local peak contrast, so the bloom beside it doesn't count
  - narrow, falling off within 4 px, so broad lit surfaces are never "core"
  - part of a line: at least 8 core pixels in a 9×9 window, so stone highlights don't count

  The core is replaced by a crisp, faint unlit fixture line, with a roughly 1 px anti-aliased edge.
- **Halo:** the strip's light is *subtracted* as a smooth field, mostly as a brightness change so the surface keeps its warm hue. A smooth field carries no texture, so subtracting it leaves the stone's texture contrast intact. It applies only within 12–22 px of the core, depending on the piece.
- **Texture floor:** no pixel goes below 50% of itself where there's stone texture. Right at the core it can go lower, which avoids a pale rim.
- **Pixels:** every changed pixel is written opaque with its final colour, so nothing is resampled or re-blurred.

**2. Sharp powered state.** The hover light used the old half-resolution, bloomed `masks/platforms.png`, which smeared glow over the painted cores. It now uses a full-resolution mask: the detected core plus a restrained halo (30% peak, σ 2.2 px).

- `power/light.png` serves Educational, Creative and Experience.
- `power/light-lift.png` serves the Engineering and Playground lifts.

**3. Path-following reveal.** The broad elliptical front is gone. Each station's strips are pieces (strip, wrap, side segment), chained from the connection's arrival point. Each part is clipped to its polygon and uncovered by a narrow front, a 10 px soft edge moving along the piece; the hover light follows the same front. Measured first-light order:

- **Educational:** both front halves at 468 ms (the energy runs out both ways from the junction), then the floor-ring segments at 668 ms.
- **Engineering:** the right-edge wrap at 552 ms, then the front strip at 701 ms.
- **Playground:** the front strip at 682 ms, then the right-edge segment at 966 ms.
- **Creative:** the right-edge wrap and front at 634 ms, then the left strip at 951 ms.
- **Experience:** the front strip at 667 ms, then the right strip at 984 ms, after a run hidden behind the plants.

Spread: 316–400 ms after arrival. The drain runs the fronts back, farthest first.

**4. Coverage.**

- **All strips participate:** front strips, side and floor-ring segments, and the right-edge wraps on Engineering and Creative. That includes Experience's right strip and tip, which a first pass of the core detection had missed.
- **Removed, Experience:** the lit disc and ring edge left of its strip. That's the base catching light, not a strip, and treating it as one produced a flat artificial patch. It now stays as painted.

**5. No flash of lit strips on load.** The plate layer stays hidden until the plate *and* the unpowered overlay have decoded, then fades in over 240 ms. A small inline script handles this as the HTML is parsed, without waiting for hydration. It falls back after 4 s, and a `<noscript>` rule covers no-JS.

Test: with the overlay held back 1.5 s over the network, the plate appeared at 1575 ms, with the overlay already decoded.

**6. Unchanged.** Playground's 18 px lift (probe: −17.75 px = −18 × 0.986), extraction, backdrop, shadows, gap light, arcade, power transfer and camera. The reference artwork and `lab-plate.webp` are untouched.

## Remaining blur and texture limitations

- **Smooth glow surfaces:** where a strip lit a smooth surface, there was no texture to keep, so the unpowered result is a smooth, darker surface. That covers:
  - the corner of the floor ring beside Creative's wrap
  - Experience's base lip under its strip
  - Playground's lower tier face

  At normal size they read as unlit; at 6–7× zoom they look smooth.
- **Residual warmth:** a little warmth stays in parts of the halo (Playground's lower face, Creative's right corner), and the floor reflections keep 40%.
- **Fixture line:** the unlit fixture is a uniform, slightly grey line. It's crisp, but it carries no texture of its own because the painted core had none.
- **Educational junction:** the connection line's own lit end still meets the dark fixture there. The line isn't part of this milestone.
- **Other lines:** Educational, Engineering, Creative and Experience's connection lines still look lit at rest (unchanged since M1.3F).
- **Old assets:** `engineering-light.webp` and `playground-light.png` are no longer used at runtime. Playground's approved gap light is still derived from `masks/platforms.png`.

## Commands

- Masks: `node scripts/make-platform-power.mjs [--preview <dir>]`
- Evidence: `npm run visual:power -- --url http://localhost:3000 --out docs/m1.3f1`
