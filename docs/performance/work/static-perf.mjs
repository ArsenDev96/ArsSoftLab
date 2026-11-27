// Static Lite experiment: current Lite against the static prototype, default Chrome (no GPU flags: on the office
// computer Chrome composites in software), headless, 1648 x 928.
//   node static-perf.mjs [rounds]   -> results/static-perf.json
// Per mode and round, on a fresh browser profile (cold cache); modes alternate, so drift falls on both:
//   load      navigation to the scene shown (Lite: its gate open; static: the plate loaded), LCP, scene requests and
//             bytes, main-thread time, elements under <main>
//   hover     each station, first hover and one repeat: frames over 1 s, hover registered, next paint after the
//             pointer event (Event Timing), station half and fully powered
//   switch    a sweep over the five stations and back, 300 ms on each (10 moves): frames, each visit powered or not
//   select    each station's title clicked: frames over 1.2 s, then Escape
//   chips     each station's first chip: hovered, clicked; selected, next paint after the click, frames over 1 s
//   trace     compositor (viz) busy time for one hover, the sweep, and one selection
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:3002";
const ROUNDS = +(process.argv[2] ?? 2);
// MODES: the render values to compare (default the experiment's "lite,static"); OUT: the results file name.
// After the integration (STATIC-LITE-INTEGRATION.md), `lite` is itself the static scene: MODES=lite OUT=lite-integration-perf.json.
const MODES = (process.env.MODES || "lite,static").split(",");
const OUT = process.env.OUT || "static-perf.json";
const STATIONS = ["engineering", "educational", "playground", "creative", "experience"];
const AWAY = [4, 924];

async function readStream(page, h) { const c = []; for (;;) { const x = await page.send("IO.read", { handle: h, size: 1 << 20 }); c.push(x.base64Encoded ? Buffer.from(x.data, "base64") : Buffer.from(x.data, "latin1")); if (x.eof) break; } await page.send("IO.close", { handle: h }).catch(() => {}); return Buffer.concat(c).toString("latin1"); }
async function traced(page, fn) {
  await page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: ["toplevel", "viz", "gpu", "cc", "devtools.timeline"], excludedCategories: ["*"] } });
  await fn();
  const done = new Promise((ok) => { const o = page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
  await page.send("Tracing.end");
  const t = JSON.parse(await readStream(page, await done)); const ev = t.traceEvents ?? t;
  const tn = {}; for (const e of ev) if (e.ph === "M" && e.name === "thread_name") tn[`${e.pid}:${e.tid}`] = e.args.name;
  const busy = (re) => { let s = 0; const by = {}; for (const e of ev) if (e.ph === "X" && e.dur && re.test(tn[`${e.pid}:${e.tid}`] ?? "")) (by[`${e.pid}:${e.tid}`] ??= []).push(e); for (const l of Object.values(by)) { l.sort((a, b) => a.ts - b.ts); let end = -1; for (const e of l) if (e.ts >= end) { s += e.dur; end = e.ts + e.dur; } } return Math.round(s / 1000); };
  const sum = (re) => Math.round(ev.filter((e) => e.ph === "X" && re.test(e.name)).reduce((a, e) => a + (e.dur ?? 0), 0) / 1000);
  return { vizMs: busy(/^VizCompositorThread$/), rendererMainMs: busy(/^CrRendererMain$/), drawQuadMs: sum(/^SoftwareRenderer::DoDrawQuad$/), rasterMs: sum(/^RasterTask$/) };
}
const stat = (f) => {
  const d = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b), q = (p) => +(d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0).toFixed(1);
  return { frames: f.length, fps: +((f.length - 1) / ((f.at(-1) - f[0]) / 1000)).toFixed(1), medianMs: q(0.5), p95Ms: q(0.95), maxMs: +(d.at(-1) ?? 0).toFixed(1), over50: d.filter((x) => x > 50).length, over100: d.filter((x) => x > 100).length, over150: d.filter((x) => x > 150).length };
};

