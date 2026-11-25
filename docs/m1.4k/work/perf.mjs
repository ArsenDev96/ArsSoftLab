// M1.4I.2: image memory, layers, load and frame pacing of /lab-v2. Real time, GPU, fresh Chrome profile per page.
//   node perf.mjs <label> [pages per viewport] [path]     -> perf-<label>.json (runs are appended)
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { ARRIVE, BASE, IDS, SEQ } from "./lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const [label, n = "3", path = "/lab-v2"] = process.argv.slice(2);
const FILE = join(HERE, `perf-${label}.json`);
const VIEWPORTS = [[1648, 928], [1920, 1080]];
const HOOK = `window.__long=[];window.__lcp=0;try{new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__long.push([Math.round(e.startTime),Math.round(e.duration)]))).observe({type:"longtask",buffered:true});
new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lcp=e.startTime)).observe({type:"largest-contentful-paint",buffered:true});}catch{}
window.__gate=null;(function g(){const e=document.querySelector(".lab-plate-gate");if(e&&+getComputedStyle(e).opacity>0){window.__gate=performance.now();return}requestAnimationFrame(g)})();`;
const stat = (d) => {
  const s = [...d].sort((a, b) => a - b);
  return { frames: s.length, median: +(s[s.length >> 1] ?? 0).toFixed(1), p95: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(1), max: +(s.at(-1) ?? 0).toFixed(1) };
};
/** Private memory of this Chrome's processes, MB. */
function processes() {
  const q = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match 'arssoftlab-visual' } | ForEach-Object { $t = if ($_.CommandLine -match '--type=([a-z-]+)') { $matches[1] } else { 'browser' }; "$t $([math]::Round($_.PrivatePageCount/1MB))" }`;
  const r = {};
  try {
    for (const l of execSync(`powershell -NoProfile -Command "${q.replace(/"/g, '\\"')}"`, { encoding: "utf8" }).trim().split(/\r?\n/)) {
      const [t, p] = l.split(" ");
      r[t] = (r[t] ?? 0) + +p;
    }
  } catch (e) { r.error = String(e).slice(0, 100); }
  return r;
}
/** Chrome's own accounting (memory-infra dump), MB: every allocator root, summed over processes. */
async function dump(page) {
  // Streamed in small pieces: one large reply can get lost on Node's WebSocket.
  await page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: ["disabled-by-default-memory-infra"], excludedCategories: ["*"], memoryDumpConfig: { triggers: [] } } });
  await page.send("Tracing.requestMemoryDump", { levelOfDetail: "detailed" }).catch((e) => console.log("dump", e.message));
  await sleep(600);
  const done = new Promise((ok) => { const o = page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
  await page.send("Tracing.end");
  const stream = await done;
  let txt = "";
  for (;;) {
    const r = await page.send("IO.read", { handle: stream, size: 400000 });
    txt += r.base64Encoded ? Buffer.from(r.data, "base64").toString("latin1") : r.data;
    if (r.eof) break;
  }
  await page.send("IO.close", { handle: stream });
  const ev = JSON.parse(txt).traceEvents;
  const t = {};
  const names = {};
  for (const x of ev) for (const [k, v] of Object.entries(x.args?.dumps?.allocators ?? {})) {
    const s = parseInt(v.attrs?.size?.value ?? "0", 16) / 1048576;
    if (!s) continue;
    const key = /^cc\/tile_memory\/provider_\w+\/resource/.test(k) ? "tiles"
      : /^cc\/image_memory\/cache_\w+\/gpu\//.test(k) ? "image_gpu"
      : /^cc\/image_memory\/cache_\w+\/discardable\//.test(k) ? "image_cpu"
      : /^gpu\/transfer_cache\/cache_\w+\/gpu\//.test(k) ? "transfer_gpu"
      : /^gpu\/shared_images\/client_\w+\/mailbox/.test(k) ? "shared_images" : null;
    if (key) { t[key] = (t[key] ?? 0) + s; t[key + "_n"] = (t[key + "_n"] ?? 0) + 1; }
    if (k.split("/").length === 2) names[k] = Math.max(names[k] ?? 0, s);
  }
  for (const k of Object.keys(t)) t[k] = +t[k].toFixed(1);
  for (const k of ["cc/tile_memory", "cc/image_memory", "gpu/transfer_cache", "skia/gpu_resources", "gpu/shared_images"]) t[k] = +(names[k] ?? 0).toFixed(1);
  return t;
}
async function layers(page) {
  let ls = [];
  const off = page.on((m) => { if (m.method === "LayerTree.layerTreeDidChange" && m.params.layers) ls = m.params.layers; });
  await page.send("LayerTree.enable");
  // Any repaint makes Chrome report the tree.
  for (let k = 0; k < 4 && !ls.length; k++) { await page.eval(`document.documentElement.style.setProperty("outline", "0 solid rgb(0 0 " + ${k} + ")")`); await sleep(300); }
  await page.send("LayerTree.disable");
  off();
  const d = ls.filter((l) => l.drawsContent);
  return { layers: ls.length, drawing: d.length, big: d.map((l) => [l.width, l.height]).sort((a, b) => b[0] * b[1] - a[0] * a[1]).slice(0, 60), area_mpx: +(d.reduce((t, l) => t + l.width * l.height, 0) / 1e6).toFixed(2), full_frame: d.filter((l) => l.width > 1500 && l.height > 800).length };
}
const out = existsSync(FILE) ? JSON.parse(readFileSync(FILE)) : [];
for (let i = 0; i < +n; i++) for (const [w, h] of VIEWPORTS) {
  const page = await launch({ width: w, height: h, gpu: true });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
  await page.send("Network.enable");
  const req = new Map();
  page.on((m) => {
    if (m.method === "Network.requestWillBeSent") req.set(m.params.requestId, { url: m.params.request.url });
    if (m.method === "Network.loadingFinished" && req.has(m.params.requestId)) req.get(m.params.requestId).bytes = m.params.encodedDataLength;
  });
  await page.goto(BASE + path);
  await page.mouseMove(4, h - 4);
  await sleep(2500);
  const run = { w, h, path, at: new Date().toISOString() };
  run.load = await page.eval(`(() => { const n = performance.getEntriesByType("navigation")[0]; const f = performance.getEntriesByName("first-contentful-paint")[0]; return { ttfb: Math.round(n.responseStart), dom: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: Math.round(f?.startTime ?? 0), lcp: Math.round(window.__lcp), shown: Math.round(window.__gate ?? -1), long: window.__long }; })()`);
  const scene = [...req.values()].filter((r) => /\/scene\//.test(r.url));
  run.transfer = { files: scene.length, kb: +(scene.reduce((t, r) => t + (r.bytes ?? 0), 0) / 1024).toFixed(0) };
  run.layers_idle = await layers(page);
  run.mem_idle = await dump(page);
  run.proc_idle = processes();
  await page.eval(`(window.__t=[],(function t(n){window.__t.push(n);requestAnimationFrame(t)})(performance.now()),1)`);
  run.idle = stat(await page.eval(`new Promise((r) => setTimeout(() => { const t = window.__t; r(t.map((x, k) => k ? x - t[k - 1] : 0).slice(1)); }, 1500))`));
  const order = IDS.map((_, k) => IDS[(k + i) % IDS.length]);
  run.order = order;
  run.st = {};
  for (let visit = 0; visit < 3; visit++) for (const id of order) {
    if (visit === 1 && id === order[0]) run.mem_round1 = await dump(page), run.proc_round1 = processes();
    const c = await page.center(`[data-hotspot="${id}"]`);
    await page.eval("window.__t.length = 0");
    const t0 = await page.eval("performance.now()");
    await page.mouseMove(c.x, c.y);
    await sleep(ARRIVE[id] + SEQ[id] + 400);
    const ts = await page.eval("window.__t");
    const d = (a, b) => stat(ts.map((t, k) => [t, k ? t - ts[k - 1] : 0]).filter(([t]) => t > a && t <= b).map(([, x]) => x));
    const A = t0 + ARRIVE[id];
    const r = { all: d(t0, A + SEQ[id]), charge: d(t0, A), seq: d(A, A + SEQ[id]), first_frame: +((ts.find((t) => t > t0) ?? t0) - t0).toFixed(1) };
    if (id === "playground") r.lift = d(A, A + 450);
    (run.st[id] ??= []).push(r);
    await page.mouseMove(4, h - 4);
    await sleep(1700);
  }
  run.mem_after = await dump(page);
  run.proc_after = processes();
  // Everything the page loaded, at its natural size (decoded RGBA).
  run.decoded = await page.eval(`(async () => { const u = [...new Set(performance.getEntriesByType("resource").map((e) => e.name).filter((n) => n.includes("/scene/")))]; let px = 0; for (const s of u) { const i = new Image(); i.src = s; try { await i.decode(); } catch {} px += i.naturalWidth * i.naturalHeight; } return { files: u.length, mpx: +(px / 1e6).toFixed(2), mb: +(px * 4 / 1048576).toFixed(1) }; })()`);
  out.push(run);
  writeFileSync(FILE, JSON.stringify(out) + "\n");
  console.log(label, i, w, JSON.stringify({ shown: run.load.shown, lcp: run.load.lcp, tr: run.transfer, dec: run.decoded, li: { ...run.layers_idle, big: undefined }, mi: run.mem_idle, ma: run.mem_after, pi: run.proc_idle, pa: run.proc_after }));
  await page.close();
}
process.exit(0);
