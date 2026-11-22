#!/usr/bin/env node
// M1.3F / M1.3F.1: the five platforms' amber light strips, unpowered at
// rest and lit by the hover energy along their own paths.
//
// The plate paints every platform strip lit. This builds, from the plate:
//
//   unpowered  the strips switched off, at full resolution:
//              - core: each strip's painted core (detected per pixel, so it
//                follows the artwork, ~1 px anti-aliased edge) is replaced by
//                a crisp unlit fixture line;
//              - halo: the strip's light on the stone / floor around it is
//                subtracted. The light is a smooth field
//                  G = blur(plate, 2.5 px) - unlit
//                (unlit: the surface without the strip, from pixels outside
//                every band), so subtracting it keeps the stone's texture
//                contrast intact. It is limited to a short distance from the
//                core, and never darkens a pixel below FLOOR of itself;
//              - floor reflections under a strip: the same, gentler.
//              Every changed pixel is written opaque with its final colour,
//              so nothing is resampled or re-blurred.
//   light      the M1.3A hover brightening, sharp: the core plus a restrained
//              halo (a few px), for the platform lights and lifted stations.
//
// Each station's strips are split into pieces that the energy runs along
// (from -> to), chained from the connection's arrival point; PlatformPower
// uncovers each piece with a front moving along it (path-following, not a
// radial reveal). The generated TS holds the pieces, their clip polygons and
// their timing.
//
// Writes:
//   public/scene/power/unpowered.png       all five platforms, at the plate's position
//   public/scene/power/unpowered-lift.png  the part on each lifted station's silhouette
//   public/scene/power/light.png           hover light mask (white, alpha)
//   public/scene/power/light-lift.png      hover light for the lifts (coloured, on the silhouette)
//   components/lab/platform-power.ts       pieces, clip polygons, fronts and timing
//
// Never touches reference/ or public/scene/lab-plate.webp.
// Usage: node scripts/make-platform-power.mjs [--preview <dir>]

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
 * Pieces of each platform's strips, traced on 3-4x crops of the plate
 * (reference px). The energy enters a piece at `from` and runs to `to`; a
 * piece starts at the arrival point, or (`after`) where the named piece ends.
 * `strips`: bands around the strip and its halo (the core inside is found
 * from the pixels); `reflections`: its floor reflection; `halo`: how far its
 * light reaches over the stone (px).
 */
