# M1.2.2: Independent station layer prototype (Engineering)

**Verdict: PARTIAL.** It is promising, but it needs adjustments before all five stations can use it.

For Engineering itself the technique works:
- At rest the scene is pixel-identical to M1.2.1.
- There are no seams, holes or duplicated objects during the lift.
- The labels stay locked to the station.
- Animation runs at 60 fps on a weak GPU.
- The experiment can be switched off with one flag.

It is not yet a drop-in for every station. The reconstruction only holds up for small moves. Two stations contain see-through glass and holograms, and two have foreground leaves over them. The current asset layout costs about 25 MB of decoded images per station. Details are under "Recommendation" below.

## Evidence (this folder)

| File | What it shows |
| --- | --- |
| `idle.png` | The default lab at 1648×928. It is identical to `docs/m1.2.1/idle.png` (max difference 0). |
| `engineering-hover.png` | Pointer over Engineering: the station lifted, with the shadow and light on. |
| `engineering-return.png` | After the pointer leaves. It is identical to idle (max difference 0). |
| `comparison.png` | M1.2.1 baseline, M1.2.2 idle, hover and return, cropped and shown at 1.6×. |
| `mask-preview.png` | The traced silhouette on the plate, the alpha matte, and the cut-out over a checkerboard. It also has 8× edge details: the screen corner, plant, line junction and canvas corner. |
| `background-reconstruction.png` | The plate next to the backdrop with the station removed, at 2×. |
| `reconstruction-methods.png` | The inpainting methods tried and rejected: Telea, isotropic and horizontal normalized convolution, and FSR. |
| `lift-frames.png` | Intermediate frames with transitions paused at +0…320 ms in and +84…336 ms out. It ends with the layer-swap difference heatmap (×40). |
| `lift-edges.png` | Station edges at 4× nearest-neighbour: idle, mid-lift (+128 ms) and lifted. |
| `m1.2.2-recording.webp` | A 6.6 s, 30 fps recording: idle, pointer over the station, leave, pointer over the title, leave. The energy flow and orbit keep running. |
| `lift-report.txt` | Measured numbers: the swap, label alignment and GPU frame timing. |
| `regression/` | The `npm run visual` report (32/32 PASS) and its diff sheet. |

How the evidence was produced:
- The screenshots, frames, edges, report and recording frames come from `npm run visual:lift -- --url http://localhost:3100 --out docs/m1.2.2 --record`.
- The regression folder comes from `npm run visual -- --url http://localhost:3100 --out docs/m1.2.2/regression`. Its duplicate screenshots were removed.
- The previews come from `python scripts/make-station-layers.py --preview docs/m1.2.2`.
- The recording was assembled from the deterministic frames with Pillow, using a one-off script as in M1.2.1.
- `reconstruction-methods.png` came from a scratch prototype. It used `opencv-contrib` for FSR, which is not a repo dependency.

## 1. Technical approach

### Extraction

The silhouette is a hand-traced polygon of 77 points (`ENGINEERING_SILHOUETTE` in `scripts/make-station-layers.py`). It was traced on 4–9× gridded crops. The bottom contour was taken from per-column luminance profiles.

It is rasterised at 8× into a signed distance. The alpha reaches 1 at 0.6 px inside the traced edge and 0 at 1 px outside it.

Most of the trace is deliberately generous, and it was widened by about 1 px where the laptop's black bezel touches the wall. It is deliberately tight in three places:
- the Creative Studio canvas, which sits in front of the lower-left corner;
- the Engineering connection line, which ends under the base ring;
- the floor arc, which touches the ring.

All three stay in the static backdrop.

The output is not a rectangle crop. It is a soft-edged cut-out of the platform, laptop, code screen, chart panels, small device and plant. The light strip and the glow on the stone move with it.

### Background reconstruction

