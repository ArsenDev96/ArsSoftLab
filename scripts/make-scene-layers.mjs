#!/usr/bin/env node
// M1.3I (experimental, NEXT_PUBLIC_LAB_LAYERED=on): the 2.5D scene layers
// that can be separated from the approved artwork today.
//
//   1. Environment corrections (static, full frame, opaque where changed):
//      - every connection line removed from the floor. The line's light was
//        already taken out by M1.3E.2 / M1.3G (their unpowered overlays,
//        which ship); here the faint core they keep is removed too, and the
//        faint tint they leave along the band is matched to the floor on
//        both sides (low frequencies only; strong light such as the central
//        platform's rim is left alone). Under the ~3 px core the floor is
//        estimated: its tone from the floor beside it, its grain copied from
//        5 px aside (a shift, not a mirror). Changes stay inside the line's
//        charge windows, so the line layers always cover them.
//      - Playground's strip reflection removed from the floor in front of
//        the base (its light subtracted, the floor's texture kept), and from
//        the edge pixels of M1.3H's clean background, so the reflection can
//        be its own layer.
//   2. Connections, per line part (in the line's box; Playground's full
//      frame, like its approved overlays), each composited over the
//      corrected environment inside the existing charge windows:
//      - trace: the faint unpowered line. Where the part's approved overlay
//        has a pixel, the trace is that pixel (the same image in the same
//        window, so the rest state is the approved one); elsewhere it is
//        solved over the environment.
//      - lit:   the painted lit line, the plate's own pixels, likewise.
//      Both are opaque in the line's core and wherever they differ from the
//      environment by more than a few levels: the windows draw through a
//      rotated frame, and a transparent layer there would show it.
//      Their routes are written as SVG paths (Catmull-Rom through the
//      traced points) for the sharp powered core drawn at any zoom.
//   3. Playground, around the lifting station (full frame):
//      - reflection dim / lit: the strip's floor reflection, unpowered and
//        powered, solved over the reflection-free floor (moves with the lift);
//      - contact shadow: tight (strong at a small lift) and ambient (wider,
//        lighter; takes over as it rises), from the base's bottom edge;
//      - foundation: the joint under the base, an SVG path 6 px inside the
//        contact line (a smooth fit), hidden at rest, in the lift gap.
//
// Inputs (never modified): the plate, the shipping unpowered overlays
// (lines and platforms), the M1.3H Playground cut-out and clean background.
// Writes public/scene/layers25d/** and components/lab/scene-25d-data.ts.
//
// Usage: node scripts/make-scene-layers.mjs [--preview <dir>]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { launch } from "./visual/cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1672;
const H = 941;
const argv = process.argv.slice(2);
const PREVIEW = argv.includes("--preview") ? resolve(argv[argv.indexOf("--preview") + 1]) : null;
const OUT = join(ROOT, "public/scene/layers25d");
const URL_BASE = "/scene/layers25d";

/** A line's core (px from its centre) whose floor is re-estimated. */
const CORE_IN = 1.8;
const CORE_OUT = 3.0;
/** Line layers are opaque this far beyond the re-estimated core (px). */
const OPAQUE_MARGIN = 1.5;
/** Line layers are also opaque wherever the environment differs from their target by more than this (/255). */
const OPAQUE_DIFF = 4;
/** The rim strokes (along the central platform's lit edge) are opaque across their whole narrow band. */
const RIM_OPAQUE = 7;
/** Grain for the core comes from this far aside (px, along the normal). */
const SHIFT = [5, -5, 7, -7];
/** Half-width of a line's unpowered band (M1.3G FLOOR_HALF), and the tone-matching scale. */
const BAND = 14;
const BAND_SIGMA = 7;
/** Parts that run along the central platform's lit rim (Engineering's and Playground's first): not tone-matched (the rim's highlight is architecture); only their core is re-estimated. */
const RIM_BAND = 2.5;
/** Largest tone deviation (per channel, /255) treated as the unpowered residue. */
const TINT_MAX = 28;
/** ChargeLine's window geometry (scene-fx CHARGE_HALF / CHARGE_LEAD / CHARGE_EDGE). */
const CHARGE_HALF = 16;
const CHARGE_LEAD = 10;
const CHARGE_EDGE = 7;
/** Crop padding around a route (px): the M1.3G boxes use 30. */
const PAD = 30;
/** Playground's reflection region: the part's box widened this far up and down (px). */
const REFL_PAD = 6;
/** Foundation joint: px inside the contact line (hidden at rest, in the 18 px gap when lifted). */
const JOINT_INSET = 6;
/** Shadows (alpha): at the contact line, deepest, ramp depth, reach under the base, spill in front (px), end taper. */
const CONTACT = { edge: 0.18, deep: 0.5, ramp: 14, reach: 24, spill: 1.3, taper: 10 };
const AMBIENT = { edge: 0.12, deep: 0.26, ramp: 18, reach: 24, spill: 4.5, taper: 22 };

