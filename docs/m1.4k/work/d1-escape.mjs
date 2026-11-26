// M1.4K.7 (D1 fix): AZIZ selected, then Escape, 3 times: Playground's ring and strips per frame through the return.
//   node d1-escape.mjs   (BASE to choose the server)
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const page = await launch({ width: 1648, height: 928 });
await page.goto((process.env.BASE || "http://localhost:3002") + "/lab-v2");
await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s);
  const op = (q) => +getComputedStyle(document.querySelector(q)).opacity; window.__f = []; window.__rec = false;
  (function f(t) { if (window.__rec) { const m = document.querySelector("[data-lab-hover],[data-lab-selected],[data-lab-returning]"); window.__f.push({ t: Math.round(t), hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, sel: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, ret: document.querySelector("[data-lab-returning]")?.dataset.labReturning ?? null, ring: +op('[data-v2-ring="playground"] .lab-v2-power-lit').toFixed(3), strip: +(1 - op(".lab-v2-strip-off")).toFixed(3) }); } requestAnimationFrame(f); })(performance.now()); return 1; })()`);
await page.mouseMove(4, 924); await sleep(2000);
const out = [];
for (let k = 0; k < 3; k++) {
  const c0 = await page.center('[data-station="playground"] .lab-chip'); await page.mouseMove(c0.x, c0.y); await sleep(1800);
  const c = await page.center('[data-station="playground"] .lab-chip'); await page.click(c.x, c.y); await sleep(1800);
  const sel = await page.eval("location.search");
  await page.eval("(window.__f.length = 0, window.__rec = true, 1)");
  await page.key("Escape", "Escape", 27); await sleep(1800);
  const f = await page.eval("(window.__rec = false, window.__f.slice())");
  const gap = f.filter((q) => !q.hover && !q.sel).length, mn = Math.min(...f.filter((q) => q.hover === "playground" || q.sel === "playground" || q.ret === "playground").map((q) => Math.min(q.ring, q.strip)));
  const r = { selected: sel, after: await page.eval("location.search"), framesWithNeither: gap, returningSeen: f.some((q) => q.ret), minLightWhileOnPlayground: mn, end: f.at(-1) };
  out.push(r); console.log(JSON.stringify(r));
  await page.mouseMove(4, 924); await page.eval("(document.activeElement?.blur?.(), 1)"); await sleep(2000);
}
await page.close(); process.exit(0);
