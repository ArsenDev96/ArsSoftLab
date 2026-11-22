# Python setup for the asset scripts

The site (`npm run dev`, `npm run build`) needs no Python. Python is only needed to regenerate the `/lab-v2` assets or the milestone evidence sheets.

## Current pipeline (M1.4F–M1.4H.1)

You need Python 3.11 with NumPy and Pillow, pinned in [`scripts/requirements.txt`](../scripts/requirements.txt). Keep the environment **outside the repository**. On the original machine it lives at `E:/ArsSoftLab-tools/lama-venv`, which is the path the scripts' usage comments show; any location works.

```powershell
py -3.11 -m venv E:\ArsSoftLab-tools\lama-venv
E:\ArsSoftLab-tools\lama-venv\Scripts\python.exe -m pip install -r scripts\requirements.txt
```

If you create it inside the repo instead, name it `.venv/` or `venv/`, which are already in `.gitignore`.

**Asset generators.** They read only committed inputs:
- `public/scene/**`;
- `docs/m1.3k/package/01-source/lab-plate.png`;
- `docs/m1.3k/package/01-source/environment-lines-removed.png`;
- `docs/m1.3i/masks/*`;
- `docs/m1.4d/fit.json`.

Run them in this order (each builds on the previous one's output):

| Script | Writes |
|---|---|
| `scripts/m14f-extract.py` | `public/scene/v2/m14f/` |
| `scripts/m14f1-extract.py` | `public/scene/v2/m14f1/` |
| `scripts/m14g-floor.py` | `public/scene/v2/m14g1/` (add `--m14g` to rebuild `m14g/`) |
| `scripts/m14h1-engineering.py` | `public/scene/v2/m14h1/` and `components/lab/engineering-v2.ts` |

Run from a clean checkout, all four reproduce the committed assets pixel for pixel. That was checked before the first push.

**M1.4H.1 evidence.** You need a dev server, Node and Chrome (the capture scripts launch Chrome themselves).

```powershell
npx next dev -p 3002
node scripts/visual/m14h1-capture.mjs --webm        # BASE defaults to http://localhost:3002
<venv>\Scripts\python.exe scripts/m14h1-sheets.py
```

`m14h1-sheets.py` compares against M1.4G.1's captures in `docs/m1.4g1/work/captures/after/` (`scene-default.png` and `pg-{rest,lifted}{,-3x}.png`), which are committed for this purpose. Its captures and the `.webm` are written locally and stay out of Git.

## Not needed for current work

These scripts belong to finished or rejected milestones. Their inputs or extra packages are kept on the original machine only.

| Scripts | Needs |
|---|---|
| `make-clean-plate.py`, `make-scene-masks.py`, `make-station-layers.py` (homepage, M1.1–M1.2) | `opencv-python-headless` as well (see the README) |
| `lama-inpaint.py` (M1.3J experiment) | `torch` and a local LaMa model (`E:/ArsSoftLab-tools/models/big-lama.pt`) |
| `hybrid-floor.py`, `playground-edge.py`, `fix-playground-connection.py`, `inpaint-playground.mjs` (M1.3J experiments) | `docs/m1.3j/` candidates and frames, kept local |
| `m14a-preview.py`, `scripts/visual/m14a-preview-capture.mjs` (M1.4A, rejected generated pair) | `docs/m1.4a/` candidates, kept local |
| `m14e*-sheets.py`, `m14f-sheets.py`, `m14f1-sheets.py`, `m14g-sheets.py`, `m14g1-sheets.py` (earlier evidence sheets) | Those milestones' raw captures, kept local |

What `docs/` commits is set by its `.gitignore` section: Markdown, text and JSON throughout, plus the images listed there.
