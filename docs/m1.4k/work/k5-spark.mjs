// M1.4K (added at the office): quick returns timed from the spark's own arrival, not from the hover, so the window does not
// depend on how late a GPU starts the spark.   node k5-spark.mjs <label> [tries] [station,station]   -> results/k5-spark-<label>.json
// Leave = the hover drops X ms after the spark's arrival (pointerout 90 ms earlier: the hover's grace). Back after a gap.
import { ARRIVE, HEIGHT, IDS, POWERED, SEQ, lab, out, sleep } from "./core.mjs";
import { analyse } from "./analyse.mjs";
const [label = "office", tries = "2", which] = process.argv.slice(2);
const L = await lab();
await L.page.eval(`(() => { window.__back = (id, frames, ms) => new Promise((ok) => { const go = () => { document.querySelector('[data-hotspot="' + id + '"]').dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); ok(1); };
  const wait = () => { if (ms) return setTimeout(go, ms); let n = frames; const f = () => (n-- <= 0 ? go() : requestAnimationFrame(f)); n === 0 ? go() : requestAnimationFrame(f); };
  const d = () => document.querySelector("[data-lab-hover]"); if (!d()) return wait(); const mo = new MutationObserver(() => { if (d()) return; mo.disconnect(); wait(); }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); }); return 1; })()`);
const res = { label, runs: [] };
const lights = (f, id) => (id === "playground" ? Math.max(f[id].lights.lit, f[id].lights.strip, f[id].lights.arcade) : f[id].once);
for (let k = 0; k < +tries; k++) for (const id of IDS) {
  if (which && !which.split(",").includes(id)) continue;
  for (const x of [-60, 0, 20, 40, 80, 150, 300]) for (const [gname, frames, ms] of [["1 frame", 1, 0], ["2 frames", 2, 0], ["50 ms", 0, 50], ["150 ms", 0, 150]]) {
    await L.rest(); await L.start(); await L.on(id); await L.hovUntil(id);
    // The spark's start on the page's clock, then the pointer leaves on that clock.
    let sp = null; for (let t = 0; t < 1500 && sp === null; t += 5) { sp = (await L.st())[id].spark; if (sp === null) await sleep(5); }
    if (sp === null) { res.runs.push({ id, x, gap: gname, flag: true, why: "no spark" }); continue; }
    const back = L.page.eval(`new Promise((ok) => { const at = ${sp + ARRIVE[id] + x - 90}; const go = () => { const b = window.__back("${id}", ${frames}, ${ms}); document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })); b.then(ok); }; setTimeout(go, Math.max(0, at - document.timeline.currentTime)); })`);
    await back; await sleep(ARRIVE[id] + SEQ[id] + 700);
    const s = await L.read(), f = await L.stop();
    await L.page.eval(`(document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })), 1)`);
    const restOk = await L.rest();
    const a = analyse(f), v = a.visits.at(-1);
    // What the eye sees: the station's own light and height when the second spark lands, against when the hover dropped.
    const drop = f.findIndex((q, i) => i && q.hover === null && f[i - 1].hover === id);
    const sp2 = f.at(-1)[id].spark, arr2 = sp2 === null ? null : sp2 + ARRIVE[id];
    const atDrop = drop > 0 ? { t: Math.round(f[drop].t - (sp + ARRIVE[id])), light: +lights(f[drop], id).toFixed(3), y: f[drop][id].y } : null;
    const pre = arr2 === null ? [] : f.filter((q) => q.t >= (drop > 0 ? f[drop].t : 0) && q.t < arr2 - 18);
    const r = { id, x, gap: gname, visits: a.visits.length, lag2: v?.lag, atDrop, lightBeforeArrival: +Math.max(0, ...pre.map((q) => lights(q, id))).toFixed(3), yBeforeArrival: +Math.max(0, ...pre.map((q) => q[id].y)).toFixed(3), powered: POWERED[id](s[id]), y: f.at(-1)[id].y, rest: restOk, bad: a.bad.slice(0, 3), nBad: a.bad.length, longest: a.note.longest };
    r.flag = !r.powered || Math.abs(r.y - HEIGHT[id]) > 0.25 || !restOk || a.bad.length > 0;
    res.runs.push(r); if (r.flag) console.log("!!", JSON.stringify(r).slice(0, 700));
  }
  const q = res.runs.filter((r) => r.id === id && res.runs.indexOf(r) >= res.runs.length - 28);
  console.log(label, "try", k, id.padEnd(12), "runs", q.length, "flagged", q.filter((r) => r.flag).length, "| light before the 2nd arrival max", Math.max(...q.map((r) => r.lightBeforeArrival ?? 0)), "| height before it max", Math.max(...q.map((r) => r.yBeforeArrival ?? 0)), "| longest frame", Math.max(...q.map((r) => r.longest ?? 0)));
}
res.errors = L.errors; console.log("errors", JSON.stringify(L.errors));
await out(`k5-spark-${label}`, res); await L.page.close(); process.exit(0);
