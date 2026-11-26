// Animation lag diagnosis: one short Chrome trace of a station's first activation and one repeat, summarised per thread.
//   node trace.mjs <mode: default|gpu> <station> [config: base|A|B|C]   -> traces/<mode>-<station>[-config].json.gz, results/trace-...json
// The .json.gz opens in DevTools (Performance panel, "Load profile").
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { CSS } from "./lag-css.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:3002";
const [mode = "default", id = "engineering", config = "base"] = process.argv.slice(2);
const ARRIVE = { engineering: 620, educational: 460, playground: 650, creative: 640, experience: 660 };
mkdirSync(join(HERE, "traces"), { recursive: true }); mkdirSync(join(HERE, "results"), { recursive: true });
const page = await launch({ width: 1648, height: 928, gpu: mode === "gpu" });
await page.goto(BASE + "/lab-v2");
await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}" + ${JSON.stringify(CSS[config])}; document.head.append(s); return 1; })()`);
await page.mouseMove(4, 924); await sleep(2500);
const c = await page.center(`[data-hotspot="${id}"]`);
await page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: ["toplevel", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "cc", "gpu", "viz", "blink", "benchmark", "blink.user_timing", "disabled-by-default-devtools.timeline.invalidationTracking"], excludedCategories: ["*"] } });
await sleep(300);
const marks = [];
const mark = async (n) => marks.push([n, await page.eval("performance.now()")]);
const W = ARRIVE[id] + 1000;
await page.eval(`performance.mark("first-start")`); await page.mouseMove(c.x, c.y); await sleep(W); await page.eval(`performance.mark("first-end")`);
await page.mouseMove(4, 924); await sleep(2600);
await page.eval(`performance.mark("repeat-start")`); await page.mouseMove(c.x, c.y); await sleep(W); await page.eval(`performance.mark("repeat-end")`);
const done = new Promise((ok) => { const o = page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
await page.send("Tracing.end"); const h = await done; const chunks = [];
for (;;) { const x = await page.send("IO.read", { handle: h, size: 1 << 20 }); chunks.push(x.base64Encoded ? Buffer.from(x.data, "base64") : Buffer.from(x.data, "latin1")); if (x.eof) break; }
const raw = Buffer.concat(chunks); const tag = `${mode}-${id}${config === "base" ? "" : "-" + config}`;
writeFileSync(join(HERE, "traces", `${tag}.json.gz`), gzipSync(raw));
await page.close();

// ---- summary ----
const ev = JSON.parse(raw.toString("latin1")).traceEvents ?? JSON.parse(raw.toString("latin1"));
const tn = {}, pn = {};
for (const e of ev) if (e.ph === "M") { if (e.name === "thread_name") tn[`${e.pid}:${e.tid}`] = e.args.name; if (e.name === "process_name") pn[e.pid] = e.args.name; }
const um = (n) => ev.find((e) => e.name === n && (e.ph === "R" || e.ph === "I" || e.ph === "n" || e.cat?.includes("blink.user_timing")))?.ts;
const win = { first: [um("first-start"), um("first-end")], repeat: [um("repeat-start"), um("repeat-end")] };
const thr = (k) => { const n = tn[k] ?? "?", p = pn[k.split(":")[0]] ?? "?"; return /CompositorTileWorker/.test(n) ? `${p} / raster workers` : `${p} / ${n}`; };
const KEY = /^(UpdateLayoutTree|RecalculateStyles|Layout|PrePaint|Paint|Layerize|Commit|FunctionCall|EvaluateScript|FireAnimationFrame|RunMicrotasks|RasterTask|ImageDecodeTask|Decode Image|Decode LazyPixelRef|GPUTask|DrawFrame|Display::DrawAndSwap|DirectRenderer::DrawFrame|SkiaOutputSurfaceImplOnGpu::.*|SoftwareRenderer::.*|Graphics\.Pipeline.*|ProxyMain::BeginMainFrame|ThreadProxy::BeginMainFrame|LayerTreeHostImpl::.*|CompositeLayers|Swap.*)$/;
const summary = {};
for (const [w, [a, b]] of Object.entries(win)) {
  if (!a || !b) continue;
  const busy = {}, names = {};
  const by = {}; for (const e of ev) if (e.ph === "X" && e.ts >= a && e.ts <= b && e.dur) (by[`${e.pid}:${e.tid}`] ??= []).push(e);
  for (const [k, list] of Object.entries(by)) {
    list.sort((x, y) => x.ts - y.ts || y.dur - x.dur); let end = -1, t = 0;
    for (const e of list) { if (e.ts >= end) { t += e.dur; end = e.ts + e.dur; } if (KEY.test(e.name)) { const nk = `${thr(k)} :: ${e.name}`; names[nk] = (names[nk] ?? 0) + e.dur; } }
    busy[thr(k)] = (busy[thr(k)] ?? 0) + t;
  }
  const ms = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v / 1000)]).filter(([, v]) => v >= 5).sort((x, y) => y[1] - x[1]));
  const frames = ev.filter((e) => e.name === "PipelineReporter" && e.ts >= a && e.ts <= b && e.ph === "b");
  const st = {}; for (const f of frames) { const s = f.args?.chrome_frame_reporter?.state ?? "?"; st[s] = (st[s] ?? 0) + 1; }
  summary[w] = { windowMs: Math.round((b - a) / 1000), threadBusyMs: ms(busy), topEventsMs: Object.fromEntries(Object.entries(ms(names)).slice(0, 16)), frameReporter: st };
}
writeFileSync(join(HERE, "results", `trace-${tag}.json`), JSON.stringify(summary, null, 1) + "\n");
console.log(tag, "trace", (raw.length / 1e6).toFixed(1), "MB"); console.log(JSON.stringify(summary, null, 1));
process.exit(0);
