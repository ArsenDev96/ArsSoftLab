#!/usr/bin/env node
// M1.3I: masks for the clean-environment artwork (docs/m1.3i/background-requirements.md).
//
// Full-frame 1672 x 941 PNGs, white = to be painted (the environment that a
// station hides, plus a margin), black = keep the approved artwork:
//   <station>-remove.png  where the station is removed
//   <station>-floor.png   the floor band a lift exposes (priority area)
//   all-stations.png      the union (the five-station-free background)
//   lines.png             the five connection bands (already line-free in
//                         the experimental build; for the artist's reference)
// plus an overlay preview on the plate.
//
// Exact for Playground and Engineering (their cut-outs' alpha, dilated).
// Approximate for Educational, Creative Studio and Experience: they have no
// cut-out yet, so the hotspot polygon (generous, scene-layout.ts) is used;
// trace their silhouettes first, then regenerate.
//
// Usage: node scripts/make-background-masks.mjs [out dir, default docs/m1.3i/masks]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { launch } from "./visual/cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(process.argv[2] || join(ROOT, "docs/m1.3i/masks"));
const W = 1672;
const H = 941;
/** Margin around a silhouette (px): the painter blends into the approved artwork here. */
const MARGIN = 6;
/** Lift exposure band under a lifted station (px above the contact line), with margin. */
const LIFT_BAND = 24;

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
        const g = c.getContext("2d"); g.drawImage(img, 0, 0, ${W}, ${H});
        const d = g.getImageData(0, 0, ${W}, ${H}).data;
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
function png(path, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}
const maskPng = (path, m) => {
  const o = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) o.set(m[i] ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
  png(path, o);
};
function dilate(m, r) {
  const o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) o[yy * W + xx] = 1;
        }
    }
  return o;
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

// Hotspot polygons from scene-layout.ts (STATION_LAYOUT[id].hotspot = poly(...)).
const layout = readFileSync(join(ROOT, "components/lab/scene-layout.ts"), "utf8");
const hotspot = (id) => {
  const at = layout.indexOf(`  ${id}: {`);
  const m = layout.slice(at).match(/hotspot: poly\(([\d,\s]+)\)/);
  const n = m[1].split(",").map((v) => +v.trim());
  return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]);
};

const [plate, playground, engineering, lineGlow] = await decodeAll(["public/scene/lab-plate.webp", "public/scene/layers/playground-v2.png", "public/scene/layers/engineering.webp", "public/scene/masks/connections-glow.png"]);
const fromAlpha = (img) => Uint8Array.from({ length: W * H }, (_, i) => (img[i * 4 + 3] >= 8 ? 1 : 0));
const fromPoly = (poly) => {
  const m = new Uint8Array(W * H);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) if (pointInPoly(x + 0.5, y + 0.5, poly)) m[y * W + x] = 1;
  return m;
};
/** The band a lift of LIFT_BAND px exposes: from each column's bottom edge up. */
const liftBand = (m) => {
  const o = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let yb = -1;
    for (let y = 0; y < H; y++) if (m[y * W + x]) yb = y;
    if (yb < 0) continue;
    for (let y = Math.max(0, yb - LIFT_BAND); y <= Math.min(H - 1, yb + 3); y++) if (m[y * W + x] || y > yb) o[y * W + x] = 1;
  }
  return dilate(o, 2);
};

const stations = {
  playground: { mask: dilate(fromAlpha(playground), MARGIN), exact: true },
  engineering: { mask: dilate(fromAlpha(engineering), MARGIN), exact: true },
  educational: { mask: fromPoly(hotspot("educational")), exact: false },
  creative: { mask: fromPoly(hotspot("creative")), exact: false },
  experience: { mask: fromPoly(hotspot("experience")), exact: false },
};
const all = new Uint8Array(W * H);
const summary = {};
for (const [id, s] of Object.entries(stations)) {
  maskPng(join(OUT, `${id}-remove.png`), s.mask);
  const band = liftBand(s.mask);
  maskPng(join(OUT, `${id}-floor.png`), band);
  let n = 0;
  let nb = 0;
  for (let i = 0; i < W * H; i++) {
    if (s.mask[i]) {
      all[i] = 1;
      n++;
    }
    if (band[i]) nb++;
  }
  summary[id] = { exact: s.exact, removePx: n, floorBandPx: nb };
}
maskPng(join(OUT, "all-stations.png"), all);
maskPng(join(OUT, "lines.png"), Uint8Array.from({ length: W * H }, (_, i) => (lineGlow[i * 4 + 3] > 8 ? 1 : 0)));

// Preview: the plate, darkened, with exact masks in cyan and approximate in amber.
const prev = Uint8Array.from(plate);
for (let i = 0; i < W * H; i++) {
  for (let c = 0; c < 3; c++) prev[i * 4 + c] = Math.round(prev[i * 4 + c] * 0.55);
  for (const [, s] of Object.entries(stations))
    if (s.mask[i]) {
      const tint = s.exact ? [60, 200, 255] : [255, 170, 60];
      for (let c = 0; c < 3; c++) prev[i * 4 + c] = Math.round(prev[i * 4 + c] * 0.5 + tint[c] * 0.5);
    }
}
png(join(OUT, "preview.png"), prev);
console.log(JSON.stringify(summary, null, 1));
