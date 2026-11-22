# M1.3I clean-background requirements

What new artwork the 2.5D scene needs, exactly where, and in what form.

## Two separations: one possible from the artwork, one needing new paint

**The power connections, done here.** The connection lines are thin light painted on the floor. Their light can be subtracted and the floor's grain kept (M1.3G already did this for the unpowered state), so the environment can be made line-free without inventing anything. Under each line's ~3 px core the floor is estimated, but it is never visible on its own: the line's trace layer always covers it (`environment-3x.png`).

**The stations, not done.** Each station is an opaque object hiding a large area of wall, floor and architecture. Cutting it out reveals nothing, because the pixels behind it were never painted. M1.3H showed what synthesis can and cannot do here:

- **The floor band a lift exposes** (about 18 px under Playground): synthesised from real floor texture. Acceptable, but at 3× it is slightly flatter and greyer than the real floor.
- **Everything behind the cabinet** (wall, window, step, door): not convincing. A smeared ghost of the station's outline remains (`../m1.3h/clean-background.png`).

So a correct five-station-free background **needs new illustration** (by an artist, or generative inpainting reviewed area by area, only with your approval). It is not generated procedurally here.

## Source files

| File | Use |
|---|---|
| `public/scene/lab-plate.webp` (1672 × 941) | **Paint over this one.** It is the approved artwork with the baked interface (labels, navigation) already removed. |
| `reference/approved-lab-design.png` (1672 × 941) | The look to match: lighting, grain, colour grading. It contains the interface, so don't paint over it. |
| `docs/m1.3i/checks/environment-full.png` | The plate with the five lines and Playground's strip reflection already removed. Use it as the base if lines should not be repainted. |
| `docs/m1.3i/masks/*.png` | Where to paint (below). |

## Masks

All masks are full-frame 1672 × 941 PNGs: **white = paint new environment, black = keep the approved pixels exactly**. `masks/preview.png` shows them on the plate (cyan = exact, amber = approximate).

| Station | Remove mask | Floor band (first priority) | Area | Accuracy |
|---|---|---|---|---|
| Playground | `playground-remove.png` | `playground-floor.png` | 47,651 px | **Exact.** M1.3H cut-out alpha, plus a 6 px blend margin. |
| Engineering | `engineering-remove.png` | `engineering-floor.png` | 46,293 px | **Exact.** M1.2.2 cut-out alpha, plus 6 px. |
| Educational | `educational-remove.png` | `educational-floor.png` | 59,237 px | **Approximate.** Its hotspot polygon. The globe's orbit ring extends beyond it. |
| Creative Studio | `creative-remove.png` | `creative-floor.png` | 67,695 px | **Approximate.** Its hotspot polygon. It clips the platform's left edge. |
| Experience | `experience-remove.png` | `experience-floor.png` | 83,083 px | **Approximate.** Its hotspot polygon. |
| All five | `all-stations.png` | | | The union |
| Lines (reference only) | `lines.png` | | | Already line-free in the experimental build |

**The approximate masks must be replaced before painting those stations.** Trace each station's silhouette first (as for Playground in M1.3E/M1.3H), then rerun `node scripts/make-background-masks.mjs`.

**Floor band.** The floor band is the area up to 24 px above each station's contact line, which a lift exposes. If only one thing is painted, paint these. It fixes the lift gap without the full room.

## What to paint (per station)

- **Floor:** continue the polished stone floor under the footprint. Keep its tile joints in perspective, its grain scale at that depth, and the window and lamp reflections that cross the area. The floor under each platform is slightly darker in the reference (a worn disc); continue it, don't invent a new one.
- **Architecture behind:** complete the wall, window frames, back steps, doors and furniture that the station hides, with the same lighting.
- **Must not contain:**
  - the station or its platform;
  - its contact shadow;
  - its strip reflections;
  - its platform light spill;
  - the connection lines.

  All of these are separate layers.
- **No new design elements.** No glowing rings, extra props or changed lighting. A subtle foundation joint is drawn by code, so leave it out of the paint.
- **Colour and grain:** match the plate exactly at the mask edges (black area); the 6 px margin is for blending.

## Expected outputs

| Output | Format | Notes |
|---|---|---|
| `clean-environment.png` | 1672 × 941 RGB PNG, sRGB, same camera and perspective | The plate with the white mask areas repainted. Identical to the plate in the black areas: checked by diff. |
| *Preferred:* `clean-environment@2x.png` | 3344 × 1882 | If painted at 2×, the 3× inspection of the lift gap improves. The app can downsample. |
| Per-station delivery | Same size, painted only inside that station's mask | Acceptable. Floor bands first. |

## Integrating new artwork (next milestone, not done here)

1. **Playground:** use the painted area as the backdrop instead of the synthesised one. Re-matte the cut-out over it so the edges carry no old background colour. `make-playground-layered.mjs` needs an option to take a supplied background instead of synthesising one; that's a small change.
2. **Environment layer:** replace `lab-plate.webp` plus corrections with a single clean environment image, once all five stations are painted and cut out. Until then the plate keeps the stations it has no artwork for.
3. **Checks:** rerun `npm run visual:scene25d` to compare idle against the approved build, and the lift gap at 3× with shadows off.

## Not done without your approval

- No artwork was uploaded to an external service.
- No large AI model (for example LaMa, about 200 MB) was downloaded.

Both are possible routes to the floor bands, with your agreement.