// ---------------------------------------------------------------------------
// Decode (Chrome) / encode (PNG): as the other scene generators.

async function decodeAll(files) {
  const page = await launch({ width: 400, height: 300 });
  try {
    const out = [];
    for (const f of files) {
      const type = f.endsWith(".webp") ? "image/webp" : "image/png";
      const src = `data:${type};base64,` + readFileSync(join(ROOT, f)).toString("base64");
      const size = await page.eval(`(async () => {
        const img = new Image(); img.src = ${JSON.stringify(src)}; await img.decode();
        const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext("2d", { colorSpace: "srgb" }); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let s = ""; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
        window.__raw = btoa(s); window.__w = c.width; window.__h = c.height; return window.__raw.length;
      })()`);
      let b64 = "";
      for (let i = 0; i < size; i += 1 << 20) b64 += await page.eval(`window.__raw.slice(${i}, ${i + (1 << 20)})`);
      const w = await page.eval("window.__w");
      const h = await page.eval("window.__h");
      out.push({ w, h, data: new Uint8Array(Buffer.from(b64, "base64")) });
    }
    return out;
  } finally {
    await page.close();
  }
}
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function png(path, rgba, w = W, h = H) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}
function crop(full, box) {
  const out = new Uint8Array(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) out.set(full.subarray(((box.y + y) * W + box.x) * 4, ((box.y + y) * W + box.x + box.w) * 4), y * box.w * 4);
  return out;
}

