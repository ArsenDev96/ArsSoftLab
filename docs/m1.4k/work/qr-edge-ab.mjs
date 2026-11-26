// M1.4K (added at the office): click then Escape (qr-run's "edge" set), the same page with the lifts on and held at 0,
// alternated, to tell whether a lift makes the sequence resume part-way.   node qr-edge-ab.mjs <station> [rounds]
//   -> results/qr-edge-ab-<station>-office.json
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, STATIONS, ending, judge, open, sleep, tally, visits } from "./qr-lib.mjs";
const [id = "educational", rounds = "2"] = process.argv.slice(2);
const A = STATIONS[id].arrive, SEQ = STATIONS[id].seq;
// The lifts held at 0, as k8-perf.mjs does it.
const OFF = ".eng-lift{--el:0!important;transition:none!important}.eng-lift-cycle{transition:none!important}.edu-lift{--dl:0!important;transition:none!important}.cre-lift{--cl:0!important;transition:none!important}.exp-lift{--xl:0!important;transition:none!important}";
const out = { id, runs: [] };
for (let k = 0; k < +rounds; k++) for (const mode of ["on", "off"]) {
  const { page, call, errors, rest } = await open(id);
  if (mode === "off") await page.eval(`(() => { const e = document.createElement("style"); e.textContent = ${JSON.stringify(OFF)}; document.head.append(e); return 1; })()`);
  const c = await page.center(`[data-hotspot="${id}"]`);
  const runs = [];
  for (const [click, esc] of [[200, 100], [A - 100, 250], [A + 80, 150], [A + 180, 200], [A + 300, 250], [A + 420, 200], [A + SEQ + 300, 400]]) {
    await rest();
    await page.eval("(window.__q.start(), 1)");
    await page.mouseMove(c.x, c.y); await sleep(click);
    await page.click(c.x, c.y); await page.mouseMove(4, 924); await sleep(esc);
    await page.key("Escape", "Escape", 27); await sleep(A + SEQ + 400);
    await page.eval("(document.activeElement.blur(), 1)"); await sleep(1000);
    const log = await call("window.__q.stop()");
    const v = visits(id, log).map((x) => judge(id, x));
    const r = { round: k, mode, click, esc, visits: v.length, ...v.at(-1), ending: ending(id, log) };
    runs.push(r); out.runs.push(r);
  }
  const t = tally(id, runs);
  console.log(`round ${k} lifts ${mode.padEnd(3)}`, JSON.stringify({ runs: t.runs, bad: t.bad, premature: t.premature, held: t.heldThroughCharge, resumesPartWay: t.resumesPartWay, notAtRest: t.notAtRest }), "| at arrival", runs.map((r) => (r.atArrival ? Object.values(r.atArrival).map((x) => +x.toFixed(2)).join("/") : "-")).join(" "), "| frames before", runs.map((r) => r.framesBefore).join(","), "errors", JSON.stringify(errors));
  await page.close();
}
for (const mode of ["on", "off"]) { const q = out.runs.filter((r) => r.mode === mode); console.log(`lifts ${mode}: ${q.length} runs, bad ${q.filter((r) => r.bad).length}, resumes part-way ${q.filter((r) => r.resumes.length).length}, held ${q.filter((r) => r.held).length}`); }
writeFileSync(join(HERE, "results", `qr-edge-ab-${id}-office.json`), JSON.stringify(out) + "\n");
process.exit(0);
