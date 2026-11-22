# M1.3K integration plan: illustrated Playground artwork

How the new artwork (Asset A, Asset B, optional A2; [`ARTWORK-BRIEF.md`](ARTWORK-BRIEF.md)) enters the experimental 2.5D build.

**It needs no change to the React components, the CSS or the animation system.** The new pixels replace files the experimental build already draws.

**Nothing has been integrated.** No acceptable artwork exists yet, so the experimental implementation is unchanged.

## 1. Where each asset lands

The experimental stack, back to front. Unchanged parts are marked "same".

| Layer | Drawn by | File | Comes from |
|---|---|---|---|
| Plate + environment corrections (lines removed) | `SceneLayer` / `EnvironmentCorrections` | `lab-plate.webp`, `environment-corrections.png` | same; approved pixels everywhere outside the station footprint |
| Platform power (static strips, reflections of the other stations) | `PlatformPower` | same | same |
| **Background under the station** | `StationLayers` backdrop | `public/scene/layers25d/playground/background.png` | **Asset A** inside the footprint (42,149 px) |
| **Floor in the gap** | `StationLayers` `.lab-floor-candidate` | `…/floor.png` | **Asset A**'s own pixels in the hidden floor (6,698 px). Identical to the background there; it keeps the M1.3J file layout. |
| **Contact rows, unlit** (fades in with the lift) | `StationLayers` `.lab-depth-unlit` | `…/contact-unlit.png` | **Asset A2** if delivered; otherwise regenerated from Asset A by `scripts/playground-contact-unlit.py` |
| Contact and ambient shadows | `StationLayers` `.lab-depth-*` | `…/shadow-*.png` | same; regenerated only if Asset B moves the bottom edge (section 4) |
| **Station** (moves 18 px, ×1.01) | `StationLayers` `.lab-lift` | `…/object.png` | **Asset B**; interim: the current cut-out with its soft-edge colour re-solved against Asset A |
| Strips, arcade screen, label | `PowerPart`, `StationActivation` | same | same |
| Floor reflection (drops and fades with the lift) | `StationReflections` | `reflection-*.png` | same |
| Power connections, all five | `ChargeLines`, lights layer | `lines/*.png` | same |

**Behaviour stays as it is:**
- At rest the station group is hidden, so idle is the approved plate, exactly as today.
- From the energy's arrival the group shows; that switch is only invisible if Asset B over Asset A reproduces the plate.
- `--lp` drives the shadows, the contact rows and the reflection.
- Keyboard and reduced motion are unchanged.

## 2. The pipeline (`scripts/playground-artwork.py`)

Run with the existing Python environment: `E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe` (numpy and Pillow).

| Step | Command | Writes | Touches `public/` |
|---|---|---|---|
| 0. Package for the illustrator | `… playground-artwork.py package` | `docs/m1.3k/package/` | no |
| 1. Check a delivery | `… check <environment.png> [--object <station.png>] [--contact <rows.png>] --name <id>` | `docs/m1.3k/deliveries/<id>/`: `report.md`, `report.json`, `review-2x.png`, `gap-3x.png`, `difference-from-plate-x8.png` (+ `master-2x-gap.png` for a 2× delivery) | no |
| 2. Owner reviews the sheets | | | |
| 3. Stage | `… stage <environment.png> [--object …] [--contact …] --name <id>` | `docs/m1.3k/staging/<id>/public/scene/layers25d/playground/*.png`, `stage.json`, `APPLY.md` | no |
| 4. Apply (experimental build only) | the steps in `APPLY.md` (section 3) | `public/scene/layers25d/playground/` (backup first) | yes |
| 5. Compare in the browser | section 5 | `docs/m1.3k/candidates/<id>/` | no |
| 6. SA-1 visual review by the owner | | | |

### What `check` verifies

| Check | Rule | Result |
|---|---|---|
| Size | 1672 × 941, or 3344 × 1882 box-downsampled to the scene | else rejected |
| Colour profile | sRGB or none | warning |
| Opaque | no transparency inside the footprint | FAIL |
| Alignment | the 30 px ring around the station matches the plate (or the line-free environment) at offset (0, 0); ±3 px searched | FAIL if shifted or regraded |
| Approved pixels | outside the remove mask unchanged (they are discarded anyway) | FAIL if changed |
| Station removed | at most 10% of the station's interior still equal to the plate | FAIL |
| Station light | neon-purple or strip-orange colour in the footprint | warning over 30 px |
| Seam | step across the footprint's edge against the natural step between original pixels | warning |
| Repetition | 20 × 8 px windows of the uncovered floor matched by FFT normalised cross-correlation against the area around the station, as is and mirrored (horizontal, vertical); the real floor's own worst match is reported alongside | warning over NCC 0.85 |
| Sharpness and tone | detail (mean \|Laplacian\|) and luminance of the uncovered floor against the floor in front | information; warning only below 0.5× or above 2× |
| At rest | station over the delivery against the plate inside the footprint (what the layer switch shows), against the current layers' own figure | warning if worse |

