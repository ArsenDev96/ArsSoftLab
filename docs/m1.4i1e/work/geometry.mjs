// M1.4I.1E: what the pointer meets around each station (scene px): the hit map at rest and active, and the label's boxes.
//   node docs/m1.4i1e/work/geometry.mjs <label> [path]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDS, POWERED, open, sleep } from "../../m1.4i/work/lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const [label = "run", path = "/lab-v2"] = process.argv.slice(2);
const L = await open(path, { gpu: true });
const { page, cam } = L;
// One character per scene px: hotspot e d p c x, its connector or label in capitals / digits, header N.
const map = (x0, y0, x1, y1, step = 1) =>
  page.eval(`(() => { const C = { engineering: "e", educational: "d", playground: "p", creative: "c", experience: "x" }; const rows = []; for (let y = ${y0}; y <= ${y1}; y += ${step}) { let r = ""; for (let x = ${x0}; x <= ${x1}; x += ${step}) { const e = document.elementFromPoint(${cam.x} + (x + 0.01) * ${cam.k}, ${cam.y} + (y + 0.01) * ${cam.k}); const h = e?.dataset?.hotspot, s = e?.closest?.("[data-station]")?.dataset.station, b = e?.dataset?.bridge; r += h ? C[h] : s ? C[s].toUpperCase() : b ? "1" : e?.closest?.("header,a,button") ? "N" : "."; } rows.push(r); } return rows; })()`);
const rects = (id) =>
  page.eval(`(() => { const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [(b.left - ${cam.x}) / ${cam.k}, (b.top - ${cam.y}) / ${cam.k}, (b.right - ${cam.x}) / ${cam.k}, (b.bottom - ${cam.y}) / ${cam.k}].map((v) => +v.toFixed(1)); }; const s = document.querySelector('section[data-station="${id}"]'); return { section: R(s), title: R(s.querySelector("h2 button")), icon: R(s.querySelector(".lab-station-icon")), list: R(s.querySelector("ul")), chips: [...s.querySelectorAll("li button")].map(R), hotspot: R(document.querySelector('[data-hotspot="${id}"]')), transform: getComputedStyle(s).transform }; })()`);
const out = { cam, rest: {}, active: {}, map: {} };
for (const id of IDS) out.rest[id] = await rects(id);
out.map.rest = await map(0, 180, 1671, 800);
for (const id of IDS) {
  await L.hover(id);
  await L.settle((s) => POWERED[id](s[id]), 8000);
  await sleep(900);
  out.active[id] = await rects(id);
  out.map[id] = await map(0, 180, 1671, 800);
  await L.away();
  await sleep(1500);
}
writeFileSync(join(HERE, `geometry-${label}.json`), JSON.stringify(out) + "\n");
for (const id of IDS) console.log(id, "\n  rest  ", JSON.stringify(out.rest[id]), "\n  active", JSON.stringify(out.active[id]));
console.log(L.errors);
await page.close();
process.exit(0);
