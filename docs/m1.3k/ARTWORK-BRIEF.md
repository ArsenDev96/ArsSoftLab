# Playground 2.5D artwork brief

**Same design. Better depth. No visible blur.**

This brief asks for two images:
- **Asset A:** the laboratory with the Playground station removed.
- **Asset B:** the Playground station on its own, transparent.

They let the station rise 18 px above the floor in the website's animation. The room must stay exactly as it is in the approved illustration. Nothing is redesigned.

The pixels under and behind the station were never painted. They cannot be recovered from the illustration, and every automatic attempt so far (patch synthesis, AI inpainting, hybrids) has been rejected as blurred or unconvincing. **They need real illustration.**

Everything you need is in [`package/`](package/) (index: [`package/README.md`](package/README.md)).

## 1. The scene and its grid

| | |
|---|---|
| Scene | **1672 × 941 px**. Every file aligns pixel for pixel with `package/01-source/lab-plate.png`. |
| Preferred working canvas | **3344 × 1882 px**: exactly 2×. Scene pixel (x, y) is canvas pixels (2x…2x+1, 2y…2y+1). We downsample 2 × 2 → 1. |
| Never | Crop, reframe, rotate, rescale by any other factor, or shift the image. A 1 px shift is detected and rejected. |
| Colour | sRGB, 8 bits per channel. No colour grading, curves or filters on the whole image. |

**The 2× canvas has no extra detail.** `01-source/*@2x-UPSCALED-no-new-detail.png` is the 1× plate enlarged so that you can paint at 2×. Its existing pixels are no sharper than the 1× ones. Only what you paint adds detail.

**Paint base:** `01-source/environment-lines-removed.png` (or its @2x version). It is the plate with the five glowing power lines and Playground's strip reflection already removed. Those are separate animated layers, so they must not be painted back. `lab-plate.png` is the untouched illustration, for comparison.

The look to match is the approved design, `reference/approved-lab-design.png`. It includes interface labels, so don't paint over it.

## 2. What is original and what is new

`package/02-masks/provenance-3x.png` shows it at a glance.

| Mask (white = the area) | px (1×) | Status |
|---|---|---|
| Outside `6-remove-with-6px-margin.png` | everything else | **Original. Keep exactly.** We discard anything delivered there and use the approved pixels. |
| `6-remove-with-6px-margin.png` minus `5-hole-station-footprint.png` | 5,502 | **Original, blend margin.** Visible in the finished scene. Paint across it only to blend; we always use the approved pixels there. |
| `5-hole-station-footprint.png` | 42,149 | **New illustration.** Everything the station covers: floor, back step, wall, room. |
| `3-floor-hidden.png` | 6,698 | **New illustration, highest quality.** The floor under the base's front edge. |
| `1-lift-exposed-18px.png` | 6,779 | **What the animation actually uncovers.** It must hold up at 3× zoom. |
| `2-lift-exposed-24px-safety.png` | 8,709 | The same with a 6 px safety margin. Paint it to the same standard. |
| `4-floor-band.png` | 10,676 | The 24 px floor band from M1.3I (3,978 px of it are visible at rest). For reference. |
| `7-connection-lines-reference.png` | | Where the power lines run. **Don't paint lines.** |

All masks are also in `02-masks/@2x/` for the working canvas: hard-edged, with no anti-aliasing.

**Priority:**
1. **Red** (`1-lift-exposed-18px`): what the 18 px rise uncovers.
   - 6,512 px are floor, in a crescent along the base's whole front edge.
   - 256 px are wall at cabinet height:
     - mostly left of the marquee (x 1082–1137, y 350–450), where the cabinet's top is wider than its body below;
     - a thin strip beside the cabinet's right side panel (x ≈ 1270).
   - 11 px are near the base.
2. **Magenta** (`2-lift-exposed-24px-safety`).
3. **Green:** the rest of the hidden floor.
4. **Blue:** the rest of the footprint (behind the cabinet).

Blue is not uncovered by the current animation, but Asset A must be a complete, believable room on its own.

## 3. Asset A: clean environment

The approved laboratory with Playground removed, as if the station had never stood there.

### Floor under the station (priority)

- **Material:** the same polished dark stone flagstones as the floor around it. The floor is irregular flagstone, not a regular tile grid.
- **Joints:** `04-guides/floor-joints-contrast-2x.png` raises the local contrast so the joints and grain are visible.
  - Continue only joints that run into the footprint, along their own direction.
  - Don't invent a new pattern. In the thin band the lift uncovers, the floor is seen at a grazing angle, so joints there are short and nearly horizontal.
- **Grain and depth:** the grain must have the scale of its depth.
  - `05-floor-reference/` holds real floor at the same depth (left of the base, where it carries the bright window reflection) and just in front of the base.
  - The orange ticks in `04-guides/geometry-guides-2x.png` mark the rows at the gap's depth.
- **Tone:** the floor directly in front of the base averages RGB 44, 33, 29 (luminance 36). The floor under the platform may be a touch darker:
  - the base stands on a slightly darker, worn disc, whose edge shows around the base's left end;
  - continue that disc; don't add a new one.
- **Reflections:** the floor is glossy. Continue the soft reflections of the window and lamps that cross the area. Leave out the station's own reflections; they are separate layers.
- **Geometry:** `04-guides/geometry-guides-2x.png`, measured from the artwork:

  | Colour | Shows |
  |---|---|
  | Cyan | The base's contact line at rest |
  | Yellow | The base's edge at full lift (18 px up, 1% larger, about x 1218, y 546) |
  | Red outline | What is uncovered |
  | Green | Where the floor meets the back step behind the station: y = 432 + (x − 1060) × 18 / 320 |

