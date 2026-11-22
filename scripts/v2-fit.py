"""M1.4D: place the independent v2 assets (public/scene/v2/) in the approved
layout, and compare the generated connections with the accurate M1.3I paths.

The v2 objects share the 1672 x 941 canvas but are NOT placed: each was
generated on its own, larger and mostly centred. Each object gets one
uniform scale and a translation (no warping, no repainting), fitted so that
its base (the widest row in its lower half) has the approved base's width
and its base's bottom centre lands on the approved one.

Approved bases: the M1.3I remove masks (docs/m1.3i/masks/<id>-remove.png,
station cut-out + 6 px margin, so width - 12 and bottom - 6); the central A
has no mask and was measured on the plate (x 640-1042, bottom 655).

Writes:
  components/lab/scene-v2-data.ts   the transforms (generated; do not edit)
  docs/m1.4d/fit.json               measurements, scales, connection comparison
  docs/m1.4d/work/offline-*.png     offline composites for checking the fit

    E:/ArsSoftLab-tools/lama-venv/Scripts/python.exe scripts/v2-fit.py
"""

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "public/scene/v2"
W, H = 1672, 941
OUT = ROOT / "docs/m1.4d"

# id -> (asset path, approved remove mask or None)
OBJECTS = {
    "educational": ("stations/educational.png", "educational"),
    "engineering": ("stations/engineering.png", "engineering"),
    "playground": ("stations/playground.png", "playground"),
    "hub": ("hub/central-a.png", None),
    "creative": ("stations/creative-studio.png", "creative"),
    "experience": ("stations/experience.png", "experience"),
}
HUB_APPROVED = dict(base_w=402, cx=841.0, bottom=655)
# The new cabinet's screen corners in the asset (TL, TR, BR, BL), measured on a 3x crop.
PLAYGROUND_SCREEN = [(920, 323.3), (1094, 329.3), (1070.7, 446.7), (881, 437.3)]
CONNECTIONS = {"engineering": "engineering", "educational": "educational", "playground": "playground", "creative": "creative-studio", "experience": "experience"}


def alpha(p):
    return np.asarray(Image.open(p).convert("RGBA"))[..., 3]


def base(m):
    rows = np.nonzero(m.any(1))[0]
    y0, y1 = int(rows.min()), int(rows.max())
    widths = np.array([int(np.ptp(np.nonzero(r)[0]) + 1) if r.any() else 0 for r in m])
    lo = y0 + (y1 - y0) // 2
    yw = lo + int(np.argmax(widths[lo : y1 + 1]))
    xs = np.nonzero(m[yw])[0]
    return dict(top=y0, bottom=y1, base_w=int(widths[yw]), base_row=yw, cx=float((xs.min() + xs.max()) / 2), depth=y1 - yw)


def bezier_points(d, ox, oy, step=1.0):
    """Sample an SVG path made of M and C commands (as in scene-25d-data.ts)."""
    nums = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", d)]
    cmds = re.findall(r"[MC]", d)
    pts, i, cur = [], 0, None
    for c in cmds:
        if c == "M":
            cur = (nums[i], nums[i + 1])
            i += 2
            pts.append(cur)
        else:
            while i + 6 <= len(nums):
                p1, p2, p3 = (nums[i], nums[i + 1]), (nums[i + 2], nums[i + 3]), (nums[i + 4], nums[i + 5])
                i += 6
                n = max(2, int(np.hypot(p3[0] - cur[0], p3[1] - cur[1]) / step))
                for t in np.linspace(0, 1, n)[1:]:
                    a = (1 - t) ** 3
                    b = 3 * (1 - t) ** 2 * t
                    cc = 3 * (1 - t) * t * t
                    e = t**3
                    pts.append((a * cur[0] + b * p1[0] + cc * p2[0] + e * p3[0], a * cur[1] + b * p1[1] + cc * p2[1] + e * p3[1]))
                cur = p3
    return np.array(pts) + (ox, oy)


def existing_paths():
    src = (ROOT / "components/lab/scene-25d-data.ts").read_text()
    m = re.search(r"export const CONNECTION_LAYERS[^=]*=\s*(\{.*?\});\n", src, re.S)
    data = json.loads(m.group(1))
    out = {}
    for k, v in data.items():
        out[k] = np.concatenate([bezier_points(p["path"], v["box"]["x"], v["box"]["y"]) for p in v["parts"]])
    return out