const PLATFORMS = {
  educational: {
    arrival: [838.5, 459],
    pieces: [
      // The line meets the strip mid-way: the energy runs out both ways (the
      // split lies under the line, which is never covered).
      { name: "front strip (left half)", from: [838.5, 459], to: [754, 458], strips: [[[744, 447], [838.5, 447], [838.5, 471], [744, 471]]] },
      { name: "front strip (right half)", from: [838.5, 459], to: [920, 459], strips: [[[838.5, 447], [930, 447], [930, 471], [838.5, 471]]] },
      { name: "left floor-ring segment", after: 0, from: [716, 495], to: [680, 487], strips: [[[672, 480], [690, 478], [724, 485], [726, 502], [700, 504], [670, 498]]] },
      { name: "right floor-ring segment", after: 1, from: [962, 497], to: [997, 488], strips: [[[952, 487], [990, 479], [1008, 481], [1008, 499], [980, 503], [952, 502]]] },
    ],
  },
  engineering: {
    arrival: [586, 540.8],
    pieces: [
      { name: "right-edge wrap", from: [592, 531], to: [560, 525], strips: [[[556, 516], [586, 513], [600, 521], [596, 537], [578, 541], [556, 537]]] },
      { name: "front strip", after: 0, from: [467, 534], to: [361, 533], strips: [[[348, 522], [478, 522], [478, 545], [348, 545]]], reflections: [[[336, 549], [484, 549], [484, 562], [336, 562]]] },
    ],
  },
  playground: {
    arrival: [1088, 536.5],
    pieces: [
      // Its bloom covers most of the lower tier's face.
      { name: "front strip", from: [1118, 527], to: [1248, 532], halo: 22, strips: [[[1116, 504], [1250, 507], [1250, 545], [1116, 542]]], reflections: [[[1110, 546], [1234, 548], [1234, 556], [1110, 554]]] },
      { name: "right-edge segment", after: 0, from: [1342, 539], to: [1386, 534], strips: [[[1340, 524], [1384, 522], [1388, 548], [1340, 550]]] },
    ],
  },
  creative: {
    arrival: [505, 695.2],
    pieces: [
      // From the top of the wrap at the right edge, down and along the front.
      {
        name: "right-edge wrap and front strip",
        halo: 15,
        // The wrap reaches up to y ~728; the lit stone corner above it is not
        // part of the strip (its edge highlights would read as cores).
        from: [510, 726],
        to: [372, 775],
        strips: [[[370, 756], [440, 744], [478, 733], [494, 725], [503, 722], [512, 719], [522, 722], [525, 736], [511, 753], [478, 768], [430, 780], [370, 784]]],
        reflections: [[[410, 785], [478, 771], [512, 755], [521, 759], [517, 801], [410, 801]]],
      },
      { name: "left strip (behind the books)", after: 0, from: [244, 777], to: [181, 777], strips: [[[179, 766], [246, 766], [246, 788], [179, 788]]] },
    ],
  },
  experience: {
    arrival: [1212, 696.2],
    pieces: [
      // The long front strip along the base, from where it starts at the
      // stone's left end. (The broad lit disc and ring edge left of it are the
      // base catching light, not a strip: left as painted.)
      {
        name: "front strip",
        // The lit base ring under the strip reaches well below it.
        halo: 18,
        from: [1200, 722],
        to: [1418, 790],
        strips: [[[1193, 712], [1207, 712], [1232, 735], [1290, 753], [1350, 763], [1413, 769], [1422, 799], [1350, 797], [1280, 787], [1218, 771], [1193, 756]]],
        reflections: [
          [[1196, 773], [1254, 785], [1256, 820], [1196, 820]],
          [[1356, 800], [1414, 801], [1414, 818], [1356, 818]],
        ],
      },
      // The strip runs on, hidden behind the plants, to the right segment.
      { name: "right strip and right-edge tip", after: 0, from: [1568, 777], to: [1660, 758], strips: [[[1566, 764], [1628, 758], [1648, 743], [1662, 749], [1660, 783], [1620, 789], [1566, 789]]] },
    ],
  },
};
const LIFTED = { engineering: "public/scene/layers/engineering.webp", playground: "public/scene/layers/playground.png" };

/** Core: this much brighter than the unlit surface (lum), with this ramp (the anti-aliased edge). */
const CORE_T = 70;
const CORE_REL = 0.7;
const CORE_WIN = 4;
const CORE_RAMP = 22;
const CORE_ABS = 150;
const LINE_MIN = 8;
/** Unlit fixture: the surface, slightly greyed (a faint, crisp line). */
const FIXTURE = [86, 83, 80];
const FIXTURE_MIX = 0.32;
/** Halo: share of the strip's light kept at rest; default reach (px); no pixel below FLOOR of itself. */
const HALO_KEEP = 0.1;
const HALO_REACH = 12;
const FLOOR = 0.5;
const NEAR_FLOOR = 0.15;
/** Share of the removed light taken as the amber cast (per channel); the rest keeps the surface's hue. */
const CAST = 0.35;
const REFLECTION_KEEP = 0.4;
const REFLECTION_FLOOR = 0.6;
/** Hover light: restrained halo around the core (peak, sigma px). */
const LIGHT_HALO = 0.3;
const LIGHT_SIGMA = 2.2;
const LIGHT_RGB = [255, 208, 150];
const FEATHER = 3; // band edge feather (px)
const SIGMA_LIGHT = 2.5;
const SIGMA_UNLIT = 6;
const SIGMA_WIDE = 20;
/** Power front: soft edge (px along the piece), and the drain's speed relative to the spread. */
const FRONT = 10;
const DRAIN = 0.85;
/** Whole spread per station (ms after arrival), by its longest path (px). */
const spreadMs = (path) => Math.min(400, Math.max(220, 180 + 0.6 * path));

