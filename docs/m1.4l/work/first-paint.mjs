// M1.4Q: production first-paint measurement (measurement only; it changes nothing in the application).
//
//   node docs/m1.4l/work/first-paint.mjs <plan> [out.json]
//     plan: cold | warm | trace | headed
//   env: BASE (default http://localhost:3014), N (trials per route and condition), ROUTES (comma list of keys),
//        TRACE_DIR (where full traces are kept; default: the OS temp directory, never the repository)
//
// Conditions (each a fresh Chrome profile, default flags, 1648 x 928, DPR 1, prefers-reduced-motion: no-preference):
//   cold        a new Chrome process and profile for every trial: process start, empty HTTP cache, no fonts cached
//   warm        one Chrome per route: one unmeasured visit, then N visits with the HTTP cache warm ("warm-cache"), then
//               N visits after Network.clearBrowserCache ("warm-process"): the process is warm, the cache is empty
//   trace       one Chrome per route, warm-process conditions, N traced visits; main-thread work before first paint
//   headed      as cold, but a visible (not headless) window, to compare the headless numbers with a real window
//
// Every time is in ms from the navigation's start (PerformanceNavigationTiming.startTime = 0).
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { findChrome, sleep } from "../../../scripts/visual/cdp.mjs";

const BASE = process.env.BASE || "http://localhost:3014";
const N = Number(process.env.N || 5);
const [plan = "warm", outFile] = process.argv.slice(2);
const TRACE_DIR = process.env.TRACE_DIR || join(tmpdir(), "m14q-traces");
const W = 1648;
const H = 928;

export const ROUTES = {
  home: "/",
  cinematic: "/lab-v2",
  lite: "/lab-v2?render=lite",
  project: "/lab-v2/projects/sqlorbit",
  notfound: "/m14q-no-such-page",
};
const routeKeys = (process.env.ROUTES || Object.keys(ROUTES).join(",")).split(",");

