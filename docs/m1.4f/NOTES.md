# M1.4F: Creative Studio and Experience visual fidelity (`/lab-v2`, experimental)

**Scope:** Creative Studio and Experience in `/lab-v2` only.

**Unchanged:**
- the homepage `/`;
- Playground (asset, connection, shadow, lift, arcade, timing);
- the central A and the M1.4E foreground;
- the clean background;
- the connection geometry;
- Educational, Engineering;
- labels, chips, navigation, deep links and keyboard.

`/lab-v2` stays experimental and unlinked. No new animations. **M1.4F is not approved; it awaits owner review.**

## 1. Baseline (same 1648 × 928 viewport and camera throughout)

Compared: `reference/approved-lab-design.png`, the approved homepage, and `/lab-v2` as of M1.4E.3. Measurements are in `work/measurements.json`; base data is from `docs/m1.4d/fit.json`.

| | Creative Studio | Experience |
|---|---|---|
| Approved base (on the plate) | cx 298.5, bottom 773, width 402 | cx 1434.5, bottom 775, width 446 |
| Base depth / width: approved vs generated | **0.182 vs 0.089** | **0.191 vs 0.105** |
| Station extent: generated (before) | x 95–501, y 507–773 | x 1211–1658, y 517–775 |
| Station extent: approved (after) | x 98–501, y 509–779 | x 1201–1662, y 513–784 (with its plinth ring) |

**Footprint.** The generated stations were already placed and scaled to the approved base: same centre, width and bottom. As the brief warned, that hid the real problem.

**Perspective.** Both generated stations are rendered from a much lower camera:
- Their platform tops show about half the approved depth.
- The side faces are taller, so the platforms read as thick drums seen from the side.
- Experience's terrain is flattened, and its panel stands on a different plane.

No uniform scale or placement can fix this. Only a non-uniform stretch could, which the brief rules out.

**Stone** (side face, opaque pixels 8–40 px above the base bottom, strips excluded):

| Station | Luminance | Contrast (std) | Warmth (R − B) |
|---|---|---|---|
| Creative, generated | 56 | 32 | **72** |
| Creative, approved | 42 | 20 | **44** |
| Experience, generated | 61 | 40 | **83** |
| Experience, approved | 47 | 31 | **58** |

The generated stone is strongly orange-graded and higher in contrast. The approved stone is a darker, greyer stone in warm light.

**Objects, silhouettes and lighting:**
- **Creative Studio:** the generated version re-draws the painting, easel, brushes and frames at the low angle. The cup sits further forward and the brushes fan wider.
- **Experience:** the generated version has a taller, narrower panel standing further back, a flatter terrain, and a larger plant spilling over the front.
- **Lighting:** both generated stations have heavier, brighter base strips with a broad glow.
- **Approved lighting:** warm light from the back right, restrained strips (lit in segments), and grey-brown stone highlights.

## 2. Strategy: reuse the approved pixels (option 1 of the brief)

Both stations exist in the approved artwork at the right camera, so they were **recovered from it** as transparent layers, like M1.4E's hub and foreground. Nothing was generated, painted, warped or stretched.

**Script:** `scripts/m14f-extract.py`. It is deterministic and uses NumPy and Pillow only.

**Sources:**
- **Station pixels:** `docs/m1.3k/package/01-source/environment-lines-removed.png`, the approved plate without the power lines.
- **Lit strips:** the line-free plate also has the strips darkened by the M1.3 corrections, because the homepage lights them with separate layers. So where the two plates differ on the station, the lit strips, and their light on the stone, come from `lab-plate.png`, the approved plate itself.
- **Checked:** the corrections changed nothing else on either station body (checked by difference).

