#!/usr/bin/env node
// M1.3J: a mask-aware inpainting workflow for the floor hidden under
// Playground (the band its 18 px lift uncovers). The model or tool is
// external and chosen by you (see docs/m1.3j/NOTES.md); this script only
// prepares its inputs and takes its output back.
//
//   node scripts/inpaint-playground.mjs prepare
//       Writes docs/m1.3j/inpaint/: the context crop with the station taken
//       out, the masks, 2x versions, and a sampling mask for Photoshop.
//   node scripts/inpaint-playground.mjs integrate <candidate.png> [--name <id>]
//       Takes the tool's output (the crop's size, or 2x: then averaged down
//       2 x 2) and composites it ONLY inside the supplied floor mask, and
//       only where the floor is hidden at rest (inside the station's clean
//       background), into public/scene/layers25d/playground/floor.png, which
//       the experimental 2.5D build draws over Playground's background.
//       Verifies that nothing outside the mask changed and writes the
//       candidate's record to docs/m1.3j/candidates/<id>/.
//   (integrate and compare take --root <dir> for where records go.)
//   node scripts/inpaint-playground.mjs clear
//       Back to no candidate (a transparent floor.png): the M1.3I floor.
//   node scripts/inpaint-playground.mjs compare [--name <id>] [--url http://localhost:3001] [--orig http://localhost:3000]
//       Real-browser check of the integrated candidate (experimental build
//       running): the 18 px lift with every shadow off, at normal size and
//       3x, against the M1.3I floor; identity outside the mask; idle
//       unchanged against the approved build.
//
// The approved build never draws floor.png (the layered build only).
// Never touches reference/, lab-plate.webp or any approved asset.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { launch, sleep } from "./visual/cdp.mjs";
import { compareImages, composeGrid, prepare as prepareCompare } from "./visual/compare.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1672;
const H = 941;
/** The working crop (scene px): Playground's floor band with 90 px of floor either side and 66 px below. */
const CROP = { x: 962, y: 432, w: 512, h: 192 };
const IN = join(ROOT, "docs/m1.3j/inpaint");

const FLOOR_OUT = join(ROOT, "public/scene/layers25d/playground/floor.png");
const FILES = {
  plate: "public/scene/lab-plate.webp",
  floorMask: "docs/m1.3i/masks/playground-floor.png",
  removeMask: "docs/m1.3i/masks/playground-remove.png",
  lines: "docs/m1.3i/masks/lines.png",
  background: "public/scene/layers25d/playground/background.png",
  // The cut-out the experimental build draws (M1.3J.2: object.png; M1.3H's
  // playground-v2.png before it).
  station: existsSync(resolve(ROOT, "public/scene/layers25d/playground/object.png")) ? "public/scene/layers25d/playground/object.png" : "public/scene/layers/playground-v2.png",
  env: "public/scene/layers25d/environment-corrections.png",
};
/** Never a source for Content-Aware Fill: the Experience panel and the central platform's rim (scene px). */
const SAMPLING_EXCLUDE = [
  { x: 1384, y: 470, w: 160, h: 170 },
  { x: 930, y: 540, w: 150, h: 100 },
];
/** Floor/back-step boundary of the room behind Playground (as make-playground-layered.mjs). */
const floorY = (x) => 432 + ((x - 1060) * 18) / 320;

const argv = process.argv.slice(2);
const cmd = argv[0];
/** Where candidate records go (--root, default docs/m1.3j/candidates). */
const CANDIDATES = resolve(ROOT, (() => { const i = argv.indexOf("--root"); return i >= 0 ? argv[i + 1] : "docs/m1.3j/candidates"; })());
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};

// ---------------------------------------------------------------------------
// Decode (Chrome, exact pixels) and encode (PNG).

