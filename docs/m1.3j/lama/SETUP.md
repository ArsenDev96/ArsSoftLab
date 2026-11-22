# M1.3J.1 LaMa environment: setup, provenance and licences

Everything runs locally. No image left the machine. Everything is installed **outside the application** in `E:\ArsSoftLab-tools\`; the app's runtime and `package.json` dependencies are unchanged.

Note: the brief named `D:\ArsSoftLab`, which doesn't exist. The project is `E:\ArsSoftLab`.

## Layout

| Path | What | On disk |
|---|---|---|
| `E:\ArsSoftLab-tools\python311\` | Python 3.11.9, per-user, **not on PATH**, no launcher, no file associations | 63 MB |
| `E:\ArsSoftLab-tools\lama-venv\` | Isolated venv: PyTorch, NumPy, Pillow | 4.14 GB |
| `E:\ArsSoftLab-tools\models\big-lama.pt` | LaMa weights (TorchScript) | 196 MB |
| `E:\ArsSoftLab-tools\downloads\` | Python installer, pip logs | 25 MB |
| `%LOCALAPPDATA%\pip\cache` | pip's cached copy of the wheels | 2.46 GB (can be removed: `…\lama-venv\Scripts\python.exe -m pip cache purge`) |

## Steps taken

1. **Python 3.11.9.** Downloaded from `https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe` (25 MB).
   - Authenticode signature: Valid, *Python Software Foundation*.
   - SHA-256 `5EE42C4EEE1E6B4464BB23722F90B45303F79442DF63083F05322F1785F5FDDE`.
   - Installed quietly with `InstallAllUsers=0 TargetDir=E:\ArsSoftLab-tools\python311 PrependPath=0 Include_launcher=0 Shortcuts=0 AssociateFiles=0` (no test suite, docs or Tcl/Tk).
2. **venv.** `python311\python.exe -m venv E:\ArsSoftLab-tools\lama-venv`
3. **PyTorch** with CUDA 12.6, from PyTorch's official wheel index: `pip install torch --index-url https://download.pytorch.org/whl/cu126`
4. **NumPy and Pillow** from PyPI: `pip install numpy pillow`
5. **Model.**
   - Downloaded from `https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt`. That URL and the MD5 are the ones IOPaint's own source uses (`iopaint/model/lama.py`: `LAMA_MODEL_URL`, `LAMA_MODEL_MD5`).
   - MD5 `e3aa4aaa15225a33ec84f9f4bc47e500` **matches**.
   - SHA-256 `344c77bbcb158f17dd143070d1e789f38a66c04202311ae3a258ef66667a9ea9`.
   - Size 205,669,692 bytes.

**Not installed:** IOPaint itself (it pulls in diffusers, transformers and a web server), OpenCV, any other model.

## Installed packages and download sizes

| Package | Version | Download | Licence |
|---|---|---|---|
| torch (+cu126, bundles the CUDA 12.6 runtime libraries) | 2.14.1 | 2,602.8 MB | BSD-3-Clause. The bundled NVIDIA CUDA libraries are under NVIDIA's redistribution terms. |
| numpy | 2.4.6 | 12.6 MB | BSD-3-Clause |
| pillow | 13.0.0 | 7.3 MB | MIT-CMU (HPND) |
| sympy (torch dependency) | 1.14.0 | 6.3 MB | BSD-3-Clause |
| networkx (torch dependency) | 3.6.1 | 2.1 MB | BSD-3-Clause |
| setuptools | 78.1.0 | 1.3 MB | MIT |
| mpmath | 1.3.0 | 0.5 MB | BSD-3-Clause |
| fsspec | 2026.9.0 | 0.2 MB | BSD-3-Clause |
| filelock | 4.2.4 | 0.2 MB | Unlicense |
| jinja2 | 3.1.6 | 0.1 MB | BSD-3-Clause |
| typing_extensions | 4.16.0 | < 0.1 MB | PSF-2.0 |
| markupsafe | 3.0.3 | < 0.1 MB | BSD-3-Clause |
| pip (upgraded) | 26.3 | ~2 MB | MIT |
| Python | 3.11.9 | 25 MB | PSF License |
| **big-lama.pt** | (TorchScript) | **196 MB** | Apache-2.0 (below) |

**Total downloaded:** about 2.86 GB.

## Model provenance and licence

- **LaMa** ("Resolution-robust Large Mask Inpainting with Fourier Convolutions", Suvorov et al., WACV 2022; Samsung AI Center). Code and weights: `github.com/advimman/lama`, **Apache License 2.0**. The `big-lama` checkpoint was trained on Places2.
- **TorchScript export** by the lama-cleaner / IOPaint project (`github.com/Sanster/IOPaint`, **Apache License 2.0**), published as a GitHub release asset (`Sanster/models`, tag `add_big_lama`). It is the same model the IOPaint app uses by default, and it lets inference run with PyTorch alone.
- **Use:** inference only on our own artwork, locally. Apache-2.0 permits this, including commercial use; the generated pixels carry no licence condition from the model. If the weights are ever redistributed, keep the Apache-2.0 notice.

## Running it

```bash
E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/lama-inpaint.py \
  --image docs/m1.3j/inpaint/2x/context-env@2x.png \
  --mask  docs/m1.3j/inpaint/2x/mask-floor@2x.png \
  --out   docs/m1.3j/lama/candidates/<name>.png
```

**CUDA:** yes. `torch.cuda.is_available()` is True on the NVIDIA GeForce RTX 4060 (8 GB, driver 610.88).

| Step | Time |
|---|---|
| Model load | 0.6 s (7.8 s the first time) |
| Inference at 1024 × 384 | 0.76–0.79 s, including CUDA warm-up for the first call in a process |
| Inference at 512 × 192, first run | 4.0 s (cold CUDA) |
| Inference at 512 × 192, CPU check | 1.1 s |

The model is small, so CPU would also have been fine at this size.

`torch.jit.load` prints a deprecation warning in torch 2.14; it still works.

## Removing it all

Delete `E:\ArsSoftLab-tools\` and the pip cache. The Python install was per-user into that folder; Windows also lists it under Apps, where it can be uninstalled. Nothing else was changed.
