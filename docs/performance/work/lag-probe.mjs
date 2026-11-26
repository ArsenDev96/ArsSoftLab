// Animation lag diagnosis (diagnostic only; nothing in the app is changed). Real pointer, real time, 1648 x 928.
//   node lag-probe.mjs <mode: default|gpu> <config: base|A|B|C> [base-extras: 1]   -> results/<mode>-<config>.json
// default = Chrome's own GPU decision (this card is blocklisted: software compositing); gpu = the review probes' flags.
// A/B/C are CSS injected into this one page only (gone with it): A Engineering's soft ground shadow off, B floor reflections
// and floor light off, C every CSS/SVG filter off.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:3002";
const [mode = "default", config = "base", extras = "0"] = process.argv.slice(2);
import { CSS } from "./lag-css.mjs";
const _unused = {
  base: "",
  A: '[data-v2-ground="engineering"]{display:none!important}',
  B: '[data-v2-floor]:not([data-v2-floor^="contact"]):not([data-v2-floor="tone"]):not([data-v2-floor*="ring"]):not([data-v2-floor*="occlusion"]){display:none!important}',
  C: "*,*::before,*::after{filter:none!important;backdrop-filter:none!important}",
};
const ARRIVE = { engineering: 620, educational: 460, playground: 650, creative: 640, experience: 660 };
mkdirSync(join(HERE, "results"), { recursive: true });
const page = await launch({ width: 1648, height: 928, gpu: mode === "gpu" });
const errors = []; page.on((m) => { if (m.method === "Runtime.exceptionThrown") errors.push(String(m.params.exceptionDetails?.exception?.description).slice(0, 200)); });
await page.send("Performance.enable", { timeDomain: "timeTicks" });
const metrics = async () => Object.fromEntries((await page.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
const t0 = Date.now();
await page.goto(BASE + "/lab-v2");
const res = { mode, config, load: {}, runs: [] };
const m0 = await metrics();
res.load = { wallMs: Date.now() - t0, ...(await page.eval(`(() => { const n = performance.getEntriesByType("navigation")[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; })()`)), taskMs: Math.round(m0.TaskDuration * 1000), scriptMs: Math.round(m0.ScriptDuration * 1000), styleMs: Math.round(m0.RecalcStyleDuration * 1000), layoutMs: Math.round(m0.LayoutDuration * 1000) };
await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}" + ${JSON.stringify(CSS[config])}; document.head.append(s); return 1; })()`);
// What the page is made of (counted once).
res.inventory = await page.eval(`(() => { const cam = document.querySelector(".lab-camera").getBoundingClientRect(), A = cam.width * cam.height; const all = [...document.querySelectorAll(".lab-camera *")];
  const cs = all.map((e) => [e, getComputedStyle(e)]); const big = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height >= 0.5 * A; };
  const imgs = all.filter((e) => e.tagName === "IMG"); const mp = imgs.reduce((t, i) => t + i.naturalWidth * i.naturalHeight, 0);
  return { elements: all.length, images: imgs.length, imageMpx: +(mp / 1e6).toFixed(1), fullFrameImages: imgs.filter(big).length,
    plusLighter: cs.filter(([, s]) => s.mixBlendMode !== "normal").length, plusLighterFullFrame: cs.filter(([e, s]) => s.mixBlendMode !== "normal" && big(e)).length,
    masked: cs.filter(([, s]) => s.maskImage && s.maskImage !== "none").length, maskedFullFrame: cs.filter(([e, s]) => s.maskImage && s.maskImage !== "none" && big(e)).length,
    cssFilter: cs.filter(([, s]) => s.filter !== "none").length, svgFilters: document.querySelectorAll(".lab-camera filter").length,
    registeredNumbers: [...document.styleSheets].flatMap((x) => { try { return [...x.cssRules]; } catch { return []; } }).filter((r) => r.constructor.name === "CSSPropertyRule").length }; })()`);
await page.eval(`(() => { window.__f = []; window.__lt = []; window.__rec = false; (function f(t) { if (window.__rec) window.__f.push(t); requestAnimationFrame(f); })(performance.now());
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__rec && window.__lt.push(Math.round(e.duration)))).observe({ type: "longtask" }); return 1; })()`);
await page.mouseMove(4, 924); await sleep(2500);
const C = {}; for (const id of Object.keys(ARRIVE)) C[id] = await page.center(`[data-hotspot="${id}"]`);
const stat = (f) => { const d = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b), q = (p) => +(d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0).toFixed(1);
  return { frames: f.length, fps: +((f.length - 1) / ((f.at(-1) - f[0]) / 1000)).toFixed(1), medianMs: q(0.5), p95Ms: q(0.95), maxMs: +(d.at(-1) ?? 0).toFixed(1), dropped: d.reduce((t, x) => t + Math.max(0, Math.round(x / 16.67) - 1), 0), over50: d.filter((x) => x > 50).length }; };
async function window_(name, act, ms) {
  const a = await metrics(); await page.eval("(window.__f.length = 0, window.__lt.length = 0, window.__rec = true, 1)");
  await act(); await sleep(ms);
  const f = await page.eval("(window.__rec = false, window.__f.slice())"), lt = await page.eval("window.__lt.slice()"), b = await metrics();
  const d = (k) => Math.round((b[k] - a[k]) * 1000);
  const r = { name, ...stat(f), longTasks: lt.length, longTaskMs: lt.reduce((x, y) => x + y, 0), mainTaskMs: d("TaskDuration"), scriptMs: d("ScriptDuration"), styleMs: d("RecalcStyleDuration"), layoutMs: d("LayoutDuration"), windowMs: ms };
  res.runs.push(r); console.log(`${mode} ${config} ${name.padEnd(20)} fps ${String(r.fps).padStart(5)} | median ${r.medianMs} p95 ${r.p95Ms} max ${r.maxMs} ms | dropped ${r.dropped} >50ms ${r.over50} | main ${r.mainTaskMs} ms (script ${r.scriptMs}, style ${r.styleMs}, layout ${r.layoutMs}) | long tasks ${r.longTasks}`);
}
const leave = async () => { await page.mouseMove(4, 924); await sleep(2600); };
await window_("idle", async () => {}, 1500);
for (const id of ["engineering", "playground", ...(extras === "1" ? ["educational"] : [])]) for (let k = 0; k < (id === "educational" ? 3 : 4); k++) {
  await window_(`${id} ${k ? "repeat " + k : "first"}`, () => page.mouseMove(C[id].x, C[id].y), ARRIVE[id] + 1000); await leave();
}
if (extras === "1") await window_("switching", async () => { for (let c = 0; c < 2; c++) for (const id of ["engineering", "educational", "playground", "creative", "experience"]) { await page.mouseMove(C[id].x, C[id].y); await sleep(180); } }, 1500);
res.errors = errors; console.log("errors", JSON.stringify(errors));
writeFileSync(join(HERE, "results", `${mode}-${config}.json`), JSON.stringify(res, null, 1) + "\n");
await page.close(); process.exit(0);
