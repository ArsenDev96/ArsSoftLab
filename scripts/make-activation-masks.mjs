#!/usr/bin/env node
// M1.3C activation overlays, built from the plate's own pixels.
//
// Each output is a full-frame image at half resolution (836 x 471, drawn
// scaled up), fully transparent except where the artwork already glows:
//
//   lit images (RGBA, colour = a brighter copy of the pixel's own colour,
//   alpha = how strongly it belongs to the feature, plus a soft bloom):
//     core.png         the central A and its hoop (origin flash)
//     engineering.png  laptop code, glass chart and side panel (cyan only)
//     playground.png   purple neon and amber marquee (M1.3E: the screen is
//                      the live game now, see ArcadeScreen; not lit here)
//     educational.png  the globe's blue glass shells (+ wide bloom)
//     creative.png     the painting and the two prints (M1.3D)
//     experience.png   the winding path's own pixels (M1.3D)
//   masks (white, alpha only), for sweeps and travelling light:
//     engineering-scan.png      the same cyan pixels as engineering.png
//     creative-scan.png         the canvas face quad
//     experience-scan(-glow).png  the path pixels, crisp and soft
//     connections-wide.png      a wider soft halo of masks/connections.png
//                               (the hover spark's outer glow)
//   data:
//     components/lab/experience-path.ts  the path's route, snapped to its pixels
//
// Fading a lit image in can only intensify light that is painted there: no
// new geometry. Regions are hand-traced polygons (reference px, 1672 x 941);
// colour tests do the actual selection inside them.
//
// No Python on the build machine, so this runs in headless Chrome (canvas)
// through scripts/visual/cdp.mjs. Node 22+, Chrome/Edge (CHROME_PATH).
//
// Usage: node scripts/make-activation-masks.mjs [--preview <dir>]
//   --preview  also writes each feature tinted red over the plate, for review.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch } from "./visual/cdp.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "public", "scene", "activation");
const argv = process.argv.slice(2);
const PREVIEW = argv.includes("--preview") ? resolve(argv[argv.indexOf("--preview") + 1]) : null;

// Regions (reference px). Generous: the colour tests do the selecting.
const R = {
  coreHoop: { ellipse: [839, 570, 70, 47] },
  engScreens: [[338, 381], [482, 381], [500, 408], [546, 408], [558, 446], [558, 474], [352, 484], [345, 440]],
  cabinet: [[1124, 348], [1212, 348], [1229, 376], [1271, 376], [1275, 449], [1302, 441], [1302, 474], [1254, 486], [1193, 492], [1110, 489], [1104, 456], [1122, 398]],
  marquee: [[1133, 355], [1206, 355], [1206, 376], [1133, 376]],
  arcadeScreen: [[1144.5, 394.5], [1224, 396.5], [1218, 443.5], [1137.5, 440.5]],
  // M1.3E: the measured display quad (scene-fx game.quad) grown by 2 px,
  // so its half-lit edge into the bezel is excluded too.
  arcadeScreenEdge: [[1153.6, 394.5], [1223.6, 396.6], [1210.8, 445.1], [1138, 441.9]],
  dome: [[706, 282], [800, 278], [905, 290], [978, 330], [984, 395], [960, 437], [880, 446], [760, 444], [712, 420], [700, 360]],
  // M1.3D
  canvas: [[176, 548], [300, 546], [324, 664], [199, 675.5]],
  photo1: [[334, 661], [375, 659], [380, 689], [338, 692]],
  photo2: [[381, 665], [425, 664], [427, 688], [384, 690]],
};

/**
 * Experience's winding path, traced by eye from the front edge up to the
 * peak (reference px). Each point is snapped to the centroid of the path's
 * own bright pixels before use, and the result is written to
 * components/lab/experience-path.ts for the travelling highlight.
 */
const EXPERIENCE_TRACE = [
  [1400, 703], [1412, 703], [1425, 702], [1440, 699], [1452, 695], [1462, 690], [1468, 683], [1465, 677],
  [1455, 674], [1443, 672], [1432, 670], [1438, 667], [1450, 665], [1463, 663], [1476, 662], [1488, 660],
  [1497, 657], [1508, 653], [1520, 650], [1531, 646], [1532, 642], [1522, 639], [1508, 636], [1494, 633],
  [1482, 630], [1470, 628], [1466, 625], [1474, 621], [1484, 618], [1490, 614], [1492, 609], [1490, 604],
];
R.path = { polyline: EXPERIENCE_TRACE, width: 13 };

