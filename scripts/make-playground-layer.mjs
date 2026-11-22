#!/usr/bin/env node
// M1.3E.1: split the Playground station out of the clean plate, and make a
// dimmed ("unpowered") version of its connection line.
//
// A Node port of the M1.2.2 Engineering method (scripts/make-station-layers.py,
// which needs Python + OpenCV; this machine has neither). Headless Chrome only
// decodes the plate and the platform-strip mask; everything else is plain JS,
// and the PNGs are written losslessly here (canvas encoding would round the
// soft edges through premultiplied alpha).
//
// Writes full-frame (1672 x 941) RGBA PNGs, transparent outside one shared
// clip box, which is printed and must match STATION_LAYERS.playground.box:
//
//   public/scene/layers/playground.png           the station (moves)
//   public/scene/layers/playground-backdrop.png  scenery behind it, rebuilt (static)
//   public/scene/layers/playground-shadow.png    contact shadow (static)
//   public/scene/layers/playground-shadow-soft.png  soft penumbra at the contact line (static, M1.3E.3)
//   public/scene/layers/playground-gap.png       warm light pooled under the base's edge (static, M1.3E.3)
//   public/scene/layers/playground-light.png     platform-strip light, on the silhouette (moves)
//   public/scene/activation/playground-line-dim-{a,b}.png
//       the connection, unpowered: shown at rest, uncovered from the A
//       outward as the hover charge travels (a: across the central platform,
//       b: across the floor, plus the light it paints on the platform's corner)
//   public/scene/activation/playground-route{,-glow,-wide}.png
//       masks of the complete route, for the travelling spark (M1.3E.2)
//   components/lab/playground-route.ts
//       the route itself, traced from the plate
//
// Method (see make-station-layers.py for the long form):
//   1. silhouette: a hand-traced polygon -> soft alpha M from the signed
//      distance to it (1 just inside, 0 just outside);
//   2. reconstruction of what's behind: row interpolation between robust
//      samples outside the hole, anisotropic (horizontal-dominant) membrane
//      relaxation, then the floor at the contact line carried up into the
//      strip the lift uncovers, plus matched grain. Bright pixels (glows, the
//      connection line, floor reflections) are never used as sources;
//   3. exact matting: the station colour is solved from
//      plate = M*C + (1-M)*backdrop, so at rest station-over-backdrop
//      reproduces the plate, and a lifted station reveals only the rebuild.
//
// Never touches reference/ or public/scene/lab-plate.webp.
//
// Usage: node scripts/make-playground-layer.mjs [--preview <dir>]

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

/**
 * Outline of the Playground station, clockwise from the marquee's top-left,
 * reference px. It takes in a few px of the neon's own glow (so the glow
 * moves with the cabinet) and hugs the stone tightly where the floor, the
 * floor ring and the connection line must stay behind.
 */
const SILHOUETTE = [
  // marquee and the cabinet's top
  [1126, 352], [1129, 346.5], [1208, 345.5], [1213.5, 349.5], [1215, 373.5],
  // the cabinet's side panel, then its right edge
  [1244, 373.5], [1268.5, 374.5], [1271, 378], [1271, 437],
  // purple glass frame behind the controller
  [1277, 437], [1299.5, 436.5], [1302, 440], [1302.5, 456],
  // controller, plant
  [1316, 456.5], [1326, 461], [1331, 467], [1336, 462.5], [1343, 463], [1350, 470], [1351, 480],
  // upper slab, lower tier, right block
  [1358, 483.5], [1363.5, 487], [1365, 500.5], [1372.5, 501.5], [1375.5, 505], [1375.5, 536.5],
  // bottom contour, right to left (dark gap between the stone and the floor)
  [1373, 541], [1364, 543], [1350, 544.3], [1330, 545.3], [1300, 546.2], [1270, 546.5], [1240, 546.4],
  [1210, 546.1], [1180, 545.4], [1150, 544.2], [1125, 542.3], [1105, 540], [1093, 537.6],
  // left block (the line ends just below its corner)
  [1086, 536], [1078, 533.6], [1070, 531.2], [1063, 529], [1061.5, 524], [1061.5, 500],
  [1063.5, 496], [1072, 493.5], [1081, 491.5], [1083, 484],
  // purple glass panel on the left, the deck's corner
  [1085.5, 482], [1085.5, 456], [1088, 452.5], [1106, 451.5], [1115, 447],
  // the cabinet's left neon edge, up to the marquee
  [1117, 441], [1136.5, 391], [1127.5, 375.5],
];

/** The connection from the central A to Playground (scene-fx CONNECTIONS). */
const LINE = { from: [967, 567.2], to: [1088, 536.5], halfWidth: 11 };
/** How much of the line's own light is kept at rest (0 = floor only). */
const LINE_KEEP = 0.28;

const EDGE_IN = 1.2; // alpha reaches 1 this far inside the traced edge (px)
const EDGE_OUT = 1.2; // ... and 0 this far outside it
const BAND = 30; // floor texture rebuilt above the contact line (px), > the lift
const LIFT_MAX = 22; // full-strength texture up to here (the lift is 18)
const FLOOR_SKIP = 7; // source floor starts this far below the contact line (past the seam and reflection)
const SHADOW_DEPTH = 26; // contact-shadow footprint inside the base (px)
/** CSS opacity of the shadow when fully lifted (globals.css); for the preview. */
const SHADOW_OPACITY = 0.85;
const BOX_PAD = 2;
/**
 * M1.3E.3 under-layers (see underLayers): the penumbra's peak and falloff
 * under / in front of the contact line, and the light pool's peak position
 * (px, < 0 = inside the gap), falloff up / down, and its level away from the
 * base strips (0..1).
 */
