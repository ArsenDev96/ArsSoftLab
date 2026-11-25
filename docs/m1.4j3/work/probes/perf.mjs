// M1.4J.3: frames, layers, raster and GPU work of one activation.   BASE=... node perf.mjs <label> [station]
import { ARRIVE, IDS, REST, open, sleep } from "../../../m1.4i/work/lib.mjs";
const [label, id = "creative", nolift] = process.argv.slice(2);
const A = ARRIVE[id];
const L = await open("/lab-v2", { gpu: true });
if (nolift) await L.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ".cre-lift{--cl:0!important;transition:none!important}"; document.head.append(e); return 1; })()`);
await sleep(1000);
let ls = []; const off = L.page.on((m) => { if (m.method === "LayerTree.layerTreeDidChange" && m.params.layers) ls = m.params.layers; });
await L.page.send("LayerTree.enable");
for (let k = 0; k < 6 && !ls.length; k++) { await L.page.eval(`document.documentElement.style.setProperty("outline", "0 solid rgb(0 0 ${k})")`); await sleep(400); }
off(); await L.page.send("LayerTree.disable");
const d = ls.filter((l) => l.drawsContent);
const layers = { draw: d.length, full: d.filter((l) => l.width > 1500 && l.height > 800).length, Mpx: +(d.reduce((t, l) => t + l.width * l.height, 0) / 1e6).toFixed(2) };
const files = await L.page.eval(`performance.getEntriesByType("resource").filter((r) => /\\/scene\\//.test(r.name)).length`);
await L.page.eval(`(() => { window.__f = []; (function f() { window.__f.push(performance.now()); requestAnimationFrame(f); })(); return 1; })()`);
const c = await L.page.center(`[data-hotspot="${id}"]`);
const rest = async () => { await L.off(); await L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 8000); await sleep(600); };
const frames = [], long = [];
for (let k = 0; k < 7; k++) {
  await rest();
  await L.page.mouseMove(c.x, c.y);
  for (let i = 0; i < 200 && (await L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`)) !== id; i++) await sleep(2);
  const t0 = await L.page.eval("performance.now()");
  await sleep(A + 1000);
  const f = await L.page.eval(`window.__f.filter((t) => t >= ${t0 + A} && t < ${t0 + A + 800})`);
  if (k) { frames.push(f.length); long.push(Math.round(Math.max(...f.slice(1).map((t, i) => t - f[i])))); }
}
const gpu = [];
for (let k = 0; k < 3; k++) {
  await rest(); await L.page.mouseMove(c.x, c.y); await sleep(A - 30);
  await L.page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "cc", "gpu", "viz"], excludedCategories: ["*"] } });
  await sleep(800);
  const done = new Promise((ok) => { const o = L.page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
  await L.page.send("Tracing.end"); const h = await done; let t = "";
  for (;;) { const r = await L.page.send("IO.read", { handle: h, size: 400000 }); t += r.base64Encoded ? Buffer.from(r.data, "base64").toString("latin1") : r.data; if (r.eof) break; }
  const ev = JSON.parse(t).traceEvents, sum = (re) => { const e = ev.filter((x) => x.ph === "X" && re.test(x.name)); return [e.length, Math.round(e.reduce((a, x) => a + (x.dur ?? 0), 0) / 1000)]; };
  gpu.push([sum(/^RasterTask$/), sum(/^GPUTask$/), sum(/^Paint$/)]);
}
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
console.log(label.padEnd(16), id, "layers", JSON.stringify(layers), "files", files, "| frames in 800 ms", frames.join(" "), "median", med(frames), "longest", med(long), "| raster/gpu/paint [n, ms]", JSON.stringify(gpu));
await L.page.close();
process.exit(0);
