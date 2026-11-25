// M1.4J.2: quick returns, the lift against the spark's own clock and against its own transition's.   node quick.mjs <station> <reps>
import { ARRIVE, IDS, REST, open, sleep } from "../../../m1.4i/work/lib.mjs";
const [id, reps = "6"] = process.argv.slice(2);
const A = ARRIVE[id], cls = id === "engineering" ? "eng" : "edu", v = id === "engineering" ? "--el" : "--dl";
const L = await open("/lab-v2", { gpu: true });
await L.page.eval(`(() => { window.__log = []; window.__rec = false;
  const rise = document.querySelector(".${cls}-v2 .${cls}-rise"), lift = document.querySelector(".${cls}-v2 .${cls}-lift"), cyc = document.querySelector(".${cls}-v2 .${cls}-lift-cycle"), mv = document.querySelector('[data-surge="${id}"] [data-surge-mover]');
  (function f() { if (window.__rec) { const t = getComputedStyle(rise).transform, s = mv.getAnimations().at(-1), tr = cyc.getAnimations().find((a) => a.transitionProperty === "${v}-on"); window.__log.push({ t: document.timeline.currentTime, h: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, y: t === "none" ? 0 : +(-new DOMMatrix(t).f).toFixed(3), on: +(+getComputedStyle(lift).getPropertyValue("${v}-on")).toFixed(4), spark: s ? s.startTime : null, tr: tr ? tr.startTime : null }); } requestAnimationFrame(f); })(); return 1; })()`);
const c = await L.page.center(`[data-hotspot="${id}"]`);
const rest = async () => { await L.off(); await L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 8000); await sleep(500); };
const hov = () => L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
const rows = [];
for (const [at, gap] of [[140, 60], [140, 120], [260, 60], [400, 120], [400, 60], [800, 120]]) for (let k = 0; k < +reps; k++) {
  await rest();
  await L.page.eval("(window.__log.length = 0, window.__rec = true, 1)");
  await L.page.mouseMove(c.x, c.y);
  for (let i = 0; i < 100 && (await hov()) !== id; i++) await sleep(3);
  await L.page.eval(`new Promise((r) => setTimeout(r, ${A + at - 90}))`);
  await L.off();
  for (let i = 0; i < 100 && (await hov()) !== null; i++) await sleep(2);
  await sleep(gap);
  await L.page.mouseMove(c.x, c.y);
  await sleep(A + 1300);
  const f = JSON.parse(await L.page.eval("(window.__rec = false, JSON.stringify(window.__log))"));
  const i1 = f.findIndex((x) => x.h === id), i2 = f.findIndex((x, i) => i > i1 && x.h !== id), i3 = f.findIndex((x, i) => i > i2 && x.h === id);
  if (i3 < 0) continue;
  const g = f.slice(i3), spark = g.findLast((x) => x.spark !== null).spark, tr = g.findLast((x) => x.tr !== null).tr, arr = spark + A;
  const ch = g.filter((x) => x.t < arr - 1);
  const before = ch.filter((x) => x.on > 0);
  rows.push({ at, gap, trMinusSpark: Math.round(tr - spark), onBeforeArrival: before.length, riseBefore: ch.filter((x, i) => i && x.y > ch[i - 1].y + 0.001).length, yLastBefore: ch.at(-1).y, floorReached: ch.some((x) => x.y === 0), firstOn: Math.round(g.find((x) => x.on > 0).t - arr), jump: Math.max(...f.slice(1).map((x, i) => Math.abs(x.y - f[i].y) / Math.max(1, (x.t - f[i].t) / 16.7))).toFixed(2), maxFrame: Math.round(Math.max(...g.slice(1).map((x, i) => x.t - g[i].t))), end: g.at(-1).y });
}
for (const r of rows) if (r.onBeforeArrival || r.riseBefore || r.yLastBefore > 0) console.log(JSON.stringify(r));
console.log(id, "runs", rows.length, "| lift started before the arrival", rows.filter((r) => r.onBeforeArrival).length, "| rose before it", rows.filter((r) => r.riseBefore).length, "| still sinking at it", rows.filter((r) => r.yLastBefore > 0 && !r.riseBefore).length, "| transition minus spark (ms)", Math.min(...rows.map((r) => r.trMinusSpark)), "to", Math.max(...rows.map((r) => r.trMinusSpark)), "| worst step/60Hz frame", Math.max(...rows.map((r) => +r.jump)), "| end", [...new Set(rows.map((r) => r.end))].join());
await L.page.close();
process.exit(0);
