// Idle at several sizes; hit maps (whole scene, every 2 px) at rest and with each station powered; homepage.   node refs.mjs <label>
import { mkdirSync, writeFileSync } from "node:fs";
import { IDS, POWERED, launch, open, sleep } from "../../../m1.4i/work/lib.mjs";
import { shot } from "../../../m1.4i2/work/home/probes/px.mjs";
const label = process.argv[2];
mkdirSync("cap/j1/sizes", { recursive: true });
for (const [w, h] of [[1648, 928], [1920, 1080], [1366, 768], [1024, 640]]) {
  const L = await open("/lab-v2", { gpu: true, width: w, height: h });
  await sleep(700); await L.finish(); await sleep(250);
  await shot(L.page, `j1/sizes/${label}-${w}`);
  await L.page.close();
}
const out = {};
const CH = { engineering: "e", educational: "d", playground: "p", creative: "c", experience: "x" };
const MAP = (cam) => `(() => { const C = ${JSON.stringify(CH)}; const rows = []; for (let y = 100; y <= 830; y += 2) { let r = ""; for (let x = 2; x <= 1670; x += 2) { const e = document.elementFromPoint(${cam.x} + (x + 0.01) * ${cam.k}, ${cam.y} + (y + 0.01) * ${cam.k}); const h = e?.dataset?.hotspot, s = e?.closest?.("[data-station]")?.dataset.station, b = e?.dataset?.bridge; r += h ? C[h] : s ? C[s].toUpperCase() : b ? "1" : e?.closest?.("header,a,button") ? "N" : "."; } rows.push(r); } return rows; })()`;
{
  const L = await open("/lab-v2", { gpu: true });
  out.rest = await L.page.eval(MAP(L.cam));
  for (const id of IDS) { await L.hover(id); await L.settle((s) => POWERED[id](s[id]), 8000); await sleep(900); out[id] = await L.page.eval(MAP(L.cam)); await L.away(); await sleep(1600); }
  out.focus = await L.page.eval(`[...document.querySelectorAll("button,a[href],[tabindex]")].map((e) => (e.id || e.textContent.trim()).slice(0, 40))`);
  out.errors = L.errors;
  await L.page.close();
}
{
  const page = await launch({ width: 1648, height: 928, gpu: true });
  await page.goto("http://localhost:3002/");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(1200);
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  out.home = await page.eval(MAP(cam));
  const c = await page.center('[data-hotspot="engineering"]'); await page.mouseMove(c.x, c.y); await sleep(1800);
  out.homeEng = await page.eval(MAP(cam));
  out.homeMarkup = await page.eval(`document.querySelector("#lab-stations").outerHTML`);
  await page.mouseMove(4, 924); await sleep(1500);
  await page.freezeAnimations(0); await page.finishTransitions(); await sleep(300);
  await shot(page, `j1/sizes/${label}-home`);
  await page.close();
}
writeFileSync(`out/j1-refs-${label}.json`, JSON.stringify(out));
console.log(label, "done", out.errors);
process.exit(0);
