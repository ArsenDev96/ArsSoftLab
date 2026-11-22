# M1.4E: central A and foreground restored in `/lab-v2` (experimental)

**Status:**
- The central A and the foreground details are recovered from the approved artwork and placed as separate transparent layers in `/lab-v2`.
- The route is still experimental and unlinked; the homepage `/` is unchanged.
- **M1.4E is not approved and SA-1 has not passed.**

**Unchanged from M1.4D:**
- the five station assets;
- the clean background;
- the connection paths;
- Playground's lift and arcade;
- the HTML interface and all behaviour.

## Sources

**Everything comes from the approved plate with the five power lines removed:**
- `docs/m1.3k/package/01-source/environment-lines-removed.png`, which is `lab-plate.webp` plus the M1.3I environment corrections;
- so no connection is baked into any layer.

**Nothing is painted or generated:** every visible pixel is the plate's own.

**Why the mattes are geometric and colour-based, not a difference against the v2 background:**
- The v2 background is aligned with the plate's architecture (0–1 px).
- But it is brighter (+4 to +11 luminance on the walls), and its floor is a different render, with other tiles and reflections. Mean difference around the hub is 61.

Script: `scripts/m14e-extract.py` (deterministic; NumPy and Pillow only; no packages or models installed).

## The layers (`public/scene/v2/m14e/`, each full frame at 1672 × 941, no transform)

| Layer | Contents | How it was isolated | Drawn |
|---|---|---|---|
| `hub.png` | Platform, glowing ring on its top, the A | Union of the measured rim ellipse (x 657–1020, y 561–631) and flange ellipse (x 640–1040, down to y 655), anti-aliased at 4×. The A's tip above the rim comes from its own bright core, inside the inner ring only. | normal, in the stations' depth order (after Educational, Engineering and Playground; before Creative Studio and Experience) |
| `hub-light.png` | The two thin holographic rings and the A's glow above the rim; the restrained amber floor reflection under the platform | **Light only:** the excess over the floor's own level (an opening for the rings; a per-row 30th percentile for the reflection, warm pixels only, faded out by y 735). The Educational connection's column is masked out. | `mix-blend-mode: plus-lighter` |
| `fg-table.png` | Book stack, mug, table, and the shadowed floor between the table legs | One measured outline, anti-aliased at 4× | normal, in front of everything |
| `fg-steam.png` | The mug's steam | Light only: near-grey excess over the local level inside a feathered column; the stone's warm veins excluded | `plus-lighter` |
| `fg-plant.png` | The defocused plant at the lower-right edge | Colour matte (leaves: G/R 0.83–1.04, green above blue; the floor is warm or bluish grey), closed and softened like the defocus | normal |

**Light layers** (rings, glow, reflection, steam) are added to whatever is beneath them. That way they carry no plate floor onto the v2 floor, and no blur or dark mask is used.

**Wiring:**
- `components/lab/SceneV2.tsx`: the generated `central-a.png` is no longer drawn (the file is untouched). The hub gets no placeholder contact ellipse, because the approved pixels carry their own contact.
- The foreground sits in front of every station; it is static, with `pointer-events: none`.

## Comparison

Same 1648 × 928 viewport and camera as M1.4D (asserted).

| Sheet | Shows |
|---|---|
| `approved-vs-m14d-vs-m14e.png` | A, B and C whole scene; hub and foreground crops |
| `central-a-before-after.png` | The central A at 2×; the layers; the M1.4E browser render at 3× |
| `foreground-before-after.png` | Both foreground corners; the layers; the 3× renders |
| `playground-lifted.png` | At rest, full lift, full lift without the contact ellipses, live hover; the gap at 3× |

**Mean difference from the approved homepage** (mean \|diff\|, desktop pixels, connections on; `work/closeness-to-approved.json`):

| Region | M1.4D | M1.4E |
|---|---|---|
| Whole frame | 34.1 | **29.6** |
| Central A | 59.7 | **42.8** (the rest is the v2 floor around it) |
| Foreground, lower left | 53.4 | **25.6** |
| Foreground, lower right | 33.0 | **23.7** |
| Playground (unchanged) | 50.9 | 50.1 |

**Central A proportions:** approved again. It's the low, flat platform, glowing A, two thin rings and restrained reflection, at the approved position and size. It no longer reaches Educational's platform: the ring top is at y 525 and Educational's base at 485.

