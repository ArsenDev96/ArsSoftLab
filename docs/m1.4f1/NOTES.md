# M1.4F.1: Engineering and Educational artwork recovery (`/lab-v2`, experimental)

**Scope:** Engineering and Educational in `/lab-v2` only.

**Unchanged:**
- the homepage `/` and its assets;
- Playground (station, connection, grounding shadow, lift, arcade game);
- Creative Studio's and Experience's recovered artwork (M1.4F);
- the central A and the M1.4E foreground;
- the clean v2 environment;
- labels, chips, icons (HTML), navigation, deep links, keyboard, charge-line geometry.

`/lab-v2` stays experimental and unlinked. No new animations, lifts, floor reflections or scroll work. **M1.4F.1 is not approved; it awaits owner review.**

## 1. Baseline (same 1648 × 928 viewport and camera throughout)

Compared:
- `reference/approved-lab-design.png`;
- the approved plate, and the plate with the power lines removed (`docs/m1.3k/package/01-source/`);
- `/lab-v2` as of M1.4F;
- M1.4F's process (`scripts/m14f-extract.py`).

The outlines were measured on the approved plate at 3–8×, not on the generated images. Measurements are in `work/measurements.json`.

| | Engineering | Educational |
|---|---|---|
| Approved footprint (plate) | x 262–599, bottom 551 | x 682–994, bottom 496.6 (front of the base, mid-width) |
| Base depth / width: approved vs generated | **0.086 vs 0.076** | **0.131 vs 0.095** |
| Station extent: generated (before) | x 263–600, y 341–551 (the baked `</>` included) | x 674–990, y 259–484 |
| Station extent: approved (after) | x 262–599, y 385–551 | x 669–994, y 274–496 (orbit included) |

**Engineering, generated:**
- seen from a lower camera, so the platform is thinner and its top shallower;
- the laptop is larger, with a wider lid;
- the chart panel stands further right;
- a cyan `</>` glyph is baked in at the upper left, under the HTML icon: **two code icons**.

**Educational, generated:**
- a shallower platform top;
- a larger globe that sits differently against the island;
- a waterfall that isn't in the approved island;
- vines spilling far down the front;
- the orbit tilted differently.

**Stone** (side face, strips excluded): both approved stations are lit warmer by their own strips than the generated ones.

| Station | Luminance | Contrast (std) | Warmth (R − B) |
|---|---|---|---|
| Engineering, generated | 54 | 29 | 64 |
| Engineering, approved | 71 | 34 | 78 |
| Educational, generated | 53 | 20 | 29 |
| Educational, approved | 61 | 27 | 46 |

This is the opposite of M1.4F, where the generated stone was too orange. The approved values are what the reference shows and sit in the same range as the recovered Creative Studio, Experience and central A (warmth 37–58).

## 2. Method: M1.4F's, extended for holograms

**Script:** `scripts/m14f1-extract.py`. It is deterministic and uses NumPy and Pillow only. It imports M1.4F's helpers and writes to `public/scene/v2/m14f1/` only, so no M1.4F output can be overwritten.

**Sources, as in M1.4F:**
- **Station pixels:** the line-free plate.
- **Lit strips:** the approved plate's lit strips where the two plates differ on the station.
- **Excluded:** each connection's own segment (Engineering's end at the plinth; Educational's stem up the platform face). `/lab-v2` draws those itself.

