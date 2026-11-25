// M1.4J.4 evidence: frozen frames at the sequence's own times (sheets.py composes them).   node capture.mjs <out dir> [0,8,10,12: height test]
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
const HEIGHTS = process.argv[3] ? process.argv[3].split(",").map(Number) : null;
mkdirSync(OUT, { recursive: true });
const A = ARRIVE.experience;
const R = {
  station: [[1150, 486, 522, 404], 1.6], close: [[1190, 496, 482, 312], 2.9], trail: [[1384, 528, 190, 196], 4], panel: [[1376, 490, 180, 170], 4], label: [[1196, 556, 250, 116], 3.4], pg: [[1330, 486, 110, 90], 5],
  line: [[1140, 664, 110, 76], 6], under: [[1190, 722, 482, 78], 2.9], left: [[1180, 690, 110, 80], 5], right: [[1560, 716, 112, 80], 5], floor: [[1040, 660, 632, 240], 1.8], plant: [[1470, 610, 202, 240], 2.8],
};
const clip = async (p, [x, y, w, h], scale) => {
  for (let k = 0; k < 5; k++) {
    const r = await Promise.race([p.page.send("Page.captureScreenshot", { format: "png", clip: { x: p.cam.x + x * p.cam.k, y: p.cam.y + y * p.cam.k, width: w * p.cam.k, height: h * p.cam.k, scale } }).catch(() => null), sleep(8000)]);
    if (r?.data) return Buffer.from(r.data, "base64");
  }
  throw new Error("no screenshot");
};
const full = async (p, n) => { const r = await p.page.send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); };
const state = (p) => p.page.eval(`(() => { const e = document.querySelector(".exp-v2 .exp-rise"), g = document.querySelector('[data-v2-ground="experience"]'); const t = getComputedStyle(e).transform; return { y: t === "none" ? 0 : +(-new DOMMatrix(t).f).toFixed(3), cl: +(+getComputedStyle(e).getPropertyValue("--xl")).toFixed(3), soft: +(1 - (1 - +getComputedStyle(g).fillOpacity) ** g.childElementCount).toFixed(3), contact: +(+getComputedStyle(document.querySelector('[data-v2-floor="contact-experience"]')).opacity).toFixed(3) }; })()`);
const info = {};
const take = async (p, name, only) => {
  await sleep(350);
  info[name] = await state(p);
  for (const [n, [r, s]] of Object.entries(R)) if (!only || only.includes(n)) writeFileSync(`${OUT}/${name}.${n}.png`, await clip(p, r, s));
};
const finish = (p) => p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
const enter = async (path = "/lab-v2") => {
  const p = await open(path, { gpu: true });
  await p.finish();
  return { ...p, hoverOn: async () => { const c = await p.page.center('[data-hotspot="experience"]'); await p.page.mouseMove(c.x, c.y); await p.frame(); } };
};
if (HEIGHTS) {
  for (const px of HEIGHTS) {
    const p = await enter();
    await p.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ".exp-lift{--exp-rise:round(nearest,calc(var(--u)*${px}),1px)!important}"; document.head.append(e); return 1; })()`);
    await p.hoverOn(); await p.seek(A + 2400); await take(p, `h${px}`, ["station", "pg", "label", "under", "left", "right", "panel"]); await p.page.close();
  }
} else {
  for (const [key, path] of [["default", "/lab-v2"], ["tone", "/lab-v2?floor=approved"]]) {
    const p = await enter(path);
    await take(p, `${key}-rest`); if (key === "default") await full(p, "full-rest");
    await p.hoverOn();
    for (const [n, t] of [["0", 0], ["25", 236], ["50", 301], ["full", 2400]]) { await p.seek(A + t); await take(p, `${key}-${n}`); if (key === "default" && n === "full") await full(p, "full-raised"); }
    await finish(p); await sleep(200);
    await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); queueMicrotask(() => document.getAnimations().forEach((a) => a.pause())); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
    await p.away(); await p.frame(); await p.seek(147); await take(p, `${key}-leave`);
    await finish(p); await sleep(1300); await take(p, `${key}-back`);
    await p.page.close();
  }
  const p = await enter();
  await p.hoverOn();
  for (const t of [150, 250, 320, 388, 460, 545, 650, 720, 790, 850]) { await p.seek(A + t); await take(p, `m${t}`, ["trail"]); }
  await p.page.close();
  // Lifted as it is, with the strips' light in one piece on the floor: what the split is for.
  const n = await enter();
  await n.page.eval(`(() => { const e = document.createElement("style"); e.textContent = '[data-exp="light-stable"]{translate:none!important}[data-exp="light-stable-edge"],[data-exp="light-stable-spill"]{display:none!important}'; document.head.append(e); return 1; })()`);
  await n.hoverOn(); await n.seek(A + 2400); await take(n, "plain", ["left", "under"]); await n.page.close();
}
writeFileSync(`${OUT}/states${HEIGHTS ? "-heights" : ""}.json`, JSON.stringify(info) + "\n");
console.log(JSON.stringify(info));
process.exit(0);