const UNDER = { softMax: 0.5, softIn: 6, softFront: 3.5, gapAt: -1.5, gapUp: 3.6, gapDown: 1.8, gapFloor: 0.25 };
/** Contact occlusion under the base: at the contact line, deepest, and the depth (px) where it is deepest. */
const OCC = { edge: 0.3, deep: 0.88, depth: 18 };
/** CSS opacities when fully lifted (globals.css); for the preview. */
const SOFT_OPACITY = 0.6;
const GAP_OPACITY = 0.7;
const GAP_RGB = [255, 178, 96];
/** The activation overlays (glow, game screen) ride the lift: keep them inside its clip box. */
const ACTIVATION_BOX = { x: 1092, y: 336, w: 222, h: 168 };
const PLATFORM_LIGHT_BOX = { x: 1116, y: 503, w: 280, h: 58 };
const PLATFORM_LIGHT_RGB = [255, 208, 150];

// ---------------------------------------------------------------------------
// Decode (Chrome) and encode (PNG, here).

// Every image is drawn at the scene size: the platform-strip mask is stored
// at half size (836 x 470) and CSS stretches it to the scene, so it is
// stretched the same way here. (M1.3E.1 indexed it at full size, which left
// playground-light.png empty; fixed in M1.3E.3.)
async function decodeAll(files) {
  const page = await launch({ width: 400, height: 300 });
  try {
    const out = [];
    for (const f of files) {
      const type = f.endsWith(".webp") ? "image/webp" : "image/png";
      const src = `data:${type};base64,` + readFileSync(join(ROOT, f)).toString("base64");
      const size = await page.eval(`(async () => {
        const img = new Image(); img.src = ${JSON.stringify(src)}; await img.decode();
        const c = document.createElement("canvas"); c.width = ${W}; c.height = ${H};
        const g = c.getContext("2d", { colorSpace: "srgb" }); g.drawImage(img, 0, 0, ${W}, ${H});
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let s = ""; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
        window.__raw = btoa(s); return window.__raw.length;
      })()`);
      let b64 = "";
      for (let i = 0; i < size; i += 1 << 20) b64 += await page.eval(`window.__raw.slice(${i}, ${i + (1 << 20)})`);
      out.push(new Uint8Array(Buffer.from(b64, "base64")));
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
function png(path, rgba, w = W, h = H, channels = 4) {
  const raw = Buffer.alloc((w * channels + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * channels, w * channels).copy(raw, y * (w * channels + 1) + 1);
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
  ihdr[9] = channels === 4 ? 6 : 2;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
  console.log(`wrote ${path.replace(ROOT, "").replace(/^[\\/]/, "")}`);
}

// ---------------------------------------------------------------------------
// Geometry.

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPoly(x, y, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}
/** Soft silhouette alpha from the signed distance at pixel centres (4x4 supersampled near the edge). */
function silhouette(poly) {
  const M = new Float32Array(W * H);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)) - 3;
  const x1 = Math.ceil(Math.max(...xs)) + 3;
  const y0 = Math.floor(Math.min(...ys)) - 3;
  const y1 = Math.ceil(Math.max(...ys)) + 3;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let a = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const px = x + (sx + 0.5) / 4;
          const py = y + (sy + 0.5) / 4;
          const d = distToPoly(px, py, poly) * (pointInPoly(px, py, poly) ? 1 : -1);
          a += Math.min(1, Math.max(0, (d + EDGE_OUT) / (EDGE_IN + EDGE_OUT)));
        }
      M[y * W + x] = a / 16;
    }
  return M;
}

// ---------------------------------------------------------------------------
// Image helpers (float RGB, 3 channels).

const lumOf = (img, i) => 0.299 * img[i * 3] + 0.587 * img[i * 3 + 1] + 0.114 * img[i * 3 + 2];

