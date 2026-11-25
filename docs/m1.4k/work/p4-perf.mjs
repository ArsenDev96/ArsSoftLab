// Performance of the complete scene, real runtime data (GPU on, real time). The dev server serves the pages, so script
// times are upper bounds; decoding, painting and compositing aren't affected by it.
import { execSync } from "node:child_process";
import { ARRIVE, BASE, IDS, SEQ, launch, save, sleep } from "./lib.mjs";

const out = {};
const only = process.argv[2];
const stat = (d) => {
  const s = [...d].sort((a, b) => a - b);
  return { frames: s.length, median_ms: +(s[s.length >> 1] ?? 0).toFixed(1), p95_ms: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(1), max_ms: +(s.at(-1) ?? 0).toFixed(1), over_50ms: s.filter((x) => x > 50).length };
};
const HOOK = `window.__commits=0;window.__REACT_DEVTOOLS_GLOBAL_HOOK__={renderers:new Map(),supportsFiber:true,inject(){return 1},onScheduleFiberRoot(){},onCommitFiberRoot(){window.__commits++},onCommitFiberUnmount(){},onPostCommitFiberRoot(){},checkDCE(){}};
window.__long=[];window.__ls=0;window.__lcp=0;try{new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__long.push([Math.round(e.startTime),Math.round(e.duration)]))).observe({type:"longtask",buffered:true});
new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__ls+=e.value)).observe({type:"layout-shift",buffered:true});
new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lcp=e.startTime)).observe({type:"largest-contentful-paint",buffered:true});}catch{}
window.__gate=null;(function g(){const e=document.querySelector(".lab-plate-gate");if(e&&+getComputedStyle(e).opacity>0){window.__gate=performance.now();return}requestAnimationFrame(g)})();`;

async function fresh(path = "/lab-v2", opts = {}) {
  const page = await launch({ width: 1648, height: 928, gpu: true, ...opts });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
  await page.send("Performance.enable");
  await page.goto(BASE + path);
  await page.mouseMove(4, (opts.height ?? 928) - 4);
  return page;
}
const metrics = async (page) => Object.fromEntries((await page.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
const gc = (page) => page.send("HeapProfiler.collectGarbage").then(() => sleep(200));
const raf = (page) => page.eval(`(window.__t=[],(function t(n){window.__t.push(n);requestAnimationFrame(t)})(performance.now()),1)`);
const deltas = async (page, from, to) => {
  const ts = await page.eval("window.__t");
  return ts.map((t, k) => [t, k ? t - ts[k - 1] : 0]).filter(([t]) => t > from && t < to).map(([, d]) => d);
};
/** Memory of every process of this Chrome (MB), by type. */
function processes(page) {
  const q = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -match 'arssoftlab-visual' } | ForEach-Object { $t = if ($_.CommandLine -match '--type=([a-z-]+)') { $matches[1] } else { 'browser' }; "$t $([math]::Round($_.PrivatePageCount/1MB))" }`;
  const r = {};
  try {
    for (const l of execSync(`powershell -NoProfile -Command "${q.replace(/"/g, '\\"')}"`, { encoding: "utf8" }).trim().split(/\r?\n/)) {
      const [t, n] = l.split(" ");
      r[t] = (r[t] ?? 0) + +n;
    }
  } catch (e) { r.error = String(e).slice(0, 100); }
  return r;
}
async function trace(page, fn) {
  const ev = [];
  const off = page.on((m) => { if (m.method === "Tracing.dataCollected") ev.push(...m.params.value); });
  await page.send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "toplevel", "blink", "cc", "viz", "gpu"] } });
  const r = await fn();
  const done = new Promise((ok) => { const o = page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(); } }); });
  await page.send("Tracing.end");
  await done;
  off();
  return [ev, r];
}
function summarise(ev) {
  const sum = (f) => { const e = ev.filter((x) => x.ph === "X" && f(x)); return { n: e.length, ms: +(e.reduce((t, x) => t + (x.dur ?? 0), 0) / 1000).toFixed(1), max_ms: +(Math.max(0, ...e.map((x) => x.dur ?? 0)) / 1000).toFixed(1) }; };
  const names = {};
  for (const x of ev) if (x.ph === "X" && (x.dur ?? 0) > 2000) { const k = x.name; (names[k] ??= [0, 0])[0]++; names[k][1] += x.dur / 1000; }
  const main = ev.find((x) => x.name === "thread_name" && x.args?.name === "CrRendererMain");
  const onMain = (x) => !main || (x.pid === main.pid && x.tid === main.tid);
  return {
    image_decodes: sum((x) => /Decode Image|Decode LazyPixelRef|ImageDecodeTask/.test(x.name)),
    raster_tasks: sum((x) => x.name === "RasterTask"),
    main_script: sum((x) => /FunctionCall|EvaluateScript|FireAnimationFrame/.test(x.name) && onMain(x)),
    main_style: sum((x) => /UpdateLayoutTree|RecalculateStyles/.test(x.name) && onMain(x)),
    main_layout: sum((x) => x.name === "Layout" && onMain(x)),
    main_prepaint: sum((x) => x.name === "PrePaint" && onMain(x)),
    main_paint: sum((x) => x.name === "Paint" && onMain(x)),
    main_commit: sum((x) => x.name === "Commit" && onMain(x)),
    gpu_tasks: sum((x) => x.name === "GPUTask"),
    top: Object.entries(names).sort((a, b) => b[1][1] - a[1][1]).slice(0, 14).map(([k, v]) => `${k} x${v[0]} ${v[1].toFixed(0)}ms`),
  };
}