// Runs before any page script, in every document. It only observes.
const PROBE = `(() => {
  const fp = (window.__fp = { lcp: [], long: [], gateStyleAt: null, sceneFirstVisible: null, sceneFullyVisible: null, litePlateDrawnAt: null, firstRaf: null });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { const el = e.element; fp.lcp.push({ t: e.startTime, renderTime: e.renderTime, loadTime: e.loadTime, size: e.size, url: (e.url || "").replace(location.origin, ""), el: el ? (el.tagName + (el.id ? "#" + el.id : "") + (el.getAttribute && el.getAttribute("class") ? "." + String(el.getAttribute("class")).split(/\\s+/).slice(0, 3).join(".") : "")) : null }); } }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) fp.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true }); } catch {}
  // Cinematic: PlateGate opens the scene by appending this style to <head>.
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (fp.gateStyleAt === null && n.nodeName === "STYLE" && (n.textContent || "").includes(".lab-plate-gate{opacity:1}")) fp.gateStyleAt = performance.now(); }).observe(document, { childList: true, subtree: true });
  requestAnimationFrame(() => (fp.firstRaf = performance.now()));
  // Per frame: the scene's computed visibility (Cinematic: the gated layers; Lite: the flattened plate).
  const tick = (t) => {
    const gate = document.querySelector(".lab-plate-gate");
    if (gate) {
      const o = parseFloat(getComputedStyle(gate).opacity);
      if (o > 0 && fp.sceneFirstVisible === null) fp.sceneFirstVisible = t;
      if (o >= 1 && fp.sceneFullyVisible === null) fp.sceneFullyVisible = t;
    }
    const plate = document.querySelector('[data-lite-renderer="static"] img');
    if (plate && plate.complete && plate.naturalWidth > 0 && fp.litePlateDrawnAt === null) fp.litePlateDrawnAt = t;
    if (performance.now() < 8000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const COLLECT = `(() => {
  const n = performance.getEntriesByType("navigation")[0];
  const paint = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]));
  const r = (x) => (x == null ? null : Math.round(x * 10) / 10);
  const res = performance.getEntriesByType("resource").map((e) => ({ type: e.initiatorType, name: e.name.replace(location.origin, "").slice(0, 120), start: r(e.startTime), reqStart: r(e.requestStart), respStart: r(e.responseStart), end: r(e.responseEnd), bytes: e.transferSize, body: e.decodedBodySize, blocking: e.renderBlockingStatus }));
  const fp = window.__fp || {};
  const lcp = fp.lcp && fp.lcp.length ? fp.lcp[fp.lcp.length - 1] : null;
  return {
    nav: { redirect: r(n.redirectEnd), fetchStart: r(n.fetchStart), dns: r(n.domainLookupEnd - n.domainLookupStart), connect: r(n.connectEnd - n.connectStart), requestStart: r(n.requestStart), ttfb: r(n.responseStart), responseEnd: r(n.responseEnd), domInteractive: r(n.domInteractive), dcl: r(n.domContentLoadedEventEnd), load: r(n.loadEventEnd), htmlBytes: n.transferSize, htmlBody: n.decodedBodySize, serverTiming: n.serverTiming.map((s) => s.name + ":" + s.duration) },
    fp: r(paint["first-paint"]), fcp: r(paint["first-contentful-paint"]), lcp: lcp && r(lcp.t), lcpEl: lcp && lcp.el, lcpUrl: lcp && lcp.url, lcpAll: (fp.lcp || []).map((e) => [r(e.t), e.el, e.size]),
    firstRaf: r(fp.firstRaf), gateStyleAt: r(fp.gateStyleAt), sceneFirstVisible: r(fp.sceneFirstVisible), sceneFullyVisible: r(fp.sceneFullyVisible), litePlateDrawnAt: r(fp.litePlateDrawnAt),
    longTasks: fp.long || [], resources: res,
    fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
    diagnosticCss: (() => { const s = document.querySelector("style[data-m14q-diagnostic]"); if (!s) return null; const img = document.querySelector("main img"); return { present: true, firstImgVisibility: img ? getComputedStyle(img).visibility : null, h1Visibility: document.querySelector("h1") ? getComputedStyle(document.querySelector("h1")).visibility : null }; })(),
  };
})()`;

/** Chrome with the repository harness's flags (scripts/visual/cdp.mjs), optionally headed. Returns timings too. */
async function chrome({ headed = false } = {}) {
  const t0 = performance.now();
  // KEEP_PROFILE: one profile directory reused by every launch (its disk caches, the GPU shader cache included,
  // survive between processes); it is created if missing and never deleted here.
  const keep = process.env.KEEP_PROFILE;
  if (keep) {
    mkdirSync(keep, { recursive: true });
    rmSync(join(keep, "DevToolsActivePort"), { force: true }); // the previous process's port
  }
  const profile = keep || mkdtempSync(join(tmpdir(), "arssoftlab-m14q-"));
  // EXTRA_FLAGS: Chrome switches for a controlled variant (for example --disable-gpu), space separated.
  const extra = (process.env.EXTRA_FLAGS || "").split(" ").filter(Boolean);
  const args = [
    ...(headed ? [] : ["--headless=new"]),
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${W},${H}`, "--no-first-run", "--no-default-browser-check", ...extra, "about:blank",
  ];
  const proc = spawn(findChrome(), args, { stdio: "ignore" });
  let port;
  for (let i = 0; i < 600 && !port; i++) {
    try { port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim(); } catch { await sleep(25); }
  }
  if (!port) throw new Error("Chrome did not start");
  const tPort = performance.now();
  let target;
  for (let i = 0; i < 300 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
    if (!target) await sleep(25);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.no(new Error(m.error.message)) : p.ok(m.result); }
    else if (m.method) listeners.forEach((f) => f(m));
  };
  const send = (method, params = {}) => new Promise((ok, no) => { const i = ++id; pending.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (f) => { listeners.add(f); return () => listeners.delete(f); };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  if (!headed) await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE });
  // INJECT_CSS (diagnostics only, never the application): a style element added before the page's own content, to
  // see which drawing features the cold first frame waits for. The application's files are not changed.
  if (process.env.INJECT_CSS) {
    const css = JSON.stringify(process.env.INJECT_CSS);
    // At document start neither <html> nor <head> exists yet: add the style as soon as the parser creates <head>.
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const add = () => { if (document.querySelector("style[data-m14q-diagnostic]")) return true; if (!document.head) return false; const s = document.createElement("style"); s.setAttribute("data-m14q-diagnostic", ""); s.textContent = ${css}; document.head.appendChild(s); return true; }; if (add()) return; const o = new MutationObserver(() => { if (add()) o.disconnect(); }); o.observe(document, { childList: true, subtree: true }); })();` });
  }
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const version = (await send("Browser.getVersion")).product;
  /** SystemInfo is served only on the browser target: one short-lived connection to it. */
  const browserInfo = async () => {
    const url = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
    const bw = new WebSocket(url);
    await new Promise((ok, no) => { bw.onopen = ok; bw.onerror = no; });
    const r = await new Promise((ok) => { bw.onmessage = (ev) => ok(JSON.parse(ev.data).result); bw.send(JSON.stringify({ id: 1, method: "SystemInfo.getInfo" })); });
    bw.close();
    return r;
  };
  return {
    send, on, evaluate, version, browserInfo, launchMs: { toDevToolsPort: Math.round(tPort - t0), toPageReady: Math.round(performance.now() - t0) },
    async close() { send("Browser.close").catch(() => {}); await sleep(keep ? 1500 : 300); ws.close(); proc.kill(); if (!keep) try { rmSync(profile, { recursive: true, force: true }); } catch {} },
  };
}

/** One measured visit: navigate, wait for load plus 2.5 s (gate, fade, late LCP), collect, leave via about:blank. */
async function visit(b, path) {
  const loaded = new Promise((ok) => { const off = b.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
  const t0 = performance.now();
  await b.send("Page.navigate", { url: BASE + path });
  await loaded;
  const wallToLoad = Math.round(performance.now() - t0);
  await sleep(2500);
  const m = await b.evaluate(COLLECT);
  await b.send("Page.navigate", { url: "about:blank" });
  await sleep(300);
  return { ...m, wallToLoad };
}

const CATEGORIES = ["toplevel", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "loading", "blink.user_timing", "v8.execute", "blink", "cc", "gpu", "viz", "benchmark"];

/** A traced visit: the trace is kept outside the repository; the summary returned is what the report uses. */
async function tracedVisit(b, path, tag) {
  await b.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: CATEGORIES, excludedCategories: ["*"] } });
  const m = await visit(b, path);
  const done = new Promise((ok) => { const off = b.on((x) => { if (x.method === "Tracing.tracingComplete") { off(); ok(x.params.stream); } }); });
  await b.send("Tracing.end");
  const h = await done;
  const chunks = [];
  for (;;) { const x = await b.send("IO.read", { handle: h, size: 1 << 20 }); chunks.push(x.base64Encoded ? Buffer.from(x.data, "base64") : Buffer.from(x.data, "latin1")); if (x.eof) break; }
  const raw = Buffer.concat(chunks);
  mkdirSync(TRACE_DIR, { recursive: true });
  writeFileSync(join(TRACE_DIR, `${tag}.json.gz`), gzipSync(raw));
  return { ...m, trace: summarise(JSON.parse(raw.toString("utf8")), path) };
}

/** Main-thread work of the page's renderer from navigation start to first contentful paint, and to scene visibility. */
function summarise(doc, path) {
  const ev = doc.traceEvents ?? doc;
  const tn = {};
  for (const e of ev) if (e.ph === "M" && e.name === "thread_name") tn[`${e.pid}:${e.tid}`] = e.args.name;
  // The navigation's renderer: the thread that marked navigationStart for this URL.
  const navStart = ev.filter((e) => e.name === "navigationStart" && (e.args?.data?.documentLoaderURL || "").includes(path.split("?")[0])).pop();
  if (!navStart) return { error: "no navigationStart" };
  const key = `${navStart.pid}:${navStart.tid}`;
  const t0 = navStart.ts;
  const at = (name) => ev.find((e) => e.name === name && e.pid === navStart.pid && e.ts >= t0)?.ts;
  const fcpTs = at("firstContentfulPaint");
  const marks = { firstPaint: at("firstPaint"), firstContentfulPaint: fcpTs, domInteractive: at("domInteractive"), domContentLoaded: at("domContentLoadedEventEnd") };
  const ms = (x) => (x == null ? null : Math.round((x - t0) / 100) / 10);
  const groups = {
    parseHTML: /^ParseHTML$/,
    scriptCompile: /^(v8\.compile|v8\.compileModule|CompileScript|CompileCode|V8\.CompileFullCode|v8\.produceCache)$/,
    scriptEvaluate: /^(EvaluateScript|v8\.evaluateModule|FunctionCall|TimerFire|FireAnimationFrame|RunMicrotasks|EventDispatch|v8\.run|V8\.Execute)$/,
    gc: /^(MinorGC|MajorGC|V8\.GC.*|BlinkGC.*)$/,
    style: /^(UpdateLayoutTree|RecalculateStyles|ParseAuthorStyleSheet)$/,
    layout: /^(Layout|UpdateLayerTree)$/,
    paint: /^(PrePaint|Paint|PaintImage|Layerize|Commit|CompositeLayers|UpdateLayer)$/,
    imageDecode: /^(Decode Image|ImageDecodeTask|Decode LazyPixelRef|ImageFrameGenerator::.*)$/,
    fontWork: /^(FontCache::.*|FontFace.*|WebFontLoad|FontLoad.*)$/,
    network: /^(ResourceReceivedData|ResourceReceiveResponse|ResourceFinish|ResourceSendRequest)$/,
  };
  const window_ = (end) => {
    const top = ev.filter((e) => `${e.pid}:${e.tid}` === key && e.ph === "X" && e.ts >= t0 && e.ts < end && e.dur);
    const out = Object.fromEntries(Object.keys(groups).map((g) => [g, 0]));
    let busy = 0, last = -1;
    top.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    for (const e of top) {
      if (e.name === "RunTask" || e.name === "ThreadControllerImpl::RunTask") { const s = Math.max(e.ts, last); const f = Math.min(e.ts + e.dur, end); if (f > s) { busy += f - s; last = f; } }
      for (const [g, re] of Object.entries(groups)) if (re.test(e.name)) out[g] += Math.min(e.dur, end - e.ts);
    }
    const r = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v / 100) / 10]));
    return { windowMs: ms(end), mainThreadBusyMs: Math.round(busy / 100) / 10, ...r };
  };
  // Long tasks on the renderer main thread before FCP: what they were.
  const longBefore = ev
    .filter((e) => `${e.pid}:${e.tid}` === key && e.ph === "X" && e.name === "RunTask" && e.ts >= t0 && e.ts < (fcpTs ?? Infinity) && e.dur > 50000)
    .map((e) => {
      const inner = ev.filter((x) => `${x.pid}:${x.tid}` === key && x.ph === "X" && x.ts >= e.ts && x.ts + (x.dur || 0) <= e.ts + e.dur && x.name !== "RunTask" && x.dur > 5000);
      const names = {};
      for (const x of inner) names[x.name] = (names[x.name] ?? 0) + x.dur;
      const url = inner.find((x) => x.args?.data?.url)?.args.data.url?.replace(/^https?:\/\/[^/]+/, "");
      return { startMs: ms(e.ts), durMs: Math.round(e.dur / 100) / 10, url: url ?? null, top: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, d]) => `${n} ${Math.round(d / 1000)}`) };
    });
  // Frames the compositor produced for this renderer before FCP (draws), and the first one.
  const draws = ev.filter((e) => /^(Graphics\.Pipeline\.DrawAndSwap|DrawFrame|Display::DrawAndSwap)$/.test(e.name) && e.ts >= t0 && e.ts < (fcpTs ?? Infinity) + 1);
  // The GPU process before FCP: busy time per thread, and the events that took longest (pipeline and shader work).
  const pn = {};
  for (const e of ev) if (e.ph === "M" && e.name === "process_name") pn[e.pid] = e.args.name;
  const gpuPids = new Set(Object.entries(pn).filter(([, n]) => /GPU/i.test(n)).map(([p]) => Number(p)));
  const gpuThreads = {};
  const gpuEvents = {};
  if (fcpTs) {
    const byThread = {};
    for (const e of ev) if (gpuPids.has(e.pid) && e.ph === "X" && e.dur && e.ts >= t0 && e.ts < fcpTs) (byThread[`${e.pid}:${e.tid}`] ??= []).push(e);
    for (const [k, list] of Object.entries(byThread)) {
      list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
      let busy = 0, end = -1;
      for (const e of list) {
        if (e.ts >= end) { const f = Math.min(e.ts + e.dur, fcpTs); busy += f - e.ts; end = e.ts + e.dur; }
        if (e.dur >= 2000 && !/^(RunTask|ThreadControllerImpl::RunTask|ThreadPool_RunTask|TaskGraphRunner::RunTask)$/.test(e.name)) gpuEvents[e.name] = (gpuEvents[e.name] ?? 0) + e.dur;
      }
      const name = tn[k] ?? k;
      gpuThreads[name] = (gpuThreads[name] ?? 0) + Math.round(busy / 100) / 10;
    }
  }
  const pipelineCreates = fcpTs ? ev.filter((e) => gpuPids.has(e.pid) && e.ts >= t0 && e.ts < fcpTs && /Pipeline|Shader|D3DCompile|Compile/i.test(e.name)).length : null;
  return {
    marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, ms(v)])),
    beforeFCP: fcpTs ? window_(fcpTs) : null,
    longTasksBeforeFCP: longBefore,
    compositorDrawsBeforeFCP: draws.length,
    threads: tn[key] ?? "?",
    gpuBeforeFCP: {
      threadBusyMs: Object.fromEntries(Object.entries(gpuThreads).filter(([, v]) => v >= 5).sort((a, b) => b[1] - a[1])),
      topEventsMs: Object.fromEntries(Object.entries(gpuEvents).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, d]) => [n, Math.round(d / 1000)])),
      pipelineOrShaderEvents: pipelineCreates,
    },
  };
}

// ---- plans -----------------------------------------------------------------------------------------------------
const results = {
  plan, base: BASE, n: N, viewport: `${W}x${H}@1`, startedAt: new Date().toISOString(), chrome: null, gpu: null,
  variant: { extraFlags: process.env.EXTRA_FLAGS || "", persistentProfile: Boolean(process.env.KEEP_PROFILE), injectedCss: process.env.INJECT_CSS || "" }, runs: {},
};
const record = (route, cond, m) => ((results.runs[route] ??= {})[cond] ??= []).push(m);

async function gpuInfo(b) {
  const i = await b.browserInfo();
  return { devices: i.gpu.devices.map((d) => d.deviceString), compositing: i.gpu.featureStatus?.gpu_compositing, rasterization: i.gpu.featureStatus?.rasterization };
}

if (plan === "cold" || plan === "headed") {
  for (let t = 0; t < N; t++) {
    for (const k of routeKeys) {
      const b = await chrome({ headed: plan === "headed" });
      results.chrome ??= b.version;
      results.gpu ??= await gpuInfo(b);
      // CLEAR_CACHE=1: an empty HTTP cache even in a reused profile, so only the other on-disk state carries over.
      if (process.env.CLEAR_CACHE === "1") await b.send("Network.clearBrowserCache");
      const m = await visit(b, ROUTES[k]);
      record(k, plan, { ...m, launch: b.launchMs });
      await b.close();
      console.log(plan, t, k, "fcp", m.fcp, "lcp", m.lcp, "ttfb", m.nav.ttfb);
    }
  }
} else if (plan === "warm") {
  for (const k of routeKeys) {
    const b = await chrome();
    results.chrome ??= b.version;
    results.gpu ??= await gpuInfo(b);
    await visit(b, ROUTES[k]); // unmeasured: fills the cache and warms the renderer path
    for (let t = 0; t < N; t++) { const m = await visit(b, ROUTES[k]); record(k, "warm-cache", m); console.log("warm-cache", t, k, "fcp", m.fcp, "lcp", m.lcp); }
    for (let t = 0; t < N; t++) {
      await b.send("Network.clearBrowserCache");
      const m = await visit(b, ROUTES[k]);
      record(k, "warm-process", m);
      console.log("warm-process", t, k, "fcp", m.fcp, "lcp", m.lcp);
    }
    await b.close();
  }
} else if (plan === "coldtrace") {
  // A traced first navigation in a new Chrome process: where the cold first frame's time goes.
  for (let t = 0; t < N; t++) {
    for (const k of routeKeys) {
      const b = await chrome();
      results.chrome ??= b.version;
      const m = await tracedVisit(b, ROUTES[k], `cold-${k}-${t}`);
      record(k, "trace-cold", { ...m, launch: b.launchMs });
      await b.close();
      console.log("coldtrace", t, k, "fcp", m.fcp, JSON.stringify(m.trace.beforeFCP));
    }
  }
} else if (plan === "trace") {
  for (const k of routeKeys) {
    const b = await chrome();
    results.chrome ??= b.version;
    await visit(b, ROUTES[k]);
    for (let t = 0; t < N; t++) {
      await b.send("Network.clearBrowserCache");
      const m = await tracedVisit(b, ROUTES[k], `${k}-${t}`);
      record(k, "trace-warm-process", m);
      console.log("trace", t, k, "fcp", m.fcp, JSON.stringify(m.trace.beforeFCP));
    }
    await b.close();
  }
} else throw new Error(`unknown plan ${plan}`);

results.finishedAt = new Date().toISOString();
const file = outFile || join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "results", `first-paint-${plan}.json`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(results, null, 1) + "\n");
console.log("wrote", file);
process.exit(0);