`reconstruct()` works in four steps:
1. **Row interpolation.** Each row is filled between robust medians sampled just outside the hole. The wall, the horizon and the floor reflections are horizontal bands, so they carry straight across.
2. **Membrane relaxation.** An anisotropic relaxation, dominated by the horizontal direction, removes the seams where the hole width changes.
3. **Bottom band.** Floor sampled right at the contact line is carried 14 px upward.
4. **Grain.** Matching grain is added.

Some sources are excluded: the glow fringe around the hole, highlights (the connection line, floor arc and screen glow) and the canvas.

Telea and FSR produced diagonal streaks and false colours. Isotropic normalized convolution left a black void, and the horizontal variant showed a vertical seam. All four are in `reconstruction-methods.png`.

### Exact matting

The backdrop is B = plate·(1−P) + recon·P. The station colour C is solved from plate = M·C + (1−M)·B.

Where that would need an out-of-range C, the backdrop coverage P is lowered per pixel. This happens at the near-black bezel against the brighter reconstructed wall.

Recomposing the three layers in Python reproduces the plate with a maximum error of 0.95/255.

### Contact shadow and light

Both are baked images, so the page uses no CSS masks:
- **Contact shadow.** A static footprint under the base. It gets darker deeper under the platform, with a 3 px soft spill below the contact line.
- **Light.** A warm elliptical light that moves with the station, clipped to the silhouette. It adds 9% mean brightness on the laptop and deck, at most +16 levels. The first version added 16% and was toned down.

### Browser composition (`components/lab/StationLayers.tsx`)

The layer stack is: plate, then backdrop, then shadow, then the lift wrapper holding the station and light. It sits inside the camera, so focus zoom still works.

Each layer is a small box (349×179 reference px) with `overflow: hidden`, holding a full-frame image at the plate's exact rect. Three earlier versions failed, which set these constraints:
- **Full-frame composited layers** dropped frames on the test GPU: p95 33 ms, 50–110 frames over 25 ms per 8 cycles.
- **Cropped image files** were pixel-snapped by Chrome independently of the plate. They landed up to 0.3 px off, so 28k px changed at the swap.
- **A clip on the shared group** cut the lifted laptop's top edge off at the box. This was caught in the 4× edge inspection. Now only the static layers clip, and the lift clips to its own moving box. `npm run visual` now guards against this.

The layer group is visible only while the station is lifted. At rest the untouched plate shows the station. The reason is that resampling the cut-out and the backdrop separately can't bit-match the resampled plate along high-contrast edges. Hiding the layers makes idle exactly M1.2.1.

The group is shown at the start of a lift and hidden 420 ms after the return. It is never shown before all four images have decoded.

### Motion (`app/globals.css`)

| Property | Value |
| --- | --- |
| Lift | `translateY(−5u) scale(1.012)` about the platform base (430, 548) |
| Timing | 320 ms in with `cubic-bezier(0.2,0,0,1)`, 420 ms out with `cubic-bezier(0.4,0,0.2,1)`, no overshoot |
| Shadow | Opacity 0 → 0.7 |
| Light | Opacity 0 → 1 |
| Labels | Same transform, with the origin re-expressed from the label anchor; they follow the station within 0.001 px |
| Trigger | Existing `data-lab-hover` state: pointer over the hotspot or labels, or keyboard `:focus-visible` on the title |

The hotspot deliberately doesn't move. If it did, the pointer at the station's lower edge could flicker between hover and rest.

### Reduced motion

There is no lift and no shadow. The light still brightens, with a 150 ms cross-fade.

### Reversibility

- **Code switch:** `NEXT_PUBLIC_STATION_LAYERS=off` gives exactly the M1.2.1 scene. No layer images are requested, the original platform glow on hover returns, and idle matches `docs/m1.2.1/idle.png` with a max difference of 0. The suite then passes 20/20 with the lift checks skipped.
- **Assets:** `public/scene/lab-plate.webp` and the reference image are untouched (md5 verified).

## 2. Assets and components

