// M1.4K.8: Engineering's quick return, traced per frame. Engineering stable -> empty floor -> back <gap> ms after the
// hover drops (k3's "engineering (stable) -> empty, back 110 ms after the drop"), each trial on a fresh page.
// Per frame: hover, the lift's numbers on each EngineeringLift mount (--el-on, --elh on .eng-lift-cycle; --el on
// .eng-lift), the station's height (max of .eng-rise, scene px) and the spark's start.
//   node eng-return-trace.mjs <label> [trials] [gap ms] [leave: powered | raised]   -> results/eng-return-<label>.json
// leave "powered" (default) leaves as k3-switching does: once Engineering is powered and the rest at rest, which can
// be before its lift has finished; "raised" waits for the full 12 px first.
import { ARRIVE, IDS, POWERED, REST, lab, out, sleep } from "./core.mjs";
const [label = "check", trials = "6", gapArg = "110", leave = "powered"] = process.argv.slice(2);
const gap = +gapArg;
const id = "engineering";
const TRACE = `(() => {
  const num = (e, v) => +(+getComputedStyle(e).getPropertyValue(v)).toFixed(3);
  const k = document.querySelector(".lab-camera").offsetWidth / 1672;
  const ty = (e) => { const t = getComputedStyle(e).transform; return t === "none" ? 0 : -new DOMMatrix(t).f; };
  const cyc = [...document.querySelectorAll(".eng-lift-cycle")], lifts = [...document.querySelectorAll(".eng-lift")], rises = [...document.querySelectorAll(".eng-rise")];
  const mover = document.querySelector('[data-surge="engineering"] [data-surge-mover]');
  const v2 = document.querySelector(".eng-v2"), dims = [...document.querySelectorAll('.lab-power-dim[data-power="engineering"]')];
  window.__tr = []; window.__trOn = false;
  (function f(t) { if (window.__trOn) window.__tr.push({ t: Math.round(t), hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
    on: cyc.map((e) => num(e, "--el-on")), h: cyc.map((e) => num(e, "--elh")), el: lifts.map((e) => num(e, "--el")),
    y: +(Math.max(0, ...rises.map(ty)) / k).toFixed(3), spark: mover?.getAnimations().at(-1)?.startTime ?? null,
    // Its lights: the strips' power, the chart, the display, the bars (sum of 11) and the scan.
    pw: +Math.max(0, ...dims.map((e) => num(e, "--pw"))).toFixed(3), ef: num(v2, "--ef"), eo: num(v2, "--eo"), es: num(v2, "--es"),
    bars: +Array.from({ length: 11 }, (_, b) => num(v2, "--eb" + b)).reduce((a, b) => a + b, 0).toFixed(2) });
    requestAnimationFrame(f); })(performance.now());
  return { cycles: cyc.length, lifts: lifts.length, rises: rises.length }; })()`;
const res = { gap, leave, trials: [] };
for (let k = 0; k < +trials; k++) {
  const L = await lab();
  const info = await L.page.eval(TRACE);
  await L.rest();
  await L.on(id);
  if (leave === "raised") { await L.settle((s) => s.hover === id && s[id].y > 12, 6000); await sleep(600); }
  else await L.settle((s) => s.hover === id && POWERED[id](s[id]) && IDS.filter((o) => o !== id).every((o) => REST[o](s[o])), 6000);
  await L.page.eval("(window.__tr.length = 0, window.__trOn = true, 1)");
  await L.off(); await L.hovUntil(null); await sleep(gap); await L.on(id);
  // k3-switching's own end check, unchanged: wait for "powered" (strips, chart, bars, scan; not the height), 350 ms, read.
  const t0 = Date.now();
  await L.settle((s) => s.hover === id && POWERED[id](s[id]) && IDS.filter((o) => o !== id).every((o) => REST[o](s[o])), 6000);
  const k3 = { poweredMs: Date.now() - t0 };
  await sleep(350);
  k3.y = (await L.st())[id].y; k3.readMs = Date.now() - t0;
  await sleep(Math.max(0, ARRIVE[id] + 1900 - (Date.now() - t0)));
  const f = await L.page.eval("(window.__trOn = false, window.__tr.slice())");
  const drop = f.find((q) => q.hover === null), back = f.find((q, i) => i && q.hover === id && f[i - 1].hover === null);
  const end = f.at(-1);
  const minAfterBack = f.filter((q) => q.t >= back.t).reduce((m, q) => (q.y < m.y ? q : m), back);
  const r = { trial: k, k3, info, yAtLeave: f[0].y, elAtLeave: f[0].el, hAtLeave: f[0].h, endY: end.y, endEl: end.el, endOn: end.on, endH: end.h, yAtBack: back.y, backAfterDrop: back.t - drop.t,
    floorAfterBack: f.find((q) => q.t >= back.t && q.y === 0) ? f.find((q) => q.t >= back.t && q.y === 0).t - back.t : null,
    onStarts: f.find((q) => q.t > back.t && q.on.some((v) => v > 0)) ? f.find((q) => q.t > back.t && q.on.some((v) => v > 0)).t - back.t : null,
    sparkAfterBack: end.spark !== null ? Math.round(end.spark - back.t) : null, longest: Math.round(Math.max(...f.slice(1).map((q, i) => q.t - f[i].t))),
    ok: Math.abs(end.y - 12.167) < 0.25 };
  r.frames = f.map((q) => ({ ...q, t: q.t - back.t }));
  res.trials.push(r);
  console.log(`trial ${k} ${r.ok ? "ok  " : "FAIL"} | k3: powered ${k3.poweredMs} ms after the return, read at ${k3.readMs} ms: y ${k3.y}${Math.abs(k3.y - 12.167) < 0.25 ? "" : " (k3 FLAG)"} | leave at y ${r.yAtLeave} --elh ${JSON.stringify(r.hAtLeave)} | back ${r.backAfterDrop} ms after the drop at y ${r.yAtBack} | floor ${r.floorAfterBack} ms after the return | --el-on starts ${r.onStarts} | spark ${r.sparkAfterBack} | end y ${r.endY} --el ${JSON.stringify(r.endEl)} --el-on ${JSON.stringify(r.endOn)} --elh ${JSON.stringify(r.endH)} | longest ${r.longest} | mounts ${JSON.stringify(info)}`);
  await L.page.close();
}
console.log(`${label}: ${res.trials.filter((r) => r.ok).length} of ${res.trials.length} reached 12 px`);
await out(`eng-return-${label}`, res); process.exit(0);
