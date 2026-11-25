// M1.4K: rules checked on every logged frame (core.mjs), for switching and quick returns.
import { ARRIVE, HEIGHT, IDS } from "./core.mjs";
const K = 1.03; // device-pixel rounding of the heights
/** Split a log into hover visits (a new spark starts a new one); selected frames end a visit. */
export function visits(frames) {
  const v = [];
  frames.forEach((f, i) => {
    const id = f.sel ? null : f.hover, c = v.at(-1);
    if (!id) { if (c) c.open = false; return; }
    const sp = f[id].spark;
    if (!c?.open || c.id !== id || (c.spark !== null && sp !== null && sp !== c.spark && f.t - c.t0 > 34)) { if (c) c.open = false; v.push({ id, open: true, i0: i, t0: f.t, spark: null, frames: [] }); }
    const n = v.at(-1);
    n.frames.push(f);
    // A spark older than this visit belongs to the last one.
    if (sp !== null && sp >= n.t0 - 40) n.spark = sp;
  });
  for (const x of v) { x.arrive = x.spark === null ? null : x.spark + ARRIVE[x.id]; x.lag = x.spark === null ? null : +(x.spark - x.t0).toFixed(1); }
  return v;
}
export function analyse(frames) {
  const V = visits(frames);
  const bad = [];
  const note = { maxNotRest: 0, sparksAtOnce: 0, inactiveOnceFrames: {}, inactiveOnceMax: {}, lag: V.map((v) => v.lag) };
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i], g = frames[i - 1];
    note.maxNotRest = Math.max(note.maxNotRest, IDS.filter((o) => f[o].level > 0.01 || f[o].y > 0.02).length);
    note.sparksAtOnce = Math.max(note.sparksAtOnce, IDS.filter((o) => f[o].sv > 0.02).length);
    for (const o of IDS) {
      if (f[o].y > HEIGHT[o] * K + 0.2) bad.push([o, "too high", f[o].y]);
      if (f[o].spread > 0.001) bad.push([o, "layers apart", f[o].spread]);
      const act = f.hover === o || f.sel === o, actG = g.hover === o || g.sel === o;
      if (!act && !actG) {
        if (f[o].y > g[o].y + 0.01) bad.push([o, "rises while inactive", +(f[o].y - g[o].y).toFixed(3)]);
        if (o !== "playground") {
          if (f[o].once > 0.02) { note.inactiveOnceFrames[o] = (note.inactiveOnceFrames[o] ?? 0) + 1; note.inactiveOnceMax[o] = Math.max(note.inactiveOnceMax[o] ?? 0, f[o].once); }
          if (Object.keys(f[o].n).some((n) => f[o].n[n] > g[o].n[n] + 0.004)) bad.push([o, "progress runs forward while inactive", f[o].n]);
        }
        if (f[o].pw > g[o].pw + 0.004) bad.push([o, "strips light while inactive", f[o].pw]);
      }
    }
  }
  const visitsOut = V.map((v, k) => {
    const id = v.id, last = v.frames.at(-1);
    const pre = v.arrive === null ? v.frames : v.frames.filter((f) => f.t < v.arrive - 1), post = v.arrive === null ? [] : v.frames.filter((f) => f.t >= v.arrive - 1);
    const n = (a, p) => a.filter(p).length, rise = (a, g) => a.filter((f, i) => i && g(f) > g(a[i - 1]) + 0.004).length;
    const r = {
      id, k, lag: v.lag, stayed: Math.round(last.t - v.t0), arrived: post.length > 0, y0: v.frames[0][id].y, yArr: pre.at(-1)?.[id].y ?? null,
      once: n(pre, (f) => f[id].once > 0.02), onceMax: Math.max(0, ...pre.map((f) => f[id].once)), pulse: n(pre, (f) => f[id].pulse > 0.02), pulseMax: Math.max(0, ...pre.map((f) => f[id].pulse)),
      roseY: rise(pre, (f) => f[id].y), roseN: Object.keys(v.frames[0][id].n).filter((q) => rise(pre, (f) => f[id].n[q]) > 0), rosePw: rise(pre, (f) => f[id].pw),
      rosePg: id === "playground" ? Object.keys(v.frames[0][id].lights).filter((q) => rise(pre, (f) => f[id].lights[q]) > 0) : [],
      fellAfter: post.filter((f, i) => i && f[id].y < post[i - 1][id].y - 0.004).length,
      hung: id === "playground" ? 0 : pre.filter((f, i) => i && f[id].y > 0.02 && f[id].y === pre[i - 1][id].y && f.t > pre[i - 1].t).length,
    };
    r.first = { once: r.once ? Math.round(pre.find((f) => f[id].once > 0.02).t - (v.arrive ?? 0)) : null, pulse: r.pulse ? Math.round(pre.find((f) => f[id].pulse > 0.02).t - (v.arrive ?? 0)) : null };
    // The spark's own clock can start one frame after the styles that wait for it; more than that counts as early.
    const q = v.arrive === null ? pre : pre.filter((f) => f.t < v.arrive - 18);
    r.oneFrame = pre.length !== q.length && (r.once || r.pulse || r.roseY || r.roseN.length || r.rosePw || r.rosePg.length) ? 1 : 0;
    Object.assign(r, { once: n(q, (f) => f[id].once > 0.02), pulse: n(q, (f) => f[id].pulse > 0.02), roseY: rise(q, (f) => f[id].y), roseN: Object.keys(v.frames[0][id].n).filter((k) => rise(q, (f) => f[id].n[k]) > 0), rosePw: rise(q, (f) => f[id].pw), rosePg: id === "playground" ? Object.keys(v.frames[0][id].lights).filter((k) => rise(q, (f) => f[id].lights[k]) > 0) : [] });
    r.early = r.once > 0 || r.pulse > 0 || r.roseY > 0 || r.roseN.length > 0 || r.rosePw > 0 || r.rosePg.length > 0;
    if (r.early) bad.push([id, "before its spark arrives", { once: [r.once, r.onceMax], pulse: [r.pulse, r.pulseMax], roseY: r.roseY, roseN: r.roseN, rosePw: r.rosePw, rosePg: r.rosePg, lag: r.lag, first: r.first }]);
    if (r.fellAfter) bad.push([id, "falls after the arrival", r.fellAfter]);
    if (r.hung > 2) bad.push([id, "hangs in the air while charging", r.hung]);
    return r;
  });
  let step = 0; for (let i = 1; i < frames.length; i++) for (const o of IDS) step = Math.max(step, Math.abs(frames[i][o].y - frames[i - 1][o].y) / HEIGHT[o] / Math.max(1, (frames[i].t - frames[i - 1].t) / 16.7));
  note.oneFrame = visitsOut.filter((v) => v.oneFrame && !v.early).length; note.step = +(step * 100).toFixed(1); note.longest = Math.round(Math.max(0, ...frames.slice(1).map((f, i) => f.t - frames[i].t)));
  return { bad, note, visits: visitsOut };
}
