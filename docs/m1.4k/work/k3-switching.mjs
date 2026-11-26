// M1.4K section 4: cross-station switching, every frame checked (analyse.mjs).   node k3-switching.mjs [group,group]
import { ARRIVE, HEIGHT, IDS, POWERED, REST, SEQ, lab, out, sleep } from "./core.mjs";
import { analyse } from "./analyse.mjs";
const only = process.argv[2]?.split(",");
const L = await lab();
const res = { runs: [] };
const stable = (id, ms = 6000) => L.settle((s) => s.hover === id && POWERED[id](s[id]) && IDS.filter((o) => o !== id).every((o) => REST[o](s[o])), ms);
// M1.4K.8: the end check also waits for the height. POWERED leaves it out, and a return early in the descent can still
// read as powered (the previous visit not yet run back), so the height used to be read before the new arrival had
// raised the station again: a false "heights" flag (ENGINEERING-QUICK-RETURN.md). A lift that never arrives still fails.
const raised = async (id, ms = 6000) => { for (let t = 0; t < ms; t += 50) { if (Math.abs((await L.st())[id].y - HEIGHT[id]) < 0.25) return true; await sleep(50); } return false; };
const settled = async (id) => (await stable(id)) && (await raised(id));
const run = async (group, name, fn, finalId, sparks) => {
  if (only && !only.includes(group)) return;
  const clean = await L.rest();
  await L.start();
  await fn();
  const ok = finalId ? await settled(finalId) : true;
  await sleep(finalId ? 350 : 0);
  const s = await L.st();
  const yEnd = Object.fromEntries(IDS.map((o) => [o, s[o].y]));
  const heights = finalId ? IDS.every((o) => (o === finalId ? Math.abs(s[o].y - HEIGHT[o]) < 0.25 : s[o].y === 0)) : IDS.every((o) => s[o].y === 0);
  const n = await L.page.eval("window.__sparks.length");
  const f = await L.stop();
  const back = await L.rest();
  const a = analyse(f);
  const r = { group, name, clean, ok, heights, yEnd, sparks: n, visits: a.visits.length, back, bad: a.bad.slice(0, 6), nBad: a.bad.length, note: a.note, arrived: a.visits.filter((v) => v.arrived).length };
  r.flag = !clean || !ok || !heights || !back || a.bad.length > 0 || n !== a.visits.length;
  res.runs.push(r);
  if (r.flag) console.log("!!", group, name, JSON.stringify({ clean, ok, heights, back, sparks: n, visits: a.visits.length, yEnd: heights ? undefined : yEnd, bad: a.bad.slice(0, 3), note: a.note }).slice(0, 700));
};
// The brief's five, and every other ordered pair: from charging, from the ascent, from a running effect, from stable.
for (const a of IDS) for (const b of IDS) if (a !== b) for (const [m, t] of [["charging", 300], ["ascent", ARRIVE[a] + 220], ["effect running", ARRIVE[a] + 420], ["stable", ARRIVE[a] + SEQ[a] + 300]])
  await run("pairs", `${a} -> ${b} (${m})`, async () => { await L.on(a); await sleep(t); await L.on(b); }, b);
// There and back at once: re-entering while it sinks (and while the other charges).
for (const a of IDS) for (const b of IDS) if (a !== b) for (const t of [120, 260])
  await run("reenter", `${a} (stable) -> ${b} for ${t} ms -> ${a}`, async () => { await L.on(a); await stable(a); await L.on(b); await sleep(90 + t); await L.on(a); }, a);
for (const a of IDS) for (const t of [110, 200, 320])
  await run("reenter", `${a} (stable) -> empty, back ${t} ms after the drop`, async () => { await L.on(a); await stable(a); await L.off(); await L.hovUntil(null); await sleep(t); await L.on(a); }, a);
// Rapid sweeps over all five, with real mouse moves, both ways, at four speeds.
const ring = ["engineering", "educational", "playground", "experience", "creative"];
for (const dwell of [40, 100, 180, 350, 700]) for (const dir of [1, -1]) {
  const o = dir === 1 ? ring : [...ring].reverse();
  await run("sweep", `sweep ${dir > 0 ? "clockwise" : "back"} x2, ${dwell} ms each, ends on ${o[4]}`, async () => { for (let k = 0; k < 10; k++) { await L.on(o[k % 5]); await sleep(dwell); } }, o[4]);
  await run("sweep", `sweep ${dir > 0 ? "clockwise" : "back"}, ${dwell} ms each, out to the empty floor`, async () => { for (let k = 0; k < 5; k++) { await L.on(o[k]); await sleep(dwell); } await L.off(); await sleep(1800); }, null);
}
// Around the central A: long repeated switching, random order and dwell (seeded).
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let k = 0; k < 6; k++) await run("around", `random walk ${k}: 14 switches`, async () => { let p = null; for (let j = 0; j < 14; j++) { let q; do q = IDS[Math.floor(rnd() * 5)]; while (q === p); p = q; await L.on(q); await sleep(60 + rnd() * 1100); } await L.on(IDS[k % 5]); }, IDS[k % 5]);
// Through the central A itself.
for (const [a, b] of [["creative", "playground"], ["experience", "engineering"], ["educational", "experience"], ["playground", "creative"]])
  await run("hub", `${a} -> across the A -> ${b}`, async () => { await L.on(a); await stable(a); for (let j = 0; j <= 30; j++) { await L.to([L.x(a)[0] + ((L.x(b)[0] - L.x(a)[0]) * j) / 30, L.x(a)[1] + ((L.x(b)[1] - L.x(a)[1]) * j) / 30]); await sleep(16); } await L.on(b); }, b);
const R = res.runs;
const g = [...new Set(R.map((r) => r.group))];
for (const x of g) { const q = R.filter((r) => r.group === x); console.log(x, "runs", q.length, "flagged", q.filter((r) => r.flag).length, "| most stations not at rest at once", Math.max(...q.map((r) => r.note.maxNotRest)), "sparks at once", Math.max(...q.map((r) => r.note.sparksAtOnce)), "| largest step %/60Hz frame", Math.max(...q.map((r) => r.note.step)), "longest frame", Math.max(...q.map((r) => r.note.longest)), "| one-shot light on an inactive station (frames, max)", JSON.stringify(q.reduce((m, r) => { for (const [k, v] of Object.entries(r.note.inactiveOnceFrames)) m[k] = [Math.max(m[k]?.[0] ?? 0, v), Math.max(m[k]?.[1] ?? 0, r.note.inactiveOnceMax[k])]; return m; }, {})), "| spark clock after the hover, ms: max", Math.max(...q.flatMap((r) => r.note.lag.filter((v) => v !== null)))); }
res.errors = L.errors; console.log("errors", JSON.stringify(L.errors));
await out("k3-switching" + (only ? "-" + only.join("-") : ""), res); await L.page.close(); process.exit(0);
