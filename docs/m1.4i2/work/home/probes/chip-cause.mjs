// The chip's rounded end, still pointer: is the loss tied to the crops, or to the frame rate? mode: crops | full | throttle
import { writeFileSync } from "node:fs";
import { IDS, REST, open, sleep } from "../../../../m1.4i/work/lib.mjs";
const out = {};
for (const mode of ["crops", "full", "throttle6", "throttle20"]) {
  const L = await open("/lab-v2", { gpu: true });
  const { page, cam } = L;
  const S = ([x, y]) => [cam.x + x * cam.k, cam.y + y * cam.k];
  if (mode === "full") { await page.eval(`(() => { const e = document.createElement("style"); e.textContent = ".lab-scene-image{background:var(--full) 0 0/100% 100% no-repeat!important}.lab-scene-image image{display:none!important}"; document.head.append(e); return 1; })()`); await sleep(2500); }
  const under = (p) => page.eval(`(() => { const e = document.elementFromPoint(${S(p).join(",")}); return e?.dataset.bridge ? "bridge" : e?.closest("li button") ? "chip" : e?.closest("[data-station]") ? "label" : "other"; })()`);
  const rows = [];
  for (const x of [1290, 1292, 1316, 1343]) for (const y of [362, 365, 369, 373, 376]) {
    await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await L.off();
    await L.settle((s) => s.hover === null && IDS.every((i) => REST[i](s[i])), 8000);
    await sleep(150);
    if ((await under([x, y])) !== "chip") continue;
    if (mode.startsWith("throttle")) await page.send("Emulation.setCPUThrottlingRate", { rate: +mode.slice(8) });
    await page.eval("(window.__f = 0, window.__on = 1, (function f() { if (!window.__on) return; window.__f++; requestAnimationFrame(f); })(), 1)");
    await page.mouseMove(...S([x, y]));
    const t0 = Date.now();
    await sleep(1900);
    const f = await page.eval("(window.__on = 0, window.__f)");
    rows.push({ x, y, after: await under([x, y]), fps: Math.round((f * 1000) / (Date.now() - t0)) });
  }
  await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  out[mode] = rows;
  const s = {};
  for (const r of rows) { s[r.x] ??= []; s[r.x].push(r.after); }
  console.log(mode, "fps", rows.map((r) => r.fps).sort((a, b) => a - b)[rows.length >> 1], JSON.stringify(s));
  await page.close();
}
writeFileSync("out/chip-cause.json", JSON.stringify(out));
process.exit(0);
