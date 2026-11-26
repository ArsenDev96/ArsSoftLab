// M1.4K.7 (D1 fix), M1.4K.9 (screen): Playground's ring, reflection, strips and arcade screen per frame in lite mode and with reduced motion (neither
// sends a spark), to compare builds: hover from rest, leave, and a quick return (leave 300 ms after the hover, back 100 ms
// later).   node d1-modes.mjs <label>   (BASE to choose the server)   -> results/d1-modes-<label>.json
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const label = process.argv[2] ?? "check";
const HOOK = `(() => {
  const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s);
  const op = (q) => +getComputedStyle(document.querySelector(q)).opacity;
  window.__f = []; window.__rec = false;
  (function f(t) { if (window.__rec) window.__f.push({ t: Math.round(t - window.__t0), hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
    ring: +op('[data-v2-ring="playground"] .lab-v2-power-lit').toFixed(3), refl: +op('[data-v2-reflection="playground"] .lab-v2-power-lit').toFixed(3), strip: +(1 - op(".lab-v2-strip-off")).toFixed(3), screen: +op('.lab-arcade[data-arcade="playground"]').toFixed(3) });
    requestAnimationFrame(f); })(performance.now()); return 1; })()`;
const res = {};
for (const [mode, query, reducedMotion] of [["lite", "?render=lite", false], ["reduced", "", true]]) {
  const page = await launch({ width: 1648, height: 928, reducedMotion });
  const errors = [];
  page.on((m) => { if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text); });
  await page.goto(`${BASE}/lab-v2${query}`);
  await page.eval(HOOK);
  await page.mouseMove(4, 924); await sleep(2500);
  const c = await page.center('[data-hotspot="playground"]');
  const rec = async (moves, ms) => {
    await page.eval("(window.__f.length = 0, window.__t0 = performance.now(), window.__rec = true, 1)");
    for (const [at, where] of moves) { const t = at - (await page.eval("performance.now() - window.__t0")); if (t > 0) await sleep(t); await page.mouseMove(...where); }
    await sleep(ms);
    return page.eval("(window.__rec = false, window.__f.slice())");
  };
  const IN = [c.x, c.y], OUT = [4, 924];
  // Warm the layers once, so neither build's first-use frame lands in a measured window.
  await rec([[0, IN], [900, OUT]], 900);
  const r = (res[mode] = { errors });
  r.hover = await rec([[0, IN]], 900);
  r.leave = await rec([[0, OUT]], 900);
  await sleep(600);
  r.quick = await rec([[0, IN], [300, OUT], [400, IN]], 1100);
  await rec([[0, OUT]], 1200);
  const at = (f, k, pred, from = 0) => f.find((q) => q.t >= from && pred(q[k]))?.t ?? null;
  const sum = (k) => ({
    hover50: at(r.hover, k, (v) => v >= 0.5), hover99: at(r.hover, k, (v) => v >= 0.99),
    leaveStart: at(r.leave, k, (v) => v < 0.99), leave50: at(r.leave, k, (v) => v <= 0.5), leaveDark: at(r.leave, k, (v) => v < 0.01),
    quickMinAfterReturn: Math.min(...r.quick.filter((q) => q.t >= 400).map((q) => q[k])), quick99: at(r.quick, k, (v) => v >= 0.99, 400),
  });
  r.summary = { ring: sum("ring"), reflection: sum("refl"), strip: sum("strip"), screen: sum("screen") };
  console.log(mode.padEnd(8), JSON.stringify(r.summary), "errors", errors.length);
  await page.close();
}
writeFileSync(new URL(`./results/d1-modes-${label}.json`, import.meta.url), JSON.stringify(res) + "\n");
process.exit(0);
