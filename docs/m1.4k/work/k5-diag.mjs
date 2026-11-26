// M1.4K (office): replay one quick-return case and keep every frame, to see why a visit lost its spark.
//   node k5-diag.mjs <station> <leave at ms> <frames> [tries]      -> results/k5-diag-<station>-<at>.json
import { ARRIVE, IDS, lab, out, sleep } from "./core.mjs";
import { analyse, visits } from "./analyse.mjs";
const [id = "experience", at = "620", frames = "0", tries = "6"] = process.argv.slice(2);
const L = await lab();
await L.page.eval(`(() => { window.__back = (id, frames) => new Promise((ok) => { const go = () => { document.querySelector('[data-hotspot="' + id + '"]').dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); ok(1); };
  const wait = () => { let n = frames; const f = () => (n-- <= 0 ? go() : requestAnimationFrame(f)); n === 0 ? go() : requestAnimationFrame(f); };
  const d = () => document.querySelector("[data-lab-hover]"); if (!d()) return wait(); const mo = new MutationObserver(() => { if (d()) return; mo.disconnect(); wait(); }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); }); return 1; })()`);
const keep = [];
for (let k = 0; k < +tries; k++) {
  await L.rest(); await L.start(); await L.on(id); await L.hovUntil(id);
  await L.page.eval(`new Promise((r) => setTimeout(r, ${Math.max(0, ARRIVE[id] + +at - 90)}))`);
  const back = L.page.eval(`window.__back("${id}", ${+frames})`);
  await L.page.eval(`(document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })), 1)`);
  await back; await sleep(ARRIVE[id] + 1500);
  const f = await L.stop();
  await L.page.eval(`(document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })), 1)`);
  const a = analyse(f), v = visits(f);
  // Where the second spark first shows up: its start time against the frame that first carries it.
  const sparks = [...new Set(f.map((x) => x[id].spark).filter((s) => s !== null))];
  const firstSeen = sparks.map((s) => { const i = f.findIndex((x) => x[id].spark === s); return { spark: +s.toFixed(1), seenAt: +f[i].t.toFixed(1), seenLate: +(f[i].t - s).toFixed(1), prevFrame: i ? +f[i - 1].t.toFixed(1) : null, hoverThen: f[i].hover }; });
  const r = { k, bad: a.bad.map((b) => b.slice(0, 2).join(": ")), badFull: a.bad.slice(0, 3), visits: v.map((x) => ({ t0: +x.t0.toFixed(1), spark: x.spark === null ? null : +x.spark.toFixed(1), lag: x.lag })), firstSeen, hoverChanges: await L.page.eval("window.__hc.map(([t, v]) => [+t.toFixed(1), v])") };
  console.log(JSON.stringify(r));
  keep.push({ ...r, frames: f.map((x) => ({ t: x.t, hover: x.hover, spark: x[id].spark, y: x[id].y, once: x[id].once, lights: x[id].lights, pw: x[id].pw })) });
}
console.log("errors", JSON.stringify(L.errors));
await out(`k5-diag-${id}-${at}-office`, keep); await L.page.close(); process.exit(0);
