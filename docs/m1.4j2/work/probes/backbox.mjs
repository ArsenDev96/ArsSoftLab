// M1.4J.2: the dark box behind AriMap in some scaled captures after a frozen leave: here and on HEAD.   BASE=... node backbox.mjs <out prefix> <n>
import { writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const [out, n] = process.argv.slice(2), A = ARRIVE.educational;
const finish = (p) => p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
for (let k = 0; k < +n; k++) {
  const p = await open("/lab-v2", { gpu: true });
  const clip = async (s, name) => { const r = await p.page.send("Page.captureScreenshot", { format: "png", ...(s ? { clip: { x: p.cam.x + 638 * p.cam.k, y: p.cam.y + 214 * p.cam.k, width: 404 * p.cam.k, height: 316 * p.cam.k, scale: s } } : {}) }); writeFileSync(`${out}-${name}-${k}.png`, Buffer.from(r.data, "base64")); };
  await p.finish();
  await clip(1.7, "rest");
  const c = await p.page.center('[data-hotspot="educational"]'); await p.page.mouseMove(c.x, c.y); await p.frame();
  for (const t of [2400]) { await p.seek(A + t); await sleep(400); for (const s of [1.7, 5]) await clip(s, "x"); }
  await finish(p); await sleep(200);
  await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
  await p.away(); await p.frame(); await p.seek(147); await sleep(400); for (const s of [1.7, 5]) await clip(s, "x");
  await finish(p); await sleep(1700);
  await clip(1.7, "back"); await clip(0, "back1x");
  await p.page.close();
}
process.exit(0);
