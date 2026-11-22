"""M1.4A: inspect the generated Playground candidates and build an isolated
browser preview of them. Experimental A/B test only.

Inputs (never modified): docs/m1.4a/candidates/{environment,playground,connection-reference}.png

Writes (never public/, never the build):
  docs/m1.4a/review/inspection.json     formats, alpha, stray alpha, alignment, regions
  docs/m1.4a/preview/strict/...         the M1.3K pipeline's own staging of the pair,
                                        run with --force (it FAILS validation): approved
                                        plate everywhere, candidate only in the footprint
  docs/m1.4a/preview/full/...           VISUAL-ONLY: the candidate frame replaces the
                                        plate (the whole lab is the generated image)
  docs/m1.4a/preview/manifest.json      URL path -> file, per variant, for
                                        scripts/visual/m14a-preview-capture.mjs, which
                                        serves them by request interception in a
                                        headless browser.

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/m14a-preview.py
"""

import importlib.util
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CAND = ROOT / "docs/m1.4a/candidates"
PREV = ROOT / "docs/m1.4a/preview"
REVIEW = ROOT / "docs/m1.4a/review"
PG = "scene/layers25d/playground"

spec = importlib.util.spec_from_file_location("pa", ROOT / "scripts/playground-artwork.py")
pa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pa)
W, H = pa.W, pa.H

# Other stations (scene px), for "are the other four unchanged".
STATIONS = {
    "engineering": (260, 330, 600, 560),
    "educational": (680, 260, 1000, 500),
    "creative": (90, 520, 520, 790),
    "experience": (1200, 500, 1660, 800),
    "hub": (640, 520, 1040, 680),
}


def rgba(p):
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.float64)


def save(a, p):
    p.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8)).save(p, optimize=True)


def phase_shift(a, b):
    A = np.fft.fft2(a - a.mean())
    B = np.fft.fft2(b - b.mean())
    R = A * np.conj(B)
    R /= np.abs(R) + 1e-9
    r = np.fft.ifft2(R).real
    y, x = np.unravel_index(r.argmax(), r.shape)
    h, w = r.shape

    def sub(dy, dx):
        lo, c, hi = r[(y - dy) % h, (x - dx) % w], r[y, x], r[(y + dy) % h, (x + dx) % w]
        return (lo - hi) / (2 * (lo - 2 * c + hi) + 1e-9)

    return round(float((y if y < h / 2 else y - h) + sub(1, 0)), 2), round(float((x if x < w / 2 else x - w) + sub(0, 1)), 2)


def contact_unlit(env, floor):
    """scripts/playground-contact-unlit.py's algorithm, with its inputs as
    arguments (that script reads and writes fixed paths, including M1.3J's
    record, so it is not run here)."""
    # constants are that script's
    ROWS, BELOW, ABOVE, SIGMA = 6, (7, 11), 3, 4.0
    band = floor[..., 3] > 0
    fa = floor[..., 3:] / 255
    shown = floor[..., :3] * fa + env * (1 - fa)
    lines = np.asarray(Image.open(ROOT / "docs/m1.3i/masks/lines.png").convert("L")) > 127
    n = int(3 * SIGMA) + 1
    k = np.exp(-np.arange(-n, n + 1) ** 2 / (2 * SIGMA * SIGMA))
    k /= k.sum()
    p = np.pad(shown, ((0, 0), (n, n), (0, 0)), mode="edge")
    lf = sum(k[i] * p[:, i : i + W] for i in range(2 * n + 1))
    out = np.zeros((H, W, 4))
    for x in np.nonzero(band.any(0))[0]:
        bb = np.nonzero(band[:, x])[0].max()
        top = lf[bb - ABOVE + 1 : bb + 1, x].mean(0)
        bot = lf[bb + BELOW[0] : bb + BELOW[1], x].mean(0)
        for r in range(1, ROWS + 1):
            y = bb + r
            if lines[y, x]:
                continue
            t = r / (BELOW[0] + (BELOW[1] - BELOW[0]) / 2)
            h = np.maximum(0, lf[y, x] - (top * (1 - t) + bot * t))
            out[y, x, :3] = shown[y, x] - h
            out[y, x, 3] = 255
    return out


