// M1.4J.4: the floor left of the platform (M1.4H.4.1's disc) at frozen moments, and while it is raised.
//   BASE=http://localhost:<port> node disc.mjs <out dir>     (disc.py measures)
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const A = ARRIVE.experience;
const p = await open("/lab-v2", { gpu: true });
await p.finish();
const shot = async (n) => { await sleep(300); writeFileSync(`${OUT}/${n}.png`, Buffer.from((await p.page.send("Page.captureScreenshot", { format: "png" })).data, "base64")); };
await shot("rest");
const c = await p.page.center('[data-hotspot="experience"]'); await p.page.mouseMove(c.x, c.y); await p.frame();
for (const t of [0, 100, 200, 250, 300, 400, 550, 800, 2400]) { await p.seek(A + t); await shot("t" + t); }
await p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`); await sleep(200);
await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); queueMicrotask(() => document.getAnimations().forEach((a) => a.pause())); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
await p.away(); await p.frame();
for (const t of [60, 150, 250, 350]) { await p.seek(t); await shot("leave" + t); }
await p.page.close();
// Quick returns and a switch, in real time: the brightest the disc gets in any frame of a screencast-free poll.
const q = await open("/lab-v2", { gpu: true });
const d = await q.page.center('[data-hotspot="experience"]');
const now = async (n) => writeFileSync(`${OUT}/${n}.png`, Buffer.from((await q.page.send("Page.captureScreenshot", { format: "png", clip: { x: 1100, y: 670, width: 120, height: 90, scale: 1 } })).data, "base64"));
let k = 0;
for (const [at, gap] of [[200, 100], [400, 200], [900, 150], [1200, 300]]) {
  await q.page.mouseMove(d.x, d.y); await sleep(A + at); await q.away(); await sleep(90 + gap); await q.page.mouseMove(d.x, d.y);
  for (let i = 0; i < 14; i++) { await now(`quick-${k++}`); await sleep(40); }
  await q.away(); await sleep(1800);
}
await q.page.close();
process.exit(0);
