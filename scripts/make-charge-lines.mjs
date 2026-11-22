#!/usr/bin/env node
// M1.3G: the connections from the central A to Educational, Engineering,
// Creative Studio and Experience, as charge lines like Playground's
// (M1.3E.1/2, scripts/make-playground-layer.mjs, which still builds that one).
//
// For each station:
//   - the painted route, traced from the plate: guide curves (the Béziers of
//     scene-fx CONNECTIONS, plus the short stroke along the central
//     platform's rim that Engineering's line starts with) are refined to the
//     line's own pixels (brightness-weighted centre across the line, every
//     px, smoothed), then sampled every few px;
//   - its parts: straight-enough runs (each within ~1 px of its chord), so
//     the charge windows (ChargeLine) follow the curve;
//   - masks of the route for the spark (core / glow / wide), and per part the
//     powered glow's masks (core / glow), so parts never double up;
//   - per part, the line unpowered: the line's light is subtracted from the
//     plate as in M1.3F.1 (a smooth light field, so the floor's and stone's
//     texture contrast stays), keeping a faint, sharp core (KEEP_CORE of the
//     line's own light, its shape intact). Every changed pixel is written
//     opaque with its final colour: nothing is resampled or blurred.
//
// Assets are cropped to the route's box (they are drawn inside transformed
// charge windows, so the plate's pixel grid doesn't apply there):
//   public/scene/activation/lines/<id>-route{,-glow,-wide}.png
//   public/scene/activation/lines/<id>-<k>{,-glow,-dim}.png
//   components/lab/charge-routes.ts   (routes, part starts, crop boxes)
//
// Never touches reference/ or public/scene/lab-plate.webp.
// Usage: node scripts/make-charge-lines.mjs [--preview <dir>]

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
 * Half-width of a floor line's unpowered band (px): its bloom reaches this
 * far. It must fit the charge windows (ChargeLine: CHARGE_HALF = 16).
 */
const FLOOR_HALF = 14;
const lineGuide = (a, b) => ({ kind: "line", a, b });
const bezGuide = (p0, p1, p2) => ({ kind: "bez", p0, p1, p2 });

/**
 * Routes, from the central A outward. Each part: a guide (traced to the
 * pixels within +-band px), the half-width of its unpowered band (px; the
 * line's light on the floor around it), and how many parts to split it into
 * (curves: so each part stays within ~1 px of its chord).
 */
const ROUTES = {
  // Straight up from just below the A's outer circle (which stays lit) over
  // the floor and up the platform's face to the front strip.
  educational: { burstTilt: 0, parts: [{ guide: lineGuide([838.5, 533], [838.5, 462.5]), band: 2.5, half: FLOOR_HALF, split: 1 }] },
  // From the A's outer circle along the central platform's rim (a short,
  // faint stroke: the mirror of Playground's), down over the rim, across the
  // floor to the platform's right corner.
  engineering: {
    burstTilt: 8,
    parts: [
      { guide: lineGuide([780.5, 563.6], [721.5, 568.4]), band: 2, half: 3.5, split: 1, sides: "above" },
      { guide: bezGuide([716, 569.5], [651, 556.3], [586, 540.8]), band: 3, half: FLOOR_HALF, split: 1 },
    ],
  },
  // Out from under the central platform's base, curving across the floor.
  creative: { burstTilt: -6, parts: [{ guide: bezGuide([722.5, 645], [613, 685.9], [505, 695.2]), band: 3, half: FLOOR_HALF, split: 3 }] },
  experience: { burstTilt: 6, parts: [{ guide: bezGuide([961.5, 646.6], [1088, 687.7], [1212, 696.2]), band: 3, half: FLOOR_HALF, split: 3 }] },
};
const STEP = 8; // route sample spacing (px)
const KEEP_CORE = 0.18; // the line's own light kept at rest, in its core (a faint, sharp line)
const KEEP_HALO = 0.05;
const CAST_CORE = 1; // the core: fully per channel (a neutral faint line, like the unlit platform fixtures)
const CAST = 0.15; // share of the halo's removed light taken as the amber cast (rest keeps the hue; more tints the orange bloom green)
const SIGMA_LIGHT = 2.5;
const SIGMA_UNLIT = 6;
const SIGMA_WIDE = 18;
const PAD = 30; // crop box padding around a route (px)

