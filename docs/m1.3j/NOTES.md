# M1.3J: precise Playground inpainting (prepared, no candidate yet)

**Update (M1.3J.1):** LaMa was installed locally and run. It produced three candidates; none was convincing (the best, c2, is continuous but soft), so the M1.3I floor stays. See [`lama/NOTES.md`](lama/NOTES.md).

**Update (M1.3J.2):** a hybrid floor (c2 tone + real floor grain, `h2-s4-seamless`) is better than both at 3-4x and is integrated in the experimental build; the base-edge defects are fixed there. See [`hybrid/NOTES.md`](hybrid/NOTES.md).

**Update (M1.3J.3):** the wedge at the left end of the lifted gap (a base-corner copy in the connection layer) is removed: [`connection/NOTES.md`](connection/NOTES.md).

**Update (M1.3J.4):** the black lift gap came from the contact + ambient shadows (−46 % of the floor's light) and a step-like joint; both toned down, the floor kept: [`black-gap/NOTES.md`](black-gap/NOTES.md).

**Update (M1.3J.5):** the gap's false second step (the contact highlight left on the floor, the foundation joint, the contact shadow's edge) is removed: joint gone, highlight fades with the lift, ambient-led shadow. See [`depth/NOTES.md`](depth/NOTES.md).

**Status:** the workflow is ready and validated end to end, but **no inpainted floor exists yet**.

No model on this machine can produce one without a download, and the one installed tool that could (Photoshop) is interactive. The experimental build currently shows the M1.3I floor; the approved build is unchanged. Choose an option below.

## 1. Local inpainting capability

| What | Found |
|---|---|
| GPU | NVIDIA GeForce RTX 4060, 8 GB (driver 610.88): enough for LaMa or SD/SDXL inpainting locally |
| Python | **Not installed** (only the Microsoft Store stub) |
| Inpainting tools (IOPaint / LaMa, ComfyUI, Automatic1111, Invoke, Fooocus) | **None** |
| Model caches (Hugging Face, torch, Ollama) | **None** |
| ImageMagick, GIMP, Krita | None |
| **Adobe Photoshop 2024 (25.5)** | **Installed.** **Content-Aware Fill** runs locally. **Generative Fill** sends the image to Adobe's servers, so it counts as an upload. |
| Node 22 and headless Chrome | Used for the crop, masks, compositing and checks |

Nothing was installed, downloaded or uploaded.

## 2. Prepared inputs (`docs/m1.3j/inpaint/`)

The crop is **512 × 192** at scene (962, 432). It holds the whole floor band with 90 px of floor either side and 66 px below. There are 2× versions (1024 × 384) in `2x/` for diffusion models.

| File | Purpose |
|---|---|
| `plate-crop.png` | The approved artwork (reference only) |
| `context.png` | **The tool's input.** The plate with **every station pixel replaced** (0 px of arcade or platform left), using Playground's clean background, so the tool can't regenerate the station. Inside the band it holds the M1.3I synthesised floor, as a starting point for tools that use one. |
| `mask-floor.png` | **The mask for the tool and for compositing.** The supplied `playground-floor.png`, limited to pixels hidden at rest: 6,698 px. The supplied mask's other 3,978 px are floor visible in the approved design. They stay black, so the tool sees real floor right up to the contact line and continues it, and they are never changed. |
| `mask-supplied.png` | The supplied mask as given (for reference) |
| `mask-work.png` | A larger alternative for generative tools: everything the station hid. Only `mask-floor` is ever composited back. |
| `mask-sampling.png` | For Photoshop: visible floor only. It excludes the station area, the connection lines, lit glows, the Experience panel and the central platform's rim. |
| `masks-over-context.png`, `inputs-sheet.png` | Review sheets |
| `crop.json` | Crop geometry and pixel counts |

## 3. Integration and checks (`npm run inpaint:playground -- …`)

```bash
npm run inpaint:playground -- prepare                                  # (re)writes the inputs above
npm run inpaint:playground -- integrate <candidate.png> --name <id>    # 512x192 or 1024x384
npm run inpaint:playground -- compare --name <id>                       # needs :3000 default, :3001 experimental
npm run inpaint:playground -- clear                                    # back to the M1.3I floor
```

**What `integrate` does:**

