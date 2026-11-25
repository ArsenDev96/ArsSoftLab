// M1.4J.2 evidence: frozen frames at the sequence's own times (sheets.py composes them).   node capture.mjs <out dir> [css for a height test: 8,10,12]
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
const HEIGHTS = process.argv[3] ? process.argv[3].split(",").map(Number) : null;
mkdirSync(OUT, { recursive: true });
const A = ARRIVE.educational;
const R = {
  station: [[638, 214, 404, 316], 1.7], globe: [[655, 254, 352, 190], 2.4], top: [[748, 222, 196, 92], 5], label: [[738, 218, 220, 100], 4],
  line: [[806, 440, 66, 106], 6], lineRow: [[786, 440, 106, 106], 4], under: [[668, 468, 344, 56], 3], left: [[664, 466, 70, 46], 8], right: [[944, 466, 70, 46], 8], floor: [[640, 440, 400, 150], 2.4],
};
const clip = async (p, [x, y, w, h], scale) => {
  for (let k = 0; k < 5; k++) {
    const r = await Promise.race([p.page.send("Page.captureScreenshot", { format: "png", clip: { x: p.cam.x + x * p.cam.k, y: p.cam.y + y * p.cam.k, width: w * p.cam.k, height: h * p.cam.k, scale } }).catch(() => null), sleep(8000)]);
    if (r?.data) return Buffer.from(r.data, "base64");
  }
  throw new Error("no screenshot");
};
const full = async (p, n) => { const r = await p.page.send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); };
const state = (p) => p.page.eval(`(() => { const e = document.querySelector(".edu-v2 .edu-rise"), g = document.querySelector('[data-v2-ground="educational"]'); const t = getComputedStyle(e).transform; return { y: t === "none" ? 0 : +(-new DOMMatrix(t).f).toFixed(3), dl: +(+getComputedStyle(e).getPropertyValue("--dl")).toFixed(3), soft: +(1 - (1 - +getComputedStyle(g).fillOpacity) ** g.childElementCount).toFixed(3), contact: +(+getComputedStyle(document.querySelector('[data-v2-floor="contact-educational"]')).opacity).toFixed(3) }; })()`);
const info = {};
const take = async (p, name, only) => {
  await sleep(400);
  info[name] = await state(p);
  for (const [n, [r, s]] of Object.entries(R)) if (!only || only.includes(n)) writeFileSync(`${OUT}/${name}.${n}.png`, await clip(p, r, s));
};
const finish = (p) => p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
const enter = async (path = "/lab-v2") => {
  const p = await open(path, { gpu: true });
  await p.finish();
  return { ...p, hoverOn: async () => { const c = await p.page.center('[data-hotspot="educational"]'); await p.page.mouseMove(c.x, c.y); await p.frame(); } };
};
if (HEIGHTS) {
  for (const px of HEIGHTS) {
    const p = await enter();
    await p.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ".edu-lift{--edu-rise:round(nearest,calc(var(--u)*${px}),1px)!important}"; document.head.append(e); return 1; })()`);
    await p.hoverOn(); await p.seek(A + 2400);
    await take(p, `h${px}`, ["station", "top", "label", "under", "line", "left"]);
    await full(p, `h${px}-full`);
    await p.page.close();
  }
} else {
  for (const [key, path] of [["default", "/lab-v2"], ["tone", "/lab-v2?floor=approved"]]) {
    const p = await enter(path);
    await take(p, `${key}-rest`);
    if (key === "default") await full(p, "full-rest");
    await p.hoverOn();
    for (const [n, t] of [["0", 0], ["25", 224], ["50", 288], ["full", 2400]]) { await p.seek(A + t); await take(p, `${key}-${n}`); if (key === "default" && n === "full") await full(p, "full-raised"); }
    await finish(p); await sleep(200);
    await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); queueMicrotask(() => document.getAnimations().forEach((a) => a.pause())); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
    await p.away(); await p.frame(); await p.seek(147); await take(p, `${key}-leave`);
    await finish(p); await sleep(1300); await take(p, `${key}-back`);
    await p.page.close();
  }
  const p = await enter();
  await p.hoverOn();
  for (const t of [110, 160, 230, 300, 400, 500, 620, 740]) { await p.seek(A + t); await take(p, `m${t}`, ["globe"]); }
  await p.page.close();
}
writeFileSync(`${OUT}/states${HEIGHTS ? "-heights" : ""}.json`, JSON.stringify(info) + "\n");
console.log(JSON.stringify(info));
process.exit(0);
