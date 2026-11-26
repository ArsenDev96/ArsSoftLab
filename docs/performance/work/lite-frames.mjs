// M1.4K.4: when the slow frames fall after a hover (offsets from the move, ms), full vs lite, default Chrome.
//   node lite-frames.mjs [inject-css]   -> prints slow frames (> 50 ms) per hover
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const INJECT = process.argv[2] ?? "";
for (const mode of ["full", "lite"]) {
  const page = await launch({ width: 1648, height: 928 });
  await page.goto(`${BASE}/lab-v2?render=${mode}`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}" + ${JSON.stringify(INJECT)}; document.head.append(s);
    window.__f = []; window.__rec = false; (function f(t) { if (window.__rec) window.__f.push(t); requestAnimationFrame(f); })(performance.now()); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(2500);
  for (const id of ["engineering", "playground", "engineering"]) {
    const c = await page.center(`[data-hotspot="${id}"]`);
    await page.eval("(window.__f.length = 0, window.__rec = true, 1)");
    const t0 = await page.eval("performance.now()");
    await page.mouseMove(c.x, c.y); await sleep(1650);
    const f = await page.eval("(window.__rec = false, window.__f.slice())");
    const slow = f.slice(1).map((t, i) => [Math.round(f[i] - t0), Math.round(t - f[i])]).filter(([, d]) => d > 50);
    console.log(mode, id.padEnd(11), "frames", f.length, "slow (start ms, length ms):", JSON.stringify(slow));
    await page.mouseMove(4, 924); await sleep(2600);
  }
  await page.close();
}
process.exit(0);