// Per feature: region, weight(r, g, b) in 0..1, colour gain, core strength,
// bloom radius (full-res px) and strength.
const FEATURES = [
  {
    name: "core",
    regions: [R.coreHoop],
    weight: (r, g, b) => s(0.45, 0.9, r) * s(0.1, 0.35, r - b),
    gain: 1.45, core: 0.9, bloom: 5, bloomA: 0.55,
  },
  {
    name: "engineering",
    regions: [R.engScreens],
    weight: (r, g, b) => s(0.14, 0.5, Math.max(g, b)) * s(-0.03, 0.12, b - r),
    gain: 2.3, core: 1, bloom: 5, bloomA: 1,
    scan: true,
  },
  {
    name: "playground",
    regions: [R.cabinet],
    weight: (r, g, b, inside) => {
      const purple = s(0.08, 0.3, Math.min(r, b) - g) * s(0.3, 0.75, Math.max(r, b));
      const amber = inside.marquee ? s(0.35, 0.8, r) * s(0.08, 0.3, r - b) : 0;
      // The screen's own content is excluded: the game covers it, and a
      // lit copy would rim the game with the old artwork's edge.
      return inside.arcadeScreen ? 0 : Math.max(purple, amber);
    },
    extra: { marquee: R.marquee, arcadeScreen: R.arcadeScreenEdge },
    gain: 2, core: 1, bloom: 6, bloomA: 1,
  },
  {
    name: "educational",
    regions: [R.dome],
    weight: (r, g, b) => s(0.3, 0.75, b) * s(0.04, 0.2, b - r),
    gain: 1.45, core: 0.85, bloom: 11, bloomA: 0.7,
  },
  {
    // The painting and the two prints, lit as a whole (feathered edges, so
    // no seam): brighter and a little richer, as if a lamp came up on them.
    name: "creative",
    regions: [R.canvas, R.photo1, R.photo2],
    feather: 1,
    weight: () => 0.9,
    gain: 1.32, sat: 1.18, core: 1, bloom: 3, bloomA: 0.35,
  },
  {
    // Only the path's own bright pixels inside a narrow corridor around it
    // (the amber mountain wireframe nearby is excluded by the corridor).
    name: "experience",
    regions: [R.path],
    weight: (r, g, b) => s(0.42, 0.78, 0.5 * r + 0.4 * g + 0.1 * b) * s(0.04, 0.22, r - b),
    gain: 1.5, core: 1, bloom: 4, bloomA: 0.85,
    scan: true,
    scanGlow: 3,
  },
];
const SCREEN_MASKS = [
  { name: "creative-scan", region: R.canvas, feather: 1 },
];