// ---------------------------------------------------------------------------
// Decode (Chrome) and encode (PNG, here): as scripts/make-playground-layer.mjs.

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
// Geometry and image helpers.

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
function bboxOf(poly, pad = 0) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { x0: Math.floor(Math.min(...xs)) - pad, y0: Math.floor(Math.min(...ys)) - pad, x1: Math.ceil(Math.max(...xs)) + pad, y1: Math.ceil(Math.max(...ys)) + pad };
}
/** Separable Gaussian blur of a float plane (edges clamped). */
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
/** Two-pass chamfer distance (px) to the nearest pixel where `seed` is set. */
function distanceTo(seed) {
  const D = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) D[i] = seed[i] ? 0 : 1e9;
  const R2 = Math.SQRT2;
  for (let y = 1; y < H; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (D[i]) D[i] = Math.min(D[i], D[i - 1] + 1, D[i - W] + 1, D[i - W - 1] + R2, D[i - W + 1] + R2);
    }
  for (let y = H - 2; y >= 0; y--)
    for (let x = W - 2; x >= 1; x--) {
      const i = y * W + x;
      if (D[i]) D[i] = Math.min(D[i], D[i + 1] + 1, D[i + W] + 1, D[i + W + 1] + R2, D[i + W - 1] + R2);
    }
  return D;
}
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Regions.

const [plate, routeCore, connGlow, routeGlow, ...lifted] = await decodeAll([
  "public/scene/lab-plate.webp",
  "public/scene/activation/playground-route.png",
  "public/scene/masks/connections-glow.png",
  "public/scene/activation/playground-route-glow.png",
  ...Object.values(LIFTED),
]);
const liftAlpha = Object.fromEntries(Object.keys(LIFTED).map((id, k) => [id, lifted[k]]));
const ids = Object.keys(PLATFORMS);

// Since M1.3G every connection has its own unpowered overlay (above this
// one), so a strip is dimmed right up to the line that feeds it (before, the
// line's core was left lit there, a bright stub at Educational's junction).
// Only Playground's traced route core is kept clear: its line overlay also
// carries the light it paints on the platform's corner.
const lineCore = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) lineCore[i] = Math.min(1, (routeCore[i * 4 + 3] / 255) * 2);

// Every band, with its owner (station, piece) and kind; feathered inside.
const KIND_STRIP = 1;
const KIND_REFLECTION = 2;
const kind = new Uint8Array(W * H);
const stationOf = new Int8Array(W * H).fill(-1);
const pieceOf = new Int8Array(W * H).fill(-1);
const reach = new Float32Array(W * H);
const inBand = new Uint8Array(W * H);
const near = new Uint8Array(W * H); // within 2 px of any band: never a source
ids.forEach((id, s) => {
  PLATFORMS[id].pieces.forEach((piece, p) => {
    for (const [k, polys] of [
      [KIND_STRIP, piece.strips],
      [KIND_REFLECTION, piece.reflections ?? []],
    ])
      for (const poly of polys) {
        const b = bboxOf(poly, 3);
        for (let y = b.y0; y <= b.y1; y++)
          for (let x = b.x0; x <= b.x1; x++) {
            const i = y * W + x;
            const inside = pointInPoly(x + 0.5, y + 0.5, poly);
            if (inside || distToPoly(x + 0.5, y + 0.5, poly) <= 2) near[i] = 1;
            if (!inside || inBand[i]) continue;
            inBand[i] = 1;
            kind[i] = k;
            stationOf[i] = s;
            pieceOf[i] = p;
            reach[i] = piece.halo ?? HALO_REACH;
          }
      }
  });
});
const outside = distanceTo(Uint8Array.from(inBand, (v) => 1 - v));
const cover = Float32Array.from(outside, (d, i) => (inBand[i] ? Math.min(1, (d - 0.5) / FEATHER) : 0));

// ---------------------------------------------------------------------------
// Light estimate.