def ridge(alpha, x0, x1):
    """Per column, the row of maximum alpha (where the column has any)."""
    out = {}
    for x in range(x0, x1):
        c = alpha[:, x]
        if c.max() > 40:
            out[x] = float((np.arange(H) * c * (c > c.max() * 0.5)).sum() / (c * (c > c.max() * 0.5)).sum())
    return out


def main():
    s = pa.Scene()
    files = {k: CAND / f"{k}.png" for k in ("environment", "playground", "connection-reference")}
    rep = {"files": {}}
    for k, p in files.items():
        im = Image.open(p)
        rep["files"][k] = dict(format=im.format, size=list(im.size), mode=im.mode, bytes=p.stat().st_size, icc=bool(im.info.get("icc_profile")), gamma=im.info.get("gamma"))

    plate = s.plate
    env = rgba(files["environment"])
    st = rgba(files["playground"])
    cr = rgba(files["connection-reference"])
    envrgb = env[..., :3]

    # --- environment
    diff = np.abs(envrgb - plate).max(2)
    out = ~s.remove
    Lp, Le = pa.lum(plate), pa.lum(envrgb)
    regions = {}
    for k, (x0, y0, x1, y1) in STATIONS.items():
        regions[k] = dict(mean_abs_diff=round(float(diff[y0:y1, x0:x1].mean()), 1), lum_plate=round(float(Lp[y0:y1, x0:x1].mean()), 1), lum_candidate=round(float(Le[y0:y1, x0:x1].mean()), 1), shift_dy_dx=phase_shift(Lp[y0:y1, x0:x1], Le[y0:y1, x0:x1]))
    rep["environment"] = dict(
        alpha="opaque" if env[..., 3].min() == 255 else "has transparency",
        outside_remove_changed_gt2=int((diff[out] > 2).sum()),
        outside_remove_px=int(out.sum()),
        outside_remove_mean_abs=round(float(diff[out].mean()), 2),
        outside_remove_p99=float(np.percentile(diff[out], 99)),
        mean_rgb_candidate=[round(float(v), 1) for v in envrgb.reshape(-1, 3).mean(0)],
        mean_rgb_plate=[round(float(v), 1) for v in plate.reshape(-1, 3).mean(0)],
        regions=regions,
        floor_ring_around_station=dict(mean_abs_diff=round(float(diff[540:640, 960:1480].mean()), 1), lum_plate=round(float(Lp[540:640, 960:1480].mean()), 1), lum_candidate=round(float(Le[540:640, 960:1480].mean()), 1)),
    )

    # --- station cut-out
    a = st[..., 3]
    near = pa.dilate(s.remove, 8)
    stray = (a > 0) & ~near
    ys, xs = np.nonzero(stray)
    body = a > 128
    cur = s.oa > 0.5
    inter, union = (body & cur).sum(), (body | cur).sum()
    cy0, cx0 = np.argwhere(cur).mean(0)
    cy1, cx1 = np.argwhere(body).mean(0)
    bottom_c = {x: np.nonzero(body[:, x])[0].max() for x in range(W) if body[:, x].any()}
    bottom_o = {x: np.nonzero(cur[:, x])[0].max() for x in range(W) if cur[:, x].any()}
    shared = sorted(set(bottom_c) & set(bottom_o))
    dbot = np.array([bottom_c[x] - bottom_o[x] for x in shared])
    inner = a >= 250
    sd = np.abs(st[..., :3] - plate).max(2)
    rep["station"] = dict(
        alpha_levels=int(len(np.unique(a))),
        alpha_255_px=int((a == 255).sum()),
        alpha_250_254_px=int(((a >= 250) & (a < 255)).sum()),
        alpha_1_249_px=int(((a > 0) & (a < 250)).sum()),
        body_note="the body is alpha 250-254, not 255: ~1-2% of the background shows through the whole cabinet",
        stray_px=int(stray.sum()),
        stray_max_alpha=int(a[stray].max()) if stray.any() else 0,
        stray_bbox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if stray.any() else None,
        stray_ge_16_px=int((stray & (a >= 16)).sum()),
        outside_remove_px=int(((a > 0) & ~s.remove).sum()),
        iou_vs_current_cutout=round(float(inter / union), 4),
        centroid_shift_dx_dy=[round(float(cx1 - cx0), 2), round(float(cy1 - cy0), 2)],
        bottom_edge_vs_current=dict(mean=round(float(dbot.mean()), 2), min=int(dbot.min()), max=int(dbot.max()), cols=len(shared)),
        interior_vs_plate=dict(px=int(inner.sum()), mean_abs=round(float(sd[inner].mean()), 1), median=float(np.median(sd[inner])), within_3=round(float((sd[inner] <= 3).mean()), 3)),
        shift_vs_plate_dy_dx=phase_shift(pa.lum(plate * (a[..., None] / 255))[340:560, 1050:1390], pa.lum(st[..., :3] * (a[..., None] / 255))[340:560, 1050:1390]),
    )

    # --- connection reference vs the existing Playground line layers
    lit = sum(rgba(ROOT / f"public/scene/layers25d/lines/playground-{i}-lit.png")[..., 3] for i in (0, 1))
    ca = cr[..., 3]
    near_line = pa.dilate(lit > 0, 12)
    rr, re_ = ridge(ca * near_line, 860, 1130), ridge(np.minimum(lit, 255), 860, 1130)
    both = sorted(set(rr) & set(re_))
    dy = np.array([rr[x] - re_[x] for x in both]) if both else np.array([np.nan])
    crx = np.nonzero((ca > 40).any(0))[0]
    rep["connection_reference"] = dict(
        alpha_255_px=int((ca == 255).sum()),
        line_px_alpha_gt40=int((ca > 40).sum()),
        line_x_range=[int(crx.min()), int(crx.max())] if len(crx) else None,
        existing_line_x_range=[int(np.nonzero((lit > 40).any(0))[0].min()), int(np.nonzero((lit > 40).any(0))[0].max())],
        stray_px_far_from_existing_line=int(((ca > 0) & ~pa.dilate(lit > 0, 40)).sum()),
        ridge_dy_vs_existing=dict(cols=len(both), mean=round(float(dy.mean()), 2), mean_abs=round(float(np.abs(dy).mean()), 2), max_abs=round(float(np.abs(dy).max()), 2)),
        use="reference only; the preview keeps the existing connection layers",
    )

    # --- variant: strict (the M1.3K pipeline's staging, forced)
    sdir = PREV / "strict-stage"
    if sdir.exists():
        shutil.rmtree(sdir)
    pa.stage(str(files["environment"]), str(files["playground"]), None, "m1.4a-generated", force=True, s=s, out=sdir)
    (sdir / "APPLY.md").unlink()  # never to be applied: it failed validation
    (sdir / "NOT-FOR-APPLY.txt").write_text("Forced staging of the M1.4A generated pair for a browser preview only. It FAILS validation (docs/m1.4a/review/checker/report.md). Never copy into public/.\n")
    sp = sdir / "public" / PG
    envc = s.env
    contact_s = contact_unlit(envc, rgba(sp / "floor.png"))
    save(contact_s, sp / "contact-unlit.png")

    # --- variant: full (visual-only: the generated frame is the whole lab)
    fdir = PREV / "full"
    if fdir.exists():
        shutil.rmtree(fdir)
    sa = a[..., None] / 255
    plate_full = st[..., :3] * sa + envrgb * (1 - sa)
    save(plate_full, fdir / "scene/lab-plate.png")
    save(np.zeros((H, W, 4)), fdir / "scene/layers25d/environment-corrections.png")
    foot = s.hole | (pa.dilate(a > 0, 2) & near)
    bg = np.zeros((H, W, 4))
    bg[foot, :3] = envrgb[foot]
    bg[foot, 3] = 255
    save(bg, fdir / PG / "background.png")
    fl = np.zeros((H, W, 4))
    fl[s.floor_hidden, :3] = envrgb[s.floor_hidden]
    fl[s.floor_hidden, 3] = 255
    save(fl, fdir / PG / "floor.png")
    save(st, fdir / PG / "object.png")
    save(contact_unlit(envrgb, fl), fdir / PG / "contact-unlit.png")

    manifest = {
        "strict": {f"/{PG}/{n}.png": str((sp / f"{n}.png").relative_to(ROOT)).replace("\\", "/") for n in ("background", "floor", "object", "contact-unlit")},
        "full": {
            "/scene/lab-plate.webp": "docs/m1.4a/preview/full/scene/lab-plate.png",
            "/scene/layers25d/environment-corrections.png": "docs/m1.4a/preview/full/scene/layers25d/environment-corrections.png",
            **{f"/{PG}/{n}.png": f"docs/m1.4a/preview/full/{PG}/{n}.png" for n in ("background", "floor", "object", "contact-unlit")},
        },
    }
    (PREV / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    REVIEW.mkdir(parents=True, exist_ok=True)
    # The checker's report, kept with the review.
    chk = ROOT / "docs/m1.3k/deliveries/m1.4a-generated"
    if chk.exists():
        dst = REVIEW / "checker"
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(chk, dst)
    (REVIEW / "inspection.json").write_text(json.dumps(rep, indent=1) + "\n")
    print(json.dumps(rep, indent=1))


# ---------------------------------------------------------------- review sheets
# From docs/m1.4a/review/captures/<variant>/ (scripts/visual/m14a-preview-capture.mjs).

LABELS = {
    "approved": "APPROVED default build (:3000)",
    "m13j": "M1.3J experimental lift (:3001, as it is)",
    "strict": "M1.4A STRICT: pipeline staging forced (FAILS validation); approved plate outside the footprint",
    "full": "M1.4A VISUAL-ONLY: the generated frame replaces the whole plate (not pixel-preserving)",
}
ORDER = ["approved", "m13j", "strict", "full"]
STATION_R = (1000, 300, 440, 320)  # x, y, w, h (scene), as captured


def grid(rows, cols, path, title):
    """rows: [(row label, [PIL image per column])]; cols: column labels."""
    from PIL import ImageDraw

    f, fb = pa.font(14), pa.font(17)
    cw = [max(r[1][i].width for r in rows) for i in range(len(cols))]
    rh = [max(im.height for im in r[1]) for r in rows]
    gap, top, lab = 6, 34, 22
    Wd = sum(cw) + gap * (len(cols) + 1)
    Hd = top + lab + sum(h + lab + gap for h in rh) + gap
    out = Image.new("RGB", (Wd, Hd), (18, 18, 22))
    d = ImageDraw.Draw(out)
    d.text((gap, 8), title, fill=(255, 255, 255), font=fb)
    x = gap
    for i, c in enumerate(cols):
        d.text((x, top), c, fill=(150, 200, 255), font=f)
        x += cw[i] + gap
    y = top + lab
    for (label, ims), h in zip(rows, rh):
        d.text((gap, y + 2), label, fill=(240, 200, 120), font=f)
        x = gap
        for i, im in enumerate(ims):
            out.paste(im.convert("RGB"), (x, y + lab))
            x += cw[i] + gap
        y += h + lab + gap
    out.save(path, optimize=True)
    return path


def sheets():
    from PIL import ImageDraw

    cap = REVIEW / "captures"
    meta = json.loads((cap / "approved" / "meta.json").read_text())
    k, cx, cy = meta["camera"]["k"], meta["camera"]["x"], meta["camera"]["y"]

    def vp(r):  # scene rect -> viewport box
        x, y, w, h = r
        return (round(cx + x * k), round(cy + y * k), round(cx + (x + w) * k), round(cy + (y + h) * k))

    def im(v, n):
        return Image.open(cap / v / n).convert("RGB")

    def station(v, n):
        return im(v, n).crop(vp(STATION_R))

    # Other four stations (and the hub) at rest against the approved build, in viewport pixels.
    rest = {v: np.asarray(im(v, "A-rest.png")).astype(float) for v in ORDER}
    others = {}
    for v in ORDER:
        others[v] = {}
        for name, (x0, y0, x1, y1) in STATIONS.items():
            b = vp((x0, y0, x1 - x0, y1 - y0))
            others[v][name] = round(float(np.abs(rest[v][b[1] : b[3], b[0] : b[2]] - rest["approved"][b[1] : b[3], b[0] : b[2]]).max(2).mean()), 2)
        b = vp(STATION_R)
        others[v]["playground"] = round(float(np.abs(rest[v][b[1] : b[3], b[0] : b[2]] - rest["approved"][b[1] : b[3], b[0] : b[2]]).max(2).mean()), 2)

    # 1. idle
    rows = []
    for v in ORDER:
        o = others[v]
        lab = f"{LABELS[v]}   |  mean |diff| vs approved at rest: " + ", ".join(f"{n} {o[n]}" for n in ("engineering", "educational", "creative", "experience", "hub", "playground"))
        full = im(v, "A-rest.png")
        rows.append((lab, [full.resize((full.width // 2, full.height // 2), Image.LANCZOS), station(v, "A-rest.png"), station(v, "B-arrival.png")]))
    grid(rows, ["A. at rest, whole lab (1/2 size)", "A. at rest, Playground (1x desktop px)", "B. power arrival: first frame with the station layers on (1x)"], REVIEW / "idle-comparison.png", "M1.4A idle: same camera (1648 x 928 viewport), labels name each variant; the switch at B must not change anything")

    # 2. lifted
    rows = [(LABELS[v], [station(v, n) for n in ("C-half.png", "D-lifted.png", "F-returning.png", "G-live-hold.png")]) for v in ORDER]
    grid(rows, ["C. half way up (8.9 px)", "D. full lift (17.75 desktop px)", "F. half way down on the return", "G. live 3 s hold (real time, arcade running)"], REVIEW / "lifted-comparison.png", "M1.4A lift at normal desktop size (1x, shadows on)")

    # 3. lifted, no shadow
    rows = []
    for v in ORDER:
        g = im(v, "E-gap-3x.png")
        rows.append((LABELS[v], [station(v, "E-lifted-no-shadow.png").resize((station(v, "E-lifted-no-shadow.png").width * 2, station(v, "E-lifted-no-shadow.png").height * 2), Image.NEAREST), g]))
    grid(rows, ["E. full lift, shadows OFF, 1x capture shown at 2x (nearest)", "E. the gap, shadows OFF, browser-rendered at 3x"], REVIEW / "lifted-no-shadow.png", "M1.4A full lift with the contact and ambient shadows disabled")

    # 4. station edges 3x (browser 3x capture of the station region, shadows off)
    def r3(x0, y0, x1, y1):
        s3 = 3 * k
        return (round((x0 - STATION_R[0]) * s3), round((y0 - STATION_R[1]) * s3), round((x1 - STATION_R[0]) * s3), round((y1 - STATION_R[1]) * s3))

    rows = []
    for v in ORDER:
        e = im(v, "E-station-3x.png")
        rows.append((LABELS[v], [e.crop(r3(1055, 328, 1250, 440)), e.crop(r3(1040, 470, 1220, 585)), e.crop(r3(1220, 470, 1400, 585))]))
    grid(rows, ["marquee and cabinet top", "base, left half and gap", "base, right half and gap"], REVIEW / "station-edges-3x.png", "M1.4A station edges at full lift, shadows OFF, browser-rendered at 3x")

    (REVIEW / "rest-diff-vs-approved.json").write_text(json.dumps(others, indent=1) + "\n")
    print(json.dumps(others, indent=1))


if __name__ == "__main__":
    import sys

    sheets() if sys.argv[1:] == ["sheets"] else main()
