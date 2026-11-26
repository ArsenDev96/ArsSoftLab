// M1.4K.4: full vs lite on /lab-v2, default Chrome (no GPU flags: software compositing on the office computer), 1648 x 928.
//   node lite-perf.mjs [rounds]   -> results/lite-perf.json
// Per mode and round, on a fresh page (modes alternate, so drift falls on both):
//   hover     Engineering, then Playground: first hover and 2 repeats each (frames; hover and "powered" delays)
//   switch    Engineering -> Playground -> Engineering -> Playground, 900 ms each (frames; each station's end state)
//   traced    one Engineering hover, one Playground hover, one switch run: busy time of the compositing thread
//   chips     hover a chip of each station, click it, check the selection, Escape back
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:3002";
const ROUNDS = +(process.argv[2] ?? 2);
const W = 1650; // a full activation: arrival (620-650 ms) and sequence
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
  return { frames: f.length, fps: +((f.length - 1) / ((f.at(-1) - f[0]) / 1000)).toFixed(1), medianMs: q(0.5), p95Ms: q(0.95), maxMs: +(d.at(-1) ?? 0).toFixed(1), over50: d.filter((x) => x > 50).length, over100: d.filter((x) => x > 100).length };
};

// Per frame: time, hovered station, and how lit each station's strips are (0-1). Full mode spreads them with a front
// (--pw, masked); lite fades the unpowered overlay (opacity). Playground: its unpowered strip overlay in both.
const HOOK = `(() => {
  const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s);
  const lite = !!document.querySelector('[data-lab-render="lite"]');
  const op = (e) => { const c = getComputedStyle(e); return c.display === "none" || c.visibility === "hidden" ? 0 : +c.opacity; };
  const dims = [...document.querySelectorAll('.lab-power-dim[data-power="engineering"]')], strip = document.querySelector(".lab-v2-strip-off");
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  window.__lit = () => ({ e: +mean(dims.map((e) => (lite ? 1 - op(e) : +getComputedStyle(e).getPropertyValue("--pw")))).toFixed(3), p: +(1 - op(strip)).toFixed(3) });
  window.__f = []; window.__rec = false;
  (function f(t) { if (window.__rec) window.__f.push([t, document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, window.__lit()]); requestAnimationFrame(f); })(performance.now());
  return lite; })()`;

