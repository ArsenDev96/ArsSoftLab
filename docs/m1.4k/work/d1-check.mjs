// M1.4K.7 (D1 fix): Playground's quick return, ring / strip / arcade screen kept apart, timed on the spark's own clock
// as k5-spark.mjs. Per run: each light at the return, its largest rise and its highest level in the last 200 ms before
// the new spark lands, its level at the arrival, and when the ring and strip reach half / full after it.
//   node d1-check.mjs <label> [tries]   -> results/d1-check-<label>.json
import { ARRIVE, HEIGHT, SEQ, lab, out, sleep } from "./core.mjs";
const [label = "check", tries = "1"] = process.argv.slice(2);
const id = "playground";
const L = await lab();
await L.page.eval(`(() => { window.__back = (id, frames, ms) => new Promise((ok) => { const go = () => { document.querySelector('[data-hotspot="' + id + '"]').dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); ok(1); };
  const wait = () => { if (ms) return setTimeout(go, ms); let n = frames; const f = () => (n-- <= 0 ? go() : requestAnimationFrame(f)); n === 0 ? go() : requestAnimationFrame(f); };
  const d = () => document.querySelector("[data-lab-hover]"); if (!d()) return wait(); const mo = new MutationObserver(() => { if (d()) return; mo.disconnect(); wait(); }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); }); return 1; })()`);
const res = [];
const KEYS = ["lit", "strip", "arcade"];
for (let k = 0; k < +tries; k++) for (const x of [-60, 0, 40, 80, 150, 300]) for (const [gap, frames, ms] of [["1 frame", 1, 0], ["150 ms", 0, 150]]) {
  await L.rest(); await L.start(); await L.on(id); await L.hovUntil(id);
  let sp = null; for (let t = 0; t < 1500 && sp === null; t += 5) { sp = (await L.st())[id].spark; if (sp === null) await sleep(5); }
  await L.page.eval(`new Promise((ok) => { const go = () => { const b = window.__back("${id}", ${frames}, ${ms}); document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })); b.then(ok); }; setTimeout(go, Math.max(0, ${sp + ARRIVE[id] + x - 90} - document.timeline.currentTime)); })`);
  await sleep(ARRIVE[id] + SEQ[id] + 700);
  const s = await L.read(), f = await L.stop();
  await L.page.eval(`(document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })), 1)`);
  const restOk = await L.rest();
  let b = -1; for (let i = 1; i < f.length; i++) if (f[i].hover === id && f[i - 1].hover === null) b = i;
  const arr = f.at(-1)[id].spark + ARRIVE[id];
  const pre = f.slice(Math.max(0, b)).filter((q) => q.t < arr - 18), post = f.filter((q) => q.t >= arr - 18);
  const r = { x, gap, spark2Lag: b >= 0 ? Math.round(f.at(-1)[id].spark - f[b].t) : null, longest: Math.round(Math.max(...f.slice(1).map((q, i) => q.t - f[i].t))) };
  for (const key of KEYS) {
    const v = (q) => q[id].lights[key];
    let rise = 0; for (let i = 1; i < pre.length; i++) rise = Math.max(rise, v(pre[i]) - v(pre[i - 1]));
    r[key] = { atReturn: b >= 0 ? +v(f[b]).toFixed(3) : null, rise: +rise.toFixed(3), last200: +Math.max(0, ...pre.filter((q) => q.t >= arr - 200).map(v)).toFixed(3), atArrival: +(pre.length ? v(pre.at(-1)) : 0).toFixed(3) };
  }
  const ring = (q) => Math.max(q[id].lights.lit, q[id].lights.strip);
  r.half = post.find((q) => ring(q) >= 0.5) ? Math.round(post.find((q) => ring(q) >= 0.5).t - arr) : null;
  r.full = post.find((q) => ring(q) >= 0.99) ? Math.round(post.find((q) => ring(q) >= 0.99).t - arr) : null;
  r.liftRoseBefore = +Math.max(0, ...pre.map((q) => q[id].y - (f[b]?.[id].y ?? 0))).toFixed(2);
  r.height = f.at(-1)[id].y; r.rest = restOk;
  r.ok = r.lit.last200 < 0.01 && r.strip.last200 < 0.01 && r.lit.rise < 0.01 && r.strip.rise < 0.01 && Math.abs(r.height - HEIGHT[id]) < 0.25 && restOk;
  res.push(r);
  console.log(`${String(x).padStart(4)} ms ${gap.padEnd(7)} | ring at return ${r.lit.atReturn} last 200 ms ${r.lit.last200} at arrival ${r.lit.atArrival} rise ${r.lit.rise} | strip ${r.strip.atReturn} / ${r.strip.last200} / ${r.strip.atArrival} / ${r.strip.rise} | arcade ${r.arcade.atReturn} / ${r.arcade.last200} / ${r.arcade.atArrival} / ${r.arcade.rise} | half ${r.half} full ${r.full} | lift rose ${r.liftRoseBefore} end ${r.height} | ${r.ok ? "ok" : "FLAG"}`);
}
console.log(`${label}: ${res.filter((r) => r.ok).length} of ${res.length} ok | ring or strip lit in the last 200 ms: ${res.filter((r) => r.lit.last200 >= 0.01 || r.strip.last200 >= 0.01).length} | arcade lit in the last 200 ms: ${res.filter((r) => r.arcade.last200 >= 0.01).length} | errors ${JSON.stringify(L.errors)}`);
await out(`d1-check-${label}`, res); await L.page.close(); process.exit(0);
