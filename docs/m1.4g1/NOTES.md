# M1.4G.1: Floor lighting consistency (`/lab-v2`, experimental)

**Scope:** three targeted corrections on top of M1.4G, which stays the baseline. `scripts/m14g-floor.py --m14g` rebuilds it unchanged; M1.4G's files in `public/scene/v2/m14g/` are untouched.

**Unchanged:**
- the homepage;
- the station artwork;
- spark, charge, strip and lift timings;
- connection geometry;
- the v2 floor (environment image);
- Playground's grounding shadows;
- Creative Studio's and Experience's M1.4F files.

No new lifts, rings or scroll work. **M1.4G.1 is not approved; it awaits owner review.**

## 1. Playground: the floor follows the power

**Diagnosis:**
- M1.4G's strip reflection was already synced to the strips.
- At rest, the floor under the dark strip read as lit for three reasons:
  - the v2 floor's own warm lamp reflection, which runs straight under the station (about 130, 106, 95);
  - a faint purple-grey rest reflection of the cabinet;
  - a ring that was amber before any power arrived.

**Corrections** (`scripts/m14g-floor.py`, `components/lab/SceneV2.tsx`):
- **Strip reflection only when powered.** The strips' whole area is left out of the rest reflection: the unpowered-strip overlay's footprint, which also covers their glow on the stone, plus 8 px. The strip's reflection now comes only from the powered station, in `playground-reflection-lit.png`, and fades with the strips.
- **Reflection occlusion** (`playground-occlusion.png`). In a polished floor, the area just in front of the base reflects the dark station body, not the room's lamps behind it.
  - The station's mirrored silhouette, softened and faded like the reflections, dims the floor there by at most 26%.
  - It's a uniform darkening, so the floor's texture is kept.
  - It drops with the lift, like the reflection.
  - The powered strip's reflection brings the warmth back on arrival.
- **Ring responds to power.** The ring stays fixed to the floor. Before the energy arrives it is unlit metal: a fainter, warm-grey line (`playground-ring.png`). Its amber is added on arrival (`playground-ring-lit.png`). It has the same geometry as M1.4G, with no extra rings and no broad glow.
- **Timing:** everything that follows the power uses the strips' own timing (`.lab-v2-power-lit`): up at the energy's arrival (`--arrive-now`), down 160 ms after the pointer leaves.
- **Blend fix:** the powered reflection's fading wrapper now carries `plus-lighter` itself. In M1.4G its opacity isolated it, so it was composited normally over the rest reflection instead of adding to it.

**Through the states** (`playground-floor-states-3x.png`, `playground-before-after-1x.png`):

| State | Lift | Strip off | Strip reflection | Ring (amber) | Reflection drop |
|---|---|---|---|---|---|
| At rest | 0 | 1 | 0 | 0 | 0 |
| Charging (spark travelling) | 0 | 1 | 0 | 0 | 0 |
| Energy arrived | −0.7 | 0.697 | 0.303 | 0.303 | 0.7 |
| Fully powered and lifted | −18 | 0 | 1 | 1 | 18 |
| Returning, 150 ms | −8.68 | 0 | 1 | 1 | 8.68 |
| Returning, 300 ms | −0.99 | 0.888 | 0.112 | 0.112 | 0.99 |
| Back at rest | 0 | 1 | 0 | 0 | 0 |

- **Sync:** the strip reflection and the ring equal 1 − strip-off in every state (max difference 6 × 10⁻¹⁷).
- **Timing:** lift and strip values are identical to M1.4G's in every state.
- **Floor under the strip** (scene 1120–1320 × 548–640):

  | | Luminance | Warmth (R − B) |
  |---|---|---|
  | M1.4G, at rest | 113.1 | 35.2 |
  | M1.4G, lifted | 113.1 | 35.4 |
  | M1.4G.1, at rest | 98.2 | 31.0 |
  | M1.4G.1, lifted and powered | 104.0 | 33.0 |

  At rest it is now calmer, and it warms when powered.

## 2. Creative Studio: the cyan highlight