const res = { rounds: ROUNDS, runs: [] };
for (let r = 0; r < ROUNDS; r++) for (const mode of r % 2 ? ["lite", "full"] : ["full", "lite"]) {
  const page = await launch({ width: 1648, height: 928 });
  await page.goto(`${BASE}/lab-v2?render=${mode}`);
  const lite = await page.eval(HOOK);
  if (lite !== (mode === "lite")) throw new Error(`mode ${mode}: lite=${lite}`);
  await page.mouseMove(...AWAY); await sleep(2500);
  const C = { engineering: await page.center('[data-hotspot="engineering"]'), playground: await page.center('[data-hotspot="playground"]') };
  const run = { round: r, mode, windows: [], errors: [] };
  page.on((m) => { if (m.method === "Runtime.exceptionThrown") run.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text); });
  const record = async (moves, ms) => {
    await page.eval("(window.__f.length = 0, window.__rec = true, window.__t0 = performance.now(), 1)");
    const marks = [];
    for (const [id, at] of moves) { const t = at - (await page.eval("performance.now() - window.__t0")); if (t > 0) await sleep(t); marks.push([id, await page.eval("performance.now()")]); await page.mouseMove(C[id].x, C[id].y); }
    await sleep(ms);
    const f = await page.eval("(window.__rec = false, window.__f.slice())");
    return { f, marks };
  };
  // Delays after a move: the hover registered, and the station half / fully powered (strips).
  // Only within this visit (until the next move); null: not reached while the station was hovered.
  const delays = (f, id, t0, t1 = Infinity) => {
    const k = id === "engineering" ? "e" : "p";
    const atMove = f.filter(([t]) => t < t0).at(-1)?.[2][k] ?? 0;
    const first = (pred) => { const x = f.find(([t, h, l]) => t >= t0 && t < t1 && pred(h, l)); return x ? Math.round(x[0] - t0) : null; };
    return { litAtMove: atMove, hoverMs: first((h) => h === id), poweredHalfMs: first((h, l) => h === id && l[k] >= 0.5), poweredFullMs: first((h, l) => h === id && l[k] >= 0.999) };
  };
  for (const id of ["engineering", "playground"]) for (const name of ["first", "repeat 1", "repeat 2"]) {
    const { f, marks } = await record([[id, 0]], W);
    const t0 = marks[0][1], early = f.filter(([t]) => t < t0 + 300).map(([t]) => t);
    run.windows.push({ scenario: `${id} hover`, name, ...stat(f.map(([t]) => t)), ...delays(f, id, t0), longestFirst300: Math.round(Math.max(0, ...early.slice(1).map((t, i) => t - early[i]))) });
    await page.mouseMove(...AWAY); await sleep(2600);
  }
  // Switching, 900 ms on each.
  {
    const { f, marks } = await record([["engineering", 0], ["playground", 900], ["engineering", 1800], ["playground", 2700]], 1500);
    const last = f.at(-1)[2];
    run.windows.push({ scenario: "switch", name: "E-P-E-P", ...stat(f.map(([t]) => t)), switches: marks.map(([id, t], i) => ({ id, ...delays(f, id, t, marks[i + 1]?.[1]) })), end: { hover: f.at(-1)[1], engineeringLit: last.e, playgroundLit: last.p } });
    await page.mouseMove(...AWAY); await sleep(2600);
  }
  // Compositing: one traced run of each.
  run.trace = {};
  for (const [name, moves, ms] of [["engineering hover", [["engineering", 0]], W], ["playground hover", [["playground", 0]], W], ["switch", [["engineering", 0], ["playground", 900], ["engineering", 1800], ["playground", 2700]], 1500]]) {
    run.trace[name] = await traced(page, async () => { await sleep(100); await record(moves, ms); });
    await page.mouseMove(...AWAY); await sleep(2600);
  }
  // Chips: hover the chip until the station is settled (full: its label has risen), click its centre, Escape back.
  run.chips = [];
  for (const id of ["engineering", "playground"]) {
    const sel = `[data-station="${id}"] .lab-chip`;
    const c0 = await page.center(sel); await page.mouseMove(c0.x, c0.y); await sleep(1800);
    const c = await page.center(sel);
    await page.eval("(window.__f.length = 0, window.__rec = true, window.__t0 = performance.now(), 1)");
    await page.click(c.x, c.y);
    const t0 = await page.eval("performance.now()");
    let selectedMs = null;
    for (let k = 0; k < 400; k++) { if (await page.eval("location.search.includes('project=')")) { selectedMs = Math.round((await page.eval("performance.now()")) - t0); break; } await sleep(5); }
    await sleep(1400);
    const f = await page.eval("(window.__rec = false, window.__f.slice())");
    const state = await page.eval(`({ search: location.search, selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, project: document.querySelector("[data-lab-project]")?.dataset.labProject ?? null, chipPressed: document.querySelector(${JSON.stringify(sel)})?.getAttribute("aria-pressed") ?? null })`);
    run.chips.push({ id, chipMovedPx: +Math.hypot(c.x - c0.x, c.y - c0.y).toFixed(1), selectedMs, ...state, ...stat(f.map(([t]) => t)) });
    await page.key("Escape", "Escape", 27); await sleep(1200);
    await page.mouseMove(...AWAY); await sleep(1500);
  }
  run.home = await page.eval("location.search");
  res.runs.push(run);
  const w = (sc) => run.windows.filter((x) => x.scenario === sc);
  const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
  for (const sc of ["engineering hover", "playground hover", "switch"]) {
    const x = w(sc);
    console.log(`r${r} ${mode.padEnd(4)} ${sc.padEnd(17)} fps ${x.map((y) => y.fps).join("/")} p95 ${med(x.map((y) => y.p95Ms))} max ${Math.max(...x.map((y) => y.maxMs))} >50ms ${x.map((y) => y.over50).join("/")} | ${sc === "switch" ? JSON.stringify(x[0].switches.map((s) => s.poweredHalfMs)) + " end " + JSON.stringify(x[0].end) : "hover " + x.map((y) => y.hoverMs).join("/") + " half " + x.map((y) => y.poweredHalfMs).join("/") + " full " + x.map((y) => y.poweredFullMs).join("/")} | viz ${run.trace[sc].vizMs} ms drawQuad ${run.trace[sc].drawQuadMs}`);
  }
  for (const c of run.chips) console.log(`r${r} ${mode.padEnd(4)} chip ${c.id.padEnd(11)} moved ${c.chipMovedPx}px selected ${c.selectedMs} ms -> ${c.search} pressed ${c.chipPressed} | fps ${c.fps} max ${c.maxMs}`);
  console.log(`r${r} ${mode} home ${JSON.stringify(run.home)} errors ${run.errors.length}`);
  await page.close();
}
writeFileSync(join(HERE, "results", "lite-perf.json"), JSON.stringify(res, null, 1) + "\n");
process.exit(0);