function dilate(mask, r) {
  // Separable square dilation.
  const tmp = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < W && mask[y * W + xx]) v = 1;
      }
      tmp[y * W + x] = v;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < H && tmp[yy * W + x]) v = 1;
      }
      out[y * W + x] = v;
    }
  return out;
}
/** Box mean of the luminance (21 x 21) via an integral image. */
function localMean(lum, r = 10) {
  const I = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += lum[y * W + x];
      I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xa = Math.max(0, x - r);
      const xb = Math.min(W, x + r + 1);
      const ya = Math.max(0, y - r);
      const yb = Math.min(H, y + r + 1);
      const s = I[yb * (W + 1) + xb] - I[ya * (W + 1) + xb] - I[yb * (W + 1) + xa] + I[ya * (W + 1) + xa];
      out[y * W + x] = s / ((xb - xa) * (yb - ya));
    }
  return out;
}
const median = (vals) => {
  const s = [...vals].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const medianRGB = (list) => [0, 1, 2].map((c) => median(list.map((p) => p[c])));

/** Seeded normal noise (mulberry32 + Box-Muller). */
function noise(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
}

function reconstruct(img, hole) {
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = lumOf(img, i);
  const local = localMean(lum);
  const near = dilate(hole, 2);
  const valid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) valid[i] = !near[i] && lum[i] - local[i] < 14 ? 1 : 0;
  const ring = dilate(hole, 12);
  const solve = new Uint8Array(W * H);
  const usable = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    solve[i] = hole[i] || (ring[i] && !valid[i]) ? 1 : 0;
    usable[i] = solve[i] || valid[i] ? 1 : 0;
  }
  const f = Float32Array.from(img);
  const px = (y, x) => [img[(y * W + x) * 3], img[(y * W + x) * 3 + 1], img[(y * W + x) * 3 + 2]];

  // a. Row interpolation between robust samples outside the hole.
  const sample = (y, x, step) => {
    const vals = [];
    for (let k = 1; k <= 60 && vals.length < 8; k++) {
      const xx = x + step * k;
      if (xx < 0 || xx >= W) break;
      if (valid[y * W + xx]) vals.push(px(y, xx));
    }
    return vals.length >= 3 ? medianRGB(vals) : null;
  };
  let bx0 = W;
  let bx1 = 0;
  let by0 = H;
  let by1 = 0;
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!solve[y * W + x]) {
        x++;
        continue;
      }
      const a = x;
      while (x < W && solve[y * W + x]) x++;
      const b = x - 1;
      bx0 = Math.min(bx0, a);
      bx1 = Math.max(bx1, b);
      by0 = Math.min(by0, y);
      by1 = Math.max(by1, y);
      let left = sample(y, a, -1);
      let right = sample(y, b, 1);
      if (!left && !right) continue;
      left ??= right;
      right ??= left;
      for (let xx = a; xx <= b; xx++) {
        const t = (xx - (a - 1)) / (b - a + 2);
        for (let c = 0; c < 3; c++) f[(y * W + xx) * 3 + c] = left[c] * (1 - t) + right[c] * t;
      }
    }
  }

  // b. Anisotropic membrane relaxation inside the solve region.
  const x0 = bx0 - 1;
  const x1 = bx1 + 1;
  const y0 = by0 - 1;
  const y1 = by1 + 1;
  const nbrs = [[0, 1, 1], [0, -1, 1], [1, 0, 0.3], [-1, 0, 0.3]];
  for (let it = 0; it < 700; it++) {
    for (let y = y0 + 1; y < y1; y++)
      for (let x = x0 + 1; x < x1; x++) {
        const i = y * W + x;
        if (!solve[i]) continue;
        let r = 0;
        let g = 0;
        let bb = 0;
        let den = 0;
        for (const [dy, dx, w] of nbrs) {
          const j = (y + dy) * W + x + dx;
          const u = usable[j] * w;
          r += f[j * 3] * u;
          g += f[j * 3 + 1] * u;
          bb += f[j * 3 + 2] * u;
          den += u;
        }
        if (den > 0) {
          f[i * 3] = r / den;
          f[i * 3 + 1] = g / den;
          f[i * 3 + 2] = bb / den;
        }
      }
  }

  // c. The strip a lift uncovers (just above the platform's contact line)
  //    is floor seen under the raised platform. Rebuild it from real floor
  //    texture: each column takes the floor below the contact line, past the
  //    dark seam and the strips' reflection (FLOOR_SKIP), mirrored upward.
  //    Highlights (the connection line, reflections) are never copied: they
  //    are replaced by that column's typical floor, and the source's tone is
  //    kept, not the interpolated haze.
  const bottom = new Int32Array(W).fill(-1);
  for (let x = 0; x < W; x++)
    for (let y = H - 1; y >= 0; y--)
      if (hole[y * W + x]) {
        bottom[x] = y;
        break;
      }
  for (let x = 0; x < W; x++) {
    const yb = bottom[x];
    if (yb < 0) continue;
    // Typical floor in this column's source rows (valid pixels only).
    const src = (d) => yb + FLOOR_SKIP + d;
    const pool = [];
    for (let d = 0; d <= BAND; d++) {
      const ys = src(d);
      if (ys < H && valid[ys * W + x] && !hole[ys * W + x]) pool.push(px(ys, x));
    }
    if (pool.length < 4) continue;
    const typical = medianRGB(pool);
    for (let d = 0; d <= BAND; d++) {
      const y = yb - d;
      if (y < 0 || !hole[y * W + x]) continue;
      const ys = src(d);
      const ok = ys < H && valid[ys * W + x] && !hole[ys * W + x];
      const v = ok ? px(ys, x) : typical;
      // Full texture over the lift's reach, fading into the fill above.
      const k = Math.min(1, Math.max(0, (BAND - d) / (BAND - LIFT_MAX)));
      for (let ch = 0; ch < 3; ch++) f[(y * W + x) * 3 + ch] = f[(y * W + x) * 3 + ch] * (1 - k) + v[ch] * k;
    }
  }

  // d. Grain.
  const n = noise(11);
  const out = Float32Array.from(img);
  for (let i = 0; i < W * H; i++) if (hole[i]) for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.min(255, Math.max(0, Math.round(f[i * 3 + c] + n() * 1.6)));
  return out;
}

function contactShadow(hole) {
  const sh = new Float32Array(W * H);
  for (let x = 0; x < W; x++) {
    let yb = -1;
    for (let y = H - 1; y >= 0; y--)
      if (hole[y * W + x]) {
        yb = y;
        break;
      }
    if (yb < 0) continue;
    for (let y = Math.max(0, yb - SHADOW_DEPTH); y < Math.min(H, yb + 5); y++) {
      const depth = yb - y;
      // M1.3E.3: lighter at the contact line, deepening smoothly under the base.
      const ramp = (v) => v * v * (3 - 2 * v);
      if (depth >= 0 && hole[y * W + x]) sh[y * W + x] = OCC.edge + (OCC.deep - OCC.edge) * ramp(Math.min(1, depth / OCC.depth));
      else if (depth < 0) sh[y * W + x] = OCC.edge * Math.max(0, 1 + depth / 4);
    }
  }
  // Gaussian blur, sigma 1.2.
  const k = [-3, -2, -1, 0, 1, 2, 3].map((d) => Math.exp(-(d * d) / (2 * 1.2 * 1.2)));
  const ks = k.reduce((a, b) => a + b);
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 3; x < W - 3; x++) tmp[y * W + x] = k.reduce((a, w, j) => a + w * sh[y * W + x + j - 3], 0) / ks;
  for (let y = 3; y < H - 3; y++) for (let x = 0; x < W; x++) out[y * W + x] = k.reduce((a, w, j) => a + w * tmp[(y + j - 3) * W + x], 0) / ks;
  return out;
}

