// Engineering's frames around the lift, with it and with it switched off (same build), at CPU throttles; also with the GPU rasteriser off.
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const A = ARRIVE.engineering;
for (const gpu of [true, false]) for (const rate of gpu ? [1, 4, 8] : [1]) for (const mode of ["lift", "no lift"]) {
  const L = await open("/lab-v2", { gpu });
  if (mode === "no lift") await L.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ".eng-lift{--el:0!important;transition:none!important}"; document.head.append(e); return 1; })()`);
  await L.page.send("Emulation.setCPUThrottlingRate", { rate });
  await L.page.eval("(window.__t = [], (function f(n) { window.__t.push(n); requestAnimationFrame(f); })(performance.now()), 1)");
  const c = await L.page.center('[data-hotspot="engineering"]'); const rows = [];
  for (let k = 0; k < 6; k++) {
    await L.page.mouseMove(4, 924); await sleep(1800);
    await L.page.eval("(window.__t.length = 0, 1)");
    const t0 = await L.page.eval("performance.now()"); await L.page.mouseMove(c.x, c.y); await sleep(A + 1100);
    const ts = await L.page.eval("window.__t"); const d = ts.map((t, i) => [t, i ? t - ts[i - 1] : 0]).filter(([t]) => t > t0 + A + 60 && t <= t0 + A + 660).map(([, x]) => x);
    rows.push([d.length, +Math.max(...d).toFixed(0)]);
  }
  console.log(gpu ? "GPU" : "software", "cpu 1/" + rate, mode.padEnd(8), "frames in the 600 ms (of 36), first:", rows[0].join("/"), "later:", rows.slice(1).map((r) => r.join("/")).join(" "));
  await L.page.close();
}
process.exit(0);