function s(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const plate = "data:image/webp;base64," + readFileSync(join(ROOT, "public", "scene", "lab-plate.webp")).toString("base64");
const page = await launch({ width: 400, height: 300 });
mkdirSync(OUT, { recursive: true });
if (PREVIEW) mkdirSync(PREVIEW, { recursive: true });

try {
  await page.eval(`(async () => {
    const img = new Image(); img.src = ${JSON.stringify(plate)}; await img.decode();
    const W = img.width, H = img.height;
    const canvas = (w = W, h = H) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const base = canvas(); base.getContext("2d").drawImage(img, 0, 0);
    const px = base.getContext("2d").getImageData(0, 0, W, H).data;
    /** Antialiased coverage (0..1) of a polygon / ellipse, optionally feathered. */
    window.region = (shape, feather = 0) => {
      const c = canvas(); const g = c.getContext("2d");
      if (feather) g.filter = "blur(" + feather + "px)";
      g.fillStyle = g.strokeStyle = "#fff"; g.beginPath();
      if (shape.ellipse) { const [x, y, rx, ry] = shape.ellipse; g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
      else if (shape.polyline) {
        g.lineWidth = shape.width; g.lineJoin = g.lineCap = "round";
        shape.polyline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      } else { shape.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.fill(); }
      const d = g.getImageData(0, 0, W, H).data; const out = new Float32Array(W * H);
      for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255;
      return out;
    };
    window.ctx = { W, H, px, canvas, base };
    return true;
  })()`);

  const toFile = (name, dataUrl, dir = OUT) =>
    writeFileSync(join(dir, `${name}.${dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png"}`), Buffer.from(dataUrl.split(",")[1], "base64"));

  for (const f of FEATURES) {
    const url = await page.eval(`(() => {
      const { W, H, px, canvas, base } = window.ctx;
      const s = ${s.toString()};
      const weight = ${f.weight.toString()};
      const clip = ${JSON.stringify(f.regions)}.map((r) => region(r, ${f.feather ?? 0})).reduce((a, b) => a.map((v, i) => Math.max(v, b[i])));
      const weights = new Float32Array(W * H);
      window.ctx[${JSON.stringify(f.name)} + "-w"] = weights;
      const extra = Object.fromEntries(Object.entries(${JSON.stringify(f.extra ?? {})}).map(([k, r]) => [k, region(r)]));
      // Core: brighter copy of each pixel's own colour, alpha = weight.
      const core = canvas(); const cg = core.getContext("2d"); const out = cg.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        if (!clip[i]) continue;
        const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
        const inside = Object.fromEntries(Object.entries(extra).map(([k, m]) => [k, m[i] > 0.5]));
        const w = clip[i] * weight(r, g, b, inside);
        if (w <= 0.002) continue;
        weights[i] = w;
        // Saturation about the pixel's own luminance, then gain.
        const l = 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2];
        for (let k = 0; k < 3; k++) out.data[i * 4 + k] = Math.min(255, Math.max(0, (l + (px[i * 4 + k] - l) * ${f.sat ?? 1}) * ${f.gain}));
        out.data[i * 4 + 3] = Math.round(255 * Math.min(1, w * ${f.core}));
      }
      cg.putImageData(out, 0, 0);
      window.ctx[${JSON.stringify(f.name)}] = core;
      // Bloom under the core, then the core; downsample to half resolution.
      const full = canvas(); const fg = full.getContext("2d");
      fg.filter = "blur(${f.bloom}px)"; fg.globalAlpha = ${f.bloomA}; fg.drawImage(core, 0, 0);
      fg.filter = "none"; fg.globalAlpha = 1; fg.drawImage(core, 0, 0);
      const half = canvas(Math.round(W / 2), Math.round(H / 2)); const hg = half.getContext("2d");
      hg.imageSmoothingQuality = "high"; hg.drawImage(full, 0, 0, half.width, half.height);
      window.ctx[${JSON.stringify(f.name)} + "-full"] = full;
      return half.toDataURL("image/png");
    })()`);
    toFile(f.name, url);
    if (f.scan) {
      // Alpha-only copy of the same pixels, for the sweep band.
      const scan = await page.eval(`(() => {
        const { W, H, canvas } = window.ctx; const src = window.ctx[${JSON.stringify(f.name)}];
        const c = canvas(); const g = c.getContext("2d"); g.filter = "blur(0.8px)"; g.drawImage(src, 0, 0);
        g.globalCompositeOperation = "source-in"; g.filter = "none"; g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
        const half = canvas(Math.round(W / 2), Math.round(H / 2)); half.getContext("2d").drawImage(c, 0, 0, half.width, half.height);
        return half.toDataURL("image/png");
      })()`);
      toFile(`${f.name}-scan`, scan);
      if (f.scanGlow) {
        // Soft version for the travelling highlight's halo.
        const glow = await page.eval(`(() => {
          const { W, H, canvas } = window.ctx; const src = window.ctx[${JSON.stringify(f.name)}];
          const c = canvas(); const g = c.getContext("2d");
          for (let i = 0; i < 3; i++) { g.filter = "blur(${f.scanGlow}px)"; g.drawImage(src, 0, 0); }
          g.globalCompositeOperation = "source-in"; g.filter = "none"; g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
          const half = canvas(Math.round(W / 2), Math.round(H / 2)); half.getContext("2d").drawImage(c, 0, 0, half.width, half.height);
          return half.toDataURL("image/png");
        })()`);
        toFile(`${f.name}-scan-glow`, glow);
      }
    }
    if (PREVIEW) {
      // Cropped to the feature (a full-frame data URL stalls DevTools):
      // plate | plate + overlay | overlay pixels tinted red, at 2x.
      const pts = f.regions.flatMap((r) => (r.ellipse ? [[r.ellipse[0] - r.ellipse[2], r.ellipse[1] - r.ellipse[3]], [r.ellipse[0] + r.ellipse[2], r.ellipse[1] + r.ellipse[3]]] : (r.polyline ?? r)));
      const pad = 18;
      const x = Math.floor(Math.min(...pts.map((p) => p[0])) - pad);
      const y = Math.floor(Math.min(...pts.map((p) => p[1])) - pad);
      const w = Math.ceil(Math.max(...pts.map((p) => p[0])) + pad) - x;
      const h = Math.ceil(Math.max(...pts.map((p) => p[1])) + pad) - y;
      const prev = await page.eval(`(() => {
        const { canvas, base } = window.ctx; const full = window.ctx[${JSON.stringify(f.name)} + "-full"];
        const [x, y, w, h, k] = [${x}, ${y}, ${w}, ${h}, 2];
        const out = canvas(w * k, h * k * 3); const g = out.getContext("2d");
        const tile = (i, draw) => { g.save(); g.beginPath(); g.rect(0, i * h * k, w * k, h * k); g.clip(); g.translate(0, i * h * k); g.scale(k, k); g.translate(-x, -y); draw(); g.restore(); };
        tile(0, () => g.drawImage(base, 0, 0));
        tile(1, () => { g.drawImage(base, 0, 0); g.drawImage(full, 0, 0); });
        const tint = canvas(); const tg = tint.getContext("2d"); tg.drawImage(full, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#ff2030"; tg.fillRect(0, 0, tint.width, tint.height);
        tile(2, () => { g.drawImage(base, 0, 0); g.globalAlpha = 0.85; g.drawImage(tint, 0, 0); });
        return out.toDataURL("image/jpeg", 0.9);
      })()`);
      toFile(`preview-${f.name}`, prev, PREVIEW);
    }
    console.log(`wrote ${f.name}.png${f.scan ? ` + ${f.name}-scan.png` : ""}`);
  }

  for (const m of SCREEN_MASKS) {
    const url = await page.eval(`(() => {
      const { W, H, canvas } = window.ctx; const a = region(${JSON.stringify(m.region)}, ${m.feather});
      const c = canvas(); const g = c.getContext("2d"); const d = g.createImageData(W, H);
      for (let i = 0; i < W * H; i++) { d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = 255; d.data[i * 4 + 3] = Math.round(255 * a[i]); }
      g.putImageData(d, 0, 0);
      const half = canvas(Math.round(W / 2), Math.round(H / 2)); half.getContext("2d").drawImage(c, 0, 0, half.width, half.height);
      return half.toDataURL("image/png");
    })()`);
    toFile(m.name, url);
    console.log(`wrote ${m.name}.png`);
  }

  // Experience path: snap each traced point to the weighted centroid of the
  // path pixels around it, then write the route for the highlight.
  const snapped = await page.eval(`(() => {
    const { W } = window.ctx; const w = window.ctx["experience-w"]; const R = 5;
    return ${JSON.stringify(EXPERIENCE_TRACE)}.map(([x, y]) => {
      let sx = 0, sy = 0, sw = 0;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        const v = w[(Math.round(y) + dy) * W + Math.round(x) + dx] ** 2;
        sx += v * (x + dx); sy += v * (y + dy); sw += v;
      }
      return sw > 0.5 ? [+(sx / sw).toFixed(1), +(sy / sw).toFixed(1)] : [x, y];
    });
  })()`);
  writeFileSync(
    join(ROOT, "components", "lab", "experience-path.ts"),
    `// Generated by scripts/make-activation-masks.mjs: Experience's painted path,\n` +
      `// front edge -> peak, each traced point snapped to the path's own pixels.\n` +
      `// Do not edit by hand; edit EXPERIENCE_TRACE there and re-run.\n` +
      `export const EXPERIENCE_PATH: readonly (readonly [number, number])[] = ${JSON.stringify(snapped)};\n`,
  );
  console.log(`wrote components/lab/experience-path.ts (${snapped.length} points)`);

  // A wider, soft halo of the existing connection lines, for the hover
  // spark only (the lines themselves still come from connections.png).
  const conn = "data:image/png;base64," + readFileSync(join(ROOT, "public", "scene", "masks", "connections.png")).toString("base64");
  const wide = await page.eval(`(async () => {
    const { W, H, canvas } = window.ctx; const img = new Image(); img.src = ${JSON.stringify(conn)}; await img.decode();
    const c = canvas(); const g = c.getContext("2d"); g.filter = "blur(6px)"; g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H); for (let i = 3; i < d.data.length; i += 4) d.data[i] = Math.min(255, d.data[i] * 3.2);
    g.putImageData(d, 0, 0);
    const half = canvas(Math.round(W / 2), Math.round(H / 2)); half.getContext("2d").drawImage(c, 0, 0, half.width, half.height);
    return half.toDataURL("image/png");
  })()`);
  toFile("connections-wide", wide);
  console.log("wrote connections-wide.png");
} finally {
  await page.close();
}
