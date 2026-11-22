# M1.3J.5: Playground lift-gap depth

**Result:** at full lift the gap no longer looks like a second stone step. The raised base sits over a softly shaded strip of the same floor, which continues into the floor in front without an edge.

**Not claimed:** SA-1. It is ready for your visual review, not approved.

**Scope:**
- Experimental build only.
- The floor (`h2-s4-seamless`), cut-out, 18 px lift, timing, power system, arcade game, keyboard and reduced-motion behaviour are unchanged.

## 1. What made the gap look like a second platform

**Measured** in the fully lifted frame, at desktop scale, with layers toggled one by one (`../black-gap/before|after` A–F, and the variants below).

At x 1240–1330 the gap read, top to bottom, exactly like the base standing on the floor at rest, one step lower. Mean RGB:

| | RGB | Luminance |
|---|---|---|
| Base's lower stone step (moves) | 43, 30, 25 | 33.7 |
| Gap floor (fixed) | 45, 34, 30 | 36.6 |
| **Contact rows (fixed)** | **54, 37, 31** | **41.7** |
| Floor in front | 37, 28, 23 | 30.3 |

1. **The contact highlight stayed behind.** The plate's floor is lit in the 1–6 rows where the base met it. When the base rose, that bright line stayed on the floor under the open gap, repeating the base's lit bottom edge. This is the "duplicated bottom rim".
2. **The foundation joint drew a step edge.** A dark seam across the bottom of the gap (with a lit lip until M1.3J.4) read as the edge of a plinth.
3. **The contact shadow ended exactly on the old contact curve,** which outlined the same edge again.

**Not the cause:**
- **The cut-out's bottom rim.** Its last rows (19–40) are close to the stone above and move with the station; there is no second stationary rim.
- **Fixed base-coloured pixels.** None in the gap: all 5,625 floor pixels uncovered there are the reconstructed floor. The only other uncovered pixels (128) are at the top of the cabinet, against the wall behind it.
- **The reflection and the connection.** Hiding them changes nothing in the gap.
- **The floor.** The real floor in front is itself dark and low-contrast, and `h2-s4-seamless` matches it (M1.3J.4).

## 2. Changes (all behind the 2.5D flag)

| What | Where | Change |
|---|---|---|
| **Foundation joint** | `components/lab/scene-25d.ts` | **Removed** from Playground (`foundation: null`). Nothing replaces it: no ring, recess, bevel or outline. |
| **Contact highlight** | New `public/scene/layers25d/playground/contact-unlit.png` (`scripts/playground-contact-unlit.py`); `StationLayers.tsx`; `.lab-depth-unlit` in `globals.css` | The same floor pixels with only the highlight's low-frequency brightening removed: per channel, against a straight line between the floor just above and just below, measured along each row; grain kept. Faded in with the lift (`opacity: var(--lp)`), so at rest and at the switch nothing changes. 1,764 px; mean 7, max 53 levels removed. |
| **Shadows** | `globals.css` | The soft, wide ambient shadow leads (0.75 at full lift, was 0.45). The tight contact shadow is only an accent (×0.25, about 0.14 at full lift, peaking at a small lift; was ×0.35). |

**Shadow behaviour after the change:**
- The shading runs from under the base out a few px past the old contact line, with no edge on it.
- It grows with height through `--lp`: at rest, at the switch and with reduced motion it is 0.
- In the gap at full lift (x 1110–1360, M1.3J.4 → M1.3J.5):

  | | Before | After |
  |---|---|---|
  | Top of the gap | 34.2 | 32.5 |
  | Middle | 31.3 | 31.6 |
  | Open edge | 34.5 | 33.4 |
  | Contact rows | 41.2 | 35.7 |

  The floor in front is about 47 (with its reflection). The gap is neither uniformly dark nor uniformly bright.

**Probe updates:** the M1.3I suite (`scripts/visual/scene25d-evidence.mjs`) now:
- expects the new shadow strengths;
- checks the highlight fade (0 at rest, 1 lifted) and that there is no joint;
- checks that the new layer stays grounded.

## 3. Comparison (desktop 1648 × 928)

| File | What |
|---|---|
| `foundation-on-off.png` | A: M1.3J.4. B: joint off. C: joint off with simplified shadows. And the final. |
| `shadows-comparison.png` | Before/after, lifted, shadows on and off |
| `before-after-1x.png` | At rest, rising, full lift, returning (animations seeked, so the phases are exact) |
| `lifted-no-shadow-3x.png` | The gap at 3×, shadows off, for defects |
| `playground-lift.webm` | 5.9 s real time at 1672 × 941: idle, arrival, lift and hold, return |
| `before/`, `after/` | The single frames |
| `arrival-check/` | The activation seeked frame by frame |

**What the comparison shows:**
- **B:** removing the joint alone was a clear improvement.
- **C:** simplifying the shadows without fading the highlight still left a lit lower edge.
- **Contact shadow off entirely:** the gap became a light slab (rejected).
- **The final:** joint removed, highlight faded, ambient-led shadow. It is the only version where the gap reads as floor seen under the platform.
- **At rest:** identical before and after.

## 4. Validation

- `npm run typecheck`: pass.
- **M1.3I 2.5D probes** (against the default build on :3000), all OK:
  - initial rendering without a flash;
  - idle vs approved;
  - power transfer, progressive charging and drain;
  - platform strips lit;
  - lift 18 px;
  - arcade screen running on the lift;
  - grounded layers;
  - new shadow strengths;
  - highlight fade;
  - reflection;
  - return to idle;
  - rapid switching to Engineering mid-lift;
  - keyboard;
  - reduced motion.
- **Floor integration checks:** all OK.
- **Activation:** pixel-identical to M1.3J.3 up to and through the switch (max 0 to 650 ms). Differences start at 725 ms, as the station rises.
- **Real-time check:** the recording above. The full visual suite was not run.

## 5. Remaining defects

1. **Faint lower boundary at 3×, shadows off.** On the right half of the gap, the reconstructed floor is a few levels lighter than the floor directly in front. With shadows on it is balanced; at 1× it is not visible.
2. **Notches at the base's bottom edge.** Short notches under the lit strip, in the M1.3H cut-out.
3. **Wall behind the cabinet.** At the top of the cabinet, 128 px of M1.3H's clean background behind it are uncovered when it lifts (the wall artwork is still listed as missing).
4. **From M1.3J.3:**
   - the line's glow on the base corner appears about 75 ms later at activation;
   - 16 idle line-edge pixels (max 18/255).

**Regenerating:** `contact-unlit.png` is derived from `floor.png` (`h2-s4-seamless`). Re-run `scripts/playground-contact-unlit.py` if the floor candidate changes.