**Source, confirmed:** a subtraction artifact, not the artwork. At the strip's right end the approved plate is warm white, clipped (e.g. 255, 252, 228). The line-free plate there is darkened amber (138, 96, 68), so their difference, which is the strips' light, is cyan (117, 156, 160). It reached the screen in two places:
- **M1.4F's `creative-light.png`:** 37 px, blue above red by up to 62. This was the small glint already visible before M1.4G.
- **M1.4G's floor light:** 119 px, up to 60. Its strip spill was the same difference. Also, removing the light already present channel by channel left the blue of a warm-white reflection over amber light: the cyan streaks below the strip end.

The reflection and the ring weren't the cause.

**Corrections:**
- **Strip spill:** the strips' light now takes the approved pixel's own hue, at its own brightness.
- **Combining with existing light:** reflections and rings are reduced by the share of their brightness that is already present, so they keep their hue.
- **Creative's light layer:** a copy (`m14g1/creative-light.png`) with only its 44 contaminated pixels re-hued. M1.4F's file and Creative's station artwork are untouched.

**Result:** 0 bluish pixels in both layers near the strip end (`creative-before-after-3x.png`).

**What remains is the original source:** a faint cool tint there comes from the v2 environment's own floor, whose blue window reflection lies at that spot (e.g. 92, 112, 129). Warm light added over it reads neutral-white. It is left as is (the real floor).

**Elsewhere:** the hue-preserving combine changes the other stations' floor light only slightly (mean difference 0.13–0.30 per area at rest, imperceptible in the sheets). The hub is unchanged.

## 3. Floor tone

- **Option kept:** `?floor=approved` is still available and still off by default.
- **Comparison:** both options captured at the same viewport and moment, pointer away and animations settled (`full-scene-default.png`, `full-scene-tone.png`, `floor-tone-comparison.png`).
- **Open floor** (including the stations' floor light):

  | Option | Luminance | Warmth |
  |---|---|---|
  | Default | 79.5 | 21.5 |
  | Tone | 74.1 | 26.2 |

## 4. Regression checks

Scripts: `scripts/visual/m14g1-capture.mjs` (run `before` and `after`) and `scripts/m14g1-sheets.py`. Results are in `work/captures/{before,after}/*.json` and `work/measurements.json`.

| Check | Result |
|---|---|
| Playground | Rest, charging, powered, lifted (18 px), returning and returned as in the table; timings identical to M1.4G |
| Keyboard | Tab 15 reaches Playground (it powers: ring and strip reflection 1); Enter selects (`?station=playground`, lifted 18 px); Escape returns (`/lab-v2`) |
| Reduced motion | Hover powers the strips, ring and reflection; no lift, no drop |
| Five stations, connections | Unchanged: no station or connection code changed; the floor light stays cleared under the connections' cores, as in M1.4G |
| Homepage | No `/scene/v2/` requests |
| Console | No errors |
| Validation | `npm run typecheck`: pass. Not run: full visual suite, production build |

## Remaining

- **Strip glow on Playground's stone:** the warm glow on the stone around Playground's unlit strip is baked into the generated station image. The unpowered overlay covers the strip, not all of that glow. It's station artwork, out of scope here.
- **The floor itself:** the v2 floor keeps its own warm lamp streaks elsewhere around Playground. Only the part in front of the base, which the station would hide in reflection, is dimmed.

## Files

**New**
- `public/scene/v2/m14g1/`:
  - `floor-light.png`
  - `playground-reflection.png`
  - `playground-reflection-lit.png`
  - `playground-occlusion.png`
  - `playground-ring.png`
  - `playground-ring-lit.png`
  - `creative-light.png`
- `scripts/visual/m14g1-capture.mjs`
- `scripts/m14g1-sheets.py`
- `docs/m1.4g1/**`

**Changed**
- `scripts/m14g-floor.py`: M1.4G.1 by default; `--m14g` rebuilds M1.4G.
- `components/lab/SceneV2.tsx`: the M1.4G.1 layers, `PlaygroundRing`, the power timing class, and Creative's light override.

Captures used the dev server on port 3002 (3003 had stopped).