async function decodeAll(files) {
  const page = await launch({ width: 400, height: 300 });
  try {
    const out = [];
    for (const f of files) {
      const type = f.endsWith(".webp") ? "image/webp" : f.endsWith(".jpg") || f.endsWith(".jpeg") ? "image/jpeg" : "image/png";
      const src = `data:${type};base64,` + readFileSync(resolve(ROOT, f)).toString("base64");
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
      out.push({ w: await page.eval("window.__w"), h: await page.eval("window.__h"), data: new Uint8Array(Buffer.from(b64, "base64")) });
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
const crop = (img, r = CROP) => {
  const o = new Uint8Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) o.set(img.subarray(((r.y + y) * W + r.x) * 4, ((r.y + y) * W + r.x + r.w) * 4), y * r.w * 4);
  return o;
};
/** Nearest-neighbour 2x (masks: stay binary). */
const up2Nearest = (img, w, h) => {
  const o = new Uint8Array(w * 2 * h * 2 * 4);
  for (let y = 0; y < h * 2; y++) for (let x = 0; x < w * 2; x++) o.set(img.subarray((((y >> 1) * w + (x >> 1)) * 4), (((y >> 1) * w + (x >> 1)) * 4) + 4), (y * w * 2 + x) * 4);
  return o;
};
/** Bicubic (Catmull-Rom) 2x for the context image (model input only; never composited back). */
function up2Bicubic(img, w, h) {
  const o = new Uint8Array(w * 2 * h * 2 * 4);
  const k = (t) => {
    t = Math.abs(t);
    return t < 1 ? 1.5 * t ** 3 - 2.5 * t ** 2 + 1 : t < 2 ? -0.5 * t ** 3 + 2.5 * t ** 2 - 4 * t + 2 : 0;
  };
  const at = (x, y, c) => img[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c];
  for (let y = 0; y < h * 2; y++)
    for (let x = 0; x < w * 2; x++) {
      const sx = (x + 0.5) / 2 - 0.5;
      const sy = (y + 0.5) / 2 - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) v += at(x0 + i, y0 + j, c) * k(sx - (x0 + i)) * k(sy - (y0 + j));
        o[(y * w * 2 + x) * 4 + c] = Math.min(255, Math.max(0, Math.round(v)));
      }
    }
  return o;
}
const maskOn = (img, i) => img[i * 4] > 127;
const lum = (d, i) => 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];

// ---------------------------------------------------------------------------