/**
 * M1.3E.3: two more static floor layers under the lifted station, both
 * following the silhouette's bottom contour (the contact line):
 *
 *   soft  a wide, soft penumbra spreading from the footprint onto the floor
 *         in front and at the sides; it grows in after the lift (weight).
 *   gap   a thin warm light pooled on the floor at the contact line, as if
 *         the platform's base strips lit the floor beneath it: the dark gap
 *         gets a lit lower edge that follows the platform's outline, so the
 *         separation reads against the dark stone.
 *
 * Both stay inside the layer box (fading out before its edges).
 */
function underLayers(a8, recon, plate, strips) {
  // Bottom contour: last row with alpha >= 0.5, refined to the 0.5 crossing.
  const yb = new Float32Array(W).fill(-1);
  let x0 = W;
  let x1 = -1;
  for (let x = 0; x < W; x++)
    for (let y = H - 2; y > 0; y--)
      if (a8[y * W + x] >= 128) {
        const a = a8[y * W + x] / 255;
        const b = a8[(y + 1) * W + x] / 255;
        yb[x] = y + 0.5 + (a - 0.5) / Math.max(1e-3, a - b);
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        break;
      }
  const smooth = (v) => v * v * (3 - 2 * v);
  const ends = (x) => smooth(Math.min(1, Math.max(0, (x - x0) / 10), Math.max(0, (x1 - x) / 10)));
  // Light per column: the base strips above it (blurred along x), so the
  // pool is brightest under the lit strips and faint elsewhere.
  const lit = new Float32Array(W);
  for (let x = x0; x <= x1; x++)
    for (let y = Math.floor(yb[x] - 40); y <= yb[x]; y++) lit[x] = Math.max(lit[x], ((strips[(y * W + x) * 4 + 3] ?? 0) / 255) * (a8[y * W + x] / 255));
  const litB = new Float32Array(W);
  let litMax = 0;
  for (let x = x0; x <= x1; x++) {
    let a = 0;
    let n = 0;
    for (let d = -36; d <= 36; d++) {
      const w = Math.exp(-(d * d) / (2 * 14 * 14));
      a += w * (lit[x + d] ?? 0);
      n += w;
    }
    litB[x] = a / n;
    litMax = Math.max(litMax, litB[x]);
  }
  const floorLum = (i) => {
    const src = a8[i] ? recon : plate;
    return 0.299 * src[i * 3] + 0.587 * src[i * 3 + 1] + 0.114 * src[i * 3 + 2];
  };
  const soft = new Float32Array(W * H);
  const gap = new Float32Array(W * H);
  const P = UNDER;
  for (let x = x0 - 4; x <= x1 + 4; x++) {
    const xc = Math.min(x1, Math.max(x0, x));
    const side = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
    const base = yb[xc];
    for (let y = Math.floor(base - 26); y <= Math.ceil(base + 10); y++) {
      const d = y + 0.5 - base; // > 0: in front of the contact line
      const i = y * W + x;
      // Penumbra: flat under the footprint, soft falloff in front / at the sides.
      const front = Math.exp(-(d * d) / (2 * (d <= 0 ? P.softIn : P.softFront) ** 2));
      const lateral = Math.exp(-(side * side) / (2 * 2 * 2)) * (1 - side / 5);
      const keepIn = Math.min(1, Math.max(0, (base + 7 - (y + 0.5)) / 2)); // fade before the box's bottom
      soft[i] = P.softMax * front * lateral * keepIn;
      // Light pool: peak a little inside the gap, short tail onto the floor.
      if (!side) {
        const e = d - P.gapAt;
        const sg = e < 0 ? P.gapUp : P.gapDown;
        const strength = P.gapFloor + (1 - P.gapFloor) * (litB[x] / litMax);
        // The floor's own texture shows through the light.
        let m = 0;
        let n = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -6; dx <= 6; dx++) { m += floorLum(i + dy * W + dx); n++; }
        const tex = Math.min(1.5, Math.max(0.55, floorLum(i) / Math.max(4, m / n)));
        gap[i] = Math.exp(-(e * e) / (2 * sg * sg)) * ends(x) * keepIn * strength * tex;
      }
    }
  }
  return { soft, gap };
}

// ---------------------------------------------------------------------------

const [plateRGBA, platformsRGBA] = await decodeAll(["public/scene/lab-plate.webp", "public/scene/masks/platforms.png"]);
const O = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) O[i * 3 + c] = plateRGBA[i * 4 + c];

const Mf = silhouette(SILHOUETTE);
const alpha8 = new Uint8Array(W * H);
const hole = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  alpha8[i] = Math.round(Mf[i] * 255);
  hole[i] = alpha8[i] > 0 ? 1 : 0;
}
console.log("reconstructing ...");
const recon = reconstruct(O, hole);

