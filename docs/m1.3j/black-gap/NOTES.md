# M1.3J.4: the black Playground lift gap

**Result:** the 18 px gap now shows the floor under the raised platform instead of a black band. It is 36 luminance with all layers on (was 29; the bare floor there is 42). The joint no longer reads as a step edge.

**Not claimed:** SA-1 remains pending your review.

**Scope:**
- Experimental build only. Two edits, one CSS and one component.
- The floor (`h2-s4-seamless`), the reference image, the power connection, the arcade game and all animations are unchanged.

## 1. Root cause (measured, not assumed)

**Method:** `scripts/visual/playground-gap-layers.mjs` freezes the fully lifted frame (`matrix(1.01, 0, 0, 1.01, 0, -18)`) and captures it at desktop scale, 1:1, with layer groups switched off. The sheets are `before/diagnostic-1x.png` and `after/diagnostic-1x.png`.

**Captures** (mean luminance over the 5,782 px gap):

| Capture | Before | After |
|---|---|---|
| A: all layers | **29.2** | **36.2** |
| B: shadows off | 41.9 | 41.6 |
| C: shadows and joint off | 42.2 | 42.2 |
| D: floor and lifted station only | 42.2 | 42.2 |
| E: floor alone, station hidden | 41.8 | 41.8 |

**Single-layer probes** (`F-*`): floor candidate, clean background, reflection, connection and station off one at a time.

**What the captures prove:**
- **The floor is visible through the gap.** It is present and unchanged under every capture (E = D = C), at the same tone as the floor right in front of the base.
- **The shadows made it black.**
  - The contact shadow (alpha 0.50, at opacity 0.55 at full lift) and the ambient shadow (alpha 0.26, opacity 1) together removed about **46 %** of the floor's light across the upper two-thirds of the gap.
  - The measured floor-to-shadowed ratio is 0.53–0.57: 47 → 25.
  - At desktop scale that reads as a solid black band.
- **The foundation joint made it read as solid.**
  - Its dark line (0.55) with a lit lip under it (0.1) drew a bevelled edge across the bottom of the gap, so the opening looked like another step of the platform.
  - On its own it is a few levels. Visually it closed the gap.
- **The floor reconstruction is not the cause, so it is kept.**
  - The real floor directly in front of Playground (rows 562–590, line-free) is itself dark and low-contrast: luminance 38; detail std 1.8 / 1.6 / 2.3 at fine / mid / coarse scale.
  - `h2-s4-seamless` in the gap matches it: 39; 1.3 / 1.9 / 2.6.
  - The textured stone is the lit floor to the left (luminance 110, std 5–7), not the floor beside the gap.
- **Not involved:** the reflection, connection, clean background and station alpha. Each changes nothing in the gap when hidden, apart from the station's own lifted silhouette.

## 2. Fix

1. **Shadow strength** (`app/globals.css`, `.lab-depth-contact` / `.lab-depth-ambient`, classes that exist only in the layered build).
   - The same curves (contact strongest at a small lift, ambient taking over with height) now at **0.35×** and **0.45×**.
   - At full lift: contact 0.19, ambient 0.45.
   - **Result:** the gap darkens about 20 % deep under the base and about 8 % at the open edge. The floor stays visible, and the gap still shades towards the platform.
2. **Foundation joint** (`components/lab/StationLayers.tsx`, `Foundation`, which renders only in the layered build).
   - Joint 0.55 → 0.3.
   - Lit lip removed.
   - It stays as a faint floor seam.

**Updated probe:** M1.3I's shadow-strength expectation in `scripts/visual/scene25d-evidence.mjs` now reads contact 0.19 / ambient 0.45.

The experimental build was rebuilt (`npm run build:layered`). The default build was not rebuilt and is unchanged; both edits are inert without the 2.5D flag.

## 3. Evidence

| File | What |
|---|---|
| `before-after-1x.png` | All layers, lifted, desktop scale |
| `before-after-2x-A-all.png`, `before-after-2x-B-no-shadows.png` | The gap at 2× (true pixels), shadows on and off |
| `before/`, `after/` | A–E and F-* captures, plus the full frame (`A-all-full.png`) |
| `playground-lift.webm` | 5.9 s real-time at 1672 × 941: idle, arrival, lift and hold, return |
| `arrival-check/` | The activation seeked frame by frame (0–900 ms) |

**Activation:** pixel-identical to M1.3J.3 through the switch (max 0 up to 675 ms). Differences start only as the station rises, where the shadows are now lighter. No flash.

## 4. Validation

- `npm run typecheck`: pass.
- **M1.3I 2.5D probes** (scratch output, against the default build on :3000), all OK:
  - idle vs approved;
  - lift 18 px;
  - arcade screen running on the lift;
  - strips lit;
  - grounded layers;
  - progressive charging and drain;
  - shadows at the new strengths;
  - reflection;
  - return to idle;
  - switching station mid-lift;
  - keyboard;
  - reduced motion.
- **Floor integration checks** (`compare --name h2-s4-seamless`): all OK.
- **Full visual suite:** not run.

## 5. Remaining defects

1. **The gap reads as dark floor, because the floor in front of Playground is dark.**
   - The polished, reflective area there has little texture at 1× in the approved art.
   - The gap continues it faithfully; it does not show the brighter stone pattern seen to the left.
   - If you expect visible stone flags under the platform, that needs painted floor artwork under the footprint. I did not invent texture.
2. **A thin dark line at the top of the gap.** This is the base's own bottom rim in the station artwork, travelling with the lift.
3. **From M1.3J.3:**
   - the faint contact highlight under the gap;
   - the corner glow appearing about 75 ms later at activation;
   - 16 idle line-edge pixels (max 18/255).
