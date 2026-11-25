// M1.4J.2: Educational's whole sequence with the lift held at 0: everything but the movement must be the approved scene.
//   BASE=http://localhost:<port> node liftoff.mjs <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const A = ARRIVE.educational;
const go = async (path, o = {}) => {
  const p = await open(path, { gpu: true, ...o });
  await p.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ".edu-lift{--dl:0!important;transition:none!important}"; document.head.append(e); return 1; })()`);
  const shot = async (n) => { for (let k = 0; k < 5; k++) { const r = await Promise.race([p.page.send("Page.captureScreenshot", { format: "png" }).catch(() => null), sleep(8000)]); if (r?.data) return writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); } throw new Error("no screenshot " + n); };
  return { ...p, shot };
};
const finish = (p) => p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
{
  const p = await go("/lab-v2"); await p.finish(); await p.shot("rest");
  const c = await p.page.center('[data-hotspot="educational"]'); await p.page.mouseMove(c.x, c.y); await p.frame();
  for (const t of [-230, 40, 150, 230, 300, 450, 600, 740, 1500]) { await p.seek(A + t); await sleep(250); await p.shot("t" + t); }
  await p.seek(A + 2400); await sleep(400); await p.shot("powered");
  await finish(p); await sleep(200);
  await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); queueMicrotask(() => document.getAnimations().forEach((a) => a.pause())); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
  await p.away(); await p.frame();
  for (const t of [60, 200, 350]) { await p.seek(t); await sleep(250); await p.shot("leave" + t); }
  await finish(p); await sleep(1300); await p.shot("back"); await p.page.close();
}
for (const [n, path, o] of [["selected", "/lab-v2?station=educational", {}], ["reduced-selected", "/lab-v2?station=educational", { reducedMotion: true }], ["reduced", "/lab-v2", { reducedMotion: true }]]) {
  const p = await go(path, o); await sleep(1500); await p.finish(); await sleep(400);
  if (n === "reduced") { const c = await p.page.center('[data-hotspot="educational"]'); await p.page.mouseMove(c.x, c.y); await sleep(900); await p.finish(); await sleep(400); }
  await p.shot(n); await p.page.close();
}
process.exit(0);