**Hierarchy:** the centre no longer dominates. As approved, the five stations lead and the hub anchors.

**Foreground framing:**
- The book stack, the mug with its steam, the table and the lower-right plant frame the scene again.
- The lower left, which was empty floor in M1.4D, reads as the approved composition.

**Floor perspective:** unchanged; it is the v2 background's. The recovered objects sit on it convincingly, because they come from the same camera.

**Alpha edges at 3×:**
- The hub's rim and flange are clean.
- Books, mug and table are hard and clean.
- Steam and plant are soft, as in the original.

## Playground

- **At rest:** unchanged.
- **Full lift:** 17.75 desktop px.
- **The gap:** still the clean floor at 3×, with or without the contact ellipses.
- **Live hover:** energy, then lift, then the arcade running.
- **Interference:** none from the recovered layers. They are outside its rect and never transformed.

## Checks (`scripts/visual/m14e-capture.mjs`; `work/captures/checks.json`)

| Check | Result |
|---|---|
| Recovered layers | All five loaded (1672 × 941). Light layers use `plus-lighter`. The generated hub is not drawn. |
| Pointer | Never hits a recovered layer (books, mug, plant, hub). Over the steam and the Creative platform it reaches the Creative hotspot (hover = `creative`). |
| Playground hover | Lift 17.75 px, arcade opacity 1 and running, back to 0 on leave |
| Keyboard | 15 Tabs to Playground; Enter selects (`/lab-v2?station=playground`); Escape clears (`/lab-v2`) |
| Deep link | `/lab-v2?station=playground` selected and lifted on load |
| Reduced motion | No lift |
| Errors | No console errors |
| Homepage | `/` requests nothing from `/scene/v2/` |

## Report

**1. Original assets reused.**
- The central A, complete: platform, A, rings, reflection.
- The book stack, the ArsSoftLab mug and its steam, the foreground table, and the lower-right plant.
- All from the approved plate, line-free, with no repainting.

**2. Does the central A match the approved design?** Yes in position, size, silhouette and weight: they are the approved pixels. Differences:
- The floor around it is the v2 floor: brighter and glossier, with its own reflections.
- So the platform's reflection is a restrained additive version of the approved one, not the approved floor itself.

**3. Foreground objects restored:** all four (books, mug with steam, table, plant).

**4. Defects.**
- **Hub:** small darker notches at the very ends of the flange (x 640 and 1040, y about 610). They are the plate's own bevel ends and floor cracks, visible only at 3×.
- **Steam:** reads a little weaker than approved. It is light added over the v2 Creative platform, which is a different stone face from the one the approved steam lies over.
- **Plant:** covers slightly less of the corner than approved. The topmost leaves near the floor's dark olive patches were left out rather than cut poorly.
- **Mug handle:** the opening shows the approved floor (dark), about 10 × 30 px.
- **No black masks, blur patches or added bloom.** No connection or animated station light is baked into any layer.

**5. Closer to the approved scene?** **Yes.** It is measurably closer in every changed region (above), and visually the centre and framing now match the approved composition.

**What still separates `/lab-v2` from the approved design** (out of this milestone's scope; all from M1.4D):
- the v2 stations: their stone, flatter front platforms, baked glyphs and taller cabinet;
- the brighter and glossier v2 floor;
- no station reflections on the floor;
- the faint vector lines at rest;
- the plate-based hover effects left out.

**6. Remaining blockers.**
- **No production build of `/lab-v2` was made or needed.** It runs under `next dev` with a separate dist dir.
- **The station work above needs its own milestone** (station assets were frozen here by request).

## Validation

- `npm run typecheck`: pass.
- Targeted browser checks: above.
- **Not run:** production build, full visual suite.
- **`/` unchanged:** `LabScene` and `ChargeLines` default to the plate path. The only edit in M1.4E is to the experimental `SceneV2.tsx`.
- `next dev` rewrote `tsconfig.json` while running; it has been restored from git.

## Files

**New**
- `scripts/m14e-extract.py`
- `scripts/m14e-sheets.py`
- `scripts/visual/m14e-capture.mjs`
- `public/scene/v2/m14e/*.png` (5 layers, 268 KB)
- `docs/m1.4e/**`

**Changed**
- `components/lab/SceneV2.tsx` (recovered hub and foreground)