// Exact matting with a backdrop coverage P <= M where needed to keep C in range.
const p8 = new Uint8Array(W * H);
const backdrop = new Float32Array(W * H * 3);
const station = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  const M = alpha8[i] / 255;
  let P = M;
  if (M > 0 && M < 1) {
    for (let c = 0; c < 3; c++) {
      const d = O[i * 3 + c] - recon[i * 3 + c];
      if (Math.abs(d) <= 0.5) continue;
      const room = d < 0 ? O[i * 3 + c] : 255 - O[i * 3 + c];
      P = Math.min(P, (room * M) / ((1 - M) * Math.abs(d)));
    }
  }
  p8[i] = M >= 1 ? 255 : Math.floor(Math.max(0, Math.min(1, P)) * 255);
  const Pq = p8[i] / 255;
  for (let c = 0; c < 3; c++) {
    backdrop[i * 3 + c] = O[i * 3 + c] * (1 - Pq) + recon[i * 3 + c] * Pq;
    station[i * 3 + c] = M > 0 ? (O[i * 3 + c] - (1 - M) * backdrop[i * 3 + c]) / M : 0;
  }
}
const shadow = contactShadow(hole);
const { soft, gap } = underLayers(alpha8, recon, O, platformsRGBA);

// Platform-strip light: the M1.3A platform light, clipped to the silhouette.
const light8 = new Uint8Array(W * H);
for (let y = PLATFORM_LIGHT_BOX.y; y < PLATFORM_LIGHT_BOX.y + PLATFORM_LIGHT_BOX.h; y++)
  for (let x = PLATFORM_LIGHT_BOX.x; x < PLATFORM_LIGHT_BOX.x + PLATFORM_LIGHT_BOX.w; x++) {
    const i = y * W + x;
    light8[i] = Math.round((platformsRGBA[i * 4 + 3] / 255) * (alpha8[i] / 255) * 255);
  }

// Shared clip box: everything's coverage, plus the activation overlays.
let bx0 = ACTIVATION_BOX.x;
let by0 = ACTIVATION_BOX.y;
let bx1 = ACTIVATION_BOX.x + ACTIVATION_BOX.w;
let by1 = ACTIVATION_BOX.y + ACTIVATION_BOX.h;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (alpha8[i] || p8[i] || shadow[i] > 0.002 || soft[i] > 0.002 || gap[i] > 0.002 || light8[i]) {
      bx0 = Math.min(bx0, x);
      by0 = Math.min(by0, y);
      bx1 = Math.max(bx1, x + 1);
      by1 = Math.max(by1, y + 1);
    }
  }
const fit = { x: bx0 - BOX_PAD, y: by0 - BOX_PAD, w: bx1 - bx0 + 2 * BOX_PAD, h: by1 - by0 + 2 * BOX_PAD };
// The box is pinned (STATION_LAYERS.playground.box); the layers must fit in it.
const box = { x: 1055, y: 334, w: 327, h: 222 };
if (fit.x < box.x || fit.y < box.y || fit.x + fit.w > box.x + box.w || fit.y + fit.h > box.y + box.h) throw new Error(`layers overflow the pinned box: ${JSON.stringify(fit)}`);
console.log(`layer box = ${JSON.stringify(box)}  -> STATION_LAYERS.playground.box in components/lab/scene-layout.ts`);

const inBox = (i) => {
  const x = i % W;
  const y = (i / W) | 0;
  return x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
};
function rgbaOf(rgb, a8, constant) {
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    if (!a8[i] || !inBox(i)) continue;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = constant ? constant[c] : Math.min(255, Math.max(0, Math.round(rgb[i * 3 + c])));
    out[i * 4 + 3] = a8[i];
  }
  return out;
}
const shadow8 = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) shadow8[i] = Math.round(Math.min(1, Math.max(0, shadow[i])) * 255);

const LAYERS = join(ROOT, "public/scene/layers");
png(join(LAYERS, "playground.png"), rgbaOf(station, alpha8));
png(join(LAYERS, "playground-backdrop.png"), rgbaOf(recon, p8));
png(join(LAYERS, "playground-shadow.png"), rgbaOf(null, shadow8, [0, 0, 0]));
const to8 = (f) => Uint8Array.from(f, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
png(join(LAYERS, "playground-shadow-soft.png"), rgbaOf(null, to8(soft), [0, 0, 0]));
png(join(LAYERS, "playground-gap.png"), rgbaOf(null, to8(gap), GAP_RGB));
png(join(LAYERS, "playground-light.png"), rgbaOf(null, light8, PLATFORM_LIGHT_RGB));

// Round trip, composited as the browser does (premultiplied, 8-bit).
{
  let max = 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!hole[i]) continue;
    const a = alpha8[i] / 255;
    const p = p8[i] / 255;
    for (let c = 0; c < 3; c++) {
      const under = Math.round(Math.min(255, Math.max(0, Math.round(recon[i * 3 + c]))) * p) + (1 - p) * O[i * 3 + c];
      const rest = Math.round(Math.min(255, Math.max(0, Math.round(station[i * 3 + c]))) * a) + (1 - a) * under;
      const e = Math.abs(rest - O[i * 3 + c]);
      max = Math.max(max, e);
      sum += e;
      n++;
    }
  }
  console.log(`rest-state recomposition: max ${max.toFixed(2)}, mean ${(sum / n).toFixed(3)} over ${n / 3} px`);
}

