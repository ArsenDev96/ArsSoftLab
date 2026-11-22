#!/usr/bin/env node
// M1.3H (experimental): Playground as a proper 2.5D layered composition.
//
// The M1.3E.1-E.3 layers (make-playground-layer.mjs) rebuild only a narrow
// strip under the base, by mirroring the floor below the contact line, and
// smooth-fill everything else. This builds a *clean background* instead: the
// whole area the station covers is re-synthesised from the surrounding room
// with multi-scale PatchMatch image completion (Wexler et al. 2007 / Barnes
// et al. 2009 — the method behind "content-aware fill"). Every filled pixel
// is copied from real plate texture: nothing is mirrored, blurred or painted.
//
//   - Perspective: a patch may only come from roughly the same depth (row
//     band), so floor texture keeps its scale and lighting.
//   - Lighting: an anisotropic low-frequency guide (the room's brightness
//     carried in from left and right) steers patch choice, so no bright or
//     dark patches land out of place.
//   - Sources: glows, lamps, the connection line, strip reflections, the
//     station's own neon spill and the Experience panel are never copied.
//
// Then the station is re-matted over that background:
//   - inside: plate colour, alpha 1;
//   - edge (soft 1.2 px): the colour is the nearest interior colour (no
//     background contamination, so no halo when it lifts); the background
//     under the edge is solved so station-over-background reproduces the
//     plate exactly at rest. Where that is impossible, the colour is solved
//     instead (old method).
//
// Writes (full frame 1672 x 941, transparent outside the pinned box; the
// shipping M1.3E layers are not touched):
//   public/scene/layers/playground-v2-background.png  clean background (hole only)
//   public/scene/layers/playground-v2.png             the station (moves)
//   public/scene/layers/playground-v2-shadow.png      contact shadow (static)
//
// Usage: node scripts/make-playground-layered.mjs [--preview <dir>]

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

/** Same outline as make-playground-layer.mjs (M1.3E.1), reference px. */
const SILHOUETTE = [
  [1126, 352], [1129, 346.5], [1208, 345.5], [1213.5, 349.5], [1215, 373.5],
  [1244, 373.5], [1268.5, 374.5], [1271, 378], [1271, 437],
  [1277, 437], [1299.5, 436.5], [1302, 440], [1302.5, 456],
  [1316, 456.5], [1326, 461], [1331, 467], [1336, 462.5], [1343, 463], [1350, 470], [1351, 480],
  [1358, 483.5], [1363.5, 487], [1365, 500.5], [1372.5, 501.5], [1375.5, 505], [1375.5, 536.5],
  [1373, 541], [1364, 543], [1350, 544.3], [1330, 545.3], [1300, 546.2], [1270, 546.5], [1240, 546.4],
  [1210, 546.1], [1180, 545.4], [1150, 544.2], [1125, 542.3], [1105, 540], [1093, 537.6],
  [1086, 536], [1078, 533.6], [1070, 531.2], [1063, 529], [1061.5, 524], [1061.5, 500],
  [1063.5, 496], [1072, 493.5], [1081, 491.5], [1083, 484],
  [1085.5, 482], [1085.5, 456], [1088, 452.5], [1106, 451.5], [1115, 447],
  [1117, 441], [1136.5, 391], [1127.5, 375.5],
];
const EDGE_IN = 1.2;
const EDGE_OUT = 1.2;
/** Pinned layer box (STATION_LAYERS.playground.box). */
const BOX = { x: 1055, y: 334, w: 327, h: 222 };
/** Working crop: the hole plus the room around it that may serve as source. */
const CROP = { x: 930, y: 280, w: 580, h: 340 };
/** The Experience station's code panel, right of the base: never a source. */
const EXCLUDE_RECTS = [
  { x: 1384, y: 500, w: 200, h: 200 },
  // the lit block and lamp base left of the station
  { x: 930, y: 380, w: 72, h: 118 },
];
/**
 * Where the floor meets the back step behind the station (it slants a little
 * with the room): floor pixels are only ever filled from floor, wall from wall.
 */
const floorY = (x) => 432 + ((x - 1060) * 18) / 320;
/**
 * Floor patches may come from this many rows nearer or further. The floor at
 * the same depth as the gap is visible only left of the platform (with a
 * window reflection on it), so the floor just in front of the base, ~20-40 px
 * nearer, must be allowed too; the change in perspective is negligible.
 */
