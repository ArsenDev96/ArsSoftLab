// M1.4K.9: Playground's arcade screen on leave and return: its light against the ring's and the new spark, and whether
// the game session survives (the same game clock: ArcadeScreen's Web Animation on the canvas, same start time, no
// second boot). The pointer leaves once the game is running and comes back <gap> ms after the hover drops.
//   node arcade-session.mjs <label>   (BASE to choose the server)   -> results/arcade-session-<label>.json
import { ARRIVE, lab, out, sleep } from "./core.mjs";
const label = process.argv[2] ?? "check";
const id = "playground";
const L = await lab();
await L.page.eval(`(() => { const a = document.querySelector('.lab-arcade[data-arcade="playground"]'), cv = a.querySelector("canvas");
  const ring = document.querySelector('[data-v2-ring="playground"] .lab-v2-power-lit'), mover = document.querySelector('[data-surge="playground"] [data-surge-mover]');
  window.__a = []; window.__aOn = false;
  (function f(t) { if (window.__aOn) { const clk = cv.getAnimations()[0];
    window.__a.push({ t: Math.round(t), hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, screen: +(+getComputedStyle(a).opacity).toFixed(3),
      ring: +(+getComputedStyle(ring).opacity).toFixed(3), state: a.dataset.state ?? null, clock: clk ? Math.round(clk.startTime) : null, game: clk ? Math.round(clk.currentTime) : null,
      spark: mover?.getAnimations().at(-1)?.startTime ?? null }); }
    requestAnimationFrame(f); })(performance.now()); return 1; })()`);
const res = [];
for (const gap of [0, 60, 150, 250, 600]) for (let k = 0; k < 2; k++) {
  await L.rest(); await sleep(400);
  await L.page.eval("(window.__a.length = 0, window.__aOn = true, 1)");
  await L.on(id);
  for (let t = 0; t < 4000; t += 30) { if ((await L.page.eval(`document.querySelector('.lab-arcade[data-arcade="playground"]').dataset.state`)) === "running") break; await sleep(30); }
  await sleep(500);
  await L.off(); await L.hovUntil(null); await sleep(gap); await L.on(id);
  await sleep(ARRIVE[id] + 1200);
  const f = await L.page.eval("(window.__aOn = false, window.__a.slice())");
  let b = -1; for (let i = 1; i < f.length; i++) if (f[i].hover === id && f[i - 1].hover === null) b = i;
  const before = f[b - 1], arr = f.at(-1).spark + ARRIVE[id];
  const flight = f.slice(b).filter((q) => q.t < arr - 18), after = f.filter((q) => q.t >= arr);
  let rise = 0; for (let i = 1; i < flight.length; i++) rise = Math.max(rise, flight[i].screen - flight[i - 1].screen);
  const states = [...new Set(f.slice(b).map((q) => q.state))];
  const r = { gap, try: k, screenAtReturn: f[b].screen, screenRise: +rise.toFixed(3), screenLast200: Math.max(0, ...flight.filter((q) => q.t >= arr - 200).map((q) => q.screen)),
    screenAtArrival: flight.at(-1)?.screen ?? null, screenFullAfter: after.find((q) => q.screen >= 0.99) ? after.find((q) => q.screen >= 0.99).t - arr : null,
    ringLast200: Math.max(0, ...flight.filter((q) => q.t >= arr - 200).map((q) => q.ring)), ringFullAfter: after.find((q) => q.ring >= 0.99) ? after.find((q) => q.ring >= 0.99).t - arr : null,
    clockBefore: before.clock, clockAfter: f.at(-1).clock, sameGame: before.clock !== null && before.clock === f.at(-1).clock, gameBefore: before.game, gameEnd: f.at(-1).game,
    statesAfterReturn: states, stateEnd: f.at(-1).state };
  res.push(r);
  console.log(`gap ${String(gap).padStart(3)} ms #${k} | screen at return ${r.screenAtReturn} rise ${r.screenRise} last 200 ms ${r.screenLast200} at arrival ${r.screenAtArrival} full +${r.screenFullAfter} | ring last 200 ms ${r.ringLast200} full +${r.ringFullAfter} | game ${r.sameGame ? "SAME" : "NEW"} (clock ${r.clockBefore} -> ${r.clockAfter}, game time ${r.gameBefore} -> ${r.gameEnd} ms) | states ${states.join(">")}`);
}
console.log("errors", JSON.stringify(L.errors));
await out(`arcade-session-${label}`, res); await L.page.close(); process.exit(0);
