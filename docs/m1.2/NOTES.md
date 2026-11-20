# M1.2: Animation feasibility findings

The baseline is `docs/m1.1/homepage-1648x928.png`. All captures are 1648×928 from headless Chrome against the production build.

## Verdicts

| Experiment | Verdict | One-line reason |
| --- | --- | --- |
| A. Energy connections | **PASS** | Follows the real lines exactly (masked), invisible at rest, compositor-driven. |
| B. Globe orbit highlight | **PARTIAL** | Technically clean and correctly occluded, but very subtle at normal viewing size. Needs a design call on intensity. |
| C. Engineering camera | **PARTIAL** | Smooth and accessible, but the 1672 px plate is visibly soft at 1.15×, and the panel overlaps the globe. |

## Visual regression

See `regression.txt` and `comparison.png`.

- Idle vs M1.1: max difference 2/255, with no pixel above 2. It is identical within capture noise.
- Return-to-Lab vs idle: bit-identical (max 0).
- Reduced-motion idle vs M1.1: max 2/255.
- Active frames change only pixels inside the line and orbit areas. Nothing else in the room moves or changes colour.

## A. Energy connections

- **Technique.** The geometry is quadratic Béziers fitted to the five lines, with sub-pixel residuals. A per-pixel mask is generated from the lines themselves (`scripts/make-scene-masks.py`). A soft light travels along each track by `transform` only, seen through the mask. Two passes (a crisp core and a soft halo) give a premium glow without SVG filters.
- **Timing.** All pulses leave the central A together on an 8 s cycle. They cross their lines in the first 62% of the cycle and then rest beyond the station ends, where the mask is empty. The restart therefore never shows a jump.
- **Central platform.** The mask is empty over it, so it is never touched.

## B. Educational globe

- **Chosen technique.** A light travels around the gold orbit ring on a 20 s lap, seen through a mask of the ring's visible pixels. It disappears behind the dome, church and island exactly where the painted ring does. The lap starts and ends behind the dome, so the loop seam is never visible. The terrain, buildings and glass are untouched.
- **Rejected: rotating or moving globe pixels.** The globe is two overlapping painted glass shells with terrain inside. Rotating it would rotate the church and terrain (physically wrong). Any displacement would also expose unpainted background behind the glass.
- **Rejected: a separately extracted shell layer.** The shell is semi-transparent over the window landscape. Extracting it needs alpha matting the source can't support, and moving it would duplicate edges.
- **Rejected: an SVG ellipse overlay.** The painted ring is not a clean projected ellipse (a robust fit diverged). A drawn ring would sit visibly off the artwork.
- **Why PARTIAL.** It's correct, but at full-page scale the effect is easy to miss. Raising the intensity is a one-line change; it should be a design decision.

## C. Engineering camera

- **What moves.** The camera transforms the scene only: plate, effects and in-scene labels. The header, hero, cue and panel are outside it.
- **Framing.** The shot is a 1.15× zoom framed on the workstation. Translation is clamped, so the plate can never reveal an edge.
- **Timing.** In: 850 ms, `cubic-bezier(0.62, 0.02, 0.24, 1)`. Out: 700 ms, `cubic-bezier(0.45, 0, 0.25, 1)`. Neither overshoots. The panel fades in over 260 ms after a 520 ms delay, and out over 200 ms.
- **Input.** Keyboard (Enter/Space), pointer (title or platform), Escape, and Back to Lab all work. Focus moves into the panel and back to the trigger.
- **Image quality.** See `camera-quality.png`. At 1.15× the 1672 px plate is upsampled about 1.13× at 1648 px wide. The browser render is as sharp as an ideal Lanczos upscale, so the softness comes from the source, not the technique. Going further zooms in on that softness. **Do not raise the zoom without a higher-resolution plate.**
- **Panel placement.** The panel sits beside the workstation, over the (dimmed) globe base. It's acceptable for a prototype; final placement needs design review.

## Performance

Measured in headless Chrome on this machine.

- **Idle effects, steady state.** About 1 ms/s of main-thread work and 0 ms/s of style recalculation. The animations are compositor-driven.
- **Idle frame rate.** 60 fps in both software and GPU modes.
- **Camera transition, GPU mode** (AMD Radeon HD 5450, a very low-end 2010 GPU). Median frame 16.7 ms, p95 about 34 ms.
- **Camera transition, software rasterization.** About 30 fps, which is the pessimistic case.
- **Superseded first approach.** An earlier version animated `stroke-dashoffset` on about 60 SVG paths. It dropped software rendering to 39 fps and cost around 20 ms/s of style work, so it was replaced.
- **Two rendering pitfalls found and avoided:**
  - `mix-blend-mode` on the effect layers resampled the whole plate (about 1 level of drift everywhere).
  - Applying a full-frame SVG mask per path made software rendering drop the scene to black.

## Known issues

- The orbit highlight is subtle (see B).
- The engineering zoom is limited by the plate's resolution (see C).
- The focus panel overlaps the globe base.
- Recording frame timing comes from headless screencast, so it may look less smooth than a real browser.
- `/favicon.ico` returns 404. This pre-dates M1.1.
