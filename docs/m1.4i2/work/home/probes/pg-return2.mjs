// Playground: leave / return grid with the real pointer. Sparks counted at the source, lift per frame, sign hit tests.
import { writeFileSync } from "node:fs";
import { IDS, POWERED, REST, logger, open, sleep } from "../../../../m1.4i/work/lib.mjs";
const L = await open("/lab-v2", { gpu: true });
const { page, cam } = L;
const S = ([x, y]) => [cam.x + x * cam.k, cam.y + y * cam.k];
const to = (p) => page.mouseMove(...S(p));
const BODY = [1205, 440], SIGN = [1193, 340], SIGN_UP = [1218 + (1193 - 1218) * 1.01, 547 + (340 - 547) * 1.01 - 18], ABOVE = [1193, 310];
await page.eval(`(() => {
  window.__sp = [];
  const a = Element.prototype.animate;
  Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__sp.push(performance.now()); return a.apply(this, x); };
  window.__h = [];
  const d = document.querySelector(".lab-camera").closest("main").querySelector("div.contents");
  const now = () => { const v = d.dataset.labHover ?? "-"; if (window.__h.at(-1) !== v) window.__h.push(v); };
  new MutationObserver(now).observe(d, { attributes: true });
  now();
  return 1;
})()`);
await logger(page);
const at = (p) => page.eval(`document.elementFromPoint(${S(p).join(",")})?.dataset.hotspot ?? null`);
const hov = () => page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
const rest = () => L.settle((s) => s.hover === null && IDS.every((i) => REST[i](s[i])), 7000);
const rows = [], cases = [];
for (const leave of [200, 400, 560, 700, 800, 950, 1100, 1700]) {
  for (const gap of [20, 50]) cases.push([leave, "pointer out", gap]);
  for (const gap of [0, 20, 50, 100, 150, 200, 350, 600]) cases.push([leave, "after drop", gap]);
}
for (const [k, [leave, kind, gap]] of cases.entries()) {
  const P0 = k % 2 ? SIGN : BODY; // enter on body and sign in turn
  await L.off();
  await rest();
  await sleep(120);
  await page.eval("(window.__sp = [], window.__h = window.__h.slice(-1), window.__log.length = 0, 1)");
  await to(P0);
  await sleep(leave);
  await L.off();
  if (kind === "after drop") for (let i = 0; i < 200 && (await hov()); i++) await sleep(2);
  await sleep(gap);
  await to(BODY);
  await sleep(2300);
  const s = await page.eval("({ sp: window.__sp.map(Math.round), h: window.__h })");
  const fr = JSON.parse(await page.eval("JSON.stringify(window.__log)"));
  const signUp = await at(SIGN_UP), end = fr.at(-1)[1];
  await L.off();
  const back = await rest();
  const entries = s.h.filter((v) => v === "playground").length;
  // The return visit: the frames since the last hover entry.
  let i0 = fr.length - 1;
  while (i0 > 0 && fr[i0 - 1][1].hover === "playground") i0--;
  const ret = fr.slice(i0), t0 = ret[0][0];
  const pre = ret.filter(([t]) => t - t0 < 620).map(([, x]) => x);
  const rosePre = entries > 1 ? pre.filter((x, i) => i && (x.playground.lift > pre[i - 1].playground.lift + 0.05 || x.playground.lit > pre[i - 1].playground.lit + 0.01)).length : 0;
  const post = ret.filter(([t]) => t - t0 >= 620).map(([, x]) => x.playground.lift);
  const fell = entries > 1 ? post.filter((v, i) => i && v < post[i - 1] - 0.05).length : 0;
  const firstOn = fr.findIndex(([, x]) => x.hover === "playground");
  const gone = fr.slice(firstOn, i0).filter(([, x]) => x.hover === null).map(([, x]) => x.playground);
  const roseAway = gone.filter((x, i) => i && x.lift > gone[i - 1].lift + 0.05).length;
  const both = Math.max(...fr.map(([, x]) => IDS.filter((o) => x.sparks[o] > 0.02).length));
  const other = [...new Set(s.h.filter((v) => v !== "playground" && v !== "-"))];
  const r = { leave, kind, gap, entry: P0 === SIGN ? "sign" : "body", entries, sparks: s.sp.length, powered: POWERED.playground(end.playground), lift: end.playground.lift, signUp, restAfter: back, signRest: await at(SIGN), wallAbove: await at(ABOVE), rosePre, fell, roseAway, maxSparksAtOnce: both, other, liftAtReturn: ret[0][1].playground.lift };
  r.bad = !r.powered || !r.restAfter || r.sparks !== r.entries || r.signUp !== "playground" || r.signRest !== "playground" || r.wallAbove !== null || r.rosePre > 0 || r.fell > 0 || r.roseAway > 0 || r.maxSparksAtOnce > 1 || r.other.length > 0 || (kind === "after drop" && r.entries !== 2);
  rows.push(r);
  if (r.bad) console.log("!!", JSON.stringify(r));
  writeFileSync("out/pg-return2.json", JSON.stringify({ rows, errors: L.errors }) + "\n");
}
const n = (f) => rows.filter(f).length;
console.log(`runs ${rows.length}, flagged ${n((r) => r.bad)}; held through (one entry) ${n((r) => r.entries === 1)}; not powered ${n((r) => !r.powered)}; stuck ${n((r) => !r.restAfter)}; duplicate sparks ${n((r) => r.sparks > r.entries)}; missing sparks ${n((r) => r.sparks < r.entries)}; rose before arrival ${n((r) => r.rosePre)}; fell after ${n((r) => r.fell)}; sign lost ${n((r) => r.signUp !== "playground" || r.signRest !== "playground")}; errors ${JSON.stringify(L.errors)}`);
await page.close();
process.exit(0);
