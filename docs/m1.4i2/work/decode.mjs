// M1.4I.2: image decoding, traced. Load, then the first and second hover of each station on one page.  node decode.mjs <label> [n]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { ARRIVE, BASE, IDS, SEQ } from "../../m1.4i/work/lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const [label, n = "2"] = process.argv.slice(2);
async function trace(page, fn) {
  await page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "cc"], excludedCategories: ["*"] } });
  await fn();
  const done = new Promise((ok) => { const o = page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
  await page.send("Tracing.end");
  const h = await done;
  let t = "";
  for (;;) { const r = await page.send("IO.read", { handle: h, size: 400000 }); t += r.base64Encoded ? Buffer.from(r.data, "base64").toString("latin1") : r.data; if (r.eof) break; }
  await page.send("IO.close", { handle: h });
  const ev = JSON.parse(t).traceEvents;
  const sum = (re) => { const e = ev.filter((x) => x.ph === "X" && re.test(x.name)); return { n: e.length, ms: +(e.reduce((a, x) => a + (x.dur ?? 0), 0) / 1000).toFixed(1) }; };
  return { decode: sum(/^Decode Image$/), lazy: sum(/^Decode LazyPixelRef$/), raster: sum(/^RasterTask$/) };
}
const out = [];
for (let i = 0; i < +n; i++) {
  const page = await launch({ gpu: true });
  const r = {};
  r.load = await trace(page, async () => { await page.goto(BASE + "/lab-v2"); await page.mouseMove(4, 924); await sleep(1500); });
  for (const k of ["first", "second"]) {
    r[k] = {};
    for (const id of IDS) {
      const c = await page.center(`[data-hotspot="${id}"]`);
      r[k][id] = await trace(page, async () => { await page.mouseMove(c.x, c.y); await sleep(ARRIVE[id] + SEQ[id] + 300); });
      await page.mouseMove(4, 924);
      await sleep(1700);
    }
  }
  out.push(r);
  const f = (x) => `${x.decode.n}/${x.decode.ms}ms raster ${x.raster.n}/${x.raster.ms}`;
  console.log(label, "load", f(r.load), "| first", IDS.map((id) => `${id.slice(0, 3)} ${f(r.first[id])}`).join(", "), "| second", IDS.map((id) => `${id.slice(0, 3)} ${f(r.second[id])}`).join(", "));
  writeFileSync(join(HERE, `decode-${label}.json`), JSON.stringify(out) + "\n");
  await page.close();
}
process.exit(0);
