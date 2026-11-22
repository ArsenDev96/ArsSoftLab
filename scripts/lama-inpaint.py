"""M1.3J.1: run LaMa (big-lama, TorchScript) locally on a prepared crop.

Runs in the isolated venv outside the app (see docs/m1.3j/lama/SETUP.md):

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/lama-inpaint.py \
        --image docs/m1.3j/inpaint/context.png --mask docs/m1.3j/inpaint/mask-floor.png \
        --out docs/m1.3j/lama/candidates/<name>.png

Same preprocessing as IOPaint's LaMa (iopaint/model/lama.py): RGB in 0..1,
mask binarised (> 0), padded to a multiple of 8, output clipped to 0..255.
The model fills only where the mask is white; the integration step
(scripts/inpaint-playground.mjs) then takes only the exact floor mask back.
Nothing leaves the machine.
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image

DEFAULT_MODEL = "E:/ArsSoftLab-tools/models/big-lama.pt"


def pad_to(arr: np.ndarray, mod: int = 8) -> np.ndarray:
    h, w = arr.shape[:2]
    ph = (mod - h % mod) % mod
    pw = (mod - w % mod) % mod
    if not ph and not pw:
        return arr
    pad = ((0, ph), (0, pw)) + ((0, 0),) * (arr.ndim - 2)
    return np.pad(arr, pad, mode="symmetric")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--mask", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--cpu", action="store_true")
    a = ap.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() and not a.cpu else "cpu")
    image = np.array(Image.open(a.image).convert("RGB"))
    mask = np.array(Image.open(a.mask).convert("L"))
    if image.shape[:2] != mask.shape:
        raise SystemExit(f"image {image.shape[:2]} and mask {mask.shape} differ")
    h, w = mask.shape

    t0 = time.perf_counter()
    model = torch.jit.load(a.model, map_location="cpu").to(device).eval()
    t1 = time.perf_counter()
    img = torch.from_numpy(pad_to(image).astype("float32").transpose(2, 0, 1) / 255).unsqueeze(0).to(device)
    msk = torch.from_numpy((pad_to(mask) > 0).astype("float32")[None]).unsqueeze(0).to(device)
    with torch.no_grad():
        res = model(img, msk)
    if device.type == "cuda":
        torch.cuda.synchronize()
    t2 = time.perf_counter()
    out = np.clip(res[0].permute(1, 2, 0).cpu().numpy() * 255, 0, 255).astype("uint8")[:h, :w]
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out).save(a.out)
    print(
        json.dumps(
            {
                "out": a.out,
                "size": f"{w}x{h}",
                "maskPx": int((mask > 0).sum()),
                "device": str(device),
                "gpu": torch.cuda.get_device_name(0) if device.type == "cuda" else None,
                "loadSeconds": round(t1 - t0, 2),
                "inferSeconds": round(t2 - t1, 3),
                "torch": torch.__version__,
                "cuda": torch.version.cuda,
            }
        )
    )


if __name__ == "__main__":
    main()