async function prepare() {
  const [plate, floorMask, removeMask, lines, background, station, env] = (await decodeAll([FILES.plate, FILES.floorMask, FILES.removeMask, FILES.lines, FILES.background, FILES.station, FILES.env])).map((d) => d.data);
  for (const [name, img] of Object.entries({ floorMask, removeMask })) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const inside = x >= CROP.x && x < CROP.x + CROP.w && y >= CROP.y && y < CROP.y + CROP.h;
        if (!inside && name === "floorMask" && maskOn(img, y * W + x)) throw new Error("floor mask leaves the crop");
      }
  }
  // Context: the plate, with every pixel of the station (its remove mask)
  // replaced by Playground's clean background (M1.3H synthesis), so no part
  // of the arcade or platform is in the model's input. Inside the floor mask
  // it holds that synthesis too (a starting point for tools that use one).
  const context = Uint8Array.from(plate);
  let replaced = 0;
  for (let i = 0; i < W * H; i++) {
    if (!maskOn(removeMask, i) && !maskOn(floorMask, i)) continue;
    // Outside the clean background's hole (the 6 px margin), the plate is
    // floor already, except for the station's own soft edge and glow:
    // there the cut-out alpha tells us the station is present.
    if (background[i * 4 + 3]) context.set([background[i * 4], background[i * 4 + 1], background[i * 4 + 2], 255], i * 4);
    else if (station[i * 4 + 3] > 0) continue; // never: the background covers the cut-out
    replaced++;
  }
  // Station pixels left in the context: any cut-out pixel not replaced.
  let leftover = 0;
  for (let i = 0; i < W * H; i++) if (station[i * 4 + 3] > 0 && !background[i * 4 + 3]) leftover++;

  // Working mask for generative tools: the floor band plus everything the
  // station covered (they repaint the whole hidden area coherently; only the
  // floor band is composited back). Sampling mask for Content-Aware Fill:
  // visible floor only (below the back step, not the station area, not the
  // connection lines, not the lit strips' glow).
  const work = new Uint8Array(W * H * 4);
  const sampling = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    // Only pixels hidden at rest are ever repainted: the tool must see the
    // visible floor right up to the station's silhouette, so it continues it.
    const hiddenAtRest = background[i * 4 + 3] > 0;
    const w = hiddenAtRest && (maskOn(floorMask, i) || maskOn(removeMask, i));
    work.set(w ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
    const glow = lum(plate, i) > 150;
    const excluded = SAMPLING_EXCLUDE.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    const s = y > floorY(x) + 4 && !maskOn(removeMask, i) && !maskOn(floorMask, i) && !maskOn(lines, i) && !glow && !excluded;
    sampling.set(s ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
  }
  // mask-floor: the supplied mask where the floor is hidden at rest (what
  // is composited back); mask-supplied: the supplied mask itself.
  const floor = new Uint8Array(W * H * 4);
  const supplied = new Uint8Array(W * H * 4);
  let floorPx = 0;
  let hidden = 0;
  for (let i = 0; i < W * H; i++) {
    const on = maskOn(floorMask, i);
    const hid = on && background[i * 4 + 3] > 0;
    supplied.set(on ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
    floor.set(hid ? [255, 255, 255, 255] : [0, 0, 0, 255], i * 4);
    if (on) floorPx++;
    if (hid) hidden++;
  }

  const c = CROP;
  const out = {
    "plate-crop.png": crop(plate),
    "context.png": crop(context),
    // M1.3J.1: the same, over the experimental build's environment layer
    // (the plate without the connection lines and without Playground's strip
    // reflection, both separate layers there). This is what actually
    // surrounds the gap in the 2.5D build, so a tool doesn't carry the
    // reflection's orange or a line end into the band.
    "context-env.png": crop(Uint8Array.from(context, (v, k) => (env[(k & ~3) + 3] && !maskOn(removeMask, k >> 2) && !maskOn(floorMask, k >> 2) ? env[k] : v))),
    "mask-floor.png": crop(floor),
    "mask-supplied.png": crop(supplied),
    "mask-work.png": crop(work),
    "mask-sampling.png": crop(sampling),
  };
  for (const [name, img] of Object.entries(out)) png(join(IN, name), img, c.w, c.h);
  png(join(IN, "2x/context@2x.png"), up2Bicubic(out["context.png"], c.w, c.h), c.w * 2, c.h * 2);
  png(join(IN, "2x/context-env@2x.png"), up2Bicubic(out["context-env.png"], c.w, c.h), c.w * 2, c.h * 2);
  for (const name of ["mask-floor.png", "mask-work.png", "mask-sampling.png"]) png(join(IN, `2x/${name.replace(".png", "@2x.png")}`), up2Nearest(out[name], c.w, c.h), c.w * 2, c.h * 2);
  // Review sheet: plate | context | masks over the context.
  const overlay = Uint8Array.from(out["context.png"]);
  for (let i = 0; i < c.w * c.h; i++) {
    const f = out["mask-floor.png"][i * 4] > 127;
    const wk = out["mask-work.png"][i * 4] > 127;
    if (f) overlay.set([Math.round(overlay[i * 4] * 0.4 + 255 * 0.6), Math.round(overlay[i * 4 + 1] * 0.4 + 60 * 0.6), Math.round(overlay[i * 4 + 2] * 0.4 + 60 * 0.6), 255], i * 4);
    else if (wk) overlay.set([Math.round(overlay[i * 4] * 0.6 + 60 * 0.4), Math.round(overlay[i * 4 + 1] * 0.6 + 160 * 0.4), Math.round(overlay[i * 4 + 2] * 0.6 + 255 * 0.4), 255], i * 4);
  }
  png(join(IN, "masks-over-context.png"), overlay, c.w, c.h);
  writeFileSync(join(IN, "crop.json"), JSON.stringify({ crop: CROP, scale2x: true, floorMaskPx: floorPx, floorMaskHiddenAtRestPx: hidden, contextReplacedPx: replaced, stationPxLeftInContext: leftover }, null, 1) + "\n");
  if (!existsSync(FLOOR_OUT)) await clear(true);
  console.log(`prepared ${IN}: crop ${c.w}x${c.h} at (${c.x}, ${c.y}); floor mask ${floorPx} px (${hidden} hidden at rest and composited, ${floorPx - hidden} visible floor left untouched); station px left in context: ${leftover}`);
}

async function clear(quiet = false) {
  png(FLOOR_OUT, new Uint8Array(W * H * 4), W, H);
  if (!quiet) console.log(`cleared ${FLOOR_OUT}: the experimental build shows the M1.3I floor`);
}

async function integrate(candidatePath) {
  if (!candidatePath) throw new Error("usage: integrate <candidate.png> [--name <id>]");
  const name = opt("name", candidatePath.replace(/\\/g, "/").split("/").pop().replace(/\.[a-z]+$/i, ""));
  const [cand, plateD, floorD, bgD, stationD] = await decodeAll([candidatePath, FILES.plate, FILES.floorMask, FILES.background, FILES.station]);
  const [plate, floorMask, background, station] = [plateD, floorD, bgD, stationD].map((d) => d.data);
  // Bring the candidate to the crop's size (2x: average each 2 x 2 block).
  let candCrop;
  if (cand.w === CROP.w && cand.h === CROP.h) candCrop = cand.data;
  else if (cand.w === CROP.w * 2 && cand.h === CROP.h * 2) {
    candCrop = new Uint8Array(CROP.w * CROP.h * 4);
    for (let y = 0; y < CROP.h; y++)
      for (let x = 0; x < CROP.w; x++)
        for (let c = 0; c < 4; c++) {
          let s = 0;
          for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) s += cand.data[((y * 2 + j) * CROP.w * 2 + (x * 2 + i)) * 4 + c];
          candCrop[(y * CROP.w + x) * 4 + c] = Math.round(s / 4);
        }
  } else throw new Error(`candidate is ${cand.w}x${cand.h}; expected ${CROP.w}x${CROP.h} or ${CROP.w * 2}x${CROP.h * 2}`);

  // Composite: only inside the supplied floor mask, and only where the floor
  // is hidden at rest (the station's clean background). Floor that is
  // visible in the approved design is never replaced.
  const layer = new Uint8Array(W * H * 4);
  let written = 0;
  let skippedVisible = 0;
  for (let y = 0; y < CROP.h; y++)
    for (let x = 0; x < CROP.w; x++) {
      const i = (y + CROP.y) * W + (x + CROP.x);
      if (!maskOn(floorMask, i)) continue;
      if (!background[i * 4 + 3]) {
        skippedVisible++;
        continue;
      }
      const j = (y * CROP.w + x) * 4;
      layer.set([candCrop[j], candCrop[j + 1], candCrop[j + 2], 255], i * 4);
      written++;
    }
  // Verification: every changed pixel is inside the mask; the background as
  // composited is identical to the M1.3I background everywhere else.
  let outside = 0;
  let diffOutside = 0;
  for (let i = 0; i < W * H; i++) {
    if (!layer[i * 4 + 3]) continue;
    if (!maskOn(floorMask, i)) outside++;
  }
  for (let i = 0; i < W * H; i++) {
    if (maskOn(floorMask, i)) continue;
    const composited = layer[i * 4 + 3] ? layer.subarray(i * 4, i * 4 + 4) : background.subarray(i * 4, i * 4 + 4);
    for (let c = 0; c < 4; c++) if (composited[c] !== background[i * 4 + c]) diffOutside++;
  }
  if (outside || diffOutside) throw new Error(`identity check failed: ${outside} px outside the mask, ${diffOutside} channel differences`);

  // At rest the station covers the band; on its soft bottom edge (alpha < 1)
  // the new floor shows through slightly, for the instant the layers switch
  // on at arrival (the approved layers have the same trade-off). Measured.
  let edgePx = 0;
  let edgeMax = 0;
  for (let i = 0; i < W * H; i++) {
    if (!layer[i * 4 + 3]) continue;
    const a = station[i * 4 + 3] / 255;
    if (a >= 1) continue;
    edgePx++;
    for (let c = 0; c < 3; c++) {
      const now = station[i * 4 + c] * a + layer[i * 4 + c] * (1 - a);
      const plateV = plate[i * 4 + c];
      edgeMax = Math.max(edgeMax, Math.abs(now - plateV));
    }
  }
  // Continuity at the contact line: the candidate's bottom rows against the
  // plate's floor directly below (mean |difference| per row step), and the
  // band's tone and fine detail against the floor in front, as in M1.3H.
  const stats = (fn) => {
    let n = 0;
    let L = 0;
    let D = 0;
    for (let y = CROP.y + 1; y < CROP.y + CROP.h - 1; y++)
      for (let x = CROP.x + 1; x < CROP.x + CROP.w - 1; x++) {
        const i = y * W + x;
        const src = fn(i);
        if (!src) continue;
        const l = (k) => lum(src, k);
        L += l(i);
        D += Math.abs(4 * l(i) - l(i - 1) - l(i + 1) - l(i - W) - l(i + W));
        n++;
      }
    return { px: n, lum: +(L / n).toFixed(1), detail: +(D / n / 4).toFixed(2) };
  };
  const band = stats((i) => (layer[i * 4 + 3] && layer[i - 1 + 0] !== undefined && layer[(i - 1) * 4 + 3] && layer[(i + 1) * 4 + 3] && layer[(i - W) * 4 + 3] && layer[(i + W) * 4 + 3] ? layer : null));
  const front = stats((i) => {
    const y = (i / W) | 0;
    const x = i % W;
    return y >= 560 && y < 600 && x > 1070 && x < 1370 ? plate : null;
  });
  let seam = 0;
  let seamN = 0;
  for (let x = CROP.x; x < CROP.x + CROP.w; x++) {
    let yb = -1;
    for (let y = CROP.y; y < CROP.y + CROP.h; y++) if (layer[(y * W + x) * 4 + 3]) yb = y;
    if (yb < 0 || background[((yb + 1) * W + x) * 4 + 3]) continue;
    seam += Math.abs(lum(layer, yb * W + x) - lum(plate, (yb + 1) * W + x));
    seamN++;
  }
  const record = {
    name,
    candidate: candidatePath,
    size: `${cand.w}x${cand.h}`,
    compositedPx: written,
    maskPxLeftUntouchedBecauseVisibleAtRest: skippedVisible,
    identityOutsideMask: "exact (0 px changed)",
    restEdgePx: edgePx,
    restEdgeMaxDiff: +edgeMax.toFixed(1),
    restEdgeNote: "File model (cut-out over the plate). Since M1.3J.2 the cut-out's edge colour is solved against real browser frames (scripts/playground-edge.py), which this model cannot reproduce; the switch is measured in docs/m1.3j/hybrid/edge/.",
    contactLineSeamMeanLumStep: seamN ? +(seam / seamN).toFixed(2) : null,
    band,
    floorInFront: front,
  };
  png(FLOOR_OUT, layer, W, H);
  const dir = join(CANDIDATES, name);
  mkdirSync(dir, { recursive: true });
  png(join(dir, "candidate-crop.png"), candCrop, CROP.w, CROP.h);
  // The candidate as it lands: the crop with the composited band, for review.
  const landed = crop(plate);
  for (let y = 0; y < CROP.h; y++)
    for (let x = 0; x < CROP.w; x++) {
      const i = (y + CROP.y) * W + (x + CROP.x);
      if (layer[i * 4 + 3]) landed.set(layer.subarray(i * 4, i * 4 + 4), (y * CROP.w + x) * 4);
      else if (background[i * 4 + 3]) landed.set(background.subarray(i * 4, i * 4 + 4), (y * CROP.w + x) * 4);
    }
  png(join(dir, "landed-crop.png"), landed, CROP.w, CROP.h);
  writeFileSync(join(dir, "record.json"), JSON.stringify(record, null, 1) + "\n");
  console.log(JSON.stringify(record, null, 1));
  console.log(`integrated into ${FLOOR_OUT} (served from disk: no rebuild needed). Next: node scripts/inpaint-playground.mjs compare --name ${name}`);
}

