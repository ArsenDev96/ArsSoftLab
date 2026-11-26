// M1.4K: after Enter, which part of a station is not yet powered, and when it is (smoke-office follow-up).
import { IDS, POWERED, open, sleep } from "./lib.mjs";
import { out } from "./core.mjs";
const res = [];
for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  const L = await open("/lab-v2", { width: w, height: h, gpu: true });
  for (const id of ["creative", "experience", "engineering"]) for (let k = 0; k < 2; k++) {
    await L.page.eval(`(document.getElementById("station-${id}-trigger").focus(), 1)`); await sleep(150);
    await L.page.key("Enter", "Enter", 13); const t0 = Date.now(); let first = null, at1200 = null;
    for (let t = 0; t < 5000; t += 100) { const s = await L.read(); if (Date.now() - t0 >= 1200 && !at1200) at1200 = s[id]; if (POWERED[id](s[id])) { first = Date.now() - t0; break; } await sleep(100); }
    const r = { vp: `${w}x${h}`, id, k, poweredAfterMs: first, at1200 }; res.push(r); console.log(JSON.stringify(r));
    await L.page.key("Escape", "Escape", 27); await sleep(600); await L.page.eval("(document.activeElement?.blur?.(), 1)"); await L.off(); await sleep(2500);
  }
  await L.page.close();
}
await out("smoke-enter-check-office", res); process.exit(0);