// ---------------------------------------------------------------------------
// Decode (Chrome) and encode (PNG): as scripts/make-playground-layer.mjs.

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
function png(path, rgba, w, h) {
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
/** Write a crop (box) of a full-frame RGBA buffer. */
function pngCrop(path, full, box) {
  const out = new Uint8Array(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) out.set(full.subarray(((box.y + y) * W + box.x) * 4, ((box.y + y) * W + box.x + box.w) * 4), y * box.w * 4);
  png(path, out, box.w, box.h);
}

// ---------------------------------------------------------------------------
// Image helpers.

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
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lumOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// ---------------------------------------------------------------------------

const [plate, platformPower, playgroundWide] = await decodeAll([
  "public/scene/lab-plate.webp",
  "public/scene/power/unpowered.png",
  "public/scene/activation/playground-route-wide.png",
]);
const P = [0, 1, 2].map((c) => Float32Array.from({ length: W * H }, (_, i) => plate[i * 4 + c]));
const L = Float32Array.from({ length: W * H }, (_, i) => lumOf(P[0][i], P[1][i], P[2][i]));
const lumAt = (x, y) => {
  const x0 = Math.floor(x - 0.5);
  const y0 = Math.floor(y - 0.5);
  const fx = x - 0.5 - x0;
  const fy = y - 0.5 - y0;
  const at = (xx, yy) => L[Math.min(H - 1, Math.max(0, yy)) * W + Math.min(W - 1, Math.max(0, xx))];
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
};

/** Guide sampled every px: points and unit normals. */
function sampleGuide(g) {
  const pts = [];
  if (g.kind === "line") {
    const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
    for (let s = 0; s <= len; s++) pts.push([g.a[0] + ((g.b[0] - g.a[0]) * s) / len, g.a[1] + ((g.b[1] - g.a[1]) * s) / len]);
  } else {
    const dense = Array.from({ length: 2001 }, (_, k) => {
      const t = k / 2000;
      const m = 1 - t;
      return [m * m * g.p0[0] + 2 * m * t * g.p1[0] + t * t * g.p2[0], m * m * g.p0[1] + 2 * m * t * g.p1[1] + t * t * g.p2[1]];
    });
    let acc = 0;
    let next = 0;
    pts.push(dense[0]);
    for (let k = 1; k < dense.length; k++) {
      acc += Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1]);
      if (acc >= next + 1) {
        next += 1;
        pts.push(dense[k]);
      }
    }
    pts.push(dense.at(-1));
  }
  return pts.map((p, k) => {
    const a = pts[Math.max(0, k - 2)];
    const b = pts[Math.min(pts.length - 1, k + 2)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { p, n: [-(b[1] - a[1]) / l, (b[0] - a[0]) / l] };
  });
}
/** The line's centre near each guide sample: brightness-weighted across +-band, smoothed. */
function trace(guide, band) {
  const samples = sampleGuide(guide);
  const offs = samples.map(({ p, n }) => {
    let base = Infinity;
    for (let t = -band - 3; t <= band + 3; t += 0.5) base = Math.min(base, lumAt(p[0] + n[0] * t, p[1] + n[1] * t));
    let sw = 0;
    let st = 0;
    for (let t = -band; t <= band; t += 0.25) {
      const w = Math.max(0, lumAt(p[0] + n[0] * t, p[1] + n[1] * t) - base) ** 2;
      sw += w;
      st += w * t;
    }
    return sw > 0 ? st / sw : 0;
  });
  const smooth = offs.map((_, k) => {
    let a = 0;
    let c = 0;
    for (let j = -3; j <= 3; j++)
      if (offs[k + j] !== undefined) {
        a += offs[k + j];
        c++;
      }
    return a / c;
  });
  return samples.map(({ p, n }, k) => [p[0] + n[0] * smooth[k], p[1] + n[1] * smooth[k]]);
}