const DY_FLOOR = 40;
const DY_WALL = 34;
const DX_MAX = 330;
const PATCH_R = 3; // 7 x 7
/** How far (px) the boundary tone correction reaches into the fill. */
const SEAM_DECAY = 4;
const GUIDE_W = 0.25;
/** Cost per extra use of the same source patch (per pixel, squared 8-bit units). */
const OCC_W = 40;
/** A pixel this much above its surroundings (luminance) is a highlight: never copied. */
const BRIGHT_T = 12;
/** ... or this much above its 2 px neighbourhood (thin streaks and rims). */
const LINE_T = 8;
/** Never-copied pixels this close to the station: its own neon spill and contact shading. */
const RING = 6;
/** Max change (per channel) the exact-rest edge solve may make to the synthesised background. */
const EDGE_BG_TOL = 24;
/** Max rest error (per channel) accepted from the alpha fit before solving the colour exactly. */
const EDGE_FIT_TOL = 6;
/** Contact shadow under the lifted base: at the contact line, deepest, depth of the ramp (px). */
const SHADOW = { edge: 0.16, deep: 0.5, ramp: 16, reach: 26, spill: 1.3, taper: 10 };

// ---------------------------------------------------------------------------
// Decode (Chrome) / encode (PNG, here). Same as make-playground-layer.mjs.

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
/** Soft silhouette alpha (4 x 4 supersampled signed distance). */
function silhouette(poly) {
  const M = new Float32Array(W * H);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)) - 3; y <= Math.ceil(Math.max(...ys)) + 3; y++)
    for (let x = Math.floor(Math.min(...xs)) - 3; x <= Math.ceil(Math.max(...xs)) + 3; x++) {
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
// Small image helpers on a crop (w x h), float RGB interleaved.

function dilate(mask, w, h, r) {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w && mask[y * w + xx]) v = 1;
      }
      tmp[y * w + x] = v;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h && tmp[yy * w + x]) v = 1;
      }
      out[y * w + x] = v;
    }
  return out;
}
const kernel = (s) => {
  const r = Math.ceil(s * 3);
  const k = new Float32Array(2 * r + 1);
  for (let i = -r; i <= r; i++) k[i + r] = Math.exp((-i * i) / (2 * s * s));
  return { k, r };
};
/** Normalised (masked) anisotropic Gaussian of an RGB image: weight w (0..1) per pixel. */
function normConv(img, wgt, w, h, sx, sy) {
  const kx = kernel(sx);
  const ky = kernel(sy);
  const tmp = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let i = -kx.r; i <= kx.r; i++) {
        const xx = x + i;
        if (xx < 0 || xx >= w) continue;
        const j = y * w + xx;
        const f = kx.k[i + kx.r] * wgt[j];
        if (!f) continue;
        a += f;
        r += f * img[j * 3];
        g += f * img[j * 3 + 1];
        b += f * img[j * 3 + 2];
      }
      const o = (y * w + x) * 4;
      tmp[o] = r;
      tmp[o + 1] = g;
      tmp[o + 2] = b;
      tmp[o + 3] = a;
    }
  const out = new Float32Array(w * h * 3);
  const wout = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0, r = 0, g = 0, b = 0;
      for (let i = -ky.r; i <= ky.r; i++) {
        const yy = y + i;
        if (yy < 0 || yy >= h) continue;
        const o = (yy * w + x) * 4;
        const f = ky.k[i + ky.r];
        r += f * tmp[o];
        g += f * tmp[o + 1];
        b += f * tmp[o + 2];
        a += f * tmp[o + 3];
      }
      const j = y * w + x;
      wout[j] = a;
      if (a > 1e-6) {
        out[j * 3] = r / a;
        out[j * 3 + 1] = g / a;
        out[j * 3 + 2] = b / a;
      }
    }
  return { out, wout };
}
const lum3 = (img, j) => 0.299 * img[j * 3] + 0.587 * img[j * 3 + 1] + 0.114 * img[j * 3 + 2];

