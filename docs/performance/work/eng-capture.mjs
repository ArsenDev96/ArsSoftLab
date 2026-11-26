// M1.4K.3: Engineering frozen on its own clock, for before/after pixel comparison.
//   node eng-capture.mjs <label>   -> captures/<label>/<mode>-<w>x<h>-<state>.png   (QUERY: e.g. "?render=full", M1.4K.4)
// States are times after the spark's arrival (620 ms after the hover); every animation is paused at the same time.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lab, sleep } from "../../m1.4k/work/core.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "before";
const OUT = join(HERE, "captures", label); mkdirSync(OUT, { recursive: true });
const A = 620, STATES = [["rest", null], ["half", 247], ["chart", 450], ["full", 663], ["stable", 2400]];
const info = {};
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
for (const mode of ["default", "gpu"]) for (const [w, h] of [[1648, 928], [1920, 1080]]) {
  if (ONLY && !ONLY.includes(`${mode}-${w}x${h}`)) continue;
  for (const [state, t] of STATES) {
    // A fresh page per state: nothing left over from an earlier seek.
    const L = await lab("/lab-v2" + (process.env.QUERY ?? ""), { width: w, height: h, gpu: mode === "gpu" });
    if (process.env.INJECT) await L.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ${JSON.stringify(process.env.INJECT)}; document.head.append(e); return 1; })()`);
    await sleep(800);
    if (t !== null) { await L.on("engineering"); await L.frame(); await L.seek(A + t); }
    else await L.frame();
    await sleep(400);
    const s = await L.st();
    const k = `${mode}-${w}x${h}-${state}`;
    info[k] = { y: s.engineering.y, imgs: await L.page.eval(`[...document.querySelectorAll('[data-eng]')].filter((e) => ["body", "station-stable", "body-light", "chart-light-stable"].includes(e.dataset.eng)).map((e) => e.tagName + ":" + e.dataset.eng).join(",")`), errors: L.errors.length };
    writeFileSync(join(OUT, `${k}.png`), Buffer.from((await L.page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
    console.log(k, JSON.stringify(info[k]));
    await L.page.close();
  }
}
writeFileSync(join(OUT, "info.json"), JSON.stringify(info, null, 1) + "\n");
process.exit(0);
