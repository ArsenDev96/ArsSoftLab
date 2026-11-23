// M1.4I.1D: M1.4I P2-3 (platform -> own label drops the hover for a moment): how much of the station goes dark. node qr-label.mjs
import { open as openLab, sleep } from "../../m1.4i/work/lib.mjs";
import { LIB, STATIONS } from "./qr-lib.mjs";
const FROM = { creative: [300, 715], experience: [1430, 715], educational: [838, 440] };
for (const id of Object.keys(FROM)) {
  const L = await openLab("/lab-v2", { gpu: true });
  await L.page.eval(LIB(id));
  const t = await L.page.center(`#station-${id}-trigger`);
  const a = [L.cam.x + FROM[id][0] * L.cam.k, L.cam.y + FROM[id][1] * L.cam.k];
  for (const ms of [200, 400, 800, 1500]) {
    for (let i = 0; i < 100 && !(await L.page.eval("window.__q.rest()")); i++) await sleep(60);
    await L.page.mouseMove(...a);
    await sleep(STATIONS[id].arrive + STATIONS[id].seq + 300);
    await L.page.eval("(window.__q.start(), 1)");
    const t0 = performance.now();
    for (;;) { const f = Math.min(1, (performance.now() - t0) / ms); await L.page.mouseMove(a[0] + (t.x - a[0]) * f, a[1] + (t.y - a[1]) * f); if (f === 1) break; await sleep(6); }
    await sleep(2400);
    const log = JSON.parse(await L.page.eval("JSON.stringify(window.__q.stop())"));
    const main = STATIONS[id].nums.at(id === "creative" ? 1 : -1);
    console.log(id, ms, "ms | frames without hover", log.filter((f) => f.hover === null).length, "| lowest", main, Math.min(...log.map((f) => f.nums[main])), "| lowest strip", Math.min(...log.map((f) => Math.min(...f.pw))), "| end", log.at(-1).hover, log.at(-1).nums[main]);
    await L.off();
  }
  await L.page.close();
}
process.exit(0);
