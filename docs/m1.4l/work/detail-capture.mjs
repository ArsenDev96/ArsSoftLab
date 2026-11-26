// M1.4L.1 audit: the current project detail for each project (deep link, default Chrome, 1648 x 928).
//   node detail-capture.mjs   -> work/captures/<project>.png (whole view) and <project>-panel.png, work/detail-metrics.json
// Measures the open panel: its box, the detail sentence's font size, line count and width, the "Open project" row,
// the text's contrast against what is behind it (pixels sampled around the sentence), and overlaps with station labels.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const DIR = fileURLToPath(new URL("./captures/", import.meta.url)); mkdirSync(DIR, { recursive: true });
const PROJECTS = [["engineering", "sqlorbit"], ["engineering", "tablerefresh"], ["educational", "arimap"], ["educational", "armat"], ["playground", "aziz"], ["creative", "wallpapers"], ["experience", "koreez"]];
const out = {};
for (const [station, project] of PROJECTS) {
  const page = await launch({ width: 1648, height: 928 });
  await page.goto(`${BASE}/lab-v2?station=${station}&project=${project}`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(3000);
  const m = await page.eval(`(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const panel = document.querySelector("[data-station-panel][data-open]");
    const p = panel.querySelector("[data-project-detail]");
    const cs = getComputedStyle(p);
    const lines = Math.round(p.getBoundingClientRect().height / parseFloat(cs.lineHeight));
    const open = panel.querySelector("[data-open-row]");
    const hits = [...document.querySelectorAll("[data-station] h2, [data-station] ul")].filter((e) => { const a = panel.getBoundingClientRect(), b = e.getBoundingClientRect(); return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; }).map((e) => e.closest("[data-station]").dataset.station);
    return { panel: r(panel), heading: panel.querySelector("h2").textContent, sentence: p.textContent, sentencePx: parseFloat(cs.fontSize), sentenceColor: cs.color, lines, sentenceBox: r(p), openRow: open ? open.innerText.replace(/\\s+/g, " ").trim() : null, openHref: panel.querySelector("[data-open-row] a")?.getAttribute("href") ?? null, labelOverlaps: [...new Set(hits)] };
  })()`);
  const shot = Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64");
  writeFileSync(DIR + `${project}.png`, shot);
  const b = m.panel;
  writeFileSync(DIR + `${project}-panel.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png", clip: { x: b.x - 16, y: b.y - 50, width: b.w + 32, height: b.h + 66, scale: 1 } })).data, "base64"));
  out[project] = m;
  console.log(project, JSON.stringify(m));
  await page.close();
}
writeFileSync(fileURLToPath(new URL("./detail-metrics.json", import.meta.url)), JSON.stringify(out, null, 1) + "\n");
process.exit(0);
