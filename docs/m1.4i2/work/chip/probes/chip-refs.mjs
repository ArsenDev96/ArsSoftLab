// M1.4I.2.1: hit maps and captures with the pointer still on the AZIZ chip, old code and new.   node chip-refs.mjs <label>
import { mkdirSync, writeFileSync } from "node:fs";
import { IDS, POWERED, REST, open, sleep } from "../../../../m1.4i/work/lib.mjs";
import { shot } from "../../home/probes/px.mjs";
const label = process.argv[2];
mkdirSync("cap/chip", { recursive: true });
const out = {};
for (const [page_, path] of [["v2", "/lab-v2"], ["home", "/"]]) {
  const L = path === "/" ? null : await open(path, { gpu: true });
  let page, cam;
  if (L) ({ page, cam } = L);
  else {
    const { launch } = await import("../../../../../scripts/visual/cdp.mjs");
    page = await launch({ width: 1648, height: 928, gpu: true });
    await page.goto("http://localhost:3002/");
    await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
    await page.mouseMove(4, 924); await sleep(1200);
    cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  }
  // One character per px: owner of the point. Chip / title / label of Playground apart.
  const map = (x0, y0, x1, y1, step) => page.eval(`(() => { const C = { engineering: "e", educational: "d", playground: "p", creative: "c", experience: "x" }; const rows = []; for (let y = ${y0}; y <= ${y1}; y += ${step}) { let r = ""; for (let x = ${x0}; x <= ${x1}; x += ${step}) { const e = document.elementFromPoint(${cam.x} + (x + 0.01) * ${cam.k}, ${cam.y} + (y + 0.01) * ${cam.k}); const h = e?.dataset?.hotspot, s = e?.closest?.("[data-station]")?.dataset.station, b = e?.dataset?.bridge; r += h ? C[h] : s ? (s === "playground" ? (e.closest("li button") ? "A" : e.closest("h2 button") ? "T" : "P") : C[s].toUpperCase()) : b ? "1" : e?.closest?.("header,a,button") ? "N" : "."; } rows.push(r); } return rows; })()`);
  const S = (x, y) => [cam.x + x * cam.k, cam.y + y * cam.k];
  const o = (out[page_] = {});
  o.restWhole = await map(2, 2, 1670, 938, 4);
  o.restNear = await map(1240, 290, 1420, 470, 1);
  // Pointer still on the chip's centre (charging: 250 ms; lifted: 1600 ms), then on the title, then on the cabinet.
  for (const [n, p, ms] of [["chipCharging", [1316, 369], 250], ["chipLifted", [1316, 369], 1600], ["titleLifted", [1385, 338], 1600], ["cabinetLifted", [1200, 400], 1600]]) {
    await page.mouseMove(4, 924); await sleep(1800);
    await page.mouseMove(...S(...p)); await sleep(ms);
    o[n + "Near"] = await map(1240, 290, 1420, 470, 1);
    if (n !== "chipCharging") o[n + "Whole"] = await map(2, 2, 1670, 938, 4);
  }
  for (const [n, p] of [["chip", [1316, 369]], ["title", [1385, 338]]]) {
    await page.mouseMove(4, 924); await sleep(1800);
    await page.mouseMove(...S(...p)); await sleep(1800);
    // The label only: the arcade screen beside it keeps moving.
    await shot(page, `chip/${label}-${page_}-${n}`, { x: cam.x + 1264 * cam.k, y: cam.y + 290 * cam.k, width: 150 * cam.k, height: 150 * cam.k, scale: 1 });
  }
  o.stationMarkup = await page.eval(`document.querySelector("#lab-stations").outerHTML`);
  o.focusable = await page.eval(`[...document.querySelectorAll('#lab-stations button, #lab-stations [tabindex], #lab-stations a')].length`);
  await page.close();
}
writeFileSync(`out/chiprefs-${label}.json`, JSON.stringify(out));
console.log(label, "done");
process.exit(0);