// ---------------------------------------------------------------------------
// Helpers.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const q8 = (v) => Math.min(255, Math.max(0, Math.round(v)));
function gauss(src, sigma) {
  const r = Math.ceil(sigma * 3);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const ks = k.reduce((a, b) => a + b, 0);
  for (let i = 0; i < k.length; i++) k[i] /= ks;
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += src[y * W + Math.min(W - 1, Math.max(0, x + i))] * k[i + r];
      tmp[y * W + x] = s;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += tmp[Math.min(H - 1, Math.max(0, y + i)) * W + x] * k[i + r];
      out[y * W + x] = s;
    }
  return out;
}
/** Normalised convolution: the mean of the weighted pixels around each pixel. */
function normConv(ch, wgt, sigma) {
  const num = gauss(Float32Array.from(ch, (v, i) => v * wgt[i]), sigma);
  const den = gauss(wgt, sigma);
  return Float32Array.from(num, (v, i) => (den[i] > 1e-4 ? v / den[i] : ch[i]));
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/**
 * An RGBA layer that, composited over `base`, gives `target`: per pixel the
 * smallest alpha that keeps the colour in range, the colour solved for it.
 */
function solveOver(target, base) {
  let a = 0;
  for (let c = 0; c < 3; c++) {
    const t = target[c];
    const b = base[c];
    if (t > b + 0.25) a = Math.max(a, (t - b) / Math.max(1e-3, 255 - b));
    else if (t < b - 0.25) a = Math.max(a, (b - t) / Math.max(1e-3, b));
  }
  if (a <= 0) return null;
  const a8 = Math.min(255, Math.ceil(a * 255 - 1e-6));
  const af = a8 / 255;
  return [...[0, 1, 2].map((c) => q8(base[c] + (target[c] - base[c]) / af)), a8];
}
/** Read a JSON literal assigned in a generated TS file. */
function tsJson(file, name) {
  const src = readFileSync(join(ROOT, file), "utf8");
  const at = src.indexOf(name);
  const eq = src.indexOf("=", at);
  const end = src.indexOf(";\n", eq);
  return JSON.parse(src.slice(eq + 1, end).trim());
}
/** Smooth SVG path through points (Catmull-Rom as cubic Béziers), relative to `o`. */
function pathThrough(pts, o = [0, 0]) {
  const p = pts.map(([x, y]) => [x - o[0], y - o[1]]);
  const f = (v) => +v.toFixed(2);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// 1. Inputs.

const ROUTES = tsJson("components/lab/charge-routes.ts", "CHARGE_ROUTES");
const PG_ROUTE = tsJson("components/lab/playground-route.ts", "PLAYGROUND_ROUTE");
const PG_BEND = +readFileSync(join(ROOT, "components/lab/playground-route.ts"), "utf8").match(/PLAYGROUND_ROUTE_BEND = (\d+)/)[1];
const POWER = tsJson("components/lab/platform-power.ts", "PLATFORM_POWER");

const lines = {};
for (const [id, r] of Object.entries(ROUTES)) lines[id] = { route: r.route, starts: r.starts, box: r.box, dims: r.starts.map((_, k) => ({ file: `public/scene/activation/lines/${id}-${k}-dim.png`, box: r.box })) };
{
  const xs = PG_ROUTE.map((p) => p[0]);
  const ys = PG_ROUTE.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - PAD;
  const y0 = Math.floor(Math.min(...ys)) - PAD;
  const box = { x: x0, y: y0, w: Math.ceil(Math.max(...xs)) + PAD - x0, h: Math.ceil(Math.max(...ys)) + PAD - y0 };
  // The approved Playground overlays are full frame, so its layers are too
  // (a crop lands at a different sub-pixel phase); `box` bounds the work.
  lines.playground = { route: PG_ROUTE, starts: [0, PG_BEND], box, frame: { x: 0, y: 0, w: W, h: H }, dims: ["a", "b"].map((k) => ({ file: `public/scene/activation/playground-line-dim-${k}.png`, box: null })) };
}
const ids = Object.keys(lines);
const RIM_PARTS = new Set([ids.indexOf('engineering') * 16, ids.indexOf('playground') * 16]);

const files = ["public/scene/lab-plate.webp", "public/scene/power/unpowered.png", "public/scene/layers/playground-v2.png", "public/scene/layers/playground-v2-background.png", ...ids.flatMap((id) => lines[id].dims.map((d) => d.file))];
const decoded = await decodeAll(files);
const [plate8, pp8, station8, pgBg8] = decoded.map((d) => d.data);
let di = 4;
for (const id of ids) for (const d of lines[id].dims) d.img = decoded[di++];

const P = [0, 1, 2].map((c) => Float32Array.from({ length: W * H }, (_, i) => plate8[i * 4 + c]));

// The approved rest state: plate, the unpowered platform strips (inside
// their parts' polygons, as PlatformPower clips them), the unpowered lines.
const ppMask = new Uint8Array(W * H);
for (const spec of Object.values(POWER))
  for (const part of spec.parts) {
    const poly = part.poly.map(([x, y]) => [x + part.box.x, y + part.box.y]);
    for (let y = part.box.y; y < part.box.y + part.box.h; y++)
      for (let x = part.box.x; x < part.box.x + part.box.w; x++) {
        const i = y * W + x;
        if (pp8[i * 4 + 3] && pointInPoly(x + 0.5, y + 0.5, poly)) ppMask[i] = 1;
      }
  }
const R0 = P.map((ch, c) => Float32Array.from(ch, (v, i) => (ppMask[i] ? (pp8[i * 4 + c] * pp8[i * 4 + 3] + v * (255 - pp8[i * 4 + 3])) / 255 : v)));
const R = R0.map((ch) => Float32Array.from(ch));
// How much of a part's unpowered window shows at a pixel at rest
// (ChargeLine: a band CHARGE_HALF px either side of the part's chord, from
// CHARGE_LEAD px before it, fading in over its first CHARGE_EDGE px, to
// CHARGE_LEAD + 40 px past it). An overlay pixel outside it is never seen.
function windowAlpha(id, k, x, y) {
  const { route, starts } = lines[id];
  const from = route[starts[k]];
  const to = route[starts[k + 1] ?? route.length - 1];
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const ux = (to[0] - from[0]) / len;
  const uy = (to[1] - from[1]) / len;
  const t = (x + 0.5 - from[0]) * ux + (y + 0.5 - from[1]) * uy;
  const d = Math.abs((x + 0.5 - from[0]) * -uy + (y + 0.5 - from[1]) * ux);
  if (d > CHARGE_HALF || t > len + CHARGE_LEAD + 40) return 0;
  return Math.min(1, Math.max(0, (t + CHARGE_LEAD) / CHARGE_EDGE));
}
const partOf = new Int16Array(W * H).fill(-1); // line * 16 + part, from the approved overlays (where shown)
ids.forEach((id, li) =>
  lines[id].dims.forEach((d, k) => {
    const { w, data } = d.img;
    const ox = d.box ? d.box.x : 0;
    const oy = d.box ? d.box.y : 0;
    for (let y = 0; y < d.img.h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y + oy) * W + (x + ox);
        const a = data[(y * w + x) * 4 + 3] * windowAlpha(id, k, x + ox, y + oy);
        if (!a) continue;
        for (let c = 0; c < 3; c++) R[c][i] = (data[(y * w + x) * 4 + c] * a + R[c][i] * (255 - a)) / 255;
        partOf[i] = li * 16 + k;
      }
  }),
);

// Distance to every route's centre line (within its box).
const near = new Float32Array(W * H).fill(Infinity);
const normal = new Float32Array(W * H * 2);
const nearPart = new Int16Array(W * H).fill(-1);
ids.forEach((id, li) => {
  const { route, starts, box } = lines[id];
  const segs = route.slice(1).map((b, i) => {
    const a = route[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { a, len, ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len, part: starts.filter((s) => s <= i).length - 1 };
  });
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = y * W + x;
      for (const sg of segs) {
        const t = Math.max(0, Math.min(sg.len, (x + 0.5 - sg.a[0]) * sg.ux + (y + 0.5 - sg.a[1]) * sg.uy));
        const d = Math.hypot(x + 0.5 - (sg.a[0] + sg.ux * t), y + 0.5 - (sg.a[1] + sg.uy * t));
        if (d < near[i]) {
          near[i] = d;
          normal[i * 2] = -sg.uy;
          normal[i * 2 + 1] = sg.ux;
          nearPart[i] = li * 16 + sg.part;
        }
      }
    }
});

// Where each part's charge windows (ChargeLine: a band CHARGE_HALF px either
// side of the part's chord, from CHARGE_LEAD before it to CHARGE_LEAD past
// it, its first CHARGE_EDGE px faded) fully show that part's layers. The
// environment may only differ from the approved rest where its line's
// layers cover it.
const cover = new Float32Array(W * H);
ids.forEach((id, li) => {
  const { route, starts, box } = lines[id];
  starts.forEach((a, k) => {
    const from = route[a];
    const to = route[starts[k + 1] ?? route.length - 1];
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const ux = (to[0] - from[0]) / len;
    const uy = (to[1] - from[1]) / len;
    for (let y = box.y; y < box.y + box.h; y++)
      for (let x = box.x; x < box.x + box.w; x++) {
        const i = y * W + x;
        if (nearPart[i] !== li * 16 + k) continue;
        const t = (x + 0.5 - from[0]) * ux + (y + 0.5 - from[1]) * uy;
        const d = Math.abs((x + 0.5 - from[0]) * -uy + (y + 0.5 - from[1]) * ux);
        const margin = Math.min(t - (-CHARGE_LEAD + CHARGE_EDGE), len + CHARGE_LEAD - t, CHARGE_HALF - d);
        cover[i] = smoothstep(0, 2, margin - 0.5);
      }
  });
});

// ---------------------------------------------------------------------------
// 2. The environment without the lines.

const clear = Float32Array.from(near, (d, i) => (d > CORE_OUT + 0.5 && !ppMask[i] ? 1 : 0));
const U = R.map((ch) => normConv(ch, clear, 3));
const B = R.map((ch) => Float32Array.from(ch));
let coreReplaced = 0;
for (let i = 0; i < W * H; i++) {
  const d = near[i];
  if (!(d < CORE_OUT) || ppMask[i]) continue;
  const wc = (1 - smoothstep(CORE_IN, CORE_OUT, d)) * cover[i];
  const x = i % W;
  const y = (i / W) | 0;
  let q = -1;
  for (const s of SHIFT) {
    const qx = Math.round(x + normal[i * 2] * s);
    const qy = Math.round(y + normal[i * 2 + 1] * s);
    if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
    const j = qy * W + qx;
    if (near[j] > CORE_OUT + 0.5 && !ppMask[j]) {
      q = j;
      break;
    }
  }
  for (let c = 0; c < 3; c++) {
    const est = q >= 0 ? R[c][q] - U[c][q] + U[c][i] : U[c][i];
    B[c][i] = wc * est + (1 - wc) * R[c][i];
  }
  coreReplaced++;
}

// The approved unpowered band keeps a faint tint along each line (a residue
// of removing its bloom). Its tone is matched to the floor on both sides
// (low frequencies only: the grain is kept), so the environment carries no
// trace of the lines; the trace layer carries the difference at rest.
{
  const band = (i) => (RIM_PARTS.has(nearPart[i]) ? RIM_BAND : BAND);
  const wide = Float32Array.from(near, (d, i) => (d > band(i) + 4 && !ppMask[i] ? 1 : 0));
  const Uw = B.map((ch) => normConv(ch, wide, BAND_SIGMA));
  const lo = B.map((ch) => gauss(ch, 5));
  for (let i = 0; i < W * H; i++) {
    const d = near[i];
    if (!(d < band(i) + 4) || ppMask[i] || RIM_PARTS.has(nearPart[i])) continue;
    const w = (1 - smoothstep(band(i), band(i) + 4, d)) * cover[i];
    // Only a faint tint is corrected; anything stronger is the room's own
    // light (the central platform's rim, window reflections) and is kept.
    const dev = Math.max(...[0, 1, 2].map((c) => Math.abs(lo[c][i] - Uw[c][i])));
    const g = w * (1 - smoothstep(TINT_MAX * 0.6, TINT_MAX, dev));
    for (let c = 0; c < 3; c++) B[c][i] -= g * (lo[c][i] - Uw[c][i]);
  }
}

// Playground's strip reflection: its light field subtracted from the floor.
// The region is the reflection part's box widened by REFL_PAD px up and
// down (its brightest rows sit right at the contact line, on the edge of the
// part's polygon), on the floor only (up to the station's silhouette),
// feathered at its sides and bottom so the floor has no seam when the
// reflection moves away. The reflection layers cover exactly this region.
const pgRefl = POWER.playground.parts.findIndex((p) => p.kind === "reflection");
const reflPart = POWER.playground.parts[pgRefl];
const RB = { x: reflPart.box.x, y: reflPart.box.y - REFL_PAD, w: reflPart.box.w, h: reflPart.box.h + 2 * REFL_PAD };
const stationA = Float32Array.from({ length: W * H }, (_, i) => station8[i * 4 + 3] / 255);
const reflMask = new Float32Array(W * H);
for (let y = RB.y; y < RB.y + RB.h; y++)
  for (let x = RB.x; x < RB.x + RB.w; x++) {
    const i = y * W + x;
    if (stationA[i] >= 0.5) continue;
    const edge = Math.min(x + 0.5 - RB.x, RB.x + RB.w - x - 0.5, RB.y + RB.h - y - 0.5);
    reflMask[i] = smoothstep(0, 4, edge);
  }
const floorClear = Float32Array.from({ length: W * H }, (_, i) => {
  const x = i % W;
  const y = (i / W) | 0;
  if (x < RB.x - 40 || x >= RB.x + RB.w + 40 || y < RB.y - 20 || y >= RB.y + RB.h + 30) return 0;
  const inRB = x >= RB.x - 3 && x < RB.x + RB.w + 3 && y >= RB.y && y < RB.y + RB.h + 3;
  return !inRB && stationA[i] === 0 && near[i] > 14 && !ppMask[i] ? 1 : 0;
});
// The floor's unlit tone: from clear floor within ~5 px where there is
// enough of it, otherwise from wider around (as M1.3G's line removal).
const fineDen = gauss(floorClear, 5);
const reflUnlitFine = R0.map((ch) => normConv(ch, floorClear, 5));
const reflUnlitWide = R0.map((ch) => normConv(ch, floorClear, 14));
const unlitAt = (c, i) => {
  const a = Math.min(1, fineDen[i] / 0.05);
  return a * reflUnlitFine[c][i] + (1 - a) * reflUnlitWide[c][i];
};
const reflLocal = R0.map((ch) => gauss(ch, 1.5));
const RF = B.map((ch) => Float32Array.from(ch));
for (let y = RB.y; y < RB.y + RB.h; y++)
  for (let x = RB.x; x < RB.x + RB.w; x++) {
    const i = y * W + x;
    const w = reflMask[i];
    if (w <= 0.01) continue;
    for (let c = 0; c < 3; c++) {
      const unlit = unlitAt(c, i);
      // The reflection is a thin streak: a smoothed estimate misses its peak,
      // so most of the pixel's own excess over the floor is taken there.
      const light = Math.max(0, reflLocal[c][i] - unlit, 0.95 * (B[c][i] - unlit));
      RF[c][i] = Math.max(Math.min(B[c][i], 0.8 * unlit), B[c][i] - w * light);
    }
  }

// ---------------------------------------------------------------------------
// 3. Layers.

const rgbAt = (ch, i) => [ch[0][i], ch[1][i], ch[2][i]];
const env = new Uint8Array(W * H * 4);
let envPx = 0;
for (let i = 0; i < W * H; i++) {
  const v = rgbAt(RF, i).map(q8);
  if (v.some((c, k) => c !== plate8[i * 4 + k])) {
    env.set([...v, 255], i * 4);
    envPx++;
  }
}
png(join(OUT, "environment-corrections.png"), env);

// What actually sits under the line layers in the experimental build: the
// corrected environment, with the unpowered platform strips over it.
const E = (i) => (ppMask[i] ? rgbAt(R0, i) : rgbAt(RF, i));
const data = { lines: {} };
let traceErr = 0;
let litErr = 0;
for (const [li, id] of ids.entries()) {
  const { route, starts, box } = lines[id];
  const out = [];
  for (let k = 0; k < starts.length; k++) {
    const trace = new Uint8Array(box.w * box.h * 4);
    const lit = new Uint8Array(box.w * box.h * 4);
    for (let y = 0; y < box.h; y++)
      for (let x = 0; x < box.w; x++) {
        const i = (y + box.y) * W + (x + box.x);
        // Where this part's approved unpowered overlay has a pixel, the trace
        // is that pixel and the lit layer the plate's (both opaque, as the
        // approved overlay is): the same image in the same window, so the
        // rest state is the approved one exactly, even where the windows of
        // two parts overlap or fade in. The charge windows draw through a
        // rotated frame (~0.5 px off the environment), so opaque is also
        // what keeps the line's sharp core from showing that offset.
        const dim = lines[id].dims[k];
        const dx = x + box.x - (dim.box ? dim.box.x : 0);
        const dy = y + box.y - (dim.box ? dim.box.y : 0);
        const dj = (dy * dim.img.w + dx) * 4;
        if (dx >= 0 && dy >= 0 && dx < dim.img.w && dy < dim.img.h && dim.img.data[dj + 3] && windowAlpha(id, k, x + box.x, y + box.y) > 0) {
          const da = dim.img.data[dj + 3];
          if (da === 255) trace.set(dim.img.data.subarray(dj, dj + 4), (y * box.w + x) * 4);
          else {
            // A partly transparent overlay pixel (M1.3E.2's soft band edge):
            // what it gives over the plate, solved over the environment.
            const over = [0, 1, 2].map((c) => (dim.img.data[dj + c] * da + R0[c][i] * (255 - da)) / 255);
            const t = solveOver(over, E(i));
            if (t) trace.set(t, (y * box.w + x) * 4);
          }
          lit.set([...rgbAt(R0, i).map(q8), 255], (y * box.w + x) * 4);
          continue;
        }
        // Elsewhere: only where the environment was changed (the floor's tone
        // matched beside the line), by the part whose window covers it.
        if (partOf[i] >= 0 || !(cover[i] > 0) || nearPart[i] !== li * 16 + k) continue;
        const base = E(i);
        // Alpha-solved over the environment where the difference is small and
        // smooth; opaque in the core and where it is larger.
        const far = (target) => Math.max(...[0, 1, 2].map((c) => Math.abs(target[c][i] - base[c]))) > OPAQUE_DIFF;
        const core = near[i] < (RIM_PARTS.has(nearPart[i]) ? RIM_OPAQUE : CORE_OUT + OPAQUE_MARGIN);
        const t = core || far(R) ? [...rgbAt(R, i).map(q8), 255] : solveOver(rgbAt(R, i), base);
        if (t) trace.set(t, (y * box.w + x) * 4);
        const l = core || far(R0) ? [...rgbAt(R0, i).map(q8), 255] : solveOver(rgbAt(R0, i), base);
        if (l) lit.set(l, (y * box.w + x) * 4);
        const back = (px) => (px ? [0, 1, 2].map((c) => (px[c] * px[3] + q8(base[c]) * (255 - px[3])) / 255) : base);
        traceErr = Math.max(traceErr, ...back(t).map((v, c) => Math.abs(v - R[c][i])));
        litErr = Math.max(litErr, ...back(l).map((v, c) => Math.abs(v - R0[c][i])));
      }
    const frame = lines[id].frame;
    const place = (img) => {
      if (!frame) return img;
      const o = new Uint8Array(frame.w * frame.h * 4);
      for (let y = 0; y < box.h; y++) o.set(img.subarray(y * box.w * 4, (y + 1) * box.w * 4), ((y + box.y - frame.y) * frame.w + (box.x - frame.x)) * 4);
      return o;
    };
    // M1.3J.3: Playground part 1 also carries the plate's base corner here (copied
    // from the approved overlay); scripts/fix-playground-connection.py moves
    // it below the station afterwards. Re-run that script after this one.
    png(join(OUT, `lines/${id}-${k}-trace.png`), place(trace), (frame ?? box).w, (frame ?? box).h);
    png(join(OUT, `lines/${id}-${k}-lit.png`), place(lit), (frame ?? box).w, (frame ?? box).h);
    const pts = route.slice(starts[k], (starts[k + 1] ?? route.length - 1) + 1);
    out.push({ trace: `${URL_BASE}/lines/${id}-${k}-trace.png`, lit: `${URL_BASE}/lines/${id}-${k}-lit.png`, path: pathThrough(pts, [box.x, box.y]) });
  }
  data.lines[id] = { box, ...(lines[id].frame ? { frame: lines[id].frame } : {}), parts: out };
}

// Every pixel where the environment differs from the approved rest must be
// covered by a trace (and so by a charge window).
let uncovered = 0;
for (let i = 0; i < W * H; i++) {
  if (ppMask[i] || reflMask[i] > 0) continue;
  const e = E(i);
  if (Math.max(...[0, 1, 2].map((c) => Math.abs(e[c] - R[c][i]))) < 0.75) continue;
  if (!(partOf[i] >= 0 || cover[i] > 0)) uncovered++;
}

// Playground's reflection: unpowered and powered, over the reflection-free floor.
const reflDim = new Uint8Array(W * H * 4);
const reflLit = new Uint8Array(W * H * 4);
for (let y = RB.y; y < RB.y + RB.h; y++)
  for (let x = RB.x; x < RB.x + RB.w; x++) {
    const i = y * W + x;
    if (!(reflMask[i] > 0)) continue;
    const d = solveOver(rgbAt(R0, i), rgbAt(RF, i));
    if (d) reflDim.set(d, i * 4);
    const l = solveOver(rgbAt(P, i), rgbAt(RF, i));
    if (l) reflLit.set(l, i * 4);
  }
png(join(OUT, "playground/reflection-dim.png"), reflDim);

// M1.3H's clean background solved its edge pixels (under the cabinet's soft
// bottom edge) so that station-over-background gives the plate, so they
// took in the reflection's light at the contact line. Here the same light
// is removed from them, so no copy of the reflection stays behind when the
// reflection moves. (At identity this changes the recomposed plate on
// those edge pixels only; the layers are shown from the energy's arrival.)
const pgBg = Uint8Array.from(pgBg8);
let bgFixed = 0;
{
  const bgCh = [0, 1, 2].map((c) => Float32Array.from({ length: W * H }, (_, i) => (pgBg8[i * 4 + 3] ? pgBg8[i * 4 + c] : R0[c][i])));
  const bgLocal = bgCh.map((ch) => gauss(ch, 1.5));
  for (let y = RB.y; y < RB.y + RB.h; y++)
    for (let x = RB.x; x < RB.x + RB.w; x++) {
      const i = y * W + x;
      if (!pgBg8[i * 4 + 3]) continue;
      const edge = Math.min(x + 0.5 - RB.x, RB.x + RB.w - x - 0.5);
      const w = smoothstep(0, 4, edge);
      if (w <= 0.01) continue;
      for (let c = 0; c < 3; c++) {
        const unlit = unlitAt(c, i);
        const light = Math.max(0, bgLocal[c][i] - unlit);
        // Floor the result at the floor's own unlit tone (not a share of the
        // pixel: the edge solve amplified these, some far above the floor).
        pgBg[i * 4 + c] = q8(Math.max(Math.min(bgCh[c][i], 0.9 * unlit), bgCh[c][i] - w * light));
      }
      bgFixed++;
    }
}
png(join(OUT, "playground/background.png"), pgBg);
png(join(OUT, "playground/reflection-lit.png"), reflLit);

// Bottom edge of the station cut-out: the contact line.
const PGB = { x: 1055, y: 334, w: 327, h: 222 };
const bottom = [];
for (let x = PGB.x; x < PGB.x + PGB.w; x++) {
  let yb = -1;
  for (let y = PGB.y; y < PGB.y + PGB.h; y++) if (stationA[y * W + x] >= 0.5) yb = y;
  if (yb >= 0) bottom.push([x, yb + 0.5]);
}
const xL = bottom[0][0];
const xR = bottom.at(-1)[0];
function shadowLayer(S) {
  const a = new Uint8Array(W * H * 4);
  for (const [x, yb] of bottom) {
    const taper = smoothstep(0, S.taper, Math.min(x - xL, xR - x));
    for (let y = Math.floor(yb - S.reach); y <= Math.ceil(yb + 6 * S.spill); y++) {
      const d = yb - (y + 0.5);
      const v = d >= 0 ? S.edge + (S.deep - S.edge) * smoothstep(0, S.ramp, d) : S.edge * Math.exp(d / S.spill);
      a[(y * W + x) * 4 + 3] = q8(v * taper * 255);
    }
  }
  return a;
}
png(join(OUT, "playground/shadow-contact.png"), shadowLayer(CONTACT));
png(join(OUT, "playground/shadow-ambient.png"), shadowLayer(AMBIENT));

// Foundation joint: a smooth curve (least-squares quartic) through the
// contact line, JOINT_INSET px in. The cut-out's bottom edge is ragged at
// the pixel level; a floor joint is not. Faded at its ends (in the SVG).
const fit = (() => {
  const xm = (xL + xR) / 2;
  const xs = (xR - xL) / 2;
  const n = 5;
  const A = Array.from({ length: n }, () => new Float64Array(n));
  const bv = new Float64Array(n);
  for (const [x, y] of bottom) {
    const t = (x + 0.5 - xm) / xs;
    const pw = Array.from({ length: n }, (_, k) => t ** k);
    for (let r = 0; r < n; r++) {
      bv[r] += pw[r] * y;
      for (let c = 0; c < n; c++) A[r][c] += pw[r] * pw[c];
    }
  }
  for (let c = 0; c < n; c++)
    for (let r = c + 1; r < n; r++) {
      const m = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= m * A[c][k];
      bv[r] -= m * bv[c];
    }
  const co = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let v = bv[r];
    for (let k = r + 1; k < n; k++) v -= A[r][k] * co[k];
    co[r] = v / A[r][r];
  }
  return (x) => co.reduce((acc, ck, k) => acc + ck * ((x - xm) / xs) ** k, 0);
})();
let fitErr = 0;
for (const [x, y] of bottom) fitErr = Math.max(fitErr, Math.abs(fit(x + 0.5) - y));
const jointPts = [];
for (let x = xL + 4; x <= xR - 4; x += 8) jointPts.push([x, fit(x) - JOINT_INSET]);
let jointClear = Infinity; // at rest the joint must lie inside the silhouette
for (const [x, y] of bottom) if (x >= xL + 4 && x <= xR - 4) jointClear = Math.min(jointClear, y - (fit(x + 0.5) - JOINT_INSET));
data.playground = {
  reflection: { dim: `${URL_BASE}/playground/reflection-dim.png`, lit: `${URL_BASE}/playground/reflection-lit.png`, part: pgRefl, pad: REFL_PAD },
  background: `${URL_BASE}/playground/background.png`,
  shadow: { contact: `${URL_BASE}/playground/shadow-contact.png`, ambient: `${URL_BASE}/playground/shadow-ambient.png` },
  foundation: { path: pathThrough(jointPts, [PGB.x, PGB.y]), x0: +(jointPts[0][0] - PGB.x).toFixed(1), x1: +(jointPts.at(-1)[0] - PGB.x).toFixed(1) },
};