async function compare() {
  const name = opt("name", "current");
  const URL_ = opt("url", "http://localhost:3001");
  const ORIG = opt("orig", "http://localhost:3000");
  const dir = join(CANDIDATES, name);
  mkdirSync(join(dir, "shots"), { recursive: true });
  const GAP = { x: 1050, y: 470, w: 340, h: 100 };
  const STATION = { x: 1040, y: 325, w: 360, h: 250 };
  const NO_SHADOW = ".lab-lift-shadow,.lab-lift-penumbra,.lab-gap-sweep,.lab-depth-shadow{visibility:hidden!important}";
  const HIDE_CANDIDATE = ".lab-floor-candidate{visibility:hidden!important}";
  const notes = [];
  const note = (n, ok, d) => {
    notes.push(`${ok ? "OK  " : "BAD "} ${n}  ${JSON.stringify(d)}`);
    console.log(notes.at(-1));
  };
  const css = (page, text, id) => page.eval(`(() => { const s = document.createElement("style"); s.id = ${JSON.stringify(id)}; s.textContent = ${JSON.stringify(text)}; document.head.append(s); return true; })()`);
  const uncss = (page, id) => page.eval(`(() => { document.getElementById(${JSON.stringify(id)})?.remove(); return true; })()`);
  const shot = async (page, path, r, scale = 1) => {
    const s = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
    const clip = r ? { x: s.x + r.x * s.k, y: s.y + r.y * s.k, width: r.w * s.k, height: r.h * s.k, scale } : undefined;
    const res = await page.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
    writeFileSync(path, Buffer.from(res.data, "base64"));
  };

  // Idle: experimental (with the candidate) vs approved, around the station.
  for (const [tag, url] of [["approved", ORIG], ["experimental", URL_]]) {
    const page = await launch({ width: 1648, height: 928 });
    try {
      await page.goto(url);
      await page.mouseMove(4, 924);
      await sleep(700);
      await shot(page, join(dir, `shots/idle-${tag}.png`), STATION);
      if (tag === "approved") {
        const refs = await page.eval(`document.documentElement.outerHTML.includes("playground/floor.png")`);
        note("Approved (default) build never references the candidate", !refs, { references: refs });
      }
      if (tag === "experimental") {
        await css(page, HIDE_CANDIDATE, "hc0");
        await sleep(100);
        await shot(page, join(dir, "shots/idle-experimental-without.png"), STATION);
        await uncss(page, "hc0");
        const has = await page.eval(`!!document.querySelector(".lab-floor-candidate")`);
        note("Experimental build draws the candidate layer", has, { present: has });
        const c = await page.center('[data-hotspot="playground"]');
        await page.mouseMove(c.x, c.y);
        await sleep(2300);
        await page.freezeAnimations(0);
        await css(page, NO_SHADOW, "ns");
        await sleep(100);
        await shot(page, join(dir, "shots/lifted-no-shadow-1x.png"), STATION);
        await shot(page, join(dir, "shots/lifted-no-shadow-3x.png"), GAP, 3);
        await shot(page, join(dir, "shots/lifted-no-shadow-gap-1x.png"), GAP);
        await css(page, HIDE_CANDIDATE, "hc");
        await sleep(100);
        await shot(page, join(dir, "shots/baseline-no-shadow-1x.png"), STATION);
        await shot(page, join(dir, "shots/baseline-no-shadow-3x.png"), GAP, 3);
        await shot(page, join(dir, "shots/baseline-no-shadow-gap-1x.png"), GAP);
        await uncss(page, "hc");
        await uncss(page, "ns");
        await sleep(100);
        await shot(page, join(dir, "shots/lifted-3x.png"), GAP, 3);
      }
    } finally {
      await page.close();
    }
  }
  const page = await launch({ width: 400, height: 300 });
  try {
    await prepareCompare(page);
    const idle = await compareImages(page, join(dir, "shots/idle-experimental-without.png"), join(dir, "shots/idle-experimental.png"));
    note("Idle around Playground: the candidate changes nothing at rest (experimental build, candidate on vs off)", idle.max === 0, idle);
    // Outside the floor band (mapped to the screen, 2 px margin for
    // resampling) the lifted frame must not change when the candidate is on.
    const [floorMask] = (await decodeAll([FILES.floorMask])).map((d) => d.data);
    const k = 1648 / 1672;
    const exclude = [];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if (maskOn(floorMask, y * W + x) && x >= 1050 && y >= 470) exclude.push([Math.floor((x - 1050) * k) - 2, Math.floor((y - 470) * k) - 2, Math.ceil((x + 1 - 1050) * k) + 2, Math.ceil((y + 1 - 470) * k) + 2]);
    const outside = await compareImages(page, join(dir, "shots/baseline-no-shadow-gap-1x.png"), join(dir, "shots/lifted-no-shadow-gap-1x.png"), { exclude });
    note("Lifted, shadows off: nothing outside the floor mask changes with the candidate", outside.max === 0, outside);
    const inside = await compareImages(page, join(dir, "shots/baseline-no-shadow-gap-1x.png"), join(dir, "shots/lifted-no-shadow-gap-1x.png"));
    note("Lifted, shadows off: change inside the gap (for the record)", true, inside);
    await composeGrid(
      page,
      [
        { label: "M1.3I floor (synthesised), lifted, shadows off", path: join(dir, "shots/baseline-no-shadow-3x.png") },
        { label: `Candidate "${name}", lifted, shadows off`, path: join(dir, "shots/lifted-no-shadow-3x.png") },
        { label: `Candidate "${name}", lifted, as shipped (shadows on)`, path: join(dir, "shots/lifted-3x.png") },
      ],
      join(dir, "lift-gap-3x.png"),
      { columns: 1 },
    );
    await composeGrid(
      page,
      [
        { label: "M1.3I floor, lifted, shadows off (normal size)", path: join(dir, "shots/baseline-no-shadow-1x.png") },
        { label: `Candidate "${name}", lifted, shadows off (normal size)`, path: join(dir, "shots/lifted-no-shadow-1x.png") },
      ],
      join(dir, "lift-gap-1x.png"),
      { columns: 2 },
    );
  } finally {
    await page.close();
  }
  writeFileSync(join(dir, "compare.txt"), notes.join("\n") + "\n");
  const bad = notes.filter((l) => l.startsWith("BAD")).length;
  console.log(bad ? `${bad} check(s) failed` : `all checks OK: ${dir}`);
  process.exitCode = bad ? 1 : 0;
}

if (cmd === "prepare") await prepare();
else if (cmd === "integrate") await integrate(argv[1]);
else if (cmd === "clear") await clear();
else if (cmd === "compare") await compare();
else {
  console.log("usage: node scripts/inpaint-playground.mjs prepare | integrate <candidate.png> [--name id] | clear | compare [--name id]");
  process.exitCode = 1;
}