// Before any page script: when the scene is first shown, LCP, and Event Timing (time to the next paint after an input).
const INIT = `(() => {
  window.__ev = []; window.__lcp = null; window.__ready = null;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ev.push({ name: e.name, start: e.startTime, dur: e.duration }); }).observe({ type: "event", durationThreshold: 16, buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { const e = l.getEntries().at(-1); window.__lcp = { t: Math.round(e.startTime), what: (e.element?.tagName ?? "") + " " + (e.url || "").replace(location.origin, "").slice(0, 60) }; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
  const shown = () => {
    const st = document.querySelector("[data-lab-render]"); if (!st) return false;
    if (st.dataset.labRender === "static" || st.dataset.liteRenderer === "static") { const p = st.querySelector(":scope > img"); return !!p && p.complete && p.naturalWidth > 0; }
    const g = st.querySelector(".lab-plate-gate"); return !!g && +getComputedStyle(g).opacity >= 0.99;
  };
  (function f() { if (!window.__ready && shown()) window.__ready = Math.round(performance.now()); if (!window.__ready) requestAnimationFrame(f); })();
})()`;

// Per frame: time, hovered station, and how powered each station is (0-1). Lite: its unpowered strip overlays fade out
// (Playground: .lab-v2-strip-off). Static: its sprite's opacity.
const HOOK = `(() => {
  const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s);
  const mode = document.querySelector("[data-lab-render]").dataset.labRender;
  const sprites = !!document.querySelector("[data-static-power]");
  const op = (e) => { const c = getComputedStyle(e); return c.display === "none" || c.visibility === "hidden" ? 0 : +c.opacity; };
  const ids = ${JSON.stringify(STATIONS)};
  const els = Object.fromEntries(ids.map((id) => [id, sprites ? [document.querySelector('[data-static-power="' + id + '"]')] : id === "playground" ? [document.querySelector(".lab-v2-strip-off")] : [...document.querySelectorAll('.lab-power-dim[data-power="' + id + '"]')]]));
  for (const id of ids) if (!els[id].length || !els[id][0]) throw new Error("no power indicator for " + id);
  const lit = (id) => { const v = els[id].map((e) => (sprites ? op(e) : 1 - op(e))); return +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3); };
  window.__lit = () => Object.fromEntries(ids.map((id) => [id, lit(id)]));
  window.__f = []; window.__rec = false;
  (function f(t) { if (window.__rec) window.__f.push([t, document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, window.__lit()]); requestAnimationFrame(f); })(performance.now());
  return mode; })()`;

