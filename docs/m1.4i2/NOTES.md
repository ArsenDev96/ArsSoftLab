# M1.4I.2: Lossless rendering optimization

**Recommendation: GO, once the remaining regression checks (section 6) pass.** In Chrome `/lab-v2` draws the same scene with **58 % less decoded image memory** and **176 MB less in the GPU process** at 1648 × 928 (251 MB less at 1920 × 1080). Four of the five station sequences now run close to 60 Hz on this old card. **Playground's lift does not run at a reliably higher frame rate.** Nothing committed or pushed.

| Decision criterion | Result |
|---|---|
| 1. Approved visuals unchanged | Yes: at most 6 of 255 levels, no visible difference (`visual-equivalence.md`) |
| 2. Animations and interactions work | So far, yes; some checks are still to run (section 6) |
| 3. Less texture area or memory | 416.7 → 173.5 MB decoded; GPU image textures 298 → 119 MB idle (`performance.md`) |
| 4. No new artifacts | None found |
| 5. Complexity in proportion | One component, one generated map, one generator script |

## 1. What changed

| File | Change |
|---|---|
| `scripts/m14i2-crop.py` | New. Makes the crops, `scene-crops.ts` and `crop-map.json`. Reproduce: `python scripts/m14i2-crop.py`; verify: `… --check` |
| `public/scene/v2/m14i2/` | New. 43 lossless crops (258.1 → 8.8 MB decoded, 1,265 → 912 kB). The sources are untouched |
| `components/lab/scene-crops.ts` | New, generated: source → crop and its rectangle in the 1672 × 941 scene. The only place with offsets |
| `components/lab/SceneImage.tsx` | New. Draws a full-frame layer from its crop |
| `SceneV2`, `EngineeringV2`, `EducationalV2`, `CreativeV2`, `ExperienceV2` | Their image elements use it. Seven wrappers are clipped to their own pixels (section 4) |
| `EngineeringScreen.tsx` | Its mask wrapper is clipped (section 4) |
| `PlateGate.tsx` | On `/lab-v2` the gate also waits for the crops. The homepage's script is unchanged |
| `LabScene.tsx` | `/lab-v2` adds the component's stylesheet |

M1.4I.1A–E's changes are all in place. The homepage uses none of this.

## 2. How a crop is placed
The element keeps the full-frame box the `<img>` had: same class, style, blend, mask and clip. It is an SVG whose coordinate system is the 1672 × 941 scene, with the crop at its scene rectangle. So no animation, mask, clip or lift needed a new offset.

- **Size rounding:** a browser rounds an `<img>`'s box to device pixels but not an SVG's. The stylesheet gives the SVG the rounded size, for the usual Windows scalings and zoom levels. Verified at real device scales 1, 1.25 and 1.5.
- **Guard:** each crop keeps 2 transparent pixels around its content, so its edges are filtered as before.

## 3. Chromium only
Firefox snaps every image by itself, also inside an SVG, and a crop can land up to 0.7 px off. So crops are drawn only where they are verified (`@supports (object-view-box:none)`, Chromium). **Elsewhere the same element draws the full-frame file, as before:** Firefox is pixel-identical, but gets no memory saving and downloads the crops as well (912 kB).

## 4. Besides cropping
Only one further change passed the "measurable and equivalent" test: **wrappers that covered the whole scene for a few pixels** are clipped to them, as Educational's already were (M1.4H.2). They are Engineering's display, scan, chart and bar caps, and the strip-light groups of Creative Studio and Experience.

- Full-frame layers 22 → 15, tile memory 324 → 264 MB.
- Engineering's sequence: 12 frames before, 17 with the crops alone, **34–35** with this.

| Looked into | Finding |
|---|---|
| Duplicate or repeated decoding | Before: 5–14 decodes on every second hover. After: 0 |
| The same texture twice | `engineering-chart.png` is a layer (cropped) and a mask (full); the mask is decoded only while Engineering is active, as before |
| Loading priority | SVG images are not preloaded from the HTML. The scene is not shown reliably later or earlier |
| The spark's layers | 20 layers of 834 × 360 exist at rest (`will-change`). Shared with the homepage and the approved spark: not touched |
| Background as lossless WebP | 2,237 → 1,673 kB, pixels identical, no memory gain. Not done; optional |