writeFileSync(
  join(ROOT, "components/lab/scene-25d-data.ts"),
  `// Generated by scripts/make-scene-layers.mjs (M1.3I): do not edit.
import type { SceneRect } from "@/lib/scene";

export const ENVIRONMENT_CORRECTIONS = "${URL_BASE}/environment-corrections.png";

/** Per connection: its box (reference px; the core paths are relative to it), the images' frame if not the box, and per part the trace, lit layer and core path. */
export const CONNECTION_LAYERS: Record<string, { box: SceneRect; frame?: SceneRect; parts: { trace: string; lit: string; path: string }[] }> = ${JSON.stringify(data.lines)};

/** Playground's reflection (power part index), shadows and foundation joint (path relative to the station box). */
export const PLAYGROUND_25D = ${JSON.stringify(data.playground)};
`,
);

console.log(`Playground background: reflection light removed from ${bgFixed} edge px`);
console.log(`environment corrections: ${envPx} px (line cores re-estimated: ${coreReplaced} px)`);
console.log(`environment changes outside the line windows: ${uncovered} px (must be 0)`);
console.log(`round trip over the environment: trace max ${traceErr.toFixed(2)}, lit max ${litErr.toFixed(2)} (/255, before 8-bit compositing)`);
console.log(`foundation joint: x ${jointPts[0][0].toFixed(0)}-${jointPts.at(-1)[0].toFixed(0)}, ${jointPts.length} points; contact line x ${xL}-${xR}, fit max dev ${fitErr.toFixed(1)} px, joint at least ${jointClear.toFixed(1)} px inside the contact line`);

