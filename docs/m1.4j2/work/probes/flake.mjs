// M1.4J.2: raster corruption on this GPU: real hover cycles, Educational's area captured powered and back at rest; frames that
// differ from the page's own usual one.   BASE=... node flake.mjs <out dir> <cycles> [frozen]
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const [OUT, N, mode] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const p = await open("/lab-v2", { gpu: true });
const shot = async (n) => { const r = await p.page.send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); };
const finish = () => p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
const c = await p.page.center('[data-hotspot="educational"]'), g = await p.page.center('[data-hotspot="playground"]');
for (let k = 0; k < +N; k++) {
  const id = k % 3 === 2 ? "p" : "e", q = id === "p" ? g : c;
  await p.page.mouseMove(q.x, q.y);
  if (mode === "frozen") {
    await p.frame(); for (const t of [100, 300, 450]) { await p.seek(ARRIVE[id === "p" ? "playground" : "educational"] + t); await sleep(120); }
    await finish(); await sleep(150);
    await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
    await p.away(); await p.frame(); await p.seek(200); await sleep(150); await finish(); await sleep(1300);
  } else { await sleep(1900); await shot(`${id}-on-${k}`); await p.off(); await sleep(2200); }
  await shot(`rest-${k}`);
}
console.log(OUT, p.errors.length);
await p.page.close();
process.exit(0);