// Routes: traced parts, sampled every STEP px; part starts.
const routes = {};
for (const [id, spec] of Object.entries(ROUTES)) {
  const route = [];
  const starts = [];
  const partInfo = [];
  for (const part of spec.parts) {
    const centres = trace(part.guide, part.band);
    // Split curves into `split` runs of equal length.
    for (let q = 0; q < part.split; q++) {
      const a = Math.round((q * (centres.length - 1)) / part.split);
      const b = Math.round(((q + 1) * (centres.length - 1)) / part.split);
      starts.push(route.length ? route.length - (q > 0 ? 1 : 0) : 0);
      const idx = [];
      for (let k = a; k < b; k += STEP) idx.push(k);
      idx.push(b);
      // Consecutive runs of one part share their joint point.
      for (const k of q > 0 ? idx.slice(1) : idx) route.push(centres[k].map((v) => +v.toFixed(2)));
      partInfo.push({ half: part.half, sides: part.sides });
    }
  }
  // The end, 1.5 px on along the traced direction (as Playground's).
  {
    const [a, b] = route.slice(-2);
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    route.push([+(b[0] + ((b[0] - a[0]) / l) * 1.5).toFixed(2), +(b[1] + ((b[1] - a[1]) / l) * 1.5).toFixed(2)]);
  }
  routes[id] = { route, starts, partInfo, burstTilt: spec.burstTilt };
}

// Arc length / nearest point per route.
for (const r of Object.values(routes)) {
  r.segs = r.route.slice(1).map((b, i) => {
    const a = r.route[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const part = r.starts.filter((s) => s <= i).length - 1;
    return { a, b, len, ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len, part };
  });
  let acc = 0;
  for (const sg of r.segs) {
    sg.s0 = acc;
    acc += sg.len;
  }
  r.length = acc;
  const xs = r.route.map((p) => p[0]);
  const ys = r.route.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - PAD);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - PAD);
  r.box = { x: x0, y: y0, w: Math.min(W, Math.ceil(Math.max(...xs)) + PAD) - x0, h: Math.min(H, Math.ceil(Math.max(...ys)) + PAD) - y0 };
}
function nearest(r, x, y) {
  let best = null;
  r.segs.forEach((sg, k) => {
    let t = (x - sg.a[0]) * sg.ux + (y - sg.a[1]) * sg.uy;
    const lo = k === 0 ? -20 : 0;
    const hi = k === r.segs.length - 1 ? sg.len + 20 : sg.len;
    t = Math.max(lo, Math.min(hi, t));
    const px = sg.a[0] + sg.ux * t;
    const py = sg.a[1] + sg.uy * t;
    const dist = Math.hypot(x - px, y - py);
    if (!best || dist < best.dist) best = { dist, s: sg.s0 + t, d: (x - px) * -sg.uy + (y - py) * sg.ux, part: sg.part };
  });
  return best;
}

// Per pixel: which route (if any), its nearest point, and the unpowered band.
const owner = new Int8Array(W * H).fill(-1);
const near = new Array(W * H);
const ids = Object.keys(routes);
ids.forEach((id, k) => {
  const r = routes[id];
  for (let y = r.box.y; y < r.box.y + r.box.h; y++)
    for (let x = r.box.x; x < r.box.x + r.box.w; x++) {
      const i = y * W + x;
      const n = nearest(r, x + 0.5, y + 0.5);
      if (owner[i] >= 0 && near[i].dist <= n.dist) continue;
      owner[i] = k;
      near[i] = n;
    }
});