## 5. Left uncropped
Reasons and sizes: `asset-audit.md`. In short: 11 images that Chrome composites on their own (66 MB), 7 masks, Playground's two downscaled images, 8 sprites, the opaque background, and `core.png` (shared with the homepage).

**Where the rest could come from (owner decision, not part of this milestone):** at most window sizes the stage starts on a fraction of a pixel (−0.44 px at 1648 × 928), which is why shared layers are slightly softer than single images. Starting it on a whole pixel would make both sharp and the 11 crops safe. It moves the scene by up to half a pixel, so it is a visible change, however small.

## 6. Functional regressions

**Not finished: the session ended before all checks had run.** Output: `work/regress/functional.txt`.

| Check | Result |
|---|---|
| `npm run typecheck` | Passes |
| Hover to powered, leave to rest | All five, Chrome and Firefox |
| Keyboard (Tab, Enter), Escape, focus return | As in 1E |
| Title, platform and chip clicks | 17 of 17 open the right place (chips: one spark each) |
| Direct links | 5 of 5 powered at once, no spark, at rest after Escape |
| Reduced motion | 5 of 5: no spark, nothing lifts |
| 1E: bridges hold and never start a hover | 5 of 5 |
| 1E: hit area through Playground's lift, still pointer | As in 1E (12 of 24,166 at every height; 16 start, 0 restart) |
| 1E: platform, title and chip transitions | Engineering and Educational: 96 runs, 0 interrupted. **Playground, Creative Studio and Experience: not run** |
| 1A: direct load of `/lab-v2`, and `/` to `/lab-v2` to `/` by link | Opens and activates |
| 1A: entering from a page without the lab, history, remount | **Not run:** the probe's test address was wrong on this shell, so these lines in the output say FAILED; that is not a finding about the page |
| 1C: Playground's sign (clicks, timing, paths) | **Not run** (its hit map is unchanged) |
| 1B: Engineering's quick return | 10 runs, 0 flags, 0 errors |
| 1D: quick return, Creative Studio, Educational, Experience | **Not run** (stopped; no timing or state code changed) |
| One performance page after the browser test (section 3) was added | **Not run** |

**The GO above is conditional on these.** Commands, with the dev server on port 3002 (copy `docs/m1.4i1` and `docs/m1.4i1e` first: these probes write there):
```
node docs/m1.4i1e/work/transitions.mjs i2 playground,creative,experience label,chip
MSYS_NO_PATHCONV=1 OTHER=/nope node docs/m1.4i1/work/nav.mjs i2
node docs/m1.4i1/work/sign-probe.mjs i2 timing click paths
node docs/m1.4i1/work/qr-run.mjs i2 creative mouse        (then educational, experience)
node docs/m1.4i2/work/perf.mjs check 1
```

## 7. Floor tone
`?floor=approved` costs 6 MB of image memory, one more file and at most a few frames on first visits (`performance.md`, section 7). Same-state captures: `floor-tone-comparison.png`. **Recommendation: make it the default.** The earlier concern (about 15 % fewer frames on Playground) has shrunk to 22 → 20 of 54 on later visits. The default is unchanged, and so is the colour treatment.

## 8. Remaining risks
- **Chrome's layer decisions:** which images it composites on their own is its own heuristic. A later version could draw a few layers slightly softer or sharper, as it can today.
- **Window sizes at exactly half a device pixel, and unlisted zoom levels:** cropped layers can sit up to half a device pixel off at the scene's far edge.
- **Windows below about 1180 px:** Chrome samples smaller mip levels; at 1024 × 640 the largest difference was 3 levels.
- **Playground's first visit** keeps its one frame of about 320 ms.
- **Renderer process** about 25–30 MB larger after use.
- **Sources changed later:** run the generator again after editing any source image, or the old crop stays. `--check` fails if they differ.
- **Not tested:** production build, Safari (draws full frames by the same rule), touch, 2560 × 1080 captures.

This machine ran out of memory and disk during the work. Everything affected was measured again; the leftover test-browser profiles were deleted.
