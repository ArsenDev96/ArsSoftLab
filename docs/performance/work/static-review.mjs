// Static Lite: captures for the final visual review (default Chrome, headless, dev server). Read-only: no app change.
//   node static-review.mjs   -> work/static-*.png, work/lite-rest-1366.png (deliverables),
//                               work/captures/static/review/<mode>-<state>-<w>.png (both modes, for static-review.py)
// States: rest; Engineering selected + Playground hovered (sel-eng-hover-pg); Educational selected + Playground
// hovered (sel-edu-hover-pg, the pair whose powered pixels overlap most, 1,130 px). At 1648 x 928 and 1366 x 768, and
// at the scene's own 1672 x 941, where the two modes can be compared pixel for pixel.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const WORK = fileURLToPath(new URL("./", import.meta.url));
const OUT = fileURLToPath(new URL("./captures/static/review/", import.meta.url)); mkdirSync(OUT, { recursive: true });
const log = [];

const PLAN = [
  [1648, 928, ["rest", "sel-eng-hover-pg", "sel-edu-hover-pg"]],
  [1672, 941, ["rest", "sel-eng-hover-pg", "sel-edu-hover-pg"]],
  [1366, 768, ["rest"]],
];
for (const [w, h, states] of PLAN) for (const mode of ["static", "lite"]) {
  const page = await launch({ width: w, height: h });
  await page.goto(`${BASE}/lab-v2?render=${mode}`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  const away = [4, h - 4];
  const title = (id) => page.center(`[data-station="${id}"] .lab-station-title`);
  for (const state of states) {
    await page.mouseMove(...away); await sleep(1200);
    if (state !== "rest") {
      const sel = state.includes("sel-eng") ? "engineering" : "educational";
      const t = await title(sel); await page.mouseMove(t.x, t.y); await sleep(400); await page.click(t.x, t.y); await sleep(800);
      const p = await title("playground"); await page.mouseMove(p.x, p.y); await sleep(1500);
    }
    const s = await page.eval(`({ hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, url: location.search })`);
    log.push({ w, mode, state, ...s });
    const file = `${OUT}${mode}-${state}-${w}.png`;
    writeFileSync(file, Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
    if (state !== "rest") { await page.key("Escape", "Escape", 27); await sleep(900); }
  }
  await page.close();
}
// The deliverables.
copyFileSync(`${OUT}static-rest-1648.png`, `${WORK}static-rest-1648.png`);
copyFileSync(`${OUT}static-sel-eng-hover-pg-1648.png`, `${WORK}static-selected-hovered-1648.png`);
copyFileSync(`${OUT}static-rest-1366.png`, `${WORK}static-rest-1366.png`);
copyFileSync(`${OUT}lite-rest-1366.png`, `${WORK}lite-rest-1366.png`);
console.log(log.map((l) => `${l.w} ${l.mode.padEnd(6)} ${l.state.padEnd(17)} hover ${l.hover} selected ${l.selected} ${l.url}`).join("\n"));
process.exit(0);
