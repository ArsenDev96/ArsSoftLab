# Playground artwork package

Inputs for the illustration described in [`../ARTWORK-BRIEF.md`](../ARTWORK-BRIEF.md).

**Regenerate:** `E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/playground-artwork.py package`. It rebuilds this folder from the repository's files and is deterministic. Every mask comes from an existing M1.3I/M1.3J asset; nothing is re-traced.

All images align pixel for pixel with the 1672 × 941 scene. Files marked `@2x` are exactly 2× (3344 × 1882).

| Folder | Files | What |
|---|---|---|
| `01-source/` | `lab-plate.png` | The approved illustration (lossless copy of `public/scene/lab-plate.webp`, the interface already removed) |
| | `environment-lines-removed.png` | **Paint base.** The plate without the power lines and Playground's strip reflection (separate layers in the site) |
| | `*@2x-UPSCALED-no-new-detail.png` | The same at 2× for the working canvas: enlarged, so no sharper than 1× |
| `02-masks/` | `1-lift-exposed-18px` … `7-connection-lines-reference` | White = the area named, black = keep. Hard-edged; `@2x/` for the working canvas. Numbered by priority (see the brief, section 2). |
| | `provenance-full.png`, `provenance-3x.png` | Original vs newly illustrated pixels, colour-coded with a legend |
| `03-context/` | `context-1x.png`, `context-2x.png` | The station and its surroundings (scene x 960–1480, y 300–620) |
| | `detail-*-4x.png` | Cabinet top, base left end, middle and right end at 4× (nearest neighbour: the real pixels) |
| | `station-cutout-current.png` | The current transparent station (full frame, RGBA) |
| | `station-cutout-current-checker-2x.png`, `station-cutout-defects.png` | It on a checkerboard and on flat colours: the defects to fix in Asset B |
| `04-guides/` | `geometry-guides-2x.png` | Measured contact line (rest and full lift), what is uncovered, the back-step line, same-depth rows |
| | `floor-joints-contrast-2x.png` | Local contrast ×5, so the flagstone joints and grain read |
| `05-floor-reference/` | `left-of-base-same-depth-4x.png`, `in-front-of-base-4x.png`, `floor-stats.json` | Real floor at the gap's depth and in front of the base, with mean colour, luminance and detail |
| `06-defects/` | `defects-to-avoid.png` | Every rejected attempt (M1.3H to M1.3J.5) |
| | `package.json` | Pixel counts of every mask |

**Not copied (paths in the repository):**
- `reference/approved-lab-design.png`: the approved look, with interface labels.
- `docs/m1.3i/masks/preview.png`: all five stations' masks.
- `docs/m1.3j/inpaint/`: a 512 × 192 crop set from M1.3J for inpainting tools.