const res = { rounds: ROUNDS, viewport: "1648x928", chrome: "default flags (software compositing on this computer)", runs: [] };
// Warm-up (not measured): the dev server compiles the route and reads every scene file once, so neither mode's first
// measured load pays for that. Each measured run still starts with a cold browser cache (a fresh profile).
{ const page = await launch({ width: 1648, height: 928 }); for (const mode of MODES) { await page.goto(`${BASE}/lab-v2?render=${mode}`); await sleep(1500); } await page.close(); }
for (let r = 0; r < ROUNDS; r++) for (const mode of r % 2 ? [...MODES].reverse() : MODES) {
  const page = await launch({ width: 1648, height: 928 });
  const run = { round: r, mode, errors: [] };
  page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) run.errors.push(JSON.stringify(m.params).slice(0, 200)); });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
  await page.send("Performance.enable"); // before navigating, so the load's main-thread time is counted

  // ---- load
  await page.goto(`${BASE}/lab-v2?render=${mode}`);
  for (let i = 0; i < 100 && !(await page.eval("window.__ready")); i++) await sleep(100);
  await sleep(1500);
  run.load = await page.eval(`(() => {
    const n = performance.getEntriesByType("navigation")[0];
    const sc = performance.getEntriesByType("resource").filter((e) => e.name.includes("/scene/"));
    return { domContentLoadedMs: Math.round(n.domContentLoadedEventEnd), loadMs: Math.round(n.loadEventEnd), sceneShownMs: window.__ready, lcp: window.__lcp,
      sceneRequests: sc.length, sceneKB: Math.round(sc.reduce((a, e) => a + (e.transferSize || e.encodedBodySize), 0) / 1024),
      sceneDecodedMpx: +([...document.querySelectorAll("[data-lab-render] img")].reduce((a, i) => a + i.naturalWidth * i.naturalHeight, 0) / 1e6).toFixed(1),
      lastSceneResponseMs: Math.round(Math.max(0, ...sc.map((e) => e.responseEnd))), mainElements: document.querySelectorAll("main *").length };
  })()`);
  const pm = Object.fromEntries((await page.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  run.load.mainThreadTaskMs = Math.round(pm.TaskDuration * 1000);
  run.load.scriptMs = Math.round(pm.ScriptDuration * 1000);
  run.load.layoutStyleMs = Math.round((pm.LayoutDuration + pm.RecalcStyleDuration) * 1000);

  if ((await page.eval(HOOK)) !== mode) throw new Error(`mode ${mode} not rendered`);
  await page.mouseMove(...AWAY); await sleep(1500);
  const C = {}; for (const id of STATIONS) C[id] = await page.center(`[data-station="${id}"] .lab-station-title`);
  const record = async (moves, ms) => {
    await page.eval("(window.__f.length = 0, window.__ev.length = 0, window.__rec = true, window.__t0 = performance.now(), 1)");
    const marks = [];
    for (const [id, at] of moves) { const t = at - (await page.eval("performance.now() - window.__t0")); if (t > 0) await sleep(t); marks.push([id, await page.eval("performance.now()")]); await page.mouseMove(C[id].x, C[id].y); }
    await sleep(ms);
    return { f: await page.eval("(window.__rec = false, window.__f.slice())"), ev: await page.eval("window.__ev.slice()"), marks };
  };
  const delays = (f, id, t0, t1 = Infinity) => {
    const first = (pred) => { const x = f.find(([t, h, l]) => t >= t0 && t < t1 && pred(h, l)); return x ? Math.round(x[0] - t0) : null; };
    return { hoverMs: first((h) => h === id), poweredHalfMs: first((h, l) => h === id && l[id] >= 0.5), poweredFullMs: first((h, l) => h === id && l[id] >= 0.999) };
  };
  // Event Timing: the longest input-to-next-paint among the events of this interaction (under 16 ms is not reported).
  const nextPaint = (ev, t0, names) => { const d = ev.filter((e) => e.start >= t0 - 5 && names.includes(e.name)).map((e) => e.dur); return d.length ? Math.round(Math.max(...d)) : "<16"; };

  // ---- hover
  run.hover = [];
  for (const id of STATIONS) for (const name of ["first", "repeat"]) {
    const { f, ev, marks } = await record([[id, 0]], 1000);
    run.hover.push({ id, name, ...stat(f.map(([t]) => t)), ...delays(f, id, marks[0][1]), nextPaintMs: nextPaint(ev, marks[0][1], ["pointerover", "pointerenter", "mouseover", "mouseenter"]) });
    await page.mouseMove(...AWAY); await sleep(1200);
  }

  // ---- switching sweep
  {
    const order = [...STATIONS, ...[...STATIONS].reverse()];
    const { f, marks } = await record(order.map((id, i) => [id, i * 300]), 800);
    const last = f.at(-1);
    run.sweep = { ...stat(f.map(([t]) => t)), visits: marks.map(([id, t], i) => ({ id, ...delays(f, id, t, marks[i + 1]?.[1]) })), end: { hover: last[1], lit: last[2] } };
    await page.mouseMove(...AWAY); await sleep(1500);
  }

  // ---- selection: click the title, 1.2 s; Escape, 1 s
  run.select = [];
  for (const id of STATIONS) {
    await page.mouseMove(C[id].x, C[id].y); await sleep(500);
    await page.eval("(window.__f.length = 0, window.__ev.length = 0, window.__rec = true, 1)");
    const t0 = await page.eval("performance.now()");
    await page.click(C[id].x, C[id].y); await sleep(1200);
    const f = await page.eval("(window.__rec = false, window.__f.slice())"), ev = await page.eval("window.__ev.slice()");
    const sel = await page.eval(`({ search: location.search, selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null })`);
    await page.eval("(window.__f.length = 0, window.__rec = true, 1)");
    await page.key("Escape", "Escape", 27); await sleep(1000);
    const fe = await page.eval("(window.__rec = false, window.__f.slice())");
    run.select.push({ id, ...sel, ...stat(f.map(([t]) => t)), nextPaintMs: nextPaint(ev, t0, ["pointerdown", "pointerup", "click", "mousedown", "mouseup"]), escape: stat(fe.map(([t]) => t)) });
    await page.mouseMove(...AWAY); await sleep(1000);
  }

  // ---- chips
  run.chips = [];
  for (const id of STATIONS) {
    const sel = `[data-station="${id}"] .lab-chip`;
    const c = await page.center(sel); await page.mouseMove(c.x, c.y); await sleep(400);
    await page.eval(`(window.__f.length = 0, window.__ev.length = 0, window.__rec = true, window.__chip = null, (function w() { if (document.querySelector(${JSON.stringify(sel)}).getAttribute("aria-pressed") === "true") window.__chip = performance.now(); else if (window.__rec) requestAnimationFrame(w); })(), 1)`);
    const t0 = await page.eval("performance.now()");
    await page.click(c.x, c.y); await sleep(1000);
    const f = await page.eval("(window.__rec = false, window.__f.slice())"), ev = await page.eval("window.__ev.slice()");
    const chipAt = await page.eval("window.__chip");
    run.chips.push({ id, search: await page.eval("location.search"), pressedFrameMs: chipAt ? Math.round(chipAt - t0) : null, nextPaintMs: nextPaint(ev, t0, ["pointerdown", "pointerup", "click", "mousedown", "mouseup"]), ...stat(f.map(([t]) => t)) });
    await page.key("Escape", "Escape", 27); await sleep(900);
    await page.mouseMove(...AWAY); await sleep(700);
  }

  // ---- compositor work
  run.trace = {};
  run.trace.hover = await traced(page, async () => { await sleep(100); await record([["engineering", 0]], 1000); });
  await page.mouseMove(...AWAY); await sleep(1500);
  run.trace.sweep = await traced(page, async () => { await sleep(100); await record([...STATIONS, ...[...STATIONS].reverse()].map((id, i) => [id, i * 300]), 800); });
  await page.mouseMove(...AWAY); await sleep(1500);
  run.trace.select = await traced(page, async () => { await page.mouseMove(C.engineering.x, C.engineering.y); await sleep(400); await page.click(C.engineering.x, C.engineering.y); await sleep(1200); });
  await page.key("Escape", "Escape", 27); await sleep(1000);
  run.home = await page.eval("location.search");

  res.runs.push(run);
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  const h = run.hover;
  console.log(`r${r} ${mode.padEnd(6)} load shown ${run.load.sceneShownMs} ms, LCP ${run.load.lcp?.t}, ${run.load.sceneRequests} req ${run.load.sceneKB} KB, ${run.load.sceneDecodedMpx} Mpx, main ${run.load.mainThreadTaskMs} ms, ${run.load.mainElements} el`);
  console.log(`r${r} ${mode.padEnd(6)} hover  fps ${med(h.map((x) => x.fps))} p95 ${med(h.map((x) => x.p95Ms))} max ${Math.max(...h.map((x) => x.maxMs))} >150 ${h.map((x) => x.over150).join("/")} | half ${h.map((x) => x.poweredHalfMs).join("/")} | next paint ${h.map((x) => x.nextPaintMs).join("/")}`);
  console.log(`r${r} ${mode.padEnd(6)} sweep  fps ${run.sweep.fps} max ${run.sweep.maxMs} >100 ${run.sweep.over100} >150 ${run.sweep.over150} | half ${run.sweep.visits.map((v) => v.poweredHalfMs).join("/")} | end ${run.sweep.end.hover}`);
  console.log(`r${r} ${mode.padEnd(6)} select max ${run.select.map((x) => x.maxMs).join("/")} >150 ${run.select.map((x) => x.over150).join("/")} next paint ${run.select.map((x) => x.nextPaintMs).join("/")} | escape max ${run.select.map((x) => x.escape.maxMs).join("/")}`);
  console.log(`r${r} ${mode.padEnd(6)} chips  pressed ${run.chips.map((x) => x.pressedFrameMs).join("/")} next paint ${run.chips.map((x) => x.nextPaintMs).join("/")} max ${run.chips.map((x) => x.maxMs).join("/")}`);
  console.log(`r${r} ${mode.padEnd(6)} viz    hover ${run.trace.hover.vizMs} sweep ${run.trace.sweep.vizMs} select ${run.trace.select.vizMs} ms | errors ${run.errors.length} home ${JSON.stringify(run.home)}`);
  await page.close();
}
writeFileSync(join(HERE, "results", OUT), JSON.stringify(res, null, 1) + "\n");
process.exit(0);