// --- 0. the machine: what a plain page can do.
if (!only || only === "control") {
  const page = await launch({ width: 1648, height: 928, gpu: true });
  out.gpu = await page.eval(`(() => { const g = document.createElement("canvas").getContext("webgl"); if (!g) return "no webgl"; const e = g.getExtension("WEBGL_debug_renderer_info"); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); })()`);
  await page.eval(`(document.body.innerHTML = '<div id=b style="position:absolute;width:200px;height:200px;background:red"></div>', document.getElementById("b").animate([{ transform: "none" }, { transform: "translateX(900px)" }], { duration: 1000, iterations: 9 }), 1)`);
  await raf(page);
  await sleep(3200);
  const n = await page.eval("performance.now()");
  out.control_blank_page_transform = stat(await deltas(page, n - 3000, n));
  await page.eval(`(document.body.innerHTML = '', document.body.style.cssText = 'margin:0;background:#222', Array.from({ length: 12 }, (_, k) => { const d = document.createElement("div"); d.style.cssText = "position:absolute;inset:0;mix-blend-mode:plus-lighter;opacity:.1;background:linear-gradient(" + k * 30 + "deg,#400,#040)"; document.body.append(d); d.animate([{ opacity: 0.02 }, { opacity: 0.2 }], { duration: 700, iterations: 9, direction: "alternate" }); }), 1)`);
  await sleep(3200);
  const n2 = await page.eval("performance.now()");
  out.control_12_fullscreen_blended_layers = stat(await deltas(page, n2 - 3000, n2));
  await page.close();
}

// --- 1. initial rendering (fresh profile each time).
if (!only || only === "load") {
  out.load = {};
  for (const path of ["/", "/lab-v2"]) {
    out.load[path] = [];
    for (let i = 0; i < 3; i++) {
      const page = await fresh(path);
      await sleep(2500);
      const r = await page.eval(`(() => { const n = performance.getEntriesByType("navigation")[0]; const f = performance.getEntriesByName("first-contentful-paint")[0]; return { ttfb_ms: Math.round(n.responseStart), dom_ms: Math.round(n.domContentLoadedEventEnd), load_ms: Math.round(n.loadEventEnd), fcp_ms: Math.round(f?.startTime ?? 0), lcp_ms: Math.round(window.__lcp), scene_shown_ms: Math.round(window.__gate ?? -1), long_tasks: window.__long, layout_shift: +window.__ls.toFixed(5), commits: window.__commits }; })()`);
      const m = await metrics(page);
      r.heap_mb = +(m.JSHeapUsedSize / 1048576).toFixed(1);
      r.nodes = m.Nodes;
      r.memory_mb = processes(page);
      out.load[path].push(r);
      await page.close();
    }
  }
  save("perf-load.json", out.load);
}