const P = [0, 1, 2].map((c) => Float32Array.from({ length: W * H }, (_, i) => plate[i * 4 + c]));
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const src = new Float32Array(W * H);
// The lines' glow is not the unlit surface either (it would read as "already dark").
for (let i = 0; i < W * H; i++) src[i] = !near[i] && lineCore[i] < 0.05 && Math.max(connGlow[i * 4 + 3], routeGlow[i * 4 + 3]) < 13 ? 1 : 0;
const wFine = gauss(src, SIGMA_UNLIT);
const wWide = gauss(src, SIGMA_WIDE);
const unlit = P.map((ch) => {
  const masked = Float32Array.from(ch, (v, i) => v * src[i]);
  const fine = gauss(masked, SIGMA_UNLIT);
  const wide = gauss(masked, SIGMA_WIDE);
  return Float32Array.from(fine, (v, i) => {
    const coarse = wWide[i] > 1e-6 ? wide[i] / wWide[i] : ch[i];
    const w = kind[i] === KIND_REFLECTION ? 0 : Math.min(1, wFine[i] / 0.05);
    return w > 0 ? w * (v / Math.max(wFine[i], 1e-9)) + (1 - w) * coarse : coarse;
  });
});
const lit = P.map((ch) => gauss(ch, SIGMA_LIGHT));

// Core: the strip's painted core, per pixel, off the lines. It must be well
// above the unlit surface *and* close to the brightest pixel around it, so
// the bright inner bloom beside the core is halo, not core.
const L = Float32Array.from({ length: W * H }, (_, i) => lum(P[0][i], P[1][i], P[2][i]));
const core = new Float32Array(W * H);
for (let y = 4; y < H - 4; y++)
  for (let x = 4; x < W - 4; x++) {
    const i = y * W + x;
    if (kind[i] !== KIND_STRIP) continue;
    let peak = 0;
    let low = 255;
    for (let dy = -CORE_WIN; dy <= CORE_WIN; dy++)
      for (let dx = -CORE_WIN; dx <= CORE_WIN; dx++) {
        peak = Math.max(peak, L[i + dy * W + dx]);
        low = Math.min(low, L[i + dy * W + dx]);
      }
    const base = lum(unlit[0][i], unlit[1][i], unlit[2][i]);
    const t = base + Math.max(CORE_T, CORE_REL * (peak - base));
    // A strip core is narrow: it falls off to well below itself within the
    // window. A broad lit surface (a ring's top) is halo, never core.
    const narrow = Math.min(1, Math.max(0, ((L[i] - low) / Math.max(1, L[i] - base) - 0.45) / 0.15));
    // ... and near-white: lit stone texture, however narrow, is never a core.
    const hot = Math.min(1, Math.max(0, (L[i] - CORE_ABS) / 20));
    core[i] = Math.min(1, Math.max(0, (L[i] - t) / CORE_RAMP + 0.5)) * narrow * hot * (1 - lineCore[i]) * cover[i];
  }
// A strip core is a line: it runs on through a 9 x 9 window (>= LINE_MIN
// core pixels), where a highlight on the stone is a small blob.
{
  const solid = Uint8Array.from(core, (v) => (v >= 0.5 ? 1 : 0));
  for (let y = 4; y < H - 4; y++)
    for (let x = 4; x < W - 4; x++) {
      const i = y * W + x;
      if (!core[i]) continue;
      let n = 0;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) n += solid[(y + dy) * W + x + dx];
      if (n < LINE_MIN) core[i] = 0;
    }
}
const fromCore = distanceTo(Uint8Array.from(core, (v) => (v >= 0.5 ? 1 : 0)));

// ---------------------------------------------------------------------------
// Unpowered overlay and hover light.

