// qr-run's "escape" case (click 200 ms after the hover, Escape 100 ms later), repeated with its timeline. Cold: the first act of a new page.
//   node extra/esc.mjs [station] [cold] [warm]
import { writeFileSync } from "node:fs";
import { STATIONS, judge, open, sleep, visits } from "../../../../m1.4i1/work/qr-lib.mjs";
const [id = "creative", cold = "8", warm = "8"] = process.argv.slice(2);
const A = STATIONS[id].arrive, SEQ = STATIONS[id].seq;
const rows = [];
async function one(S, kind, stay) {
  const { page, call, rest } = S;
  const c = await page.center(`[data-hotspot="${id}"]`);
  await rest();
  await page.eval("(window.__q.start(), 1)");
  await page.mouseMove(c.x, c.y);
  await sleep(200);
  await page.click(c.x, c.y);
  await page.mouseMove(4, 924);
  await sleep(100);
  const tEsc = await page.eval("document.timeline.currentTime");
  await page.key("Escape", "Escape", 27);
  await sleep(A + SEQ + stay);
  const before = await page.eval(`({ t: document.timeline.currentTime, url: location.pathname + location.search, focus: document.activeElement?.id, hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, sel: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null })`);
  await page.eval("(document.activeElement.blur(), 1)");
  await sleep(1000);
  const log = await call("window.__q.stop()");
  const v = visits(id, log);
  const last = v.at(-1), j = judge(id, last), f = last.frames;
  let longest = 0;
  for (let k = 1; k < log.length; k++) longest = Math.max(longest, log[k].t - log[k - 1].t);
  const r = { kind, stay, visits: v.length, from: Math.round(f[0].t - tEsc), spark: f.at(-1).spark === null ? null : Math.round(f.at(-1).spark - tEsc), arrive: Math.round(last.arrive - tEsc), end: Math.round(f.at(-1).t - tEsc), endNums: f.at(-1).nums, endPw: f.at(-1).pw, endStable: f.at(-1).stable, powered: j.powered, premature: j.premature, stale: j.stale, froze: j.froze, longestFrame: Math.round(longest), atBlur: before };
  rows.push(r);
  console.log(JSON.stringify(r));
}
for (let k = 0; k < +cold; k++) { const S = await open(id); await one(S, "cold", 400); await S.page.close(); }
const W = await open(id);
for (let k = 0; k < +warm; k++) await one(W, "warm", 400);
for (let k = 0; k < 3; k++) await one(W, "warm, longer stay", 1500);
writeFileSync(`out/esc-${id}.json`, JSON.stringify(rows, null, 0));
console.log(`not powered: cold ${rows.filter((r) => r.kind === "cold" && !r.powered).length} of ${cold}; warm ${rows.filter((r) => r.kind === "warm" && !r.powered).length} of ${warm}; longer ${rows.filter((r) => r.stay === 1500 && !r.powered).length} of 3; premature/stale/frozen ${rows.filter((r) => r.premature || r.stale || r.froze).length}; errors ${JSON.stringify(W.errors)}`);
await W.page.close();
process.exit(0);