| Type | Item |
| --- | --- |
| Generator | `scripts/make-station-layers.py` (dev-only; needs opencv-python-headless and numpy). It is deterministic and re-running it reproduces the shipped files byte-for-byte. |
| Asset | `engineering.webp` (57 KB), the station cut-out |
| Asset | `engineering-backdrop.webp` (51 KB), the reconstructed scenery behind it |
| Asset | `engineering-shadow.webp` (2 KB), the contact-shadow footprint |
| Asset | `engineering-light.webp` (4 KB), the hover light |
| Component | `components/lab/StationLayers.tsx` (new) |
| Changed | `scene-layout.ts`: `STATION_LAYERS`, `hasStationLayer`, the on/off flag |
| Changed | `ProjectStation.tsx`: the labels ride the lift |
| Changed | `LabStations.tsx`: no static platform glow for a layered station |
| Changed | `LabScene.tsx` |
| Changed | `globals.css`: the lift rules |
| Tooling | `scripts/visual/lift.mjs` (new): lift probes |
| Tooling | `scripts/visual/station-lift.mjs` (new): the evidence script |
| Tooling | `check.mjs`: 12 lift checks |
| Tooling | `compare.mjs`: exclusion rectangles and `composeGrid` |
| Tooling | `package.json`: `visual:lift` |

All four assets are in `public/scene/layers/`, are full-frame lossless WebP, and total about 114 KB.

## 3. Regression and measurements

`npm run visual` passes 32/32.

| Comparison | Result |
| --- | --- |
| Idle vs M1.1 baseline | Max 2/255, the same as M1.2.1 |
| Idle vs M1.2.1 idle | Max 0 |
| Hover return vs idle | Max 0 |
| Hover vs idle, outside the station region | Max 0. The energy flow, orbit and other stations are untouched. |
| Camera focus and return, keyboard focus, Escape, reduced motion | All PASS, unchanged |

**Layer swap.** This compares the first frame of a lift, with the layers on and no motion yet, against idle:
- **Inside the station:** this is sub-pixel resampling of an animating layer. Chrome rasterises it at its peak scale of 1.012×. Most changes are at most 8 levels; the maximum is 48.
- **Labels:** the label is promoted to its own layer, which re-rasters the title text, with a maximum of 89.

In total 2,095 px change by more than 12/255. The heatmap is the last tile in `lift-frames.png`. At 4× nearest-neighbour the swap frame can't be told from idle by eye, and it coincides with the start of motion. It is not bit-exact, though.

## 4. Performance

The test machine was headless Chrome on an AMD Radeon HD 5450, a 2010 low-end GPU, at 1648×928. The run was 8 hover cycles in and out.

| Case | Median frame | p95 | Frames over 25 ms |
| --- | --- | --- | --- |
| Engineering lift (final) | 16.7 ms | 16.8 ms | 1 of about 650 |
| Educational hover (M1.2.1 reference) | 16.7 ms | 16.8 ms | 0 of about 650 |
| First version, full-frame layers | 16.7 ms | 33 ms | 50–110 |

- **Main thread:** about 0.5 ms of style recalculation per frame during transitions and negligible layout. The motion itself is compositor-only.
- **Idle cost:** none. The layers are hidden, so they are neither painted nor composited at rest.
- **Memory:** the four images are full-frame, so each decodes to 1672×941×4 ≈ 6.3 MB, about 25 MB for one station. The download is only about 114 KB.

## 5. The six questions

1. **Can the silhouette be separated cleanly?** Yes, for Engineering, with a hand trace, a 1.6 px soft edge and exact matting. The plant's leaves are covered by a generous blob, so a little background between them moves with the plant. That is invisible at 5 px but would show with larger moves.
2. **Can the shadow and glow move convincingly?** Yes, at this amplitude. Light on the station moves with it. Light the station casts on the floor stays put, which is physically right: the strip's reflection, the screen's wall glow and the floor arc.

   One inconsistency: a mirror reflection should move down as the object rises, and here it stays still. That isn't noticeable at 5 px.

   The new contact shadow is essential. Without it, the uncovered strip read as a pale ghost rim under the base, and the platform looked as if it slid rather than lifted.