// ---------------------------------------------------------------------------
// M1.3E.2: the complete connection, traced from the plate.
//
// The painted connection from the A to Playground has two parts: a fainter
// stroke across the central platform's top, from the A's outer circle to the
// platform's rim, and the bright stroke across the floor to the station,
// where it also lights the platform's corner. (M1.3E.1, and the shared
// connection masks, only knew the floor stroke, as a straight chord.)
//
// Each column's line centre is the brightness-weighted centroid in a narrow
// band around a rough guess, smoothed along the line; the route is sampled
// from those centres.
const lumAt = (x, y) => lumOf(O, y * W + x);
const bez = { p0: [967, 567.2], p1: [1027.5, 556.1], p2: [1088, 536.5] };
const bezierY = (x) => {
  const t = (x - bez.p0[0]) / (bez.p2[0] - bez.p0[0]);
  const m = 1 - t;
  return m * m * bez.p0[1] + 2 * m * t * bez.p1[1] + t * t * bez.p2[1];
};
const ROUTE_PARTS = [
  // On the platform's top; the rim's metal highlight lies ~5 px below, so the band is narrow.
  { name: "platform", x0: 897, x1: 955, guess: (x) => 562.5 + ((x - 897) * 3) / 63, band: 2.5, step: 7 },
  // On the floor, from the rim to the station.
  { name: "floor", x0: 963, x1: 1087, guess: bezierY, band: 3.5, step: 9 },
];
function traceCentres({ x0, x1, guess, band }) {
  const ys = [];
  for (let x = x0; x <= x1; x++) {
    const g = guess(x);
    let base = Infinity;
    for (let y = Math.floor(g - band - 3); y <= Math.ceil(g + band + 3); y++) base = Math.min(base, lumAt(x, y));
    let sw = 0;
    let sy = 0;
    for (let y = Math.floor(g - band); y <= Math.ceil(g + band); y++) {
      const w = Math.max(0, lumAt(x, y) - base) ** 2;
      sw += w;
      sy += w * (y + 0.5);
    }
    ys.push(sw > 0 ? sy / sw : g);
  }
  // Smooth along the line (+-3 columns).
  return ys.map((_, i) => {
    let a = 0;
    let n = 0;
    for (let k = -3; k <= 3; k++)
      if (ys[i + k] !== undefined) {
        a += ys[i + k];
        n++;
      }
    return a / n;
  });
}
const ROUTE = [];
let BEND = 0;
for (const part of ROUTE_PARTS) {
  const ys = traceCentres(part);
  if (part.name === "floor") BEND = ROUTE.length;
  const xs = [];
  for (let x = part.x0; x < part.x1; x += part.step) xs.push(x);
  xs.push(part.x1);
  for (const x of xs) ROUTE.push([x + 0.5, +ys[x - part.x0].toFixed(2)]);
}
// The floor stroke's end, just under the platform's corner: continue the
// traced direction 1.5 px.
{
  const [a, b] = ROUTE.slice(-2);
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  ROUTE.push([+(b[0] + ((b[0] - a[0]) / l) * 1.5).toFixed(2), +(b[1] + ((b[1] - a[1]) / l) * 1.5).toFixed(2)]);
}
writeFileSync(
  join(ROOT, "components/lab/playground-route.ts"),
  `// Generated by scripts/make-playground-layer.mjs (M1.3E.2): do not edit.
/**
 * Playground's painted connection, from the A's outer circle to the station,
 * traced from the plate (reference px): first across the central platform's
 * top, then (from PLAYGROUND_ROUTE_BEND, where it steps down over the
 * platform's rim) across the floor to the platform's corner.
 */
export const PLAYGROUND_ROUTE: readonly (readonly [number, number])[] = ${JSON.stringify(ROUTE)};
export const PLAYGROUND_ROUTE_BEND = ${BEND};
`,
);
console.log(`wrote components/lab/playground-route.ts (${ROUTE.length} points, floor from ${BEND})`);

// Arc length and nearest point on the route.
const segs = ROUTE.slice(1).map((b, i) => {
  const a = ROUTE[i];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { a, b, len, ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len, part: i < BEND ? "platform" : "floor" };
});
let acc = 0;
for (const sg of segs) {
  sg.s0 = acc;
  acc += sg.len;
}
const ROUTE_LEN = acc;
/** Nearest route point to (x, y): arc position s (may run past either end), signed distance d (+ = below-right of travel), segment. */
function nearest(x, y) {
  let best = null;
  segs.forEach((sg, k) => {
    const rx = x - sg.a[0];
    const ry = y - sg.a[1];
    let t = rx * sg.ux + ry * sg.uy;
    const lo = k === 0 ? -20 : 0;
    const hi = k === segs.length - 1 ? sg.len + 20 : sg.len;
    t = Math.max(lo, Math.min(hi, t));
    const px = sg.a[0] + sg.ux * t;
    const py = sg.a[1] + sg.uy * t;
    const dist = Math.hypot(x - px, y - py);
    if (!best || dist < best.dist) best = { dist, s: sg.s0 + t, d: (x - px) * -sg.uy + (y - py) * sg.ux, sg };
  });
  return best;
}