### Room behind the cabinet

Continue what is visible either side:
- the dark wall and back step;
- the warm lamp light from the left;
- the window frames and the dark pillar to the right.

Use the same light direction and softness as the room. The wall exposed left of the marquee and beside the cabinet's right side panel comes first, because the animation shows it.

### Must not contain

- Any part of the arcade cabinet, controller, plant or stone platform.
- The cabinet's purple neon glow on the wall, or the platform's orange strip light on the floor. All station light belongs to Asset B or is drawn by code.
- Contact shadows or ambient occlusion under the station. Shadows are drawn by code and scale with height.
- The power line or the station's floor reflection (separate animated layers).
- New design elements: glowing rings, foundations, plinths, bevels, outlines, props, decals or new light sources.

## 4. Asset B: transparent Playground

The station exactly as illustrated, cleanly separated.

| | |
|---|---|
| Contents | Stone platform, arcade cabinet, controller, plant and the other attached objects. Include the platform's orange strip and the cabinet's neon, as painted. |
| Opaque pixels | **Unchanged from the plate.** Re-cut the edges; don't repaint the station. Inside the outline the station must be the plate's own pixels. |
| Alpha | Hard where the artwork is hard (stone, cabinet body), soft only where the artwork is soft (neon glow). Straight (not premultiplied) alpha. |
| Glow | The neon's glow on the wall immediately around the cabinet may stay in Asset B as semi-transparent coloured pixels. Over Asset A it must reproduce the plate (see 6). It must be glow, not wall: no dark pixels carried along. |

**Fix the current cut-out's defects.** `03-context/station-cutout-defects.png` shows them, and the current file is `03-context/station-cutout-current.png`.

- **Cabinet top:** a dark band a few px wide, of wall and glow, is cut out with the marquee and its right-hand box. It rises with the cabinet as a dark halo. Cut to the cabinet itself.
- **Base bottom:** an uneven strip of lit floor is attached under the stone, with notches under the lit strip. The bottom edge must be the stone's own lower edge, continuous and sharp, with no floor below it.
- **Far-right base corner:** the matte was rebuilt by code in M1.3J.2. Check its curve against the artwork.

## 5. Optional Asset A2: contact rows without the station's light

At rest the floor is lit in the 1–6 rows right under the base, where the base meets the polished floor (x 1060–1376, y 526–553). Those pixels are visible in the approved design, so Asset A keeps them.

When the station rises, that light should go. Today code darkens those rows (`public/scene/layers25d/playground/contact-unlit.png`, a mean of 7 and a maximum of 53 levels removed). If you can, paint those rows as they would look with the station gone, on a transparent layer. Otherwise we keep the code version.

## 6. What we check

The delivery is checked automatically, then reviewed by the owner in the running site at desktop size and at 3×.

**Automatic checks** (`scripts/playground-artwork.py check`):
- **Alignment:** exact; shifts of up to 3 px are detected.
- **Approved pixels:** unchanged outside the remove mask.
- **Station removed:** no remnants and no neon or strip colour in the footprint.
- **Seams:** none at the footprint's edge.
- **Texture:** no copied or mirrored texture in the uncovered floor (clone-stamped patches are found).
- **Switch-on:** Asset B over Asset A must reproduce the plate, because the layers replace the plate the moment the station is activated.

**Visual review (SA-1):**
- **At rest:** practically identical to the approved design.
- **Station risen 18 px:** a clearly open gap, with sharp, continuous floor under the platform.
- **None of these:**
  - duplicated stone edges;
  - black or grey filler bands;
  - mirrored or repeated grain;
  - smearing.
- **Shadows off:** still convincing.
- **Behind the cabinet:** no exposed defects.

`package/06-defects/defects-to-avoid.png` shows every rejected attempt.

**Blur can't be measured reliably here.** The real floor is dark and soft at 1×, and the earlier rejected floors measure as detailed as it. Sharpness is therefore judged by eye, at 3×.

## 7. Deliverables

| File | Format | Required |
|---|---|---|
| `playground-environment@2x.png` | 3344 × 1882 RGB PNG, sRGB, 8-bit. The full frame, flattened: approved pixels outside the remove mask, your painting inside. Easiest: paint on layers above the supplied @2x plate and export everything. | **Yes** (or the 1× equivalent, 1672 × 941) |
| `playground-station@2x.png` | 3344 × 1882 RGBA PNG, straight alpha. Transparent outside the station. | **Yes** |
| Layered working file | PSD or KRA, with painted layers kept separate from the supplied plate | Yes |
| `playground-contact-rows@2x.png` | 3344 × 1882 RGBA. Opaque only on the contact rows (section 5). | Optional |
| `NOTES.txt` | What was invented and why (for example: where joints were continued, what architecture was assumed behind the cabinet) | Yes |

**Deliver in two passes:**
1. **The floor crescent and the exposed wall** (red and magenta). This alone unblocks the review.
2. **The rest of the footprint.**

## 8. Rules for any production route

- **Who paints:** an illustrator, or an AI-assisted workflow the owner has approved.
  - Every generated or AI-assisted pixel is reviewed and corrected by hand before delivery.
  - Generative tools tend to invent rings, lights and objects; anything that isn't in the approved design must be removed.
- **No uploading.** Don't upload the artwork to an online service unless the owner has approved that service in writing.
- **Content-aware fill and patch synthesis** may be used as a starting underpainting only, never as the final pixels. These routes have already been rejected on their own (M1.3H, M1.3J).
