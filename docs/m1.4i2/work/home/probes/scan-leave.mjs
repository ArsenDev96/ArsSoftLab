// Engineering: leave while the scan runs. The scan line's opacity, frame by frame, after the hover has dropped; and captures.
import { writeFileSync } from "node:fs";
import { ARRIVE, IDS, REST, open, sleep } from "../../../../m1.4i/work/lib.mjs";
const L = await open("/lab-v2", { gpu: true });
const { page } = L;
const c = await page.center('[data-hotspot="engineering"]');
const rows = [];
for (const at of [140, 200, 260, 320, 380, 430]) for (let k = 0; k < 3; k++) {
  await L.off();
  await L.settle((s) => s.hover === null && IDS.every((i) => REST[i](s[i])), 7000);
  await sleep(150);
  await page.eval(`(() => { window.__l = []; window.__on = true; (function f() { if (!window.__on) return; const h = document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null; window.__l.push([performance.now(), h, +getComputedStyle(document.querySelector(".eng-scan-band")).opacity, +getComputedStyle(document.querySelector(".eng-caps")).opacity]); requestAnimationFrame(f); })(); return 1; })()`);
  await page.mouseMove(c.x, c.y);
  await sleep(ARRIVE.engineering + at - 90);
  await L.off();
  await sleep(700);
  const l = await page.eval("(window.__on = false, window.__l)");
  const i = l.findLastIndex((f) => f[1] === "engineering");
  const t0 = l[i + 1][0], tail = l.slice(i + 1);
  const vis = tail.filter((f) => f[2] > 0);
  rows.push({ at, first: +(l[i][2]).toFixed(3), visibleMs: vis.length ? Math.round(vis.at(-1)[0] - t0) : 0, frames: vis.length, rose: tail.filter((f, j) => j && f[2] > tail[j - 1][2] + 0.001).length, values: vis.map((f) => +f[2].toFixed(2)) });
}
for (const r of rows) console.log(JSON.stringify(r));
console.log(`runs ${rows.length}; longest ${Math.max(...rows.map((r) => r.visibleMs))} ms; rose ${rows.reduce((a, r) => a + r.rose, 0)}; errors ${JSON.stringify(L.errors)}`);
writeFileSync("out/scan-leave.json", JSON.stringify(rows) + "\n");
await page.close();
process.exit(0);