// The surface without the lines: from pixels well clear of every line
// (Playground's too) and of the platform strips, which have their own overlay.
const src = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const n = near[i];
  const clear = !n || n.dist > routes[ids[owner[i]]].partInfo[n.part].half + 3 || n.s < -6 || n.s > routes[ids[owner[i]]].length + 6;
  src[i] = clear && playgroundWide[i * 4 + 3] < 13 && platformPower[i * 4 + 3] === 0 ? 1 : 0;
}
const wFine = gauss(src, SIGMA_UNLIT);
const wWide = gauss(src, SIGMA_WIDE);
const unlit = P.map((ch) => {
  const m = Float32Array.from(ch, (v, i) => v * src[i]);
  const fine = gauss(m, SIGMA_UNLIT);
  const wide = gauss(m, SIGMA_WIDE);
  return Float32Array.from(fine, (v, i) => {
    const coarse = wWide[i] > 1e-6 ? wide[i] / wWide[i] : ch[i];
    const w = Math.min(1, wFine[i] / 0.05);
    return w > 0 ? w * (v / Math.max(wFine[i], 1e-9)) + (1 - w) * coarse : coarse;
  });
});
const lit = P.map((ch) => gauss(ch, SIGMA_LIGHT));

// ---------------------------------------------------------------------------
// Masks and the unpowered lines.

const OUT = join(ROOT, "public/scene/activation/lines");
const fresh = () => new Uint8Array(W * H * 4);
const idle = PREVIEW ? Uint8Array.from(plate) : null;
const meta = {};
ids.forEach((id, k) => {
  const r = routes[id];
  const parts = r.starts.length;
  const route = { core: fresh(), glow: fresh(), wide: fresh() };
  const per = Array.from({ length: parts }, () => ({ core: fresh(), glow: fresh(), dim: fresh() }));
  let changed = 0;
  for (let y = r.box.y; y < r.box.y + r.box.h; y++)
    for (let x = r.box.x; x < r.box.x + r.box.w; x++) {
      const i = y * W + x;
      if (owner[i] !== k) continue;
      const n = near[i];
      // Masks for the spark and the powered glow (as Playground's).
      const cap = Math.min(1, Math.max(0, (n.s + 3) / 4), Math.max(0, (r.length + 3 - n.s) / 4));
      const put = (buf, a) => {
        const v = Math.round(Math.min(1, Math.max(0, a)) * cap * 255);
        if (v) buf.set([255, 255, 255, v], i * 4);
      };
      put(route.core, (1.9 - n.dist) / 1.0);
      put(route.glow, Math.exp(-(n.dist * n.dist) / (2 * 3.6 * 3.6)));
      put(route.wide, Math.exp(-(n.dist * n.dist) / (2 * 8 * 8)));
      put(per[n.part].core, (1.9 - n.dist) / 1.0);
      put(per[n.part].glow, Math.exp(-(n.dist * n.dist) / (2 * 3.6 * 3.6)));

      // Unpowered: subtract the line's light.
      const { half, sides } = r.partInfo[n.part];
      const d = n.dist;
      if (d > half || n.s < -3 || n.s > r.length + 1) continue;
      if (sides === "above" && n.d > 1.5) continue; // the rim's own highlight lies just below
      // Where a platform's strips meet the line (Educational's junction), the
      // platform overlay (below this one) already unpowers the strip: only
      // the line's own core is drawn here, or a part-dimmed copy of the lit
      // strip would cover it.
      if (platformPower[i * 4 + 3] && d > 2.5) continue;
      const ends = Math.min(1, (n.s + 3) / 3, (r.length + 1 - n.s) / 3);
      // The subtraction fades out gradually with the bloom (an abrupt band
      // edge leaves a dark trench inside and lit bloom outside).
      const w = (1 - smoothstep(half * 0.4, half, d)) * Math.max(0, ends);
      if (w <= 0) continue;
      const lumP = Math.max(1, L[i]);
      const gLum = Math.max(0, lumOf(lit[0][i], lit[1][i], lit[2][i]) - lumOf(unlit[0][i], unlit[1][i], unlit[2][i]));
      // Within a few px of the line it is all glow: take each pixel's own excess there.
      const edge = smoothstep(2.5, 6, d);
      const keep = KEEP_HALO + (KEEP_CORE - KEEP_HALO) * (1 - smoothstep(0.6, 2, d));
      const floor = 0.1 + 0.5 * smoothstep(2, 6, d);
      const rgb = [0, 1, 2].map((c) => {
        const blurred = (1 - CAST) * gLum * (P[c][i] / lumP) + CAST * Math.max(0, lit[c][i] - unlit[c][i]);
        // Near the line: its own excess (CAST_CORE: how much per channel; the
        // rest keeps the hue).
        const local = (1 - CAST_CORE) * Math.max(0, L[i] - lumOf(unlit[0][i], unlit[1][i], unlit[2][i])) * (P[c][i] / lumP) + CAST_CORE * Math.max(0, P[c][i] - unlit[c][i]);
        const gain = edge * blurred + (1 - edge) * local;
        const v = Math.max(P[c][i] - (1 - keep) * w * gain, P[c][i] * (1 - (1 - floor) * w));
        return Math.round(Math.min(255, Math.max(0, v)));
      });
      if (Math.max(...rgb.map((v, c) => Math.abs(v - plate[i * 4 + c]))) < 1) continue;
      changed++;
      per[n.part].dim.set([...rgb, 255], i * 4);
      if (idle) idle.set(rgb, i * 4);
    }
  pngCrop(join(OUT, `${id}-route.png`), route.core, r.box);
  pngCrop(join(OUT, `${id}-route-glow.png`), route.glow, r.box);
  pngCrop(join(OUT, `${id}-route-wide.png`), route.wide, r.box);
  per.forEach((p, q) => {
    pngCrop(join(OUT, `${id}-${q}.png`), p.core, r.box);
    pngCrop(join(OUT, `${id}-${q}-glow.png`), p.glow, r.box);
    pngCrop(join(OUT, `${id}-${q}-dim.png`), p.dim, r.box);
  });
  meta[id] = { route: r.route, starts: r.starts, box: r.box, burstTilt: r.burstTilt };
  console.log(`${id.padEnd(12)} ${r.route.length} points, ${parts} part(s), ${r.length.toFixed(1)} px, ${changed} px unpowered, box ${JSON.stringify(r.box)}`);
});