// --- 2. first hover after load against the second and third: frames, and (separately) where the time goes.
if (!only || only === "hover") {
  out.hover = {};
  for (const id of IDS) {
    const page = await fresh();
    await sleep(2500);
    const c = await page.center(`[data-hotspot="${id}"]`);
    await raf(page);
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const before = await metrics(page);
      const c0 = await page.eval("window.__commits");
      const l0 = await page.eval("window.__long.length");
      const t0 = await page.eval("performance.now()");
      await page.mouseMove(c.x, c.y);
      await sleep(ARRIVE[id] + SEQ[id] + 400);
      const after = await metrics(page);
      runs.push({
        charging: stat(await deltas(page, t0, t0 + ARRIVE[id])),
        activation: stat(await deltas(page, t0 + ARRIVE[id], t0 + ARRIVE[id] + SEQ[id])),
        first_frame_after_input_ms: +((await page.eval("window.__t")).find((t) => t > t0) - t0).toFixed(1),
        react_commits: (await page.eval("window.__commits")) - c0,
        layouts: after.LayoutCount - before.LayoutCount,
        style_recalcs: after.RecalcStyleCount - before.RecalcStyleCount,
        script_ms: +((after.ScriptDuration - before.ScriptDuration) * 1000).toFixed(1),
        main_task_ms: +((after.TaskDuration - before.TaskDuration) * 1000).toFixed(1),
        long_tasks: await page.eval(`window.__long.slice(${l0})`),
      });
      await page.mouseMove(4, 924);
      await sleep(1800);
    }
    out.hover[id] = runs;
    await page.close();
  }
  save("perf-hover.json", out.hover);
}
// The same activation traced, in fresh pages: first and second.
if (!only || only === "trace") {
  out.trace = {};
  for (const id of IDS) {
    const page = await fresh();
    await sleep(2500);
    const c = await page.center(`[data-hotspot="${id}"]`);
    out.trace[id] = [];
    for (let i = 0; i < 2; i++) {
      const [ev] = await trace(page, async () => {
        await page.mouseMove(c.x, c.y);
        await sleep(ARRIVE[id] + SEQ[id] + 300);
      });
      out.trace[id].push(summarise(ev));
      await page.mouseMove(4, 924);
      await sleep(1800);
    }
    await page.close();
  }
  save("perf-trace.json", out.trace);
}
// A quarter of the pixels: is the limit the pixels (GPU) or the work per frame?
if (!only || only === "small") {
  out.small = {};
  for (const [w, h] of [[1648, 928], [824, 464]]) {
    const page = await fresh("/lab-v2", { width: w, height: h });
    await sleep(2500);
    await raf(page);
    for (const id of ["engineering", "experience"]) {
      const c = await page.center(`[data-hotspot="${id}"]`);
      for (let i = 0; i < 3; i++) {
        const t0 = await page.eval("performance.now()");
        await page.mouseMove(c.x, c.y);
        await sleep(ARRIVE[id] + SEQ[id] + 400);
        if (i) (out.small[`${w}x${h} ${id}`] ??= []).push(stat(await deltas(page, t0 + ARRIVE[id], t0 + ARRIVE[id] + SEQ[id])));
        await page.mouseMove(4, h - 4);
        await sleep(1800);
      }
    }
    await page.close();
  }
  save("perf-small.json", out.small);
}

// --- 3. repeated switching: does anything grow?
if (!only || only === "growth") {
  const page = await fresh();
  await sleep(2500);
  const pts = {};
  for (const id of IDS) pts[id] = await page.center(`[data-hotspot="${id}"]`);
  await raf(page);
  const snap = async (label) => {
    await page.mouseMove(4, 924);
    await sleep(2500);
    await gc(page);
    const m = await metrics(page);
    return { label, heap_mb: +(m.JSHeapUsedSize / 1048576).toFixed(2), nodes: m.Nodes, listeners: m.JSEventListeners, documents: m.Documents, animations: await page.eval("document.getAnimations().length"), dom: await page.eval("document.querySelectorAll('*').length"), commits: await page.eval("window.__commits"), layout_shift: await page.eval("+window.__ls.toFixed(5)"), rafs_in_1s: await page.eval(`new Promise((r) => { const o = window.requestAnimationFrame; let n = 0; window.requestAnimationFrame = (f) => { n++; return o.call(window, f); }; setTimeout(() => { window.requestAnimationFrame = o; r(n); }, 1000); })`), memory_mb: processes(page) };
  };
  const snaps = [await snap("after load")];
  const pace = [];
  for (let round = 1; round <= 6; round++) {
    const t0 = await page.eval("performance.now()");
    for (let k = 0; k < 8; k++) for (const id of IDS) { await page.mouseMove(pts[id].x, pts[id].y); await sleep(k % 4 === 3 ? 1500 : 260); }
    const t1 = await page.eval("performance.now()");
    pace.push({ round, ...stat(await deltas(page, t0, t1)) });
    await page.eval("window.__t.length = 0");
    snaps.push(await snap(`after ${round * 40} switches`));
  }
  out.growth = { snaps, pace };
  save("perf-growth.json", out.growth);
  await page.close();
}
console.log(JSON.stringify(out));