- Takes the candidate's pixels **only inside the exact mask, and only where the floor is hidden at rest**.
- Writes them to `public/scene/layers25d/playground/floor.png`. That file is drawn only by the experimental build, directly over Playground's clean background, and is served from disk, so **no rebuild is needed**.
- **Verifies pixel identity outside the mask** and fails if anything else changed.
- Records how the candidate lands (`docs/m1.3j/candidates/<id>/record.json`):
  - pixels written;
  - the step at the contact line against the plate;
  - the band's tone and detail against the floor in front;
  - the station's soft-edge difference at the arrival instant.

**What `compare` does** (real browser, 1648 × 928), in `docs/m1.3j/candidates/<id>/`:

- The 18 px lift **with every shadow off**, at normal size (`lift-gap-1x.png`) and at 3× (`lift-gap-3x.png`), against the M1.3I floor, plus the 3× view with shadows on.
- Identity checks: nothing changes at rest; nothing outside the mask changes when lifted; the default build never references the candidate.

**Validated** with the current floor as candidate `baseline-m1.3i` (`candidates/baseline-m1.3i/`):

- 6,698 px composited;
- identity outside the mask exact;
- all `compare` checks OK;
- the 2× (1024 × 384) path also tested.

The experimental build was rebuilt once for the new layer; `npm run typecheck` passes.

## 4. Options for producing the floor (your decision)

| Option | Install / upload | Fit for this band | Effort |
|---|---|---|---|
| **A. Photoshop Content-Aware Fill** (recommended first) | None: installed and local | Copies real floor texture, like M1.3H's synthesis, but with Adobe's tuned matching, colour adaptation and your control of the sampling area. Sharp; risk of repeated patches. | About 10 minutes by hand (steps below) |
| B. LaMa via IOPaint, local | Python (~30 MB), PyTorch with CUDA (~2.5 GB) and the LaMa model (~200 MB), all downloads; **needs your approval** | Strong on thin bands and textures; runs in seconds on the 4060. Can go soft at 1×, so use the 2× inputs. Doesn't invent objects. | I can run it end to end once approved |
| C. SD / SDXL inpainting, local (for example ComfyUI) | 2–7 GB model plus Python and PyTorch; **needs your approval** | Generative and sharp, but may invent seams, rings or lights. Needs a prompt, low denoise and several seeds, each candidate reviewed. 8 GB VRAM is enough for SDXL fp16. | I can run it once approved |
| D. Photoshop Generative Fill | **Uploads the crop to Adobe**; needs your approval | Generative, with the same risks as C | Minutes |
| E. An illustrator | None | Best control. Brief and masks ready: `../m1.3i/background-requirements.md`, plus these inputs. | External |

### A. Content-Aware Fill steps (Photoshop 2024)

1. Open `inpaint/context.png` and `inpaint/mask-floor.png`. Optionally use the `2x/` pair instead.
2. In `context.png`, choose **Select > Load Selection**. Set Document to `mask-floor.png` and Channel to `Gray`, then click OK. The band is now selected.
3. Choose **Edit > Content-Aware Fill…**:
   - **Sampling Area Options:** Custom. Paint out the grey area above the band and the Experience panel; `mask-sampling.png` shows the floor to keep.
   - **Color Adaptation:** High.
   - **Rotation Adaptation:** None.
   - **Scale:** off. **Mirror:** off (no mirrored texture).
   - **Output:** Current Layer.
4. **File > Export > Export As > PNG**, at the same size (512 × 192 or 1024 × 384).
5. Run `npm run inpaint:playground -- integrate <that file> --name ps-caf-1`, then `compare --name ps-caf-1`.

Don't use **Generative Fill**; check whether the **Remove tool** is local before using it.

**My recommendation:** try A first, since it needs no install or upload and takes about 10 minutes. If the gap still doesn't read as convincing stone floor at 3× with shadows off, approve B (about 3 GB of downloads) and I'll generate and compare candidates.

## 5. Not done

- No candidate floor was generated, so the success criterion (a sharp, continuous, believable floor under the lifted Playground) is **not yet met**.
- No station animations were added.
- No long tests were run.
- `floor.png` is cleared (transparent), so the experimental build shows the M1.3I floor until a candidate is integrated.

## Files

**New**

- `scripts/inpaint-playground.mjs`
- `docs/m1.3j/**`
- `public/scene/layers25d/playground/floor.png` (transparent)

**Changed**

- `components/lab/scene-25d.ts`: the `floor` field.
- `components/lab/StationLayers.tsx`: draws `floor` over the background (layered stations only).
- `package.json`: `inpaint:playground`.