writeFileSync(
  join(ROOT, "components/lab/charge-routes.ts"),
  `// Generated by scripts/make-charge-lines.mjs (M1.3G): do not edit.
import type { ZoneId } from "@/data/zones";
import type { SceneRect } from "@/lib/scene";

export interface ChargeRouteSpec {
  /** The painted connection from the A's outer circle to the station, traced from the plate (reference px). */
  route: readonly (readonly [number, number])[];
  /** Index of each part's first point (parts: straight-enough runs of the route). */
  starts: readonly number[];
  /** Box the route's assets are cropped to (reference px). */
  box: SceneRect;
  /** Tilt of the arrival burst (deg), to sit flat on the surface there. */
  burstTilt: number;
}

export const CHARGE_ROUTES: Partial<Record<ZoneId, ChargeRouteSpec>> = ${JSON.stringify(meta)};
`,
);
console.log("wrote components/lab/charge-routes.ts");

if (PREVIEW) {
  mkdirSync(PREVIEW, { recursive: true });
  png(join(PREVIEW, "idle-lines.png"), idle, W, H);
  // Traced routes drawn over the plate (diagnostic).
  const over = Uint8Array.from(plate);
  for (const r of Object.values(routes))
    for (const sg of r.segs)
      for (let t = 0; t <= sg.len; t += 0.25) {
        const x = Math.round(sg.a[0] + sg.ux * t - 0.5);
        const y = Math.round(sg.a[1] + sg.uy * t - 0.5);
        over.set([[0, 255, 255], [255, 0, 255], [255, 255, 0]][sg.part % 3], (y * W + x) * 4);
      }
  png(join(PREVIEW, "routes.png"), over, W, H);
}
