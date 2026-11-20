// Pixel comparison done inside headless Chrome (canvas), so no image
// libraries are needed. Difference = per-pixel max channel delta (0–255).

import { readFileSync, writeFileSync } from "node:fs";

const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;

const BROWSER_HELPERS = `
  window.__load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  window.__pixels = (img) => { const c = new OffscreenCanvas(img.width, img.height); const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
  window.__png = async (canvas) => { const blob = await canvas.convertToBlob({ type: "image/png" }); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(",")[1]); f.readAsDataURL(blob); }); };
  true;
`;

/** Load the helper functions into a blank page. */
export async function prepare(page) {
  await page.send("Page.navigate", { url: "about:blank" });
  await new Promise((r) => setTimeout(r, 200));
  await page.eval(BROWSER_HELPERS);
}

/**
 * Compare two PNGs of identical size. `exclude` lists screen rectangles
 * [x0, y0, x1, y1] to ignore (they count as identical).
 * @returns {Promise<{ mean: number, max: number, over2: number, over12: number, width: number, height: number }>}
 */
export async function compareImages(page, aPath, bPath, { heatmapPath, gain = 40, exclude = [] } = {}) {
  const result = await page.eval(`(async () => {
    const [A, B] = await Promise.all([__load(${JSON.stringify(dataUrl(aPath))}), __load(${JSON.stringify(dataUrl(bPath))})]);
    if (A.width !== B.width || A.height !== B.height) return { error: "size mismatch " + A.width + "x" + A.height + " vs " + B.width + "x" + B.height };
    const W = A.width, H = A.height, a = __pixels(A), b = __pixels(B);
    const heat = new ImageData(W, H);
    const exclude = ${JSON.stringify(exclude)};
    const skip = new Uint8Array(W * H);
    for (const [x0, y0, x1, y1] of exclude)
      for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) skip.fill(1, y * W + Math.max(0, x0), y * W + Math.min(W, x1));
    let sum = 0, max = 0, over2 = 0, over12 = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (skip[i >> 2]) { heat.data[i + 3] = 255; continue; }
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      sum += d; if (d > max) max = d; if (d > 2) over2++; if (d > 12) over12++;
      const v = Math.min(255, d * ${gain});
      heat.data[i] = v; heat.data[i + 1] = v; heat.data[i + 2] = v; heat.data[i + 3] = 255;
    }
    const c = new OffscreenCanvas(W, H); c.getContext("2d").putImageData(heat, 0, 0);
    return { mean: sum / (W * H), max, over2, over12, width: W, height: H, heat: ${heatmapPath ? "await __png(c)" : "null"} };
  })()`);
  if (result.error) throw new Error(result.error);
  if (heatmapPath && result.heat) writeFileSync(heatmapPath, Buffer.from(result.heat, "base64"));
  delete result.heat;
  return result;
}

/**
 * Grid of labelled tiles. Each item may crop its source ([x0, y0, x1, y1]);
 * every tile is drawn at the first tile's size times `scale`.
 * `pixelated` uses nearest-neighbour enlargement (for edge inspection).
 */
export async function composeGrid(page, items, outPath, { columns = 2, scale = 1, pixelated = false } = {}) {
  // One image per call: a single evaluate carrying many full-size PNGs
  // (tens of MB of base64) can stall the DevTools connection.
  await page.eval(`window.__grid = []; true`);
  for (const i of items) {
    await page.eval(`(async () => { const it = ${JSON.stringify({ label: i.label, crop: i.crop ?? null, src: dataUrl(i.path) })}; __grid.push({ ...it, img: await __load(it.src) }); return true; })()`);
  }
  const b64 = await page.eval(`(async () => {
    const items = __grid;
    const imgs = items.map((i) => i.img);
    const box = (k) => items[k].crop ?? [0, 0, imgs[k].width, imgs[k].height];
    const [a, b, c, d] = box(0);
    const tw = Math.round((c - a) * ${scale}), th = Math.round((d - b) * ${scale}), gap = 10, top = 28;
    const cols = Math.min(${columns}, items.length), rows = Math.ceil(items.length / cols);
    const cv = new OffscreenCanvas(cols * tw + (cols - 1) * gap, rows * (th + top) + (rows - 1) * gap);
    const x = cv.getContext("2d");
    x.fillStyle = "#0e0e10"; x.fillRect(0, 0, cv.width, cv.height);
    x.imageSmoothingEnabled = ${!pixelated}; x.imageSmoothingQuality = "high";
    x.font = "14px system-ui, sans-serif"; x.fillStyle = "#f2be78";
    imgs.forEach((img, k) => {
      const [x0, y0, x1, y1] = box(k);
      const cx = (k % cols) * (tw + gap), cy = Math.floor(k / cols) * (th + top + gap);
      x.drawImage(img, x0, y0, x1 - x0, y1 - y0, cx, cy + top, tw, th);
      x.fillText(items[k].label, cx + 4, cy + 19);
    });
    return await __png(cv);
  })()`);
  writeFileSync(outPath, Buffer.from(b64, "base64"));
}

/** Side-by-side sheet of labelled images (each scaled to `tileWidth`). */
export async function composeSheet(page, items, outPath, { tileWidth = 824 } = {}) {
  const payload = JSON.stringify(items.map((i) => ({ label: i.label, src: dataUrl(i.path) })));
  const b64 = await page.eval(`(async () => {
    const items = ${payload};
    const imgs = await Promise.all(items.map((i) => __load(i.src)));
    const tw = ${tileWidth}, th = Math.round(tw * imgs[0].height / imgs[0].width), gap = 12, top = 34;
    const c = new OffscreenCanvas(items.length * tw + (items.length - 1) * gap, th + top);
    const x = c.getContext("2d");
    x.fillStyle = "#0e0e10"; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = "high";
    x.font = "15px system-ui, sans-serif"; x.fillStyle = "#f2be78";
    imgs.forEach((img, k) => { x.drawImage(img, k * (tw + gap), top, tw, th); x.fillText(items[k].label, k * (tw + gap) + 6, 22); });
    return await __png(c);
  })()`);
  writeFileSync(outPath, Buffer.from(b64, "base64"));
}
