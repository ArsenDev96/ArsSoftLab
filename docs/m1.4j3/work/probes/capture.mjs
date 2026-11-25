// M1.4J.3 evidence: frozen frames at the sequence's own times (sheets.py composes them).   node capture.mjs <out dir> [0,8,10,12: height test]
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
const HEIGHTS = process.argv[3] ? process.argv[3].split(",").map(Number) : null;
mkdirSync(OUT, { recursive: true });
const A = ARRIVE.creative;
const R = {
  station: [[56, 478, 540, 420], 1.6], close: [[84, 492, 440, 320], 3], canvas: [[150, 490, 190, 210], 4], label: [[300, 560, 290, 120], 3.4], top: [[180, 490, 150, 72], 5],
  line: [[470, 650, 130, 100], 6], under: [[170, 722, 360, 80], 3.4], right: [[420, 690, 140, 100], 5], left: [[84, 690, 150, 110], 5], steam: [[225, 700, 120, 110], 5], floor: [[60, 660, 520, 240], 2],
};
const clip = async (p, [x, y, w, h], scale) => {
  for (let k = 0; k < 5; k++) {
    const r = await Promise.race([p.page.send("Page.captureScreenshot", { format: "png", clip: { x: p.cam.x + x * p.cam.k, y: p.cam.y + y * p.cam.k, width: w * p.cam.k, height: h * p.cam.k, scale } }).catch(() => null), sleep(8000)]);
    if (r?.data) return Buffer.from(r.data, "base64");
  }
  throw new Error("no screenshot");
};
const full = async (p, n) => { const r = await p.page.send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); };
const state = (p) => p.page.eval(`(() => { const e = document.querySelector(".cre-v2 .cre-rise"), g = document.querySelector('[data-v2-ground="creative"]'); const t = getComputedStyle(e).transform; return { y: t === "none" ? 0 : +(-new DOMMatrix(t).f).toFixed(3), cl: +(+getComputedStyle(e).getPropertyValue("--cl")).toFixed(3), soft: +(1 - (1 - +getComputedStyle(g).fillOpacity) ** g.childElementCount).toFixed(3), contact: +(+getComputedStyle(document.querySelector('[data-v2-floor="contact-creative"]')).opacity).toFixed(3) }; })()`);
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
  return { ...p, hoverOn: async () => { const c = await p.page.center('[data-hotspot="creative"]'); await p.page.mouseMove(c.x, c.y); await p.frame(); } };
};
if (HEIGHTS) {
  for (const px of HEIGHTS) {
    const p = await enter();
    await p.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ".cre-lift{--cre-rise:round(nearest,calc(var(--u)*${px}),1px)!important}"; document.head.append(e); return 1; })()`);
    await p.hoverOn(); await p.seek(A + 2400); await take(p, `h${px}`, ["station", "top", "label", "under", "left", "right", "steam"]); await p.page.close();
  }
} else {
  for (const [key, path] of [["default", "/lab-v2"], ["tone", "/lab-v2?floor=approved"]]) {
    const p = await enter(path);
    await take(p, `${key}-rest`); if (key === "default") await full(p, "full-rest");
    await p.hoverOn();
    for (const [n, t] of [["0", 0], ["25", 222], ["50", 288], ["full", 2400]]) { await p.seek(A + t); await take(p, `${key}-${n}`); if (key === "default" && n === "full") await full(p, "full-raised"); }
    await finish(p); await sleep(200);
    await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); queueMicrotask(() => document.getAnimations().forEach((a) => a.pause())); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
    await p.away(); await p.frame(); await p.seek(147); await take(p, `${key}-leave`);
    await finish(p); await sleep(1300); await take(p, `${key}-back`);
    await p.page.close();
  }
  const p = await enter();
  await p.hoverOn();
  for (const t of [150, 200, 260, 320, 420, 500, 600, 740]) { await p.seek(A + t); await take(p, `m${t}`, ["canvas", "close"]); }
  await p.page.close();
  // Lifted as it is, without the fill, the books and the whole steam: what those are for.
  const n = await enter();
  await n.page.eval(`(() => { const e = document.createElement("style"); e.textContent = '[data-cre="fill"],[data-cre="fill-off"],[data-cre="books"],[data-v2-recovered="steam-lifted"]{opacity:0!important}[data-v2-recovered="steam"]{opacity:1!important}'; document.head.append(e); return 1; })()`);
  await n.hoverOn(); await n.seek(A + 2400); await take(n, "plain", ["steam", "left", "station"]); await n.page.close();
}
writeFileSync(`${OUT}/states${HEIGHTS ? "-heights" : ""}.json`, JSON.stringify(info) + "\n");
console.log(JSON.stringify(info));
process.exit(0);