/** Seeded uniform random (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. Plate and masks.

const [P8] = await decodeAll(["public/scene/lab-plate.webp"]);
const plate = new Float32Array(W * H * 3);
for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) plate[i * 3 + c] = P8[i * 4 + c];
const M = silhouette(SILHOUETTE);

const cw = CROP.w;
const ch = CROP.h;
const toCrop = (x, y) => (y - CROP.y) * cw + (x - CROP.x);
const img0 = new Float32Array(cw * ch * 3);
const hole0 = new Uint8Array(cw * ch);
for (let y = 0; y < ch; y++)
  for (let x = 0; x < cw; x++) {
    const i = (y + CROP.y) * W + x + CROP.x;
    const j = y * cw + x;
    for (let c = 0; c < 3; c++) img0[j * 3 + c] = plate[i * 3 + c];
    hole0[j] = M[i] > 0 ? 1 : 0;
  }

// Bright features (lamps, the line, strip reflections, glints): anything well
// above its surroundings, or simply bright. Never copied, never in the guide.
const known = Float32Array.from(hole0, (h) => (h ? 0 : 1));
const coarse = normConv(img0, known, cw, ch, 8, 8).out;
const bright = new Uint8Array(cw * ch);
for (let j = 0; j < cw * ch; j++) {
  if (hole0[j]) continue;
  const l = lum3(img0, j);
  const warm = img0[j * 3] - img0[j * 3 + 2];
  if (l - lum3(coarse, j) > BRIGHT_T || l > 150 || (warm > 70 && l > 70)) bright[j] = 1;
}
// Thin highlights (floor reflection streaks, rims) are as unwanted under the
// platform as big ones: anything clearly above its 2 px neighbourhood.
{
  const fine = normConv(img0, known, cw, ch, 2, 2).out;
  const thin = new Uint8Array(cw * ch);
  for (let j = 0; j < cw * ch; j++) if (!hole0[j] && lum3(img0, j) - lum3(fine, j) > LINE_T) thin[j] = 1;
  const t2 = dilate(thin, cw, ch, 1);
  for (let j = 0; j < cw * ch; j++) if (t2[j]) bright[j] = 1;
}
const nearStation = dilate(hole0, cw, ch, RING);
const excluded = dilate(bright, cw, ch, 2);
for (let j = 0; j < cw * ch; j++) if (nearStation[j] && !hole0[j]) excluded[j] = 1;
for (const r of EXCLUDE_RECTS)
  for (let y = Math.max(r.y, CROP.y); y < Math.min(r.y + r.h, CROP.y + ch); y++)
    for (let x = Math.max(r.x, CROP.x); x < Math.min(r.x + r.w, CROP.x + cw); x++) excluded[toCrop(x, y)] = 1;

// Low-frequency guide: the room's own brightness, carried into the hole as a
// smooth membrane (Laplace) from the clean pixels around it. Nearby boundary
// wins, so rows at the contact line follow the floor right in front of them.
const clean = new Float32Array(cw * ch);
for (let j = 0; j < cw * ch; j++) clean[j] = hole0[j] || excluded[j] ? 0 : 1;
const lp = normConv(img0, clean, cw, ch, 4, 4);
const lowpass = lp.out;
const guide0 = Float32Array.from(lowpass);
{
  const unknown = new Uint8Array(cw * ch);
  for (let j = 0; j < cw * ch; j++) unknown[j] = hole0[j] || nearStation[j] || lp.wout[j] < 0.05 ? 1 : 0;
  const init = normConv(img0, clean, cw, ch, 60, 60).out;
  for (let j = 0; j < cw * ch; j++) if (unknown[j]) for (let c = 0; c < 3; c++) guide0[j * 3 + c] = init[j * 3 + c];
  const list = [];
  for (let j = 0; j < cw * ch; j++) if (unknown[j]) list.push(j);
  for (let it = 0; it < 2500; it++)
    for (const j of list) {
      const x = j % cw;
      const y = (j / cw) | 0;
      for (let c = 0; c < 3; c++) {
        let s = 0, n = 0;
        if (x > 0) { s += guide0[(j - 1) * 3 + c]; n++; }
        if (x < cw - 1) { s += guide0[(j + 1) * 3 + c]; n++; }
        if (y > 0) { s += guide0[(j - cw) * 3 + c]; n++; }
        if (y < ch - 1) { s += guide0[(j + cw) * 3 + c]; n++; }
        const v = guide0[j * 3 + c];
        guide0[j * 3 + c] = v + 1.9 * (s / n - v);
      }
    }
}

// ---------------------------------------------------------------------------
// 2. Multi-scale PatchMatch completion.

function down(level) {
  const { w, h, img, hole, excl, guide, low } = level;
  const w2 = Math.ceil(w / 2);
  const h2 = Math.ceil(h / 2);
  const o = { w: w2, h: h2, img: new Float32Array(w2 * h2 * 3), hole: new Uint8Array(w2 * h2), excl: new Uint8Array(w2 * h2), guide: new Float32Array(w2 * h2 * 3), low: new Float32Array(w2 * h2 * 3) };
  for (let y = 0; y < h2; y++)
    for (let x = 0; x < w2; x++) {
      const j2 = y * w2 + x;
      let n = 0, nk = 0;
      const acc = [0, 0, 0], g = [0, 0, 0], l = [0, 0, 0];
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const xx = 2 * x + dx;
          const yy = 2 * y + dy;
          if (xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          n++;
          if (hole[j]) o.hole[j2] = 1;
          if (excl[j]) o.excl[j2] = 1;
          for (let c = 0; c < 3; c++) {
            g[c] += guide[j * 3 + c];
            l[c] += low[j * 3 + c];
          }
          if (!hole[j]) {
            nk++;
            for (let c = 0; c < 3; c++) acc[c] += img[j * 3 + c];
          }
        }
      for (let c = 0; c < 3; c++) {
        o.img[j2 * 3 + c] = nk ? acc[c] / nk : g[c] / n;
        o.guide[j2 * 3 + c] = g[c] / n;
        o.low[j2 * 3 + c] = l[c] / n;
      }
    }
  return o;
}

const levels = [{ w: cw, h: ch, img: Float32Array.from(img0), hole: hole0, excl: excluded, guide: guide0, low: lowpass }];
while (levels.length < 4) levels.push(down(levels[levels.length - 1]));

const R = PATCH_R;
const PN = (2 * R + 1) ** 2;
const random = rng(1307);

function complete(L, scale, nnfIn, emIters, pmIters, sharpen) {
  const { w, h, img, hole, excl, guide, low } = L;
  // Valid source centres: whole patch inside, no hole, no excluded pixel.
  const valid = new Uint8Array(w * h);
  const bad = new Uint8Array(w * h);
  for (let j = 0; j < w * h; j++) bad[j] = hole[j] || excl[j] ? 1 : 0;
  const badD = dilate(bad, w, h, R);
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) valid[y * w + x] = badD[y * w + x] ? 0 : 1;
  const byRow = Array.from({ length: h }, () => []);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (valid[y * w + x]) byRow[y].push(x);
  // Targets: every patch centre that overlaps the hole.
  const tmask = dilate(hole, w, h, R);
  const targets = [];
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) if (tmask[y * w + x]) targets.push(y * w + x);
  // Region of a patch centre: 1 = floor, 0 = wall, -1 = straddles the line
  // (never a source; as a target it may take either).
  const region = (x, y) => {
    const fx = floorY(x * scale + CROP.x) - CROP.y;
    const top = (y - R) * scale;
    const bot = (y + R + 1) * scale;
    return top >= fx ? 1 : bot <= fx ? 0 : -1;
  };
  const isFloor = (tx, ty) => (ty * scale) >= floorY(tx * scale + CROP.x) - CROP.y;
  const dyMax = (tx, ty) => Math.max(2, Math.round((isFloor(tx, ty) ? DY_FLOOR : DY_WALL) / scale));
  const dxMax = Math.round(DX_MAX / scale);
  const ok = (tx, ty, sx, sy) => {
    if (sx < 0 || sy < 0 || sx >= w || sy >= h || !valid[sy * w + sx]) return false;
    if (Math.abs(sy - ty) > dyMax(tx, ty) || Math.abs(sx - tx) > dxMax) return false;
    const rs = region(sx, sy);
    return rs >= 0 && rs === (isFloor(tx, ty) ? 1 : 0);
  };

  // Known pixels that are never copied (highlights, the station's own spill,
  // other stations) are not matched against either: the fill must not
  // continue them into the hole.
  const ign = new Uint8Array(w * h);
  for (let j = 0; j < w * h; j++) ign[j] = excl[j] && !hole[j] ? 1 : 0;
  const tw = new Float32Array(w * h);
  for (let y = R; y < h - R; y++)
    for (let x = R; x < w - R; x++) {
      let n = 0;
      for (let v = -R; v <= R; v++) for (let u = -R; u <= R; u++) n += ign[(y + v) * w + x + u] ? 0 : 1;
      tw[y * w + x] = n ? PN / n : 0;
    }
  const dist = (tx, ty, sx, sy, cut) => {
    let d = 0;
    const k = tw[ty * w + tx];
    for (let v = -R; v <= R; v++) {
      const rt = (ty + v) * w;
      const rs = (sy + v) * w;
      for (let u = -R; u <= R; u++) {
        if (ign[rt + tx + u]) continue;
        const a = (rt + tx + u) * 3;
        const b = (rs + sx + u) * 3;
        const e0 = img[a] - img[b];
        const e1 = img[a + 1] - img[b + 1];
        const e2 = img[a + 2] - img[b + 2];
        d += (e0 * e0 + e1 * e1 + e2 * e2) * k;
      }
      if (d > cut) return d;
    }
    const a = (ty * w + tx) * 3;
    const b = (sy * w + sx) * 3;
    const g0 = guide[a] - low[b];
    const g1 = guide[a + 1] - low[b + 1];
    const g2 = guide[a + 2] - low[b + 2];
    return d + GUIDE_W * PN * (g0 * g0 + g1 * g1 + g2 * g2) + OCC_W * PN * use[sy * w + sx];
  };
  // How many targets currently copy each source patch: re-using one patch
  // across many targets is what makes flat bars and repeats, so it costs.
  const use = new Float32Array(w * h);
  const countUse = () => {
    use.fill(0);
    for (const t of targets) use[ny[t] * w + nx[t]]++;
  };
  const randomSource = (tx, ty) => {
    for (let k = 0; k < 200; k++) {
      const sy = Math.round(ty + (random() * 2 - 1) * dyMax(tx, ty));
      if (sy < 0 || sy >= h || !byRow[sy].length) continue;
      const row = byRow[sy];
      const sx = row[Math.floor(random() * row.length)];
      if (ok(tx, ty, sx, sy)) return [sx, sy];
    }
    // Fallback: nearest valid anywhere by row.
    for (let r = 0; r < h; r++)
      for (const sy of [ty - r, ty + r]) {
        if (sy < 0 || sy >= h) continue;
        for (const sx of byRow[sy]) if (Math.abs(sx - tx) <= dxMax && region(sx, sy) === (isFloor(tx, ty) ? 1 : 0)) return [sx, sy];
      }
    throw new Error("no source");
  };

  const nx = new Int32Array(w * h);
  const ny = new Int32Array(w * h);
  const nd = new Float64Array(w * h);
  for (const t of targets) {
    const tx = t % w;
    const ty = (t / w) | 0;
    let s = nnfIn ? nnfIn(tx, ty) : null;
    if (!s || !ok(tx, ty, s[0], s[1])) s = randomSource(tx, ty);
    nx[t] = s[0];
    ny[t] = s[1];
  }
  const isT = new Uint8Array(w * h);
  for (const t of targets) isT[t] = 1;

  const vote = (sharp) => {
    const ds = [];
    for (const t of targets) ds.push(nd[t]);
    ds.sort((a, b) => a - b);
    const s2 = Math.max(1, ds[Math.floor(ds.length * (sharp ? 0.4 : 0.75))]) / (sharp ? 4 : 1);
    const acc = new Float64Array(w * h * 4);
    for (const t of targets) {
      const tx = t % w;
      const ty = (t / w) | 0;
      const wgt = Math.exp(-nd[t] / (2 * s2)) + 1e-12;
      for (let v = -R; v <= R; v++)
        for (let u = -R; u <= R; u++) {
          const p = (ty + v) * w + tx + u;
          if (!hole[p]) continue;
          const q = ((ny[t] + v) * w + nx[t] + u) * 3;
          acc[p * 4] += wgt * img[q];
          acc[p * 4 + 1] += wgt * img[q + 1];
          acc[p * 4 + 2] += wgt * img[q + 2];
          acc[p * 4 + 3] += wgt;
        }
    }
    for (let p = 0; p < w * h; p++) {
      if (!hole[p] || !acc[p * 4 + 3]) continue;
      for (let c = 0; c < 3; c++) img[p * 3 + c] = acc[p * 4 + c] / acc[p * 4 + 3];
    }
    if (sharp) {
      // Final pass: every pixel is the centre of its own best patch, copied
      // as is (no averaging of overlapping patches, so no softening).
      const out = Float32Array.from(img);
      for (const t of targets) {
        if (!hole[t]) continue;
        const q = (ny[t] * w + nx[t]) * 3;
        for (let c = 0; c < 3; c++) out[t * 3 + c] = img[q + c];
      }
      img.set(out);
    }
  };

  for (let em = 0; em < emIters; em++) {
    countUse();
    for (const t of targets) nd[t] = dist(t % w, (t / w) | 0, nx[t], ny[t], Infinity);
    for (let it = 0; it < pmIters; it++) {
      const fwd = it % 2 === 0;
      const order = fwd ? targets : [...targets].reverse();
      const e = fwd ? 1 : -1;
      for (const t of order) {
        const tx = t % w;
        const ty = (t / w) | 0;
        const tryS = (sx, sy) => {
          if (!ok(tx, ty, sx, sy)) return;
          const d = dist(tx, ty, sx, sy, nd[t]);
          if (d < nd[t]) {
            nd[t] = d;
            nx[t] = sx;
            ny[t] = sy;
          }
        };
        const left = t - e;
        if (isT[left]) tryS(nx[left] + e, ny[left]);
        const up = t - e * w;
        if (isT[up]) tryS(nx[up], ny[up] + e);
        for (let rad = Math.max(w, h); rad >= 1; rad = Math.floor(rad / 2)) {
          tryS(Math.round(nx[t] + (random() * 2 - 1) * rad), Math.round(ny[t] + (random() * 2 - 1) * rad));
        }
      }
    }
    vote(sharpen && em === emIters - 1);
  }
  return { nx, ny, w, h };
}

let nnf = null;
const t0 = Date.now();
for (let l = levels.length - 1; l >= 0; l--) {
  const L = levels[l];
  if (l === levels.length - 1) {
    for (let j = 0; j < L.w * L.h; j++) if (L.hole[j]) for (let c = 0; c < 3; c++) L.img[j * 3 + c] = L.guide[j * 3 + c];
  } else {
    // Initialise the hole from the coarser solution (nearest upsample).
    const C = levels[l + 1];
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const j = y * L.w + x;
        if (!L.hole[j]) continue;
        const k = Math.min(C.h - 1, y >> 1) * C.w + Math.min(C.w - 1, x >> 1);
        for (let c = 0; c < 3; c++) L.img[j * 3 + c] = C.img[k * 3 + c];
      }
  }
  const prev = nnf;
  const nnfIn = prev
    ? (x, y) => {
        const k = Math.min(prev.h - 1, y >> 1) * prev.w + Math.min(prev.w - 1, x >> 1);
        return [prev.nx[k] * 2 + (x & 1), prev.ny[k] * 2 + (y & 1)];
      }
    : null;
  const em = l === levels.length - 1 ? 8 : l === 0 ? 4 : 5;
  nnf = complete(L, 2 ** l, nnfIn, em, l === 0 ? 4 : 5, l === 0);
  console.log(`level ${l} (${L.w}x${L.h}) done, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
const filled = levels[0].img;

// Seamless boundary: a fill pixel next to the plate should continue the
// plate's tone there. The difference at the boundary is spread inward by a
// screened Poisson solve that decays within a few px (SEAM_DECAY), so only
// the tone right at the edge shifts; the copied texture is untouched. Plate
// neighbours that are highlights (strip reflections, glints) do not count.
{
  const corr = new Float32Array(cw * ch * 3);
  const fixed = new Uint8Array(cw * ch);
  for (let y = 1; y < ch - 1; y++)
    for (let x = 1; x < cw - 1; x++) {
      const j = y * cw + x;
      if (!hole0[j]) continue;
      const acc = [0, 0, 0];
      let n = 0;
      for (const k of [j - 1, j + 1, j - cw, j + cw]) {
        if (hole0[k] || bright[k]) continue;
        n++;
        for (let c = 0; c < 3; c++) acc[c] += img0[k * 3 + c];
      }
      if (!n) continue;
      fixed[j] = 1;
      for (let c = 0; c < 3; c++) corr[j * 3 + c] = acc[c] / n - filled[j * 3 + c];
    }
  const screen = 1 / (SEAM_DECAY * SEAM_DECAY);
  const list = [];
  for (let j = 0; j < cw * ch; j++) if (hole0[j] && !fixed[j]) list.push(j);
  for (let it = 0; it < 300; it++)
    for (const j of list)
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (const k of [j - 1, j + 1, j - cw, j + cw]) sum += hole0[k] ? corr[k * 3 + c] : 0;
        corr[j * 3 + c] = sum / (4 + screen);
      }
  for (let j = 0; j < cw * ch; j++) if (hole0[j]) for (let c = 0; c < 3; c++) filled[j * 3 + c] += corr[j * 3 + c];
}

// ---------------------------------------------------------------------------
// 3. Background B (full frame) and the station matte.

const B = Float32Array.from(plate);
for (let y = 0; y < ch; y++)
  for (let x = 0; x < cw; x++) {
    const j = y * cw + x;
    if (!hole0[j]) continue;
    const i = (y + CROP.y) * W + x + CROP.x;
    for (let c = 0; c < 3; c++) B[i * 3 + c] = filled[j * 3 + c];
  }

const C = new Float32Array(W * H * 3);
const A = new Float32Array(W * H);
let solvedBg = 0, solvedFg = 0, solvedExact = 0;
for (let i = 0; i < W * H; i++) {
  const m = M[i];
  if (m <= 0) continue;
  if (m >= 1) {
    for (let c = 0; c < 3; c++) C[i * 3 + c] = plate[i * 3 + c];
    A[i] = 1;
    continue;
  }
  // Edge: foreground colour from the nearest fully inside pixels.
  const x = i % W;
  const y = (i / W) | 0;
  let fg = null;
  for (let r = 1; r <= 4 && !fg; r++) {
    const s = [0, 0, 0];
    let n = 0;
    for (let v = -r; v <= r; v++)
      for (let u = -r; u <= r; u++) {
        const k = (y + v) * W + x + u;
        if (M[k] >= 1) {
          n++;
          for (let c = 0; c < 3; c++) s[c] += plate[k * 3 + c];
        }
      }
    if (n) fg = s.map((v) => v / n);
  }
  fg ??= [0, 1, 2].map((c) => plate[i * 3 + c]);
  // Background under the edge so the rest composite is exact:
  // B' = (P - m F) / (1 - m). Used only where it stays close to the
  // synthesised background (otherwise it would print a speckled outline
  // into the clean background, exposed by the lift).
  const bb = fg.map((f, c) => (plate[i * 3 + c] - m * f) / (1 - m));
  if (bb.every((v, c) => v >= -0.5 && v <= 255.5 && Math.abs(v - B[i * 3 + c]) <= EDGE_BG_TOL)) {
    solvedBg++;
    for (let c = 0; c < 3; c++) {
      C[i * 3 + c] = fg[c];
      B[i * 3 + c] = Math.min(255, Math.max(0, bb[c]));
    }
    A[i] = m;
  } else {
    // Keep the synthesised background and the clean foreground colour; fit
    // alpha by least squares (a small rest error on this pixel instead of a
    // halo or a speckle).
    solvedFg++;
    let num = 0, den = 0;
    for (let c = 0; c < 3; c++) {
      const d = fg[c] - B[i * 3 + c];
      num += (plate[i * 3 + c] - B[i * 3 + c]) * d;
      den += d * d;
    }
    const a = den > 1 ? Math.min(1, Math.max(0, num / den)) : m;
    let res = 0;
    for (let c = 0; c < 3; c++) res = Math.max(res, Math.abs(a * fg[c] + (1 - a) * B[i * 3 + c] - plate[i * 3 + c]));
    if (res <= EDGE_FIT_TOL) {
      A[i] = a;
      for (let c = 0; c < 3; c++) C[i * 3 + c] = fg[c];
    } else {
      // Exact at rest: solve the colour over the synthesised background,
      // raising alpha just enough to keep it in range (the neon's own glow).
      solvedExact++;
      let e = m;
      for (let c = 0; c < 3; c++) {
        const p = plate[i * 3 + c];
        const b = B[i * 3 + c];
        if (p > b) e = Math.max(e, (p - b) / Math.max(1e-3, 255 - b));
        else if (p < b) e = Math.max(e, (b - p) / Math.max(1e-3, b));
      }
      e = Math.min(1, e);
      A[i] = e;
      for (let c = 0; c < 3; c++) C[i * 3 + c] = Math.min(255, Math.max(0, B[i * 3 + c] + (plate[i * 3 + c] - B[i * 3 + c]) / e));
    }
  }
}
console.log(`edge pixels: exact (background solved) ${solvedBg}, alpha fitted ${solvedFg - solvedExact}, colour solved ${solvedExact}`);

// ---------------------------------------------------------------------------
// 4. Contact shadow: graded under the base's bottom edge, a short spill in front.

const bottom = new Map();
let xL = Infinity, xR = -Infinity;
for (let x = BOX.x; x < BOX.x + BOX.w; x++) {
  let yb = -1;
  for (let y = BOX.y; y < BOX.y + BOX.h; y++) if (M[y * W + x] >= 0.5) yb = y;
  if (yb >= 0) {
    bottom.set(x, yb + 0.5);
    xL = Math.min(xL, x);
    xR = Math.max(xR, x);
  }
}
const shadow = new Float32Array(W * H);
const smooth = (a, b, t) => {
  const s = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return s * s * (3 - 2 * s);
};
for (const [x, yb] of bottom) {
  const taper = smooth(0, SHADOW.taper, Math.min(x - xL, xR - x));
  for (let y = Math.floor(yb - SHADOW.reach); y <= Math.ceil(yb + 4); y++) {
    const d = yb - (y + 0.5);
    const a = d >= 0 ? SHADOW.edge + (SHADOW.deep - SHADOW.edge) * smooth(0, SHADOW.ramp, d) : SHADOW.edge * Math.exp(d / SHADOW.spill);
    shadow[y * W + x] = a * taper;
  }
}

// ---------------------------------------------------------------------------
// 5. Write.

const inBox = (i) => {
  const x = i % W;
  const y = (i / W) | 0;
  return x >= BOX.x && x < BOX.x + BOX.w && y >= BOX.y && y < BOX.y + BOX.h;
};
const q8 = (v) => Math.min(255, Math.max(0, Math.round(v)));
const bgOut = new Uint8Array(W * H * 4);
const stOut = new Uint8Array(W * H * 4);
const shOut = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) {
  if (!inBox(i)) continue;
  if (M[i] > 0) {
    for (let c = 0; c < 3; c++) bgOut[i * 4 + c] = q8(B[i * 3 + c]);
    bgOut[i * 4 + 3] = 255;
  }
  const a8 = q8(A[i] * 255);
  if (a8) {
    for (let c = 0; c < 3; c++) stOut[i * 4 + c] = q8(C[i * 3 + c]);
    stOut[i * 4 + 3] = a8;
  }
  shOut[i * 4 + 3] = q8(shadow[i] * 255);
}
for (let i = 0; i < W * H; i++) if (M[i] > 0 && !inBox(i)) throw new Error("station outside the pinned box");

const LAYERS = join(ROOT, "public/scene/layers");
png(join(LAYERS, "playground-v2-background.png"), bgOut);
png(join(LAYERS, "playground-v2.png"), stOut);
png(join(LAYERS, "playground-v2-shadow.png"), shOut);

// Rest round trip, as the browser composites 8-bit layers.
{
  let max = 0, sum = 0, n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!(M[i] > 0)) continue;
    const a = stOut[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) {
      const rest = stOut[i * 4 + c] * a + (1 - a) * bgOut[i * 4 + c];
      const e = Math.abs(rest - P8[i * 4 + c]);
      max = Math.max(max, e);
      sum += e;
      n++;
    }
  }
  console.log(`rest recomposition: max ${max.toFixed(2)}, mean ${(sum / n).toFixed(3)} over ${n / 3} px`);
}

// Texture check: what the lift uncovers (up to 22 px above the contact line)
// against the real floor in front of it (8-34 px below): mean luminance and
// fine detail (mean |Laplacian|), bright features excluded.
{
  const stat = (pick) => {
    let n = 0, l = 0, d = 0;
    for (const [x, yb] of bottom)
      for (let y = BOX.y; y < H - 1; y++) {
        if (!pick(x, y, yb)) continue;
        const i = y * W + x;
        const L = (k) => 0.299 * B[k * 3] + 0.587 * B[k * 3 + 1] + 0.114 * B[k * 3 + 2];
        if (L(i) > 120) continue;
        n++;
        l += L(i);
        d += Math.abs(4 * L(i) - L(i - 1) - L(i + 1) - L(i - W) - L(i + W));
      }
    return `lum ${(l / n).toFixed(1)}, detail ${(d / n).toFixed(2)} (${n} px)`;
  };
  console.log(`uncovered band: ${stat((x, y, yb) => y + 0.5 < yb && y + 0.5 >= yb - 22 && M[y * W + x] > 0)}`);
  console.log(`floor in front:  ${stat((x, y, yb) => y + 0.5 > yb + 8 && y + 0.5 <= yb + 34)}`);
}

// ---------------------------------------------------------------------------
// 6. Preview sheets (evidence only).

if (PREVIEW) {
  mkdirSync(PREVIEW, { recursive: true });
  // Clean background: the plate with the station removed.
  const cleanFull = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) cleanFull[i * 4 + c] = M[i] > 0 ? bgOut[i * 4 + c] : P8[i * 4 + c];
    cleanFull[i * 4 + 3] = 255;
  }
  png(join(PREVIEW, "clean-background-full.png"), cleanFull);
  // The room around the station, plate and clean background (1x crops; the
  // evidence script sets them side by side).
  const REGION = { x: 990, y: 310, w: 460, h: 270 };
  const crop = (src) => {
    const out = new Uint8Array(REGION.w * REGION.h * 4);
    for (let y = 0; y < REGION.h; y++) out.set(src.subarray(((y + REGION.y) * W + REGION.x) * 4, ((y + REGION.y) * W + REGION.x + REGION.w) * 4), y * REGION.w * 4);
    for (let k = 3; k < out.length; k += 4) out[k] = 255;
    return out;
  };
  png(join(PREVIEW, "checks/crop-plate.png"), crop(P8), REGION.w, REGION.h);
  png(join(PREVIEW, "checks/crop-clean.png"), crop(cleanFull), REGION.w, REGION.h);
  // The transparent station over a checkerboard, and a diagnostic of what was
  // allowed as a source (green = hole, red = never copied).
  const cut = (src, fn) => {
    const out = new Uint8Array(BOX.w * BOX.h * 4);
    for (let y = 0; y < BOX.h; y++)
      for (let x = 0; x < BOX.w; x++) {
        const i = (y + BOX.y) * W + x + BOX.x;
        const o = (y * BOX.w + x) * 4;
        fn(i, x, y, out, o);
      }
    return out;
  };
  png(
    join(PREVIEW, "asset-station.png"),
    cut(stOut, (i, x, y, out, o) => {
      const chk = ((x >> 3) + (y >> 3)) % 2 ? 205 : 245;
      const a = stOut[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) out[o + c] = q8(stOut[i * 4 + c] * a + chk * (1 - a));
      out[o + 3] = 255;
    }),
    BOX.w,
    BOX.h,
  );
  const diag = new Uint8Array(cw * ch * 4);
  for (let j = 0; j < cw * ch; j++) {
    const g = lum3(img0, j) * 0.6;
    diag[j * 4] = q8(excluded[j] ? 120 + g : g);
    diag[j * 4 + 1] = q8(hole0[j] ? 110 + g : g);
    diag[j * 4 + 2] = q8(g);
    diag[j * 4 + 3] = 255;
  }
  png(join(PREVIEW, "checks/synthesis-sources.png"), diag, cw, ch);
}