const all = new Uint8Array(W * H * 4);
const lift = new Uint8Array(W * H * 4);
const light = new Uint8Array(W * H * 4);
const liftLight = new Uint8Array(W * H * 4);
let changed = 0;
for (let i = 0; i < W * H; i++) {
  if (!inBand[i]) continue;
  const id = ids[stationOf[i]];
  const M = liftAlpha[id] ? liftAlpha[id][i * 4 + 3] / 255 : 0;
  const keepLine = 1 - lineCore[i];
  // The strip's light here, mostly as a brightness change (the surface keeps
  // its warm hue), partly as the amber cast itself.
  const lumP = Math.max(1, lum(P[0][i], P[1][i], P[2][i]));
  const gLum = Math.max(0, lum(lit[0][i], lit[1][i], lit[2][i]) - lum(unlit[0][i], unlit[1][i], unlit[2][i]));
  const blurred = (c) => (1 - CAST) * gLum * (P[c][i] / lumP) + CAST * Math.max(0, lit[c][i] - unlit[c][i]);
  // Within a few px of a core the blur underestimates the sharp glow at its
  // edge (a pale rim would remain): take the pixel's own excess there.
  const edge = kind[i] === KIND_STRIP ? smoothstep(1, 4, fromCore[i]) : 1;
  const gain = (c) => edge * blurred(c) + (1 - edge) * Math.max(0, P[c][i] - unlit[c][i]);
  let out;
  if (kind[i] === KIND_STRIP) {
    const w = (1 - smoothstep(1.5, reach[i], fromCore[i])) * cover[i] * keepLine;
    // Right beside the core it is all glow (nothing to protect); further out
    // the floor keeps the stone's texture.
    const floor = NEAR_FLOOR + (FLOOR - NEAR_FLOOR) * smoothstep(1, 5, fromCore[i]);
    const halo = [0, 1, 2].map((c) => Math.max(P[c][i] - (1 - HALO_KEEP) * w * gain(c), P[c][i] * (1 - (1 - floor) * w)));
    const fixture = [0, 1, 2].map((c) => unlit[c][i] * (1 - FIXTURE_MIX) + FIXTURE[c] * FIXTURE_MIX);
    out = halo.map((v, c) => core[i] * fixture[c] + (1 - core[i]) * v);
    // Hover light: the core, and a restrained halo just around it.
    const d = fromCore[i];
    const l = Math.max(core[i], d > 0 ? LIGHT_HALO * Math.exp(-(d * d) / (2 * LIGHT_SIGMA * LIGHT_SIGMA)) : 0) * keepLine * cover[i];
    const l8 = Math.round(Math.min(1, l) * 255);
    if (l8) {
      light.set([255, 255, 255, l8], i * 4);
      const lm = Math.round(l8 * M);
      if (lm) liftLight.set([...LIGHT_RGB, lm], i * 4);
    }
  } else {
    const w = cover[i] * keepLine;
    out = [0, 1, 2].map((c) => Math.max(P[c][i] - (1 - REFLECTION_KEEP) * w * gain(c), P[c][i] * (1 - (1 - REFLECTION_FLOOR) * w)));
  }
  const rgb = out.map((v) => Math.round(Math.min(255, Math.max(0, v))));
  if (Math.max(...rgb.map((v, c) => Math.abs(v - plate[i * 4 + c]))) < 1) continue;
  changed++;
  all.set([...rgb, 255], i * 4);
  const m8 = Math.round(M * 255);
  if (m8) lift.set([...rgb, m8], i * 4);
}
console.log(`${changed} px changed at rest`);
const OUT = join(ROOT, "public/scene/power");
png(join(OUT, "unpowered.png"), all);
png(join(OUT, "unpowered-lift.png"), lift);
png(join(OUT, "light.png"), light);
png(join(OUT, "light-lift.png"), liftLight);

// ---------------------------------------------------------------------------
// Pieces: clip polygons, fronts and timing.
//
// A piece's energy enters at `from` and runs toward `to` (direction d). A
// part (one polygon of the piece) is uncovered by a front perpendicular to
// d: in CSS, a linear-gradient mask at d's angle whose stop moves with --pw.
// Path position: the arrival point is 0; a piece's `from` lies at the
// distance from the arrival (or from the end of the piece it follows);
// position t along d past `from` is reached at path + t. Spread speed is
// set per station so its longest path takes spreadMs; the drain runs back
// the other way (farthest first), DRAIN times as long.