The review sheets include an **offline lifted preview**: the station warped exactly as the CSS transform does, shadows off, at 2× and 3×. It lets a delivery be judged before it goes near the build. The browser remains the authority.

### What `stage` writes

| File | Contents |
|---|---|
| `background.png` | Asset A on the footprint, opaque. The footprint is the current one, or its union with a delivered Asset B's alpha. |
| `floor.png` | Asset A on the hidden floor (6,698 px) |
| `object.png` | Asset B if delivered. Otherwise the current cut-out, with its 2,470 soft-edge pixels (alpha 0.08–1) recoloured: `C = (today's composite − (1 − a) · A) / a`. The switch at arrival then looks exactly as it does today; out-of-range solutions are counted in `stage.json`. |
| `contact-unlit.png` | Asset A2, if delivered |

## 3. Applying a staged delivery (only after the owner approves the check)

`docs/m1.3k/staging/<id>/APPLY.md` holds these steps with the names filled in:

1. Back up `background.png`, `floor.png`, `object.png` and `contact-unlit.png` to `docs/m1.3k/staging/_previous/`.
2. Copy the staged files into `public/scene/layers25d/playground/`. The file names are unchanged, so **no code edit and no rebuild** are needed.
3. Without Asset A2, regenerate the contact rows: `scripts/playground-contact-unlit.py`. It reads the new `floor.png`.
4. Restart the experimental server: `NEXT_DIST_DIR=.next-layered npx next start -p 3001`.
5. Refine the station's edge colour in the real browser, the M1.3J.2 procedure:
   - run `scripts/playground-edge.py variants`, then `node scripts/playground-edge-frames.mjs`, then `scripts/playground-edge.py solve`, then refine passes;
   - this absorbs Chrome's sub-pixel resampling, which the offline solve can't see.
6. **Undo:** copy `_previous/*.png` back.

## 4. Code changes needed only with a new Asset B (small; not made yet)

| Where | Today | Change |
|---|---|---|
| `scripts/make-scene-layers.mjs` (file list at line 265; `stationA`; `background.png` written at line 615) | Reads `public/scene/layers/playground-v2.png` for the station's alpha and **rewrites `background.png`** from M1.3H's synthesised background. | Read the station from `object.png` when present (as `inpaint-playground.mjs` already does at line 53). Don't write `background.png` when an illustrated one is in place. Then rerun it to regenerate the contact and ambient shadows from Asset B's bottom edge. **Until this guard exists, don't rerun `npm run layers:25d` after applying: it would restore the synthesised background.** |
| `scripts/playground-edge.py` | `SRC` is `playground-v2.png`; it rebuilds the far-right corner's alpha | With Asset B: `SRC` = Asset B; skip the corner rebuild (the artist's matte is authoritative); keep the edge-colour solve and refine |
| `components/lab/scene-25d.ts` | `missing` lists the floor and the wall behind the cabinet | Update once Asset A is accepted (text only) |

**Optional, later:**
- **2× assets:** `background.png` and `object.png` could be served at 3344 × 1882 at the same CSS rect, for sharper 3× zoom and high-DPI screens. The switch-on edge must then be refined at the served resolution. Not needed for SA-1 at desktop scale.
- **Separate glow layer:** the neon glow on the wall could be its own screen-blended layer (one `img`, one CSS rule). Not needed if the glow stays in Asset B (the brief's default).

## 5. Comparison with the approved scene

Use the default build on :3000 and the experimental build on :3001:

| Command | Shows |
|---|---|
| `node scripts/visual/playground-depth-evidence.mjs <id>` | 1648 × 928: rest, rising, full lift, lift without shadows, the gap at 3× without shadows, returning, rest again (animations seeked to exact phases) |
| `npm run inpaint:playground -- compare --name <id> --root docs/m1.3k/candidates` | The lift with every shadow off at 1× and 3×; nothing changes at rest; the default build never references experimental assets |
| `npm run visual:scene25d` | The M1.3I probes: idle against approved, power transfer, strips, the 18 px lift, arcade, grounded layers, shadow fade, keyboard, reduced motion, rapid switching |
| `node scripts/visual/playground-gap-record.mjs` | A short real-time recording for the review |

## 6. Acceptance mapping (brief section 7)

| Requirement | Evidence |
|---|---|
| Near-identical at rest | `visual:scene25d` idle probe; `check` at-rest figure; the switch frames (`playground-arrival-frames.mjs`) |
| Playground rises 18 px | `visual:scene25d` lift probe (unchanged CSS) |
| Clearly visible open gap; sharp, continuous floor | `depth-evidence` full lift at 1× and gap at 3×; owner review |
| No duplicated stone edges, filler bands, mirrored or repeated grain, smearing | `check` repetition and seam checks; 3× sheets; owner review |
| Convincing with shadows disabled | `-no-shadow` captures at 1× and 3× |
| No exposed defects behind the cabinet | The 256 px of wall in `1-lift-exposed-18px`; the 3× station capture |
| Default build unchanged | `inpaint:playground compare` identity check; no change to `next.config.ts` or flags |

**SA-1 is decided by the owner's visual review, not by these checks.**