**Hard mattes** (measured outlines, anti-aliased at 4×):
- **Engineering:**
  - the platform (raised block, lower slab, right block, the plinth's rounded end, bottom edge);
  - the laptop lid and keyboard deck;
  - the puck;
  - the plant pot.
- **Educational:**
  - the two-tier platform;
  - the island's body, whole: grass, trees, the diorama's mountains and Ararat, the church, and the rock down to the platform.

**Soft mattes:** the holograms and plants. These are light, not solid objects, so each pixel is split against `B`, the plate's own background diffused in from just outside the outline:
- **Solid part:** alpha is a smoothstep of how much brighter than `B` the pixel is. This covers the bars, globe lines, the diorama sky, the cyan glass and the orbit's core, and keeps the pixel's own colour.
- **Light part:** the remainder, `(1 − alpha)·max(I − B, 0)`, goes to the `-light` layer (`plus-lighter`). This covers the faint glass, panel tint and glow.
- **Exact reconstruction:** on the plate this rebuilds the artwork exactly. Every opaque pixel has error 0, and the only error is at anti-aliased outline edges, as in M1.4F.
- **Over the v2 room:** the faint glass and glow are added to the new background instead of carrying the plate's.
- **No dark patches:** where the plate is darker than `B`, the pixel is simply transparent.

**Engineering's soft regions:** the chart panel with its bars, the cube, and the potted plant.

**Educational's soft regions:**
- the globe (both bubbles), the diorama sky, the cyan glass bowl and the glow on the platform;
- the orbit's right half;
- the orbit's left arc, as a narrow band, so the plate's background plant beside it isn't taken.

**Floor light:** the strips' light on the floor is plate minus line-free plate, added as `plus-lighter` (as in M1.4F). It includes:
- Engineering's warm pool under the strip;
- Educational's two lit arcs at the base's bottom corners, as approved.

**Wiring** (`components/lab/SceneV2.tsx`):
- The two recovered stations and their light layers replace the generated images, in the same depth order. The generated files are untouched.
- The existing contact ellipse stays under each.
- Hotspots, labels, chips, icons and connections are unchanged.

## 3. Result

| Sheet | Shows |
|---|---|
| `engineering-before-after.png` | At 1×: approved design, approved homepage, before (M1.4F), after |
| `educational-before-after.png` | The same for Educational |
| `engineering-closeup-3x.png` | The approved artwork (enlarged), before and after, rendered at 3× |
| `educational-closeup-3x.png` | The same for Educational |
| `full-scene.png` | The whole `/lab-v2` at rest |
| `approved-vs-v2.png` | The approved design vs the updated `/lab-v2` |

**Geometry: now the approved geometry.** Platform depth, tiers, laptop, chart, globe, island and orbit are the approved artwork's own, at its own position. Nothing is scaled, stretched or warped.

**Engineering:**
- the approved laptop with its code;
- the cyan chart panel, transparent: the v2 room's steps show through it, with the bars solid;
- the small cube;
- the potted plant and the ivy on the stone;
- the approved stone and its lit strip, with the warm light pool under it.

**Duplicate icon removed:**
- The approved artwork has no floating glyph, so the only `</>` is the HTML icon (one `.lab-station-icon` per station, checked).
- The HTML label and chips are unchanged.

**Educational:**
- the floating island with its church, trees and Ararat;
- the blue globe with its map lines, now see-through to the v2 window view;
- the cyan glass bowl and glow;
- the amber orbit, complete: its left arc in front of the pillar, its right end at x 994, crossing in front of the island as approved;
- the two-tier stone platform with the lit strip and corner lights.

The globe, island, orbit and platform stay aligned, because they are one piece of approved artwork. Educational's HTML icon, label and chips aren't in the layer (the plate has none).

**Consistency:** Engineering and Educational now share the camera, stone and light of Creative Studio, Experience, the central A and the foreground. Playground is the only generated station left.

## 4. Remaining differences

- **Through the globe:** the v2 window view (green hills and a fog band) shows through the globe's upper glass. On the plate, a darker dusk landscape shows through it. This is real transparency, and the globe's lines and tint are the approved ones.
- **Educational's connection stem:** under the strip's centre, the platform face shows the approved artwork's unlit stem housing (a small grey block), as the homepage does at rest. `/lab-v2` draws the stem itself (dim at rest, charging on hover), so it isn't baked in lit.
- **The floor:** the v2 floor is brighter and glossier, with no floor rings, as noted in M1.4F. The approved floor's rings around both bases and the floor reflection under Engineering's plinth aren't on the v2 floor and weren't added. The strip light is the approved amount, added to a different floor.
- **Grounding:** each base carries its approved dark contact edge, and the generic contact ellipse stays under it. Educational's front edge is lower (496.6) than the M1.4D fit's bottom (485), so its ellipse lies under the stone apart from its faint, almost transparent ends. The contact there is the approved edge, which reads as grounded at 1×. Shared floor lighting is a later milestone.
- **Hover:** Engineering's and Educational's homepage hover effects (Engineering's scan, the globe's orbit animation) aren't in `/lab-v2`, as since M1.4D. Hover lights the label and charges the connection.

## 5. Alpha and transparency defects (looked for at 3×)

- **Dark halos or borders:** none. Outlines are 1 px anti-aliased, and soft edges fade to transparent, never to the plate's background.
- **Baked floor patches:** none. No plate floor is in either station layer, and floor light is light only.
- **Clipped orbit:** none; the whole ring is kept, including its thin left arc.
- **Dark patches inside the globe:** none (see the method).
- **Small, at 3× only:** Engineering's plant leaves are slightly softer than the stone edges (soft matte).

## 6. Checks

Scripts: `scripts/visual/m14f1-capture.mjs` and `scripts/visual/m14f1-playground.mjs`. Results are in `work/captures/checks.json` and `work/measurements.json`.

| Check | Result |
|---|---|
| Layers | `engineering.png`, `educational.png` (normal) and their `-light.png` (`plus-lighter`) all load at 1672 × 941. The generated Engineering and Educational images are no longer requested |
| Icons | One HTML icon per station; no baked glyph (before: two `</>`) |
| Hover | The pointer over each recovered platform hovers its station; labels light, the connection charges; no errors |
| Keyboard | Tab 12 reaches the Engineering title, Tab 9 Educational. For each: focus powers it, Enter selects it (`?station=…`), Escape returns (`/lab-v2`) |
| Deep links | `/lab-v2?station=engineering` and `?station=educational` select on load |
| Reduced motion | Hover works |
| Console | No errors |
| Playground | Unchanged from M1.4F at rest and fully lifted; lift 18 px (details below) |
| Connection | Playground's continuous line unchanged at rest and powered (below) |
| Creative Studio, Experience | Unchanged from M1.4F over their own pixels (max difference 11 and 2) |
| Homepage | Unchanged from M1.4F's capture (149 px over 16, max 37), within run-to-run noise (two captures of the same code: 319 px, max 45); no `/scene/v2/` requests; all five icons |
| Validation | `npm run typecheck`: pass. Not run: full visual suite, production build (not needed: only static layers and one component's data changed) |

**Playground and its connection, in detail:**
- **Raw comparison:** with the dev badge hidden by an injected style, Chrome sometimes re-rasterises the transformed Playground image slightly softer about 1 s after load. This is pre-existing: it also happens with the new stations hidden from first paint, and in M1.4F's own `--before` capture. So raw captures differ along every edge (at rest: 950 px over 16, max 66), with no shift.
- **Like-for-like comparison:** after a 2 px blur, which removes raster sharpness but keeps any shift, colour or missing-element change, every comparison has 0 px over 16:

  | Comparison (2 px blur) | Max difference |
  |---|---|
  | Station at rest | 13 |
  | Station lifted | 6 |
  | Connection at rest | 5 |
  | Connection lifted | 4 |

## Files

**New**
- `scripts/m14f1-extract.py`
- `scripts/m14f1-sheets.py`
- `scripts/visual/m14f1-capture.mjs`
- `scripts/visual/m14f1-playground.mjs`
- `public/scene/v2/m14f1/{engineering,engineering-light,educational,educational-light}.png`
- `docs/m1.4f1/**`

**Changed**
- `components/lab/SceneV2.tsx`: Engineering and Educational drawn from the recovered layers. The station map now holds full paths, so Creative Studio and Experience are unchanged.

The captures used the `next dev --port 3002` server already running on this machine; it was left running.
