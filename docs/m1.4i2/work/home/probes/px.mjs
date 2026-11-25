// Screenshots decoded and compared in a second Chrome (no image library here).
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../../../scripts/visual/cdp.mjs";

export async function shot(page, name, clip) {
  for (let k = 0; k < 5; k++) {
    const r = await Promise.race([page.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) }).catch(() => null), sleep(8000)]);
    if (r?.data) {
      if (name) writeFileSync(`cap/${name}.png`, Buffer.from(r.data, "base64"));
      return r.data;
    }
  }
  throw new Error("no screenshot");
}

export async function viewer() {
  const px = await launch({ width: 400, height: 300 });
  await px.eval(`(() => {
    window.P = {};
    window.put = async (k, b) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const i = await createImageBitmap(new Blob([u], { type: "image/png" })); const c = new OffscreenCanvas(i.width, i.height), g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(i, 0, 0); P[k] = { w: i.width, h: i.height, d: g.getImageData(0, 0, i.width, i.height).data }; return 1; };
    window.lum = (k) => { const { d } = P[k]; let s = 0, dark = 0; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; if (l < 3) dark++; } return { mean: +(s / (d.length / 4)).toFixed(2), blackShare: +(dark / (d.length / 4)).toFixed(3) }; };
    window.diff = (a, b) => { const A = P[a], B = P[b]; let mx = 0, n2 = 0, n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let i = 0; i < A.d.length; i += 4) { const m = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2])); if (m) n++; if (m > mx) mx = m; if (m > 2) { n2++; const q = i / 4, x = q % A.w, y = (q / A.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } } return { max: mx, changed: n, over2: n2, box: n2 ? [x0, y0, x1, y1] : null }; };
    return 1;
  })()`);
  return {
    put: (k, b) => px.eval(`put(${JSON.stringify(k)}, ${JSON.stringify(b)})`),
    lum: (k) => px.eval(`lum(${JSON.stringify(k)})`),
    diff: (a, b) => px.eval(`diff(${JSON.stringify(a)}, ${JSON.stringify(b)})`),
    close: () => px.close(),
  };
}
