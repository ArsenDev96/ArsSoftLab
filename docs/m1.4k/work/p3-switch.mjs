// Rapid switching and interruption, at real speed with the GPU on: every frame's numbers are logged, and checked
// against rules (below). Each scenario starts from a settled idle page.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARRIVE, CAP, IDS, POWERED, REST, logger, open, save, sleep, until } from "./lib.mjs";

const only = process.argv[2];
const { page, errors, hover, off, away, read, settle, shot } = await open("/lab-v2", { gpu: true });
const log = await logger(page);
const out = {};
const idle = (s) => IDS.every((o) => REST[o](s[o])) && IDS.every((o) => s.sparks[o] === 0);

// One-shot light per station: what only may show while its own sequence runs forward after its arrival.
const ONE_SHOT = {
  engineering: (s) => s.scan > 0,
  educational: (s) => s.light > 0,
  creative: (s) => s.light > 0,
  experience: (s) => s.light > 0,
  playground: () => false,
};

/** Analyse a log: per frame, time since each station's hover (re)began. */
function analyse(frames) {
  const r = { frames: frames.length, light_without_hover: {}, light_before_arrival: {}, max_sparks: 0, spark_wrong_station: 0, rose_without_hover: {}, held_light: {} };
  let cur = null, t0 = 0, prev = null;
  for (const [t, s] of frames) {
    if (s.hover !== cur) { cur = s.hover; t0 = t; }
    const n = IDS.filter((o) => s.sparks[o] > 0.02).length;
    r.max_sparks = Math.max(r.max_sparks, n);
    for (const o of IDS) {
      const shown = ONE_SHOT[o](s[o]);
      if (shown && s.hover !== o && s.selected !== o) r.light_without_hover[o] = (r.light_without_hover[o] ?? 0) + 1;
      if (shown && s.hover === o && s.selected !== o && t - t0 < ARRIVE[o] - 25) r.light_before_arrival[o] = (r.light_before_arrival[o] ?? 0) + 1;
      if (prev && s.hover !== o && prev.hover !== o && s.selected !== o && prev.selected !== o) {
        const keys = { engineering: ["pw", "ef", "bars"], educational: ["pw", "gs", "go"], creative: ["pw", "cs"], experience: ["pw", "xs"], playground: ["lift", "lit", "arcade"] }[o];
        for (const k of keys) if (s[o][k] > prev[o][k] + 0.002) (r.rose_without_hover[o] ??= {})[k] = (r.rose_without_hover[o][k] ?? 0) + 1;
      }
    }
    prev = s;
  }
  return r;
}
const run = async (name, fn) => {
  if (only && !name.includes(only)) return;
  await away();
  const clean = await settle(idle, 8000);
  const m = await log.mark();
  const extra = await fn();
  const fr = await log.since(m);
  out[name] = { started_idle: clean, ...analyse(fr), ...extra };
  await away();
  out[name].returned_to_idle = await settle(idle, 8000);
  if (!out[name].returned_to_idle) { out[name].stuck = await read(); await shot(`stuck-${name}.png`); }
  await page.eval("window.__log.length = 0");
  save("switching.json", { ...out, errors });
};
const stable = (id) => until(log, (s) => s.hover === id && POWERED[id](s[id]), 7000);

