// M1.4I.1C: where Playground's sign is (from the artwork's own pixels) and what the pointer meets there.
//   node docs/m1.4i1/work/sign-geometry.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { open, sleep } from "../../m1.4i/work/lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const L = await open(process.argv[2] ?? "/lab-v2", { gpu: true });
const { page, cam } = L;
const S = (x, y) => [cam.x + x * cam.k, cam.y + y * cam.k];

// What is under a grid over the sign, top first.
const at = async (x, y) => {
  const [sx, sy] = S(x, y);
  return page.eval(`document.elementsFromPoint(${sx}, ${sy}).slice(0, 4).map((e) => e.dataset.hotspot ? "hotspot:" + e.dataset.hotspot : e.dataset.station ? "label:" + e.dataset.station : e.tagName.toLowerCase() + "." + String(e.className.baseVal ?? e.className).split(" ").slice(0, 2).join(".")).join(" > ")`);
};
for (const [x, y] of [[1190, 322], [1190, 335], [1165, 340], [1230, 340], [1190, 348], [1190, 353], [1190, 360], [1262, 340], [1275, 345], [1283, 345]]) console.log(`(${x}, ${y})`, await at(x, y));
// Anything at all with pointer events between the hotspots and the top, over the sign?
console.log("all at the sign:", await page.eval(`document.elementsFromPoint(${S(1190, 335).join(",")}).map((e) => e.tagName + "[" + getComputedStyle(e).pointerEvents + "]" + (e.dataset.layer ?? e.dataset.camera ?? "") + "." + String(e.className).slice(0, 40)).join("\\n  ")`));
console.log("station image pointer-events:", await page.eval(`(() => { const i = document.querySelector('[data-v2-object="playground"]'); return i ? getComputedStyle(i).pointerEvents + " / parent " + getComputedStyle(i.parentElement).pointerEvents : null; })()`));

// The station's alpha and the sign's amber panel, in scene px.
const geo = await page.eval(`(async () => {
  const i = document.querySelector('[data-v2-object="playground"]');
  const m = new DOMMatrix(getComputedStyle(i).transform), k = i.offsetWidth / 1672;
  const sx = m.a, tx = m.e / k, ty = m.f / k;
  const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(i, 0, 0);
  const W = c.width, H = c.height, d = g.getImageData(0, 0, W, H).data, r = 1672 / W;
  const rows = {};
  for (let Y = 300; Y <= 400; Y += 4) {
    const py = Math.round((Y - ty) / sx / r); if (py < 0 || py >= H) continue;
    let a = null, b = null, pa = null, pb = null;
    for (let x = 0; x < W; x++) {
      const o = (py * W + x) * 4;
      const X = +(x * r * sx + tx).toFixed(1);
      if (d[o + 3] > 128) { if (a === null) a = X; b = X; }
      // The panel: amber (r > g > b, bright).
      if (d[o + 3] > 200 && d[o] > 170 && d[o + 1] > 95 && d[o + 2] < 120 && X > 1140 && X < 1262) { if (pa === null) pa = X; pb = X; }
    }
    rows[Y] = { art: [a, b], amber: [pa, pb] };
  }
  let top = null; for (let y = 0; y < H && top === null; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { top = +(y * r * sx + ty).toFixed(1); break; }
  return { natural: [W, H], scale: sx, tx, ty, top, rows };
})()`);
console.log("artwork top", geo.top, "scale", geo.scale, geo.tx, geo.ty);
for (const [y, r] of Object.entries(geo.rows)) console.log(y, "art", r.art.join("–"), " amber", r.amber.join("–"));

const rects = await page.eval(`(() => { const cam = document.querySelector(".lab-camera").getBoundingClientRect(), k = cam.width / 1672; const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map((v, i) => +(((v - (i % 2 ? cam.top : cam.left)) / k)).toFixed(1)); }; const s = document.querySelector('section[data-station="playground"]'); return { label: R(s), title: R(s.querySelector("button")), chip: R(s.querySelector("li button")), hotspot: R(document.querySelector('[data-hotspot="playground"]')) }; })()`);
console.log("label at rest", JSON.stringify(rects));
await L.hover("playground");
await sleep(2500);
console.log("label lifted ", JSON.stringify(await page.eval(`(() => { const cam = document.querySelector(".lab-camera").getBoundingClientRect(), k = cam.width / 1672; const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map((v, i) => +(((v - (i % 2 ? cam.top : cam.left)) / k)).toFixed(1)); }; const s = document.querySelector('section[data-station="playground"]'); return { label: R(s), title: R(s.querySelector("button")), chip: R(s.querySelector("li button")), lift: getComputedStyle(document.querySelector('.lab-lift[data-lift="playground"]')).transform }; })()`)));
const clip = { x: cam.x + 1040 * cam.k, y: cam.y + 280 * cam.k, width: 380 * cam.k, height: 290 * cam.k, scale: 2 };
writeFileSync(join(HERE, "sign-lifted.png"), Buffer.from((await page.send("Page.captureScreenshot", { format: "png", clip })).data, "base64"));
await L.away();
await sleep(1500);
writeFileSync(join(HERE, "sign-rest.png"), Buffer.from((await page.send("Page.captureScreenshot", { format: "png", clip })).data, "base64"));
await page.close();
process.exit(0);
