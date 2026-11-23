// Each station on its own: real-time timings (every frame logged), other stations untouched, full-scene captures at
// rest / spark / powered / returned, and connection close-ups at rest, charging, powered, returning (seeked).
import { ARRIVE, IDS, POWERED, REST, SEQ, logger, open, save, sleep, until } from "./lib.mjs";

const out = { realtime: {}, captures: {} };

// --- real time, GPU on.
for (const id of process.argv.includes("captures") ? [] : IDS) {
  const { page, errors, hover, away, read } = await open("/lab-v2", { gpu: true });
  const runs = [];
  const log = await logger(page);
  for (let n = 0; n < 2; n++) {
    await page.eval("window.__log.length = 0");
    const m = 0;
    await sleep(120);
    await hover(id);
    const pw = await until(log, (s) => s.hover === id && POWERED[id](s[id]), 6000);
    await sleep(1200);
    const on = await log.since(m);
    const t0 = on.find(([, s]) => s.hover === id)?.[0];
    const first = (f) => { const e = on.find(([, s]) => f(s)); return e ? e[0] - t0 : null; };
    const restS = on[0][1];
    const changed = (s) => JSON.stringify(s[id]) !== JSON.stringify(restS[id]);
    const spark = on.filter(([, s]) => s.sparks[id] > 0);
    const m2 = await log.mark();
    await away();
    await until(log, (s) => s.hover !== id && REST[id](s[id]), 6000);
    await sleep(500);
    const offL = await log.since(m2);
    const t1 = offL.find(([, s]) => s.hover !== id)?.[0];
    const others = IDS.filter((o) => o !== id);
    const all = [...on, ...offL];
    runs.push({
      frames_on: on.length,
      spark_first_ms: spark.length ? spark[0][0] - t0 : null,
      spark_last_ms: spark.length ? spark.at(-1)[0] - t0 : null,
      other_sparks_frames: all.filter(([, s]) => others.some((o) => s.sparks[o] > 0)).length,
      first_station_change_ms: first(changed),
      powered_ms: pw ? on.find(([, s]) => s.hover === id && POWERED[id](s[id]))?.[0] - t0 : null,
      expected_arrival_ms: ARRIVE[id],
      rest_after_leave_ms: (() => { const e = offL.find(([, s]) => s.hover !== id && REST[id](s[id])); return e ? e[0] - t1 : null; })(),
      frames_with_other_station_changed: all.filter(([, s]) => others.some((o) => JSON.stringify(s[o]) !== JSON.stringify(restS[o]))).length,
      rest_before: IDS.every((o) => REST[o](restS[o])),
      rest_after: IDS.every((o) => REST[o](offL.at(-1)[1][o])),
    });
  }
  out.realtime[id] = { runs, errors };
  await page.close();
}
if (!process.argv.includes("captures")) save("stations.json", out);
if (process.argv.includes("realtime")) process.exit(0);

// --- full scene: idle, then each powered, then back to rest.
{
  const { page, errors, hover, away, shot, finish } = await open("/lab-v2");
  await shot("full-idle.png");
  for (const id of IDS) {
    await hover(id);
    await sleep(ARRIVE[id] + SEQ[id] + 2600);
    await shot(`full-powered-${id}.png`);
    await away();
    await sleep(2600);
    await shot(`full-returned-${id}.png`);
  }
  out.captures.errors = errors;
  await page.close();
}
// --- the connections: close-ups, seeked (ascending: a finished transition is retired).
const LINE = {
  educational: { x: 770, y: 440, w: 140, h: 140 },
  engineering: { x: 560, y: 495, w: 210, h: 120 },
  playground: { x: 915, y: 480, w: 260, h: 130 },
  creative: { x: 470, y: 620, w: 270, h: 110 },
  experience: { x: 930, y: 620, w: 290, h: 110 },
};
const END = {
  educational: { x: 806, y: 440, w: 64, h: 44 },
  engineering: { x: 556, y: 512, w: 64, h: 44 },
  playground: { x: 1050, y: 508, w: 84, h: 58 },
  creative: { x: 474, y: 666, w: 64, h: 44 },
  experience: { x: 1178, y: 674, w: 64, h: 44 },
};
const START = {
  educational: { x: 806, y: 500, w: 64, h: 44 },
  engineering: { x: 690, y: 556, w: 64, h: 44 },
  playground: { x: 926, y: 552, w: 64, h: 44 },
  creative: { x: 690, y: 618, w: 64, h: 44 },
  experience: { x: 930, y: 622, w: 64, h: 44 },
};
for (const id of IDS) {
  const { page, seek, finish, hover, away, shot } = await open("/lab-v2");
  const grab = async (n) => {
    await shot(`line-${id}-${n}.png`, LINE[id], 3);
    await shot(`end-${id}-${n}.png`, END[id], 8);
    await shot(`start-${id}-${n}.png`, START[id], 8);
  };
  await grab("rest");
  await shot(`full-seek-rest-${id}.png`);
  await hover(id);
  await sleep(30);
  for (const [n, t] of [["charge-25", ARRIVE[id] * 0.35], ["charge-50", ARRIVE[id] * 0.55], ["charge-75", ARRIVE[id] * 0.78], ["before-arrival", ARRIVE[id] - 30], ["arrived", ARRIVE[id] + 10], ["lift-mid", ARRIVE[id] + 180]]) {
    await seek(t);
    await grab(n);
    if (n === "before-arrival") await shot(`full-before-arrival-${id}.png`);
  }
  await finish();
  await sleep(400);
  await grab("powered");
  await away();
  for (const [n, t] of [["return-200", 200], ["return-600", 600], ["return-800", 800]]) {
    await seek(t);
    await grab(n);
  }
  await finish();
  await sleep(1500);
  await grab("returned");
  await page.close();
}
console.log("captures", JSON.stringify(out.captures));
