// M1.4K section 3: each station alone, real time: spark, first light, first movement, half, full, return, rest; every layer together; the floor stays.
//   node k1-stations.mjs [runs]
import { ARRIVE, HEIGHT, IDS, PLAN, POWERED, REST, SEQ, lab, out, sleep } from "./core.mjs";
const N = +(process.argv[2] ?? 4);
const L = await lab();
const res = {};
// What lies on the floor and must not move: its boxes on screen (Playground's reflection drops by design, M1.4G).
const FLOOR = `(() => { const r = {}; for (const e of document.querySelectorAll('[data-v2-floor],[data-v2-ring],[data-v2-foreground] > *,[data-v2-hub],svg[data-charge],[data-charge] path')) { if (e.closest('[class*="-rise"]') || e.matches('[class*="-rise"]') || e.closest('[data-v2-reflection],[data-v2-occlusion]')) continue; const b = e.getBoundingClientRect(); r[(e.dataset.v2Floor ?? e.dataset.v2Ring ?? e.dataset.charge ?? e.tagName) + "#" + Object.keys(r).length] = [b.x, b.y, b.width, b.height].map((v) => +v.toFixed(2)); } return r; })()`;
const round = (v) => (v === null || v === undefined ? null : Math.round(v));
for (const id of IDS) {
  res[id] = { runs: [], other: {} };
  for (let k = 0; k < N; k++) {
    if (!(await L.rest())) console.log(id, "NOT AT REST");
    const f0 = await L.page.eval(FLOOR);
    await L.start(); await L.on(id); await sleep(ARRIVE[id] + Math.max(SEQ[id], 900) + 700);
    const f1 = await L.page.eval(FLOOR);
    const f = (await L.stop()).filter((x) => x.hover === id);
    const arr = f.find((x) => x[id].spark !== null)[id].spark + ARRIVE[id];
    const at = (p) => round((f.find(p)?.t ?? null) === null ? null : f.find(p).t - arr);
    const full = Math.max(...f.map((x) => x[id].y));
    const pre = f.filter((x) => x.t < arr - 1);
    const r = {
      full, first: at((x) => x[id].y > 0.01), quarter: at((x) => x[id].y >= full * 0.25), half: at((x) => x[id].y >= full * 0.5), done: at((x) => x[id].y >= full - 0.001),
      yBefore: Math.max(0, ...pre.map((x) => x[id].y)), onceBefore: Math.max(0, ...pre.map((x) => x[id].once)), pulseBefore: Math.max(0, ...pre.map((x) => x[id].pulse)), levelBefore: Math.max(0, ...pre.map((x) => x[id].level)),
      sparkSeen: f.filter((x) => x[id].sv > 0.02).length, sparkLastSeen: at((x) => x === f.findLast((y) => y[id].sv > 0.02)), strip: at((x) => x[id].pw > 0.01 || x[id].lights.strip > 0.01),
      lights: Object.fromEntries(Object.keys(f[0][id].lights).map((l) => [l, [at((x) => x[id].lights[l] > 0.02), id === "playground" ? at((x) => x[id].lights[l] >= 0.999) : round((f.findLast((x) => x[id].lights[l] > 0.02)?.t ?? NaN) - arr)]])),
      spread: Math.max(...f.map((x) => x[id].spread)), fell: f.filter((x, i) => i && x[id].y < f[i - 1][id].y - 0.001).length,
      othersMoved: Math.max(...f.flatMap((x) => IDS.filter((o) => o !== id).map((o) => x[o].y))), othersLit: Math.max(...f.flatMap((x) => IDS.filter((o) => o !== id).map((o) => x[o].level))), othersSpark: f.filter((x) => IDS.some((o) => o !== id && x[o].sv > 0.02)).length,
      frames: f.filter((x) => x.t >= arr && x.t < arr + 800).length, longest: round(Math.max(...f.slice(1).map((x, i) => x.t - f[i].t))), floorMoved: Object.keys(f0).filter((n) => JSON.stringify(f0[n]) !== JSON.stringify(f1[n])).map((n) => [n, f0[n], f1[n]]), floorParts: Object.keys(f0).length, sparks: await L.page.eval("window.__sparks.length"),
    };
    r.powered = POWERED[id]((await L.read())[id]);
    await L.start(); await L.off(); await sleep(1500);
    const d = await L.stop(), i0 = d.findIndex((x) => x.hover === null), t0 = d[i0].t, a = d.slice(i0);
    r.down = { half: round(a.find((x) => x[id].y <= full / 2).t - t0), floor: round(a.find((x) => x[id].y === 0).t - t0), rose: a.filter((x, i) => i && x[id].y > a[i - 1][id].y + 0.001).length, spread: Math.max(...a.map((x) => x[id].spread)), onceAfter: a.filter((x) => x[id].once > 0.02 && id !== "playground").length, dark: round(a.find((x) => x[id].level < 0.005 && x[id].y === 0)?.t - t0), residual: a.at(-1)[id].level, rest: REST[id]((await L.read())[id]) };
    res[id].runs.push(r);
  }
  const R = res[id].runs, med = (g) => R.map(g).sort((x, y) => x - y)[R.length >> 1];
  console.log(id.padEnd(12), "full", med((r) => r.full), "plan", HEIGHT[id], "| first/quarter/half/full", med((r) => r.first), med((r) => r.quarter), med((r) => r.half), med((r) => r.done), "plan", PLAN[id].join("/"), "| down half/floor/dark", med((r) => r.down.half), med((r) => r.down.floor), med((r) => r.down.dark), "| strip", med((r) => r.strip), "lights", JSON.stringify(R[1].lights), "| before arrival: y", Math.max(...R.map((r) => r.yBefore)), "once", Math.max(...R.map((r) => r.onceBefore)), "pulse", Math.max(...R.map((r) => r.pulseBefore)), "level", Math.max(...R.map((r) => r.levelBefore)), "| spread", Math.max(...R.map((r) => r.spread)), Math.max(...R.map((r) => r.down.spread)), "fell", R.reduce((s, r) => s + r.fell, 0), "rose", R.reduce((s, r) => s + r.down.rose, 0), "| others moved", Math.max(...R.map((r) => r.othersMoved)), "lit", Math.max(...R.map((r) => r.othersLit)), "sparks", R.map((r) => r.sparks + "+" + r.othersSpark).join(), "| floor moved", JSON.stringify([...new Set(R.flatMap((r) => r.floorMoved.map((m) => m[0])))]), "of", R[0].floorParts, "| powered", R.every((r) => r.powered), "rest", R.every((r) => r.down.rest), "residual", Math.max(...R.map((r) => r.down.residual)), "| frames/800ms", R.map((r) => r.frames).join(), "longest", R.map((r) => r.longest).join());
}
res.errors = L.errors; console.log("errors", JSON.stringify(L.errors));
await out("k1-stations", res); await L.page.close(); process.exit(0);