def main():
    (OUT / "work").mkdir(parents=True, exist_ok=True)
    fit = {"objects": {}, "connections": {}}
    plate = Image.open(ROOT / "docs/m1.3k/package/01-source/lab-plate.png").convert("RGBA")
    env = Image.open(V2 / "environment/lab-background.png").convert("RGBA")
    comp = env.copy()
    over_plate = plate.copy()
    d = ImageDraw.Draw(over_plate)
    for oid, (path, mask) in OBJECTS.items():
        a = alpha(V2 / path)
        b = base(a > 200)
        if mask:
            r = base(np.asarray(Image.open(ROOT / f"docs/m1.3i/masks/{mask}-remove.png").convert("L")) > 127)
            ap = dict(base_w=r["base_w"] - 12, cx=r["cx"], bottom=r["bottom"] - 6, depth=r["depth"] - 6)
        else:
            ap = dict(HUB_APPROVED)
        s = ap["base_w"] / b["base_w"]
        tx = ap["cx"] - s * b["cx"]
        ty = ap["bottom"] - s * b["bottom"]
        faint = (a > 0) & (a < 16)
        fit["objects"][oid] = dict(
            src=f"/scene/v2/{path}",
            asset=b,
            approved=ap,
            scale=round(s, 5),
            tx=round(tx, 2),
            ty=round(ty, 2),
            base_depth_ratio=dict(asset=round(b["depth"] / b["base_w"], 3), approved=round(ap["depth"] / ap["base_w"], 3) if "depth" in ap else None),
            placed_height=round((b["bottom"] - b["top"]) * s, 1),
            faint_specks_px=int(faint.sum()),
        )
        # Offline composite: the object scaled and moved exactly as the CSS will.
        im = Image.open(V2 / path).convert("RGBA")
        sw, sh = round(W * s), round(H * s)
        small = im.resize((sw, sh), Image.LANCZOS)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        layer.paste(small, (round(tx), round(ty)))
        comp = Image.alpha_composite(comp, layer)
        # Outline of the placed object on the approved plate.
        la = np.asarray(layer)[..., 3] > 128
        edge = la & ~np.asarray(Image.fromarray(la.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3))).astype(bool)
        ys, xs = np.nonzero(edge)
        for x, y in zip(xs[::1], ys[::1]):
            d.point((int(x), int(y)), fill=(0, 255, 255, 255))
    q = [(round(fit["objects"]["playground"]["tx"] + fit["objects"]["playground"]["scale"] * x, 2), round(fit["objects"]["playground"]["ty"] + fit["objects"]["playground"]["scale"] * y, 2)) for x, y in PLAYGROUND_SCREEN]
    fit["playground_screen_quad"] = q
    comp.convert("RGB").save(OUT / "work/offline-composite.png")
    over_plate.convert("RGB").save(OUT / "work/offline-outlines-on-approved.png")

    # Connections: the generated PNGs as-is (same canvas) against the accurate paths.
    paths = existing_paths()
    conn_layer = comp.copy()
    dd = ImageDraw.Draw(conn_layer)
    for cid, name in CONNECTIONS.items():
        a = alpha(V2 / f"connections/{name}.png")
        core = a > 128
        ys, xs = np.nonzero(core)
        P = paths[cid]
        if len(xs):
            G = np.stack([xs, ys], 1).astype(float)
            # distance from each accurate path point to the nearest generated core pixel
            dist = np.sqrt(((P[:, None, :] - G[None, ::7, :]) ** 2).sum(2)).min(1)
            gen_end = [G[G[:, 0].argmin()].tolist(), G[G[:, 0].argmax()].tolist()]
        else:
            dist, gen_end = np.array([np.inf]), None
        fit["connections"][cid] = dict(
            generated_core_px=int(core.sum()),
            generated_bbox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None,
            generated_extremes_x=gen_end,
            accurate_path_ends=[P[0].round(1).tolist(), P[-1].round(1).tolist()],
            accurate_points_within_6px=round(float((dist <= 6).mean()), 3),
            mean_distance_px=round(float(dist.mean()), 1),
            max_distance_px=round(float(dist.max()), 1),
            faint_px_outside_core=int(((a > 0) & (a <= 128)).sum()),
        )
        dd.line([tuple(p) for p in P], fill=(0, 255, 255, 255), width=2)
        gl = Image.open(V2 / f"connections/{name}.png").convert("RGBA")
        conn_layer = Image.alpha_composite(conn_layer, gl)
        dd = ImageDraw.Draw(conn_layer)
    conn_layer.convert("RGB").save(OUT / "work/offline-generated-connections-vs-paths.png")

    (OUT / "fit.json").write_text(json.dumps(fit, indent=1) + "\n")
    order = sorted(fit["objects"], key=lambda k: fit["objects"][k]["approved"]["bottom"])
    ts = [
        "// Generated by scripts/v2-fit.py (M1.4D). Do not edit.",
        "// Each v2 object is drawn full-frame (1672 x 941) with one uniform scale and a",
        "// translation in scene px, fitted to the approved base (see docs/m1.4d/NOTES.md).",
        "",
        'export type V2ObjectId = "educational" | "engineering" | "playground" | "hub" | "creative" | "experience";',
        "export type V2Object = { id: V2ObjectId; src: string; scale: number; tx: number; ty: number; base: { cx: number; bottom: number; w: number; depth: number } };",
        "",
        'export const V2_ENVIRONMENT = "/scene/v2/environment/lab-background.png";',
        "",
        "/** Back to front (by the approved base's bottom). */",
        "export const V2_OBJECTS: V2Object[] = " + json.dumps(
            [
                dict(
                    id=k,
                    src=fit["objects"][k]["src"],
                    scale=fit["objects"][k]["scale"],
                    tx=fit["objects"][k]["tx"],
                    ty=fit["objects"][k]["ty"],
                    base=dict(cx=fit["objects"][k]["approved"]["cx"], bottom=fit["objects"][k]["approved"]["bottom"], w=fit["objects"][k]["approved"]["base_w"], depth=round(fit["objects"][k]["asset"]["depth"] * fit["objects"][k]["scale"], 1)),
                )
                for k in order
            ]
        )
        + ";",
        "",
        "/** The new cabinet's screen (TL, TR, BR, BL), scene px, for ArcadeScreen. */",
        "export const V2_PLAYGROUND_SCREEN = " + json.dumps([list(p) for p in q]) + " as const;",
        "",
        "/** The generated connection references (not production geometry; see NOTES). */",
        "export const V2_CONNECTION_REFERENCES = " + json.dumps({k: f"/scene/v2/connections/{v}.png" for k, v in CONNECTIONS.items()}) + ";",
        "",
    ]
    (ROOT / "components/lab/scene-v2-data.ts").write_text("\n".join(ts))
    print(json.dumps(fit, indent=1))


if __name__ == "__main__":
    main()
