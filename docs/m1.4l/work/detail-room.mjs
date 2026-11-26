// M1.4L.1 audit: how much room the hero slot has below a project's sentence before it meets Engineering's label
// (each station's camera shot, 1648 x 928 and 1366 x 768), deep links.   node detail-room.mjs -> detail-room.json
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const out = {};
for (const [w, h] of [[1648, 928], [1366, 768]]) for (const [station, project] of [["engineering", "sqlorbit"], ["educational", "armat"], ["playground", "aziz"], ["creative", "wallpapers"], ["experience", "koreez"]]) {
  const page = await launch({ width: w, height: h });
  await page.goto(`${BASE}/lab-v2?station=${station}&project=${project}`);
  await sleep(3200);
  const m = await page.eval(`(() => {
    const r = (e) => e.getBoundingClientRect();
    const panel = document.querySelector("[data-station-panel][data-open]");
    const text = [...panel.querySelectorAll("h2, p, ul, [data-open-row], button")].map(r);
    const right = Math.max(...text.map((b) => b.right)), back = r([...panel.querySelectorAll("button")].at(-1));
    const sentence = r(panel.querySelector("[data-project-detail]"));
    const eng = [...document.querySelectorAll('[data-station="engineering"] h2, [data-station="engineering"] ul')].map(r);
    const engBox = { left: Math.min(...eng.map((b) => b.left)), top: Math.min(...eng.map((b) => b.top)), right: Math.max(...eng.map((b) => b.right)), bottom: Math.max(...eng.map((b) => b.bottom)) };
    return { textRight: Math.round(right), panelBottom: Math.round(back.bottom), sentenceBottom: Math.round(sentence.bottom), engLabel: Object.fromEntries(Object.entries(engBox).map(([k, v]) => [k, Math.round(v)])),
      horizontalOverlap: engBox.left < right, gapBelowPanelToEngLabel: Math.round(engBox.top - back.bottom) };
  })()`);
  out[`${w}x${h} ${project}`] = m; console.log(`${w}x${h}`, station.padEnd(11), JSON.stringify(m));
  await page.close();
}
writeFileSync(new URL("./detail-room.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
process.exit(0);
