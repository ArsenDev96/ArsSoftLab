// M1.4K.3: Engineering's activation, before/after. Frames, compositing time (trace), Chrome's image/tile memory, first hover.
//   node eng-perf.mjs <label> [rounds]   -> results/eng-perf-<label>.json
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:3002";
const [label = "before", rounds = "2"] = process.argv.slice(2);
const W = 620 + 1000;
async function readStream(page, h) { const c = []; for (;;) { const x = await page.send("IO.read", { handle: h, size: 1 << 20 }); c.push(x.base64Encoded ? Buffer.from(x.data, "base64") : Buffer.from(x.data, "latin1")); if (x.eof) break; } await page.send("IO.close", { handle: h }).catch(() => {}); return Buffer.concat(c).toString("latin1"); }
const traced = async (page, cats, fn, extra = {}) => {
  await page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: cats, excludedCategories: ["*"], ...extra } });
  await fn();
  const done = new Promise((ok) => { const o = page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
  await page.send("Tracing.end"); const t = JSON.parse(await readStream(page, await done)); return t.traceEvents ?? t;
};
// Chrome's own accounting, as M1.4I.2's perf.mjs (memory-infra), MB.
async function memory(page) {
  const ev = await traced(page, ["disabled-by-default-memory-infra"], async () => { await page.send("Tracing.requestMemoryDump", { levelOfDetail: "detailed" }).catch(() => {}); await sleep(600); }, { memoryDumpConfig: { triggers: [] } });
  const t = {}, top = {};
  for (const x of ev) for (const [k, v] of Object.entries(x.args?.dumps?.allocators ?? {})) {
    const s = parseInt(v.attrs?.size?.value ?? "0", 16) / 1048576; if (!s) continue;
    const key = /^cc\/tile_memory\/provider_\w+\/resource/.test(k) ? "tiles" : /^cc\/image_memory\/cache_\w+\/gpu\//.test(k) ? "image_gpu" : /^cc\/image_memory\/cache_\w+\/discardable\//.test(k) ? "image_cpu" : /^gpu\/shared_images\/client_\w+\/mailbox/.test(k) ? "shared_images" : null;
    if (key) t[key] = (t[key] ?? 0) + s;
    if (k.split("/").length === 2) top[k] = Math.max(top[k] ?? 0, s);
  }
  for (const k of ["cc/tile_memory", "cc/image_memory", "gpu/shared_images", "skia/gpu_resources", "discardable", "malloc", "partition_alloc"]) t[k] = top[k] ?? 0;
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, +v.toFixed(1)]));
}
const stat = (f) => { const d = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b), q = (p) => +(d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0).toFixed(1);
  return { fps: +((f.length - 1) / ((f.at(-1) - f[0]) / 1000)).toFixed(1), medianMs: q(0.5), p95Ms: q(0.95), maxMs: +(d.at(-1) ?? 0).toFixed(1), over50: d.filter((x) => x > 50).length }; };
const res = { label, runs: [] };
for (let r = 0; r < +rounds; r++) for (const mode of ["default", "gpu"]) {
  const page = await launch({ width: 1648, height: 928, gpu: mode === "gpu" });
  await page.goto(BASE + "/lab-v2");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}" + ${JSON.stringify(process.env.INJECT ?? "")}; document.head.append(s);
    window.__f = []; window.__rec = false; (function f(t) { if (window.__rec) window.__f.push(t); requestAnimationFrame(f); })(performance.now());
    window.__hov = null; new MutationObserver(() => { if (window.__hov === null && document.querySelector('[data-lab-hover="engineering"]')) window.__hov = performance.now(); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(2500);
  const c = await page.center('[data-hotspot="engineering"]');
  const run = { round: r, mode, memIdle: await memory(page), windows: [] };
  const win = async (name) => {
    await page.eval("(window.__f.length = 0, window.__hov = null, window.__rec = true, window.__t0 = performance.now(), 1)");
    await page.mouseMove(c.x, c.y); await sleep(W);
    const o = await page.eval("({ f: (window.__rec = false, window.__f.slice()), t0: window.__t0, hov: window.__hov })");
    const early = o.f.filter((t) => t < o.t0 + 300), gaps = early.slice(1).map((t, i) => t - early[i]);
    const w = { name, ...stat(o.f), hoverMs: o.hov === null ? null : Math.round(o.hov - o.t0), longestFirst300: Math.round(Math.max(0, ...gaps)) };
    run.windows.push(w); await page.mouseMove(4, 924); await sleep(2600); return w;
  };
  await win("first");
  for (let k = 1; k <= 3; k++) await win(`repeat ${k}`);
  run.memAfter = await memory(page);
  // One traced repeat: busy time of the thread that composites (viz in software, the GPU main thread with the GPU).
  const ev = await traced(page, ["toplevel", "viz", "gpu", "cc", "devtools.timeline"], async () => { await sleep(150); await page.mouseMove(c.x, c.y); await sleep(W); });
  await page.mouseMove(4, 924);
  const tn = {}; for (const e of ev) if (e.ph === "M" && e.name === "thread_name") tn[`${e.pid}:${e.tid}`] = e.args.name;
  const busy = (re) => { let t = 0; const by = {}; for (const e of ev) if (e.ph === "X" && e.dur && re.test(tn[`${e.pid}:${e.tid}`] ?? "")) (by[`${e.pid}:${e.tid}`] ??= []).push(e); for (const l of Object.values(by)) { l.sort((a, b) => a.ts - b.ts); let end = -1; for (const e of l) if (e.ts >= end) { t += e.dur; end = e.ts + e.dur; } } return Math.round(t / 1000); };
  const sum = (re) => Math.round(ev.filter((e) => e.ph === "X" && re.test(e.name)).reduce((t, e) => t + (e.dur ?? 0), 0) / 1000);
  run.trace = { vizMs: busy(/^VizCompositorThread$/), gpuMainMs: busy(/^CrGpuMain$/), rendererMainMs: busy(/^CrRendererMain$/), drawQuadMs: sum(/^SoftwareRenderer::DoDrawQuad$/), swapMs: sum(/^SkiaOutputSurfaceImplOnGpu::SwapBuffers$/), rasterMs: sum(/^RasterTask$/) };
  run.errors = [];
  res.runs.push(run);
  const rep = run.windows.slice(1), med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  console.log(`${label} r${r} ${mode.padEnd(7)} first ${run.windows[0].fps} fps (hover ${run.windows[0].hoverMs} ms, longest in 300 ms ${run.windows[0].longestFirst300}) | repeats ${med(rep.map((w) => w.fps))} fps p95 ${med(rep.map((w) => w.p95Ms))} max ${Math.max(...rep.map((w) => w.maxMs))} | trace viz ${run.trace.vizMs} gpu ${run.trace.gpuMainMs} drawQuad ${run.trace.drawQuadMs} swap ${run.trace.swapMs} raster ${run.trace.rasterMs} | image ${JSON.stringify({ idle: run.memIdle["cc/image_memory"], after: run.memAfter["cc/image_memory"], tilesAfter: run.memAfter["cc/tile_memory"], sharedAfter: run.memAfter["gpu/shared_images"] })}`);
  await page.close();
}
writeFileSync(join(HERE, "results", `eng-perf-${label}.json`), JSON.stringify(res, null, 1) + "\n");
process.exit(0);