// Route masks for the spark (white, alpha only): a crisp core, a glow, a
// wide soft halo; empty before the route's start and past its end.
const rcore = new Uint8Array(W * H * 4);
const rglow = new Uint8Array(W * H * 4);
const rwide = new Uint8Array(W * H * 4);
// Per part (platform / floor), for the powered glow that fills in behind the
// charge front: each charge window shows only its own part, so the two never
// double up at the rim step.
const partMasks = { platform: { core: new Uint8Array(W * H * 4), glow: new Uint8Array(W * H * 4) }, floor: { core: new Uint8Array(W * H * 4), glow: new Uint8Array(W * H * 4) } };
const RX0 = Math.floor(ROUTE[0][0]) - 30;
const RX1 = Math.ceil(ROUTE.at(-1)[0]) + 30;
const RY0 = Math.floor(Math.min(...ROUTE.map((p) => p[1]))) - 30;
const RY1 = Math.ceil(Math.max(...ROUTE.map((p) => p[1]))) + 30;
for (let y = RY0; y <= RY1; y++)
  for (let x = RX0; x <= RX1; x++) {
    const n = nearest(x + 0.5, y + 0.5);
    const cap = Math.min(1, Math.max(0, (n.s + 3) / 4), Math.max(0, (ROUTE_LEN + 3 - n.s) / 4));
    const i = (y * W + x) * 4;
    const put = (buf, a) => {
      const v = Math.round(Math.min(1, Math.max(0, a)) * cap * 255);
      if (v) buf.set([255, 255, 255, v], i);
    };
    put(rcore, (1.9 - n.dist) / 1.0);
    put(rglow, Math.exp(-(n.dist * n.dist) / (2 * 3.6 * 3.6)));
    put(partMasks[n.sg.part].core, (1.9 - n.dist) / 1.0);
    put(partMasks[n.sg.part].glow, Math.exp(-(n.dist * n.dist) / (2 * 3.6 * 3.6)));
    put(rwide, Math.exp(-(n.dist * n.dist) / (2 * 8 * 8)));
  }
const ACT = join(ROOT, "public/scene/activation");
png(join(ACT, "playground-route.png"), rcore);
png(join(ACT, "playground-route-glow.png"), rglow);
png(join(ACT, "playground-route-wide.png"), rwide);
png(join(ACT, "playground-route-a.png"), partMasks.platform.core);
png(join(ACT, "playground-route-a-glow.png"), partMasks.platform.glow);
png(join(ACT, "playground-route-b.png"), partMasks.floor.core);
png(join(ACT, "playground-route-b-glow.png"), partMasks.floor.glow);

// ---------------------------------------------------------------------------
// The connection, unpowered: each pixel the line lights is moved toward the
// surface beside it, keeping LINE_KEEP of its own light. Alpha follows how
// much the line adds there, so the surface around it is untouched. One image
// per charge window (platform part / floor part), so their edges never
// double up.
//   platform: a narrow band; the surface is sampled above the line only (the
//             rim's metal highlight lies just below it, and is not the line);
//   floor:    sampled on both sides, smoothed along the line;
//   corner:   the light the line paints on the platform's corner (it belongs
//             to the station layer, but at rest the plate shows it) is dimmed
//             toward the stone just right of it.
const PARTS = {
  platform: { halfWidth: 3.5, sides: [-1], gap: 2 },
  floor: { halfWidth: LINE.halfWidth, sides: [-1, 1], gap: 1 },
};
const surface = (n, side, part) => {
  const { halfWidth, gap } = PARTS[part];
  const vals = [];
  for (let k = -4; k <= 4; k += 2) {
    // Along the line (+-4 px) and across it, beyond the band.
    const s = Math.max(n.sg.s0, Math.min(n.sg.s0 + n.sg.len, n.s + k)) - n.sg.s0;
    const bx = n.sg.a[0] + n.sg.ux * s;
    const by = n.sg.a[1] + n.sg.uy * s;
    for (let d = halfWidth + gap; d <= halfWidth + gap + 3; d++) {
      const x = Math.round(bx - n.sg.uy * d * side);
      const y = Math.round(by + n.sg.ux * d * side);
      const i = y * W + x;
      vals.push([O[i * 3], O[i * 3 + 1], O[i * 3 + 2]]);
    }
  }
  return medianRGB(vals);
};
const dims = { platform: new Uint8Array(W * H * 4), floor: new Uint8Array(W * H * 4) };
const lumRGB = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
const warmth = (p) => p[0] - p[2];
const lineLight = (P, F, lum0 = 3) => Math.min(Math.max(0, (lumRGB(P) - lumRGB(F) - lum0) / 12), Math.max(0, (warmth(P) - warmth(F) - 4) / 14), 1);
const END = ROUTE.at(-1);
for (let y = RY0; y <= RY1; y++)
  for (let x = RX0; x <= RX1; x++) {
    const i = y * W + x;
    const P = [O[i * 3], O[i * 3 + 1], O[i * 3 + 2]];
    const M = alpha8[i] / 255;
    let F = null;
    let a = 0;
    let part = null;
    const corner = Math.hypot(x + 0.5 - END[0], y + 0.5 - END[1]) <= 11 && x + 0.5 <= END[0] + 7;
    if (M > 0.02 && corner) {
      // The lit corner of the platform: compare with the stone 12 px to its right.
      const j = y * W + x + 12;
      if (alpha8[j] < 250) continue;
      F = [O[j * 3], O[j * 3 + 1], O[j * 3 + 2]];
      a = lineLight(P, F, 4) * Math.min(1, (11 - Math.hypot(x + 0.5 - END[0], y + 0.5 - END[1])) / 3);
      part = "floor";
    } else {
      const n = nearest(x + 0.5, y + 0.5);
      part = n.sg.part;
      const { halfWidth, sides } = PARTS[part];
      if (Math.abs(n.d) > halfWidth || n.s < -4 || n.s > ROUTE_LEN + 2) continue;
      if (sides.length === 2) {
        const t = (n.d / halfWidth + 1) / 2;
        const f0 = surface(n, -1, part);
        const f1 = surface(n, 1, part);
        F = f0.map((v, c) => v * (1 - t) + f1[c] * t);
      } else F = surface(n, sides[0], part);
      const taper = Math.min(1, (n.s + 4) / 4, (ROUTE_LEN + 2 - n.s) / 4) * Math.min(1, (halfWidth - Math.abs(n.d)) / Math.min(3, halfWidth));
      a = lineLight(P, F) * taper * (1 - M);
    }
    if (a <= 0.004) continue;
    const out = dims[part];
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(Math.min(255, Math.max(0, F[c] + LINE_KEEP * (P[c] - F[c]))));
    out[i * 4 + 3] = Math.round(a * 255);
  }