const round = (n, k = 2) => +n.toFixed(k);
const pieceSpec = {};
for (const id of ids) {
  const { arrival, pieces } = PLATFORMS[id];
  const path = [];
  pieces.forEach((pc, p) => {
    const len = Math.hypot(pc.to[0] - pc.from[0], pc.to[1] - pc.from[1]);
    if (pc.after === undefined) path[p] = Math.hypot(pc.from[0] - arrival[0], pc.from[1] - arrival[1]);
    else {
      const prev = pieces[pc.after];
      path[p] = path[pc.after] + Math.hypot(prev.to[0] - prev.from[0], prev.to[1] - prev.from[1]) + Math.hypot(pc.from[0] - prev.to[0], pc.from[1] - prev.to[1]);
    }
    pc.len = len;
  });
  const parts = [];
  pieces.forEach((pc, p) => {
    const d = [(pc.to[0] - pc.from[0]) / pc.len, (pc.to[1] - pc.from[1]) / pc.len];
    for (const [k, polys] of [
      ["strip", pc.strips],
      ["reflection", pc.reflections ?? []],
    ])
      for (const poly of polys) {
        const b = bboxOf(poly, 1);
        const box = { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
        const proj = poly.map(([x, y]) => (x - pc.from[0]) * d[0] + (y - pc.from[1]) * d[1]);
        const m = Math.min(...proj) - 1;
        const M = Math.max(...proj) + FRONT + 1;
        // CSS linear-gradient at angle a: the gradient line passes through
        // the box centre, length |w sin a| + |h cos a|, starting at S.
        const angle = (Math.atan2(d[0], -d[1]) * 180) / Math.PI;
        const glen = Math.abs(box.w * d[0]) + Math.abs(box.h * d[1]);
        const S = [box.x + box.w / 2 - (glen / 2) * d[0], box.y + box.h / 2 - (glen / 2) * d[1]];
        const pFrom = (pc.from[0] - S[0]) * d[0] + (pc.from[1] - S[1]) * d[1];
        parts.push({ piece: p, kind: k, box, poly: poly.map(([x, y]) => [round(x - box.x), round(y - box.y)]), angle: round(angle), f0: round(pFrom + m), span: round(M - m), path: path[p], m, M });
      }
  });
  const longest = Math.max(...parts.map((q) => q.path + q.M - FRONT - 1));
  const T = spreadMs(longest);
  const speed = longest / T; // px per ms
  for (const q of parts) {
    q.on = { delay: Math.round((q.path + q.m) / speed), dur: Math.round(q.span / speed) };
    q.off = { delay: Math.round(DRAIN * (T - (q.path + q.M) / speed)), dur: Math.round((DRAIN * q.span) / speed) };
    delete q.path;
    delete q.m;
    delete q.M;
  }
  const xs = parts.flatMap((q) => [q.box.x, q.box.x + q.box.w]);
  const ys = parts.flatMap((q) => [q.box.y, q.box.y + q.box.h]);
  pieceSpec[id] = { arrival, spreadMs: Math.round(T), box: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }, parts };
  console.log(`  ${id.padEnd(12)} ${parts.length} parts, longest path ${Math.round(longest)} px, spread ${Math.round(T)} ms`);
}

writeFileSync(
  join(ROOT, "components/lab/platform-power.ts"),
  `// Generated by scripts/make-platform-power.mjs (M1.3F.1): do not edit.
import type { ZoneId } from "@/data/zones";
import type { SceneRect } from "@/lib/scene";

/**
 * One polygon of a strip piece. The energy runs along the piece; its front
 * is a linear-gradient mask at \`angle\` (CSS degrees) over \`box\`, whose stop
 * lies at \`f0 + span * --pw\` reference px along the gradient line.
 */
export interface PowerPart {
  piece: number;
  kind: "strip" | "reflection";
  /** Scene box of the part (reference px). */
  box: SceneRect;
  /** Clip polygon, relative to the box (reference px). */
  poly: readonly (readonly [number, number])[];
  angle: number;
  f0: number;
  span: number;
  /** --pw transition when powering (delay after arrival) and draining (delay after leaving), ms. */
  on: { delay: number; dur: number };
  off: { delay: number; dur: number };
}

export interface PlatformPowerSpec {
  /** Where the connection reaches the platform: the energy enters here. */
  arrival: readonly [number, number];
  /** Time from arrival until every strip is lit (ms). */
  spreadMs: number;
  /** Box around all the parts (reference px). */
  box: SceneRect;
  parts: readonly PowerPart[];
}

/** Soft edge of the power front (reference px). */
export const POWER_FRONT = ${FRONT};

export const PLATFORM_POWER: Record<ZoneId, PlatformPowerSpec> = ${JSON.stringify(pieceSpec)};
`,
);
console.log("wrote components/lab/platform-power.ts");