3. **Can the background be reconstructed without artifacts?** Only well enough for small moves. The backdrop is plausible: the horizon and floor gradient continue, and there are no holes, duplicates or seams. It is not faithful, though. Floor texture and reflections are lost, and a faint blue haze remains where the screen lit the wall.

   This works because a 5 px lift only ever uncovers a strip about 5 px tall at the bottom contour, under the contact shadow. Lifts much beyond about 10 px, sideways moves, or hiding a station would expose the softness. A real re-render of the room without the stations is the proper fix.
4. **Does 5 px feel meaningful?** It's subtle. It reads clearly through the opening shadow gap and the labels rising, and as a hover acknowledgement it works. On its own it is not a dramatic gesture. 6–8 px would be stronger but uncovers more reconstruction, so 5 px was kept as specified.
5. **Does the scene lose depth when the station moves?** No, as long as the contact shadow and the static floor light are there. The lift then reads as the platform rising off the floor. Without the shadow, depth was visibly worse.
6. **Is the technique practical for all five stations?** Not as-is. See below.

## 6. Known limitations

- **Swap not bit-exact.** The layer swap at the start of a lift and the end of a return is sub-pixel, not bit-exact (see section 3). It is invisible in motion but measurable.
- **Soft reconstruction.** The backdrop is only good for small moves (see question 3).
- **Memory.** One station costs about 25 MB of decoded images. Five stations built the same way would cost about 125 MB.
- **Manual tracing.** The silhouette is hand-traced. The clip box the script prints has to be copied into `scene-layout.ts`, and changing the plate means re-tracing.
- **Static floor reflection.** The base light's floor reflection doesn't move with the lift.
- **Lift persists under focus.** While the camera is focused on Engineering, the station stays lifted if the pointer is still over it. Keyboard users move focus into the panel, so for them it settles. This is intentional but inconsistent between the two inputs.
- **Glow replaced.** The M1.1 static platform glow on hover is replaced, for Engineering only, by the light that moves with the station.

## 7. Recommendation for all five stations

Don't roll this out to the other four stations as-is. Before any of them:

1. **Share images between stations.** Use one shared full-frame image for all cut-outs, one for all backdrops, and one each for shadows and lights, with each station clipping its own box. Decoded memory then stays about 25 MB however many stations there are, instead of growing about 25 MB per station. Alignment stays exact because every image keeps the plate's rect.
2. **Consider a clean background render.** If any motion larger than about 10 px is ever wanted, render the room without the stations instead of reconstructing it.
3. **Add a sync check** between the generator and `scene-layout.ts`, for the clip box and silhouette.

Per station:

| Station | Assessment |
| --- | --- |
| **Playground** (arcade cabinet, gamepad) | Closest to Engineering: opaque objects on a platform against the back wall. Good candidate. Its purple floor glow must stay in the backdrop. |
| **Creative Studio** (easel, canvas, brushes) | Feasible, with care. Foreground leaves overlap its left side and need a tight mask and their own static layer. The canvas sits next to Engineering's base, so draw the stations back to front by depth. |
| **Experience** (rock model, flags, hologram panel) | Partial. The semi-transparent hologram shows the wall through it, so the wall would move with it. That's acceptable at 5 px but is a compromise. There are also foreground leaves at the lower right. |
| **Educational** (glass globe, island, orbit) | Hardest. The glass shows the windows and mountains behind it, and the M1.2.1 orbit highlight is masked to the ring's static position. The orbit effect would have to move into the lift layer, and the window mullions behind can't be row-interpolated. I'd suggest a lift of the base only, or no lift. |

Only Engineering was extracted, as agreed.