png(join(ACT, "playground-line-dim-a.png"), dims.platform);
png(join(ACT, "playground-line-dim-b.png"), dims.floor);
console.log(`route length ${ROUTE_LEN.toFixed(1)} px (platform part ${segs[BEND - 1].s0 + segs[BEND - 1].len - 0} px to the rim step)`);

// ---------------------------------------------------------------------------
// Review sheets (3x crops, nearest neighbour): outline, cut-out, backdrop,
// the lifted composite, and the connection: plate / traced route / unpowered.
if (PREVIEW) {
  const LIFT = Number(process.env.LIFT ?? 18);
  const crop = { x: 1040, y: 336, w: 350, h: 230 };
  const K = 3;
  const sheet = (name, fn, c = crop, k = K) => {
    const w = c.w * k;
    const h = c.h * k;
    const out = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = fn(c.x + Math.floor(x / k), c.y + Math.floor(y / k), x, y);
        out.set(v.map((q) => Math.min(255, Math.max(0, Math.round(q)))), (y * w + x) * 3);
      }
    png(join(PREVIEW, name), out, w, h, 3);
  };
  const plate = (x, y) => [O[(y * W + x) * 3], O[(y * W + x) * 3 + 1], O[(y * W + x) * 3 + 2]];
  const under = (x, y) => {
    const i = y * W + x;
    const p = p8[i] / 255;
    return [0, 1, 2].map((c) => recon[i * 3 + c] * p + O[i * 3 + c] * (1 - p));
  };
  sheet("1-outline.png", (x, y) => {
    const a = alpha8[y * W + x];
    return a > 64 && a < 192 ? [60, 255, 230] : plate(x, y);
  });
  sheet("2-station.png", (x, y) => {
    const i = y * W + x;
    const a = alpha8[i] / 255;
    const ch = ((x >> 3) + (y >> 3)) % 2 ? 70 : 40;
    return [0, 1, 2].map((c) => station[i * 3 + c] * a + ch * (1 - a));
  });
  sheet("3-backdrop.png", under);
  // The gap under the base at 4x, with the shadow off / at half / full.
  for (const k of [0, 0.5, 1])
    sheet(`7-gap-${LIFT}-shadow-${k}.png`, (x, y) => {
      const i = y * W + x;
      const sh = shadow[i] * SHADOW_OPACITY * k;
      const base = under(x, y).map((v) => v * (1 - sh));
      const j = (y + LIFT) * W + x;
      const al = alpha8[j] / 255;
      return base.map((v, c) => station[j * 3 + c] * al + v * (1 - al));
    }, { x: 1050, y: 500, w: 330, h: 62 }, 3);
  const SO = Number(process.env.SHADOW_OP ?? SHADOW_OPACITY);
  const withUnder = (x, y, lift, k = 1) => {
    const i = y * W + x;
    let v = under(x, y).map((q) => q * (1 - shadow[i] * SO * k));
    v = v.map((q) => q * (1 - soft[i] * SOFT_OPACITY * k));
    const g = gap[i] * GAP_OPACITY * k;
    v = v.map((q, c) => q * (1 - g) + GAP_RGB[c] * g);
    const ys = y + lift;
    if (ys >= H) return v;
    const j = ys * W + x;
    const al = alpha8[j] / 255;
    return v.map((q, c) => station[j * 3 + c] * al + q * (1 - al));
  };
  for (const L of [6, 12, LIFT]) sheet(`8-under-${L}.png`, (x, y) => withUnder(x, y, L, L / LIFT), { x: 1050, y: 500, w: 330, h: 62 }, 3);
  sheet(`9-lifted-under-${LIFT}.png`, (x, y) => withUnder(x, y, LIFT));
  sheet(`4-lifted-${LIFT}.png`, (x, y) => {
    const i = y * W + x;
    const s = shadow[i] * SHADOW_OPACITY;
    const base = under(x, y).map((v) => v * (1 - s));
    const ys = y + LIFT;
    if (ys >= H) return base;
    const j = ys * W + x;
    const a = alpha8[j] / 255;
    return base.map((v, c) => station[j * 3 + c] * a + v * (1 - a));
  });
  const lineCrop = { x: 880, y: 522, w: 220, h: 62 };
  const withDims = (x, y) => {
    let v = plate(x, y);
    for (const part of ["platform", "floor"]) {
      const i = y * W + x;
      const a = dims[part][i * 4 + 3] / 255;
      v = v.map((q, c) => dims[part][i * 4 + c] * a + q * (1 - a));
    }
    return v;
  };
  sheet("5-route.png", (x, y, px, py) => {
    // The traced route drawn over the plate (cyan), the core mask (red tint).
    const n = nearest((px + 0.5) / 5 + lineCrop.x, (py + 0.5) / 5 + lineCrop.y);
    const i = y * W + x;
    const m = rcore[i * 4 + 3] / 255;
    const base = plate(x, y).map((q, c) => q * (1 - 0.5 * m) + [255, 0, 60][c] * 0.5 * m);
    return n.dist < 0.25 && n.s >= 0 && n.s <= ROUTE_LEN ? [60, 255, 230] : base;
  }, lineCrop, 5);
  sheet("6-unpowered.png", withDims, lineCrop, 5);
}