**Mattes** (the v2 floor is a different render from the plate's, so a difference against it is unusable):
- **Measured outlines**, anti-aliased at 4×, for everything with a defined edge:
  - stone sides and bases (with the lit strips and Experience's plinth ring);
  - the top surface's back edge;
  - the painting, easel mast and back leg, cup, five brushes, two frames;
  - the code panel (its border's outer edge, rounded corners), flags and poles.

  All measured on the plate at 4–9×; the coordinates are in the script.
- **Difference matte in a narrow band:** only for Experience's irregular rocky top, the wireframe peaks outside the panel, and the plant's upper leaves.
  - These are bright or green against the plate's dark floor.
  - Alpha is the pixel's difference from that floor, estimated by diffusing the plate in from just outside the outline.
  - The colour is un-mixed from it, so no plate floor is carried onto the v2 floor as a fringe.
- **The panel:** taken whole inside its border. Its bright border hides the change from the approved backdrop inside the glass to the v2 floor outside.

**Floor light:**
- `creative-light.png` and `experience-light.png` hold the strips' light on the floor: the lit plate minus the strip-less plate, i.e. the approved light itself.
- It is taken around each base, with the connection lines' ends excluded.
- It is added with `plus-lighter`, so no plate floor texture comes with it.

**Steam:**
- The M1.4E steam (unchanged, `plus-lighter`) lies over Creative Studio's stone face, where the plate has it baked in.
- Its light is subtracted from the Creative layer there, so it is not doubled.
- The steam now reads as approved, because it lies over the approved stone again (M1.4E noted it read weak over the generated stone).

**Wiring** (`components/lab/SceneV2.tsx`):
- The two recovered layers and their light layers replace the generated images, in the same depth order.
- The generated files are untouched.
- The existing contact ellipse (measured on the approved base) stays under each.
- Hotspots, labels, chips and connections are unchanged; the connections already end at the approved bases.

## 3. Result

| Sheet | Shows |
|---|---|
| `creative-before-after.png` | At 1×: approved design, approved homepage, before (M1.4E.3), after |
| `experience-before-after.png` | The same for Experience |
| `creative-closeup-3x.png` | The approved artwork (enlarged), before and after, rendered at 3× |
| `experience-closeup-3x.png` | The same for Experience |
| `full-scene.png` | The whole `/lab-v2` at rest |
| `approved-vs-v2.png` | The approved design vs the updated `/lab-v2` |

The 3× "before" is the live page with the generated images put back in place with their own transform; it matches the M1.4E.3 capture (mean difference 0.4).

**Perspective: now the approved perspective, not just closer.** The top-surface depth, side-face height, terrain height and panel plane are the approved artwork's. Base depth/width is 0.182 and 0.191 again, from 0.089 and 0.105.

**Identity preserved:**
- **Creative Studio:** the same mountain painting, easel, brushes in their cup, and the two small framed artworks.
- **Experience:** the winding illuminated path, translucent code panel, amber wireframe mountains, both flags and the greenery.
- The panel is not enlarged; it is the approved one.

**Materials:** stone warmth drops from 72 to 44 (Creative) and from 83 to 58 (Experience); luminance and contrast are as approved.

**Lighting:**
- **Strips:** the approved strips, lit in their approved segments:
  - Creative Studio: left and right of the base front, unlit in the middle;
  - Experience: left and right of the plinth, unlit in the middle.
- **Floor:** a restrained amber light on the floor below them (the approved light).
- No blurred bands, broad patches or doubled light.

**Same laboratory:** at desktop size the two stations now share the central A's and foreground's camera, stone and light. They read as part of the same room, not as objects placed over the floor.

## 4. Remaining differences

- **The floor:** the v2 floor is brighter and glossier than the approved one. The approved floor's thin glowing rings around both bases are not part of the v2 floor and were not added. The strip light is the approved amount, added to a different floor.
- **The other stations:** Educational, Engineering and Playground are still the generated images (out of scope). Their stone is about as orange as before (warmth 29–64), while Creative Studio, Experience and the central A are approved pixels; the difference is mild at desktop size.
- **Engineering's doubled `</>` icon:** the generated image has the icon baked in under the HTML one. This is from M1.4D and out of scope.
- **Hover:** Creative Studio's and Experience's homepage hover effects (their scan and activation glows) are still not in `/lab-v2`, as since M1.4D. Hovering lights the label and charges the connection; no new animation was added (by request).

## 5. Defects introduced (looked for at 3×)

- **Dark borders:** none at the stone or object edges.
  - Outlines are 1 px anti-aliased.
  - Band edges are un-mixed from the plate floor.
- **Blur, background patches, doubled steam or light:** none.
- **Small, at 3× only:**
  - **Creative Studio's left end** keeps a few dark leaves of the approved background plant where they overlap the platform (x 98–125). The v2 background's own plant sits just left of them, so they read as its leaves.
  - **Experience's panel** shows the approved (darker) backdrop through its glass. At 1× it reads as tinted glass.
  - **Experience's plant leaves above the rock** are slightly softer than the stone edges (band matte).
  - **A small bright glint** at the right end of Creative Studio's strip, and specks at Experience's right plinth: both are the approved artwork's own.

## 6. Checks (`scripts/visual/m14f-capture.mjs`, `work/captures/checks.json`)

| Check | Result |
|---|---|
| Layers | `creative.png`, `experience.png` (normal) and their `-light.png` (`plus-lighter`) all load at 1672 × 941. The generated Creative and Experience images are no longer requested |
| Hover | The pointer over each recovered platform hovers its station (`creative`, `experience`); labels light, the connection charges; no errors |
| Keyboard | Tab 17 reaches the Creative Studio title (focus powers it); Tab 19 Experience; Enter selects it (`/lab-v2?station=experience`); Escape returns (`/lab-v2`), focus kept |
| Deep links | `/lab-v2?station=creative` and `?station=experience` select on load |
| Reduced motion | Hover works |
| Console | No errors |
| Playground | Identical to M1.4E.3 within its silhouette, at rest and fully lifted (difference 0 over about 40,000 px each; the animated arcade screen excluded). Lift 18 px. No floating icon (unchanged from M1.4E.3) |
| Homepage | Identical to the M1.4E.1 capture apart from the Educational globe's orbit animation (135 px at scene 926–984 × 307–324); no `/scene/v2/` requests; all five icons |
| Validation | `npm run typecheck`: pass. Not run: full visual suite, production build (not needed: only static layers and one component branch changed) |

## Files

**New**
- `scripts/m14f-extract.py`
- `scripts/m14f-sheets.py`
- `scripts/visual/m14f-capture.mjs`
- `public/scene/v2/m14f/{creative,creative-light,experience,experience-light}.png`
- `docs/m1.4f/**`

**Changed**
- `components/lab/SceneV2.tsx`: Creative Studio and Experience drawn from the recovered layers.

The captures used the `next dev --port 3002` server already running on this machine; it was left running. `tsconfig.json` is unchanged.
