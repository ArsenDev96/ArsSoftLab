import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const A = ARRIVE.engineering;
const V = { "no lift": ".eng-lift{--el:0!important;transition:none!important}", lift: "", "lift, will-change while on": ':is([data-lab-hover="engineering"],[data-lab-selected="engineering"]) .eng-rise{will-change:transform}' };
for (const [n, css] of Object.entries(V)) {
  const L = await open("/lab-v2", { gpu: true });
  if (css) await L.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ${JSON.stringify(css)}; document.head.append(e); return 1; })()`);
  const c = await L.page.center('[data-hotspot="engineering"]');
  await L.page.mouseMove(c.x, c.y); await sleep(2200); await L.page.mouseMove(4, 924); await sleep(1800);
  const rows = [];
  for (let k = 0; k < 3; k++) {
    await L.page.mouseMove(c.x, c.y); await sleep(A - 30);
    await L.page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "cc", "gpu", "viz"], excludedCategories: ["*"] } });
    await sleep(800);
    const done = new Promise((ok) => { const o = L.page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
    await L.page.send("Tracing.end"); const h = await done; let t = "";
    for (;;) { const r = await L.page.send("IO.read", { handle: h, size: 400000 }); t += r.base64Encoded ? Buffer.from(r.data, "base64").toString("latin1") : r.data; if (r.eof) break; }
    const ev = JSON.parse(t).traceEvents; const sum = (re) => { const e = ev.filter((x) => x.ph === "X" && re.test(x.name)); return [e.length, +(e.reduce((a, x) => a + (x.dur ?? 0), 0) / 1000).toFixed(1)]; };
    rows.push({ raster: sum(/^RasterTask$/), paint: sum(/^Paint$/), style: sum(/^(UpdateLayoutTree|RecalculateStyles)$/), layerize: sum(/^Layerize$/), gpu: sum(/^GPUTask$/), prepaint: sum(/^PrePaint$/) });
    await L.page.mouseMove(4, 924); await sleep(1800);
  }
  console.log(n.padEnd(28), rows.map((r) => JSON.stringify(r)).join("\n" + " ".repeat(29)));
  await L.page.close();
}
process.exit(0);
