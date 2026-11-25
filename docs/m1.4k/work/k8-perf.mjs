// M1.4K section 8: what each lift adds. Real time, GPU. Same page, lifts on and held at 0 (Playground's is not CSS-number driven: on only).
//   node k8-perf.mjs [path]
import { ARRIVE, IDS, lab, out, sleep } from "./core.mjs";
const path = process.argv[2] ?? "/lab-v2";
const OFF = ".eng-lift{--el:0!important;transition:none!important}.eng-lift-cycle{transition:none!important}.edu-lift{--dl:0!important;transition:none!important}.cre-lift{--cl:0!important;transition:none!important}.exp-lift{--xl:0!important;transition:none!important}";
const res = {};
for (const mode of ["on", "off", "on", "off"]) {
  const L = await lab(path);
  if (mode === "off") await L.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ${JSON.stringify(OFF)}; document.head.append(e); return 1; })()`);
  await L.page.eval(`(() => { window.__f = []; window.__cls = 0; window.__lt = []; (function f() { window.__f.push(performance.now()); requestAnimationFrame(f); })(); new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__cls += e.value))).observe({ type: "layout-shift", buffered: true }); new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask" }); return 1; })()`);
  for (const id of IDS) {
    const r = ((res[mode] ??= {})[id] ??= { first: [], frames: [], longest: [], down: [], raster: [], gpu: [], paint: [], main: [], decodes: [] });
    for (let k = 0; k < 6; k++) {
      await L.rest(); await sleep(400);
      await L.on(id); await L.hovUntil(id); const t0 = await L.page.eval("performance.now()");
      await sleep(ARRIVE[id] + 1000);
      const f = await L.page.eval(`window.__f.filter((t) => t >= ${t0 + ARRIVE[id]} && t < ${t0 + ARRIVE[id] + 800})`);
      const lg = Math.round(Math.max(...f.slice(1).map((t, i) => t - f[i])));
      if (k === 0) r.first.push([f.length, lg]); else { r.frames.push(f.length); r.longest.push(lg); }
      await L.off(); await L.hovUntil(null); const t1 = await L.page.eval("performance.now()"); await sleep(560);
      const g = await L.page.eval(`window.__f.filter((t) => t >= ${t1} && t < ${t1 + 500})`); r.down.push(g.length);
    }
    for (let k = 0; k < 4; k++) {
      await L.rest(); await sleep(300); await L.on(id); await sleep(ARRIVE[id] - 20);
      await L.page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "cc", "gpu", "viz"], excludedCategories: ["*"] } });
      await sleep(800);
      const done = new Promise((ok) => { const o = L.page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
      await L.page.send("Tracing.end"); const h = await done; let t = "";
      for (;;) { const x = await L.page.send("IO.read", { handle: h, size: 400000 }); t += x.base64Encoded ? Buffer.from(x.data, "base64").toString("latin1") : x.data; if (x.eof) break; }
      const ev = JSON.parse(t).traceEvents, sum = (re) => { const e = ev.filter((x) => x.ph === "X" && re.test(x.name)); return [e.length, Math.round(e.reduce((a, x) => a + (x.dur ?? 0), 0) / 1000)]; };
      r.raster.push(sum(/^RasterTask$/)); r.gpu.push(sum(/^GPUTask$/)); r.paint.push(sum(/^Paint$/)); r.main.push(sum(/^(FunctionCall|UpdateLayoutTree|Layout|PrePaint|Paint|Layerize|Commit)$/)); r.decodes.push(sum(/Decode (Image|LazyPixelRef)|ImageDecodeTask/)[0]);
    }
  }
  res[mode].cls = [...(res[mode].cls ?? []), await L.page.eval("window.__cls")]; res[mode].long = [...(res[mode].long ?? []), await L.page.eval("window.__lt")]; res[mode].errors = L.errors;
  await L.page.close();
}
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
for (const id of IDS) console.log(id.padEnd(12), ["on", "off"].map((m) => { const r = res[m][id]; return `${m}: first visit ${JSON.stringify(r.first)} | frames/800 ms ${Math.min(...r.frames)}-${Math.max(...r.frames)} med ${med(r.frames)} longest ${med(r.longest)} max ${Math.max(...r.longest)} | down/500 ms ${med(r.down)} | raster ${med(r.raster.map((x) => x[0]))} | gpu ms ${med(r.gpu.map((x) => x[1]))} | main ms ${med(r.main.map((x) => x[1]))} | decodes ${r.decodes.join()}`; }).join("\n             "));
console.log("layout shift", JSON.stringify(res.on.cls), JSON.stringify(res.off.cls), "long tasks", JSON.stringify(res.on.long), "errors", JSON.stringify(res.on.errors));
await out("k8-perf" + (path.includes("floor") ? "-tone" : ""), res); process.exit(0);
