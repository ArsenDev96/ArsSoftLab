// M1.4K defect D2 reproduction: Playground's AZIZ chip while the station sinks, clicked where it is drawn when the pointer
// arrives (k6-hits clicks where it is at rest). The press follows after 0, 30 or 150 ms; what is under the pointer at the press
// is recorded.   node k6-pg-live.mjs [tries]   -> results/k6-pg-live-office.json
import { POWERED, lab, out, sleep } from "./core.mjs";
const tries = +(process.argv[2] ?? 3);
const L = await lab(); const { page } = L;
const press = async ([x, y]) => { await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };
const box = () => page.eval(`(() => { const r = document.querySelector('section[data-station="playground"] li button').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()`);
const what = ([x, y]) => page.eval(`(() => { const e = document.elementFromPoint(${x}, ${y}); return e?.closest("li button") ? "chip" : e?.closest("h2 button") ? "title" : e?.dataset?.bridge ? "bridge" : e?.dataset?.hotspot ? "hotspot" : e?.closest("[data-station]") ? "label" : "other"; })()`);
const res = [];
for (let k = 0; k < tries; k++) for (const wait of [120, 260, 360]) for (const delay of [0, 30, 150]) for (const where of ["left end", "centre"]) {
  await L.home();
  await L.on("playground"); await L.settle((s) => POWERED.playground(s.playground), 8000); await sleep(250);
  await L.off(); await L.hovUntil(null); await sleep(wait);
  await page.eval("(window.__sparks.length = 0, 1)");
  const b = await box(), p = [where === "centre" ? (b[0] + b[2]) / 2 : b[0] + 2.5, (b[1] + b[3]) / 2], y0 = (await L.st()).playground.y;
  const under0 = await what(p); await page.mouseMove(...p); if (delay) await sleep(delay);
  const under1 = await what(p), b1 = await box(), y1 = (await L.st()).playground.y; await press(p); await sleep(450);
  const url = await page.eval("location.search"), sparks = await page.eval("window.__sparks.length");
  const r = { k, wait, delay, where, y0, y1, chipMoved: +(b1[1] - b[1]).toFixed(2), under0, underAtPress: under1, sparks, ok: url === "?station=playground&project=aziz", url };
  res.push(r); if (!r.ok) console.log("!!", JSON.stringify(r));
}
for (const delay of [0, 30, 150]) for (const where of ["left end", "centre"]) { const q = res.filter((r) => r.delay === delay && r.where === where); console.log(`press ${delay} ms after arriving, ${where}: ${q.filter((r) => r.ok).length} of ${q.length} opened AZIZ | chip moved max ${Math.max(...q.map((r) => r.chipMoved))} px | not under the pointer at the press ${q.filter((r) => r.underAtPress !== "chip").length}`); }
console.log("errors", JSON.stringify(L.errors));
await out("k6-pg-live-office", res); await page.close(); process.exit(0);
