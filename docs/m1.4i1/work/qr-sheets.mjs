// M1.4I.1D: before/after sheets from qr-ev-before and qr-ev-after -> ../quick-return-*.png
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { HERE } from "./qr-lib.mjs";
const u = (d, f) => "data:image/png;base64," + readFileSync(join(HERE, d, f)).toString("base64");
// crop: scene px inside the station's crop (its own origin), shown at `zoom`.
const SHEETS = {
  "quick-return-creative.png": { w: 1180, h: 800, rows: [["creative-charging.png", "400 ms after returning, spark still travelling", { x: 90, y: 0, w: 320, h: 210 }], ["creative-arrived.png", "200 ms after the spark arrives", { x: 90, y: 0, w: 320, h: 210 }]], zoom: 1.8 },
  "quick-return-educational.png": { w: 1120, h: 600, rows: [["educational-pulse.png", "Spark still travelling (strip pulse)", { x: 60, y: 215, w: 280, h: 90 }], ["educational-arrived.png", "110 ms after the spark arrives", { x: 20, y: 40, w: 360, h: 260 }]], zoom: 1.5 },
  "quick-return-experience.png": { w: 1100, h: 440, rows: [["experience-arrived.png", "25 ms after the spark arrives", { x: 330, y: 0, w: 310, h: 230 }]], zoom: 1.7 },
};
for (const [file, s] of Object.entries(SHEETS)) {
  const page = await launch({ width: s.w, height: s.h });
  await page.eval(`(async () => {
    document.body.style.cssText = "margin:0;background:#111;color:#eee;font:15px sans-serif;padding:10px";
    for (const [t, cap, c, b, a] of ${JSON.stringify(s.rows.map(([f, cap, c]) => [f, cap, c, u("qr-ev-before", f), u("qr-ev-after", f)]))}) {
      const row = document.createElement("div"); row.style.cssText = "display:flex;gap:12px;margin-bottom:12px";
      for (const [name, src] of [["Before", b], ["After", a]]) {
        const i = new Image(); i.src = src; await i.decode();
        const k = 1.5 * (1648 / 1672), z = ${s.zoom};
        const cv = document.createElement("canvas"); cv.width = c.w * z; cv.height = c.h * z;
        const g = cv.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(i, c.x * k, c.y * k, c.w * k, c.h * k, 0, 0, cv.width, cv.height);
        const d = document.createElement("div"); d.textContent = name + ": " + cap; d.append(document.createElement("br"), cv); row.append(d);
      }
      document.body.append(row);
    }
    return 1;
  })()`);
  await sleep(300);
  await page.screenshot(join(HERE, "..", file));
  await page.close();
}
process.exit(0);
