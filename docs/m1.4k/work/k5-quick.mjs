// M1.4K section 5: quick returns, real pointer, every frame checked.   node k5-quick.mjs <label> [throttle] [repeats] [station,station]
// Gap = ms from the moment the hover drops (90 ms grace after the pointer left) to the moment the pointer is back. "grace" = back inside it.
import { ARRIVE, HEIGHT, IDS, POWERED, REST, SEQ, lab, out, sleep } from "./core.mjs";
import { analyse } from "./analyse.mjs";
const [label = "a", thr = "1", rep = "1", which] = process.argv.slice(2);
const L = await lab();
if (+thr > 1) await L.page.send("Emulation.setCPUThrottlingRate", { rate: +thr });
const res = { label, thr: +thr, runs: [] };
// In-page: the pointer's return is dispatched by the page itself, so that "0 frames" is 0 frames.
await L.page.eval(`(() => { window.__back = (id, frames, ms) => new Promise((ok) => { const go = () => { const h = document.querySelector('[data-hotspot="' + id + '"]'); h.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })); ok(1); };
  const wait = () => { if (ms) return setTimeout(go, ms); let n = frames; const f = () => (n-- <= 0 ? go() : requestAnimationFrame(f)); n === 0 ? go() : requestAnimationFrame(f); };
  const d = () => document.querySelector("[data-lab-hover]"); if (!d()) return wait(); const mo = new MutationObserver(() => { if (d()) return; mo.disconnect(); wait(); }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); }); return 1; })()`);
for (let k = 0; k < +rep; k++) for (const id of IDS) {
  if (which && !which.split(",").includes(id)) continue;
  const A = ARRIVE[id], full = SEQ[id];
  // Leave at: before arrival, strips, effect starting, mid-ascent, effect running, just full, stable.
  for (const at of [-200, 60, 160, 280, 420, 620, full, full + 400]) for (const [gname, frames, ms] of [["0 frames", 0, 0], ["1 frame", 1, 0], ["2 frames", 2, 0], ["50 ms", 0, 50], ["100 ms", 0, 100], ["200 ms", 0, 200], ["350 ms (sinking)", 0, 350], ["600 ms (down)", 0, 600]]) {
    await L.rest(); await L.start(); await L.on(id); await L.hovUntil(id);
    await L.page.eval(`new Promise((r) => setTimeout(r, ${Math.max(0, A + at - 90)}))`);
    const back = L.page.eval(`window.__back("${id}", ${frames}, ${ms})`);
    await L.page.eval(`(document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })), 1)`);
    await back;
    await sleep((A + full + 500) * (+thr > 2 ? 1.3 : 1));
    const s = await L.read(), y = (await L.st())[id].y, n = await L.page.eval("window.__sparks.length");
    const f = await L.stop();
    await L.page.eval(`(document.querySelector('[data-hotspot="${id}"]').dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: null })), 1)`);
    const restOk = await L.rest();
    const a = analyse(f);
    const v = a.visits.at(-1);
    const r = { id, at, gap: gname, visits: a.visits.length, sparks: n, powered: POWERED[id](s[id]), y, rest: restOk, bad: a.bad.slice(0, 5), nBad: a.bad.length, oneFrame: a.note.oneFrame, lag: v?.lag, y0: v?.y0, yArr: v?.yArr, step: a.note.step, longest: a.note.longest };
    r.flag = !r.powered || Math.abs(y - HEIGHT[id]) > 0.25 || !restOk || a.bad.length > 0 || n !== 2;
    res.runs.push(r); if (r.flag) console.log("!!", JSON.stringify(r).slice(0, 800));
  }
  const q = res.runs.filter((r) => r.id === id);
  console.log(label, "x" + thr, id.padEnd(12), "runs", q.length, "flagged", q.filter((r) => r.flag).length, "| within one frame of the arrival", q.reduce((t, r) => t + r.oneFrame, 0), "| spark clock after hover max", Math.max(...q.map((r) => r.lag ?? 0)), "| step", Math.max(...q.map((r) => r.step)), "longest frame", Math.max(...q.map((r) => r.longest)), "| height at return max", Math.max(...q.map((r) => r.y0 ?? 0)), "at arrival max", Math.max(...q.map((r) => r.yArr ?? 0)));
}
res.errors = L.errors; console.log("errors", JSON.stringify(L.errors));
await out(`k5-quick-${label}`, res); await L.page.close(); process.exit(0);