// ---------------------------------------------------------------------------
// Preview: the environment without lines or the reflection, beside the
// approved rest state (3x, nearest neighbour), for docs.
if (PREVIEW) {
  mkdirSync(join(PREVIEW, "checks"), { recursive: true });
  const full = (ch) => {
    const o = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) o.set([q8(ch[0][i]), q8(ch[1][i]), q8(ch[2][i]), 255], i * 4);
    return o;
  };
  const rest = full(R);
  const envOnly = full(RF);
  png(join(PREVIEW, "checks/environment-full.png"), envOnly);
  const zoom = (img, box, s) => {
    const o = new Uint8Array(box.w * s * box.h * s * 4);
    for (let y = 0; y < box.h * s; y++)
      for (let x = 0; x < box.w * s; x++) o.set(img.subarray(((box.y + ((y / s) | 0)) * W + box.x + ((x / s) | 0)) * 4, ((box.y + ((y / s) | 0)) * W + box.x + ((x / s) | 0)) * 4 + 4), (y * box.w * s + x) * 4);
    return o;
  };
  const regions = { playground: { x: 890, y: 525, w: 260, h: 60 }, creative: { x: 480, y: 640, w: 260, h: 70 }, reflection: { x: 1095, y: 530, w: 160, h: 40 } };
  for (const [name, box] of Object.entries(regions)) {
    png(join(PREVIEW, `checks/env-${name}-rest-3x.png`), zoom(rest, box, 3), box.w * 3, box.h * 3);
    png(join(PREVIEW, `checks/env-${name}-environment-3x.png`), zoom(envOnly, box, 3), box.w * 3, box.h * 3);
  }
  void crop;
}