// 1. The requested pairs, from fully powered and from mid-sequence.
for (const [a, b] of [["engineering", "educational"], ["educational", "playground"], ["playground", "creative"], ["creative", "experience"], ["experience", "engineering"]]) {
  await run(`${a}->${b} (from powered)`, async () => {
    await hover(a); await stable(a);
    await hover(b);
    // both powered at once? (the first drains while the second charges)
    const m = await log.mark();
    const ok = !!(await stable(b));
    const fr = await log.since(m);
    const overlap = fr.filter(([, s]) => s.hover === b && !REST[a](s[a]) && !REST[b](s[b])).length;
    const t0 = fr.find(([, s]) => s.hover === b)?.[0];
    const gone = fr.find(([, s]) => s.hover === b && REST[a](s[a]))?.[0];
    return { second_powered: ok, first_at_rest_after_ms: gone ? gone - t0 : null, frames_both_not_at_rest: overlap, first_rest_at_end: REST[a](fr.at(-1)[1][a]) };
  });
  await run(`${a}->${b} (mid-sequence)`, async () => {
    await hover(a);
    await until(log, (s) => s.hover === a && !REST[a](s[a]) && (s[a].pw > 0 || s[a].lift > 4), 4000);
    await sleep(160);
    await hover(b);
    const ok = !!(await stable(b));
    const end = await read();
    return { second_powered: ok, first_rest_at_end: REST[a](end[a]) };
  });
}
// 2. Per station: leave before arrival, mid-sequence, right after powered; return within the hover-off reset window;
//    return while draining; enter and leave repeatedly.
for (const id of IDS) {
  await run(`${id}: leave before arrival`, async () => {
    await hover(id); await sleep(ARRIVE[id] * 0.6); await off(); await sleep(1800);
    return {};
  });
  for (const [label, after] of [["early", 140], ["middle", 300], ["late", 520]]) {
    await run(`${id}: leave mid-sequence (${label})`, async () => {
      await hover(id);
      await until(log, (s) => s.hover === id && !REST[id](s[id]) && (s[id].pw > 0 || s[id].lift > 0.5), 4000);
      await sleep(after); await off(); await sleep(1800);
      return {};
    });
  }
  await run(`${id}: leave right after powered`, async () => {
    await hover(id); await stable(id); await off(); await sleep(1800);
    return {};
  });
  // The pointer slips off and back: hover drops (after the 90 ms grace) and returns a moment later.
  for (const gap of [60, 160, 260, 420]) {
    await run(`${id}: slip off mid-sequence, back after ${gap} ms`, async () => {
      await hover(id);
      await until(log, (s) => s.hover === id && (s[id].pw > 0.5 || s[id].lift > 4), 4000);
      await sleep({ engineering: 230, educational: 260, creative: 420, experience: 420, playground: 120 }[id]);
      const before = await read();
      const mOff = await log.mark();
      await off();
      await sleep(gap);
      const m = await log.mark();
      await hover(id);
      await sleep(ARRIVE[id] * 0.6);
      if (gap === 160) await shot(`slip-${id}-before-arrival.png`, { engineering: { x: 250, y: 370, w: 380, h: 200 }, educational: { x: 640, y: 250, w: 400, h: 280 }, playground: { x: 1040, y: 320, w: 360, h: 250 }, creative: { x: 90, y: 500, w: 450, h: 300 }, experience: { x: 1180, y: 500, w: 490, h: 310 } }[id], 2);
      await stable(id);
      const fr = await log.since(m);
      const dropped = (await log.since(mOff)).some(([, s]) => s.hover !== id);
      const t0 = fr.find(([, s]) => s.hover === id)?.[0];
      // light shown while its driving number stands still (a frozen highlight), after the return
      const key = { engineering: "es", educational: "gs", creative: "cg", experience: "xs" }[id];
      let frozen = 0, from = null, to = null;
      if (key) for (let i = 1; i < fr.length; i++) {
        const [t, s] = fr[i], [, p] = fr[i - 1];
        const vals = (q) => (id === "creative" ? [q[id].cw, q[id].cs, q[id].cg] : id === "educational" ? [q[id].gp, q[id].gs, q[id].go] : [q[id][key]]).join();
        if (s.hover === id && ONE_SHOT[id](s[id]) && vals(s) === vals(p) && t > fr[i - 1][0] + 4) { frozen++; from ??= t - t0; to = t - t0; }
      }
      return { state_when_leaving: before[id], dropped_hover: dropped, frames_frozen_light: frozen, frozen_from_ms: from, frozen_to_ms: to };
    });
  }
  await run(`${id}: return while draining`, async () => {
    await hover(id); await stable(id); await off();
    await until(log, (s) => s.hover === null, 1000); await sleep(180);
    await hover(id);
    const ok = !!(await stable(id));
    return { powered_again: ok };
  });
  await run(`${id}: enter and leave 6 times`, async () => {
    for (let i = 0; i < 6; i++) { await hover(id); await sleep(220 + i * 130); await off(); await sleep(120 + i * 40); }
    return {};
  });
}
// 3. Sweeps across all five.
for (const dt of [40, 90, 180, 350]) {
  await run(`sweep five stations x3, ${dt} ms each, ending away`, async () => {
    for (let k = 0; k < 3; k++) for (const id of IDS) { await hover(id); await sleep(dt); }
    await off(); await sleep(2500);
    return {};
  });
  await run(`sweep five stations x2, ${dt} ms each, ending on playground`, async () => {
    for (let k = 0; k < 2; k++) for (const id of ["experience", "creative", "educational", "engineering", "playground"]) { await hover(id); await sleep(dt); }
    const ok = !!(await stable("playground"));
    const s = await read();
    return { ends_powered: ok, others_at_rest: IDS.filter((o) => o !== "playground").every((o) => REST[o](s[o])) };
  });
}
// 4. Leaving the window, and keyboard focus plus pointer.
save("switching.json", { ...out, errors });
let bad = 0;
for (const [k, v] of Object.entries(out)) {
  const flags = [];
  if (!v.started_idle) flags.push("NOT IDLE AT START");
  if (!v.returned_to_idle) flags.push("STUCK");
  if (Object.keys(v.light_without_hover).length) flags.push("light without hover " + JSON.stringify(v.light_without_hover));
  if (Object.keys(v.light_before_arrival).length) flags.push("light before arrival " + JSON.stringify(v.light_before_arrival));
  if (Object.keys(v.rose_without_hover).length) flags.push("rose without hover " + JSON.stringify(v.rose_without_hover));
  if (v.frames_frozen_light) flags.push(`frozen light ${v.frames_frozen_light} frames (${v.frozen_from_ms}-${v.frozen_to_ms} ms)`);
  if (v.second_powered === false || v.powered_again === false || v.ends_powered === false) flags.push("did not power");
  if (v.others_at_rest === false || v.first_rest_at_end === false) flags.push("other not at rest");
  if (flags.length) { bad++; console.log("!!", k, "|", flags.join(" | "), "|", v.frames, "frames"); }
}
console.log(Object.keys(out).length, "scenarios,", bad, "flagged; max sparks at once", Math.max(...Object.values(out).map((v) => v.max_sparks)), "errors", errors.length);
await page.close();