// ---------------------------------------------------------------------------
// Preview (diagnostic only): the idle composite, and a geometry sheet per
// platform (2x): plate | the detected cores (white), the dimmed halo
// (magenta, by strength), the bands (yellow), the arrival (white dot) and
// each piece's direction (cyan arrow).
if (PREVIEW) {
  mkdirSync(PREVIEW, { recursive: true });
  const idle = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const a = all[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) idle[i * 4 + c] = Math.round(all[i * 4 + c] * a + plate[i * 4 + c] * (1 - a));
    idle[i * 4 + 3] = 255;
  }
  png(join(PREVIEW, "idle-composite.png"), idle);

  const S = 2;
  const GAP = 12;
  const rows = ids.map((id) => {
    const b = pieceSpec[id].box;
    return { id, x: b.x - 10, y: b.y - 10, w: b.w + 20, h: b.h + 20 };
  });
  const sw = Math.max(...rows.map((r) => r.w)) * S * 2 + GAP * 3;
  const sh = rows.reduce((a, r) => a + r.h * S + GAP, GAP);
  const sheet = new Uint8Array(sw * sh * 4).fill(24);
  for (let i = 3; i < sheet.length; i += 4) sheet[i] = 255;
  const put = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= sw || y >= sh) return;
    sheet.set(rgb, (y * sw + x) * 4);
  };
  const line = (ox, oy, r, a, b, rgb) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * S * 2);
    for (let t = 0; t <= n; t++) put(Math.round(ox + (a[0] + ((b[0] - a[0]) * t) / n - r.x) * S), Math.round(oy + (a[1] + ((b[1] - a[1]) * t) / n - r.y) * S), rgb);
  };
  let oy = GAP;
  for (const r of rows) {
    const ox2 = GAP * 2 + r.w * S;
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const i = (r.y + y) * W + r.x + x;
        const base = [plate[i * 4], plate[i * 4 + 1], plate[i * 4 + 2]];
        const dim = all[i * 4 + 3] ? Math.min(1, Math.max(0, (lum(...base) - lum(all[i * 4], all[i * 4 + 1], all[i * 4 + 2])) / 45)) : 0;
        const ann = base.map((v, c) => {
          let o = v * 0.4;
          o = o * (1 - 0.7 * dim) + [255, 60, 220][c] * 0.7 * dim;
          return Math.round(o * (1 - core[i]) + 255 * core[i]);
        });
        for (let sy = 0; sy < S; sy++)
          for (let sx = 0; sx < S; sx++) {
            put(GAP + x * S + sx, oy + y * S + sy, base);
            put(ox2 + x * S + sx, oy + y * S + sy, ann);
          }
      }
    for (const pc of PLATFORMS[r.id].pieces) {
      for (const poly of [...pc.strips, ...(pc.reflections ?? [])]) poly.forEach((a, k) => line(ox2, oy, r, a, poly[(k + 1) % poly.length], [255, 220, 40]));
      line(ox2, oy, r, pc.from, pc.to, [60, 240, 255]);
      const ux = (pc.to[0] - pc.from[0]) / pc.len;
      const uy = (pc.to[1] - pc.from[1]) / pc.len;
      line(ox2, oy, r, pc.to, [pc.to[0] - 6 * ux - 4 * uy, pc.to[1] - 6 * uy + 4 * ux], [60, 240, 255]);
      line(ox2, oy, r, pc.to, [pc.to[0] - 6 * ux + 4 * uy, pc.to[1] - 6 * uy - 4 * ux], [60, 240, 255]);
    }
    const [ax, ay] = PLATFORMS[r.id].arrival;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 16) put(Math.round(ox2 + (ax - r.x) * S + dx), Math.round(oy + (ay - r.y) * S + dy), [255, 255, 255]);
    oy += r.h * S + GAP;
  }
  png(join(PREVIEW, "geometry.png"), sheet, sw, sh);
}
