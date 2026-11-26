// M1.4K defect D1 reproduction: Playground's ring/strip light on a quick return, against the new spark's arrival.
// The pointer leaves X ms after the spark lands (timed on the spark's own clock) and comes back after a short gap.
//   node repro-pg-lights.mjs [tries] [station,station]   -> results/repro-pg-lights-office.json
import { ARRIVE, SEQ, lab, out, sleep } from "./core.mjs";
const tries = +(process.argv[2] ?? 2), ids = (process.argv[3] ?? "playground,creative").split(",");
const L = await lab();
await L.page.eval(`(() => { window.__back = (id, frames, ms) => new Promise((ok) => { const go = () => { document.querySelector('[data-hotspot="' + id + '"]').dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); ok(1); };
  const wait = () => { if (ms) return setTimeout(go, ms); let n = frames; const f = () => (n-- <= 0 ? go() : requestAnimationFrame(f)); n === 0 ? go() : requestAnimationFrame(f); };
  const d = () => document.querySelector("[data-lab-hover]"); if (!d()) return wait(); const mo = new MutationObserver(() => { if (d()) return; mo.disconnect(); wait(); }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); }); return 1; })()`);
// What the eye sees as the station's light: Playground's ring, strip and arcade; elsewhere the station's own effect lights.
const light = (f, id) => (id === "playground" ? Math.max(f[id].lights.lit, f[id].lights.strip) : f[id].once);
const res = [];
for (let k = 0; k < tries; k++) for (const id of ids) for (const x of [0, 40, 80, 150]) for (const [gap, frames, ms] of [["1 frame", 1, 0], ["50 ms", 0, 50]]) {
  await L.rest(); await L.start(); await L.on(id); await L.hovUntil(id);
  let sp = null; for (let t = 0; t < 1500 && sp === null; t += 5) { sp = (await L.st())[id].spark; if (sp === null) await sleep(5); }
  await L.page.eval(`new Promise((ok) => { const go = () => { const b = window.__back("${id}", ${frames}, ${ms}); document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })); b.then(ok); }; setTimeout(go, Math.max(0, ${sp + ARRIVE[id] + x - 90} - document.timeline.currentTime)); })`);
  await sleep(ARRIVE[id] + SEQ[id] + 600);
  const f = await L.stop();
  await L.page.eval(`(document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })), 1)`);
  const drop = f.findIndex((q, i) => i && q.hover === null && f[i - 1].hover === id), back = f.findIndex((q, i) => i > drop && q.hover === id);
  const sp2 = f.at(-1)[id].spark, arr2 = sp2 + ARRIVE[id], rel = (q) => (q ? Math.round(q.t - arr2) : null);
  const after = f.slice(Math.max(0, back));
  const r = { id, x, gap, spark2Lag: back >= 0 ? Math.round(sp2 - f[back].t) : null, lightAtDrop: drop > 0 ? +light(f[drop], id).toFixed(2) : null,
    light50: rel(after.find((q) => light(q, id) >= 0.5)), light90: rel(after.find((q) => light(q, id) >= 0.9)), lightAtArrival: +light(after.filter((q) => q.t < arr2 - 18).at(-1) ?? after[0], id).toFixed(2),
    liftStart: rel(after.find((q) => q[id].y > 0.1)), returnAt: back >= 0 ? rel(f[back]) : null };
  r.early = r.light90 !== null && r.light90 < -18;
  res.push({ ...r, frames: f.map((q) => ({ t: Math.round(q.t - arr2), hover: q.hover, y: q[id].y, light: +light(q, id).toFixed(3) })) });
  console.log(JSON.stringify(r));
}
for (const id of ids) { const q = res.filter((r) => r.id === id); console.log(id, "runs", q.length, "light at 90 % before the new spark", q.filter((r) => r.early).length, "| median light at arrival", q.map((r) => r.lightAtArrival).sort((a, b) => a - b)[q.length >> 1], "| lift started before it", q.filter((r) => r.liftStart !== null && r.liftStart < -18).length); }
console.log("errors", JSON.stringify(L.errors));
await out("repro-pg-lights-office", res); await L.page.close(); process.exit(0);
