// M1.4K section 6: who owns every point of the scene (2 scene px grid), at rest and with each station powered; against the homepage too.
import { IDS, POWERED, REST, lab, out, sleep } from "./core.mjs";
const CH = { engineering: "e", educational: "d", playground: "p", creative: "c", experience: "x" };
const MAP = (cam) => `(() => { const C = ${JSON.stringify(CH)}; const rows = []; for (let y = 100; y <= 830; y += 2) { let r = ""; for (let x = 2; x <= 1670; x += 2) { const e = document.elementFromPoint(${cam.x} + (x + 0.31) * ${cam.k}, ${cam.y} + (y + 0.17) * ${cam.k}); const h = e?.dataset?.hotspot, s = e?.closest?.("[data-station]")?.dataset.station, b = e?.dataset?.bridge; r += h ? C[h] : s ? C[s].toUpperCase() : b ? "1" : e?.closest?.("header,a,button") ? "N" : "."; } rows.push(r); } return rows; })()`;
const L = await lab(); const o = {};
o.rest = await L.page.eval(MAP(L.cam));
for (const id of IDS) {
  await L.rest(); await L.on(id); await L.settle((s) => POWERED[id](s[id]), 9000); await sleep(900);
  o[id] = await L.page.eval(MAP(L.cam));
  const ch = {}, lost = {};
  o.rest.forEach((r, j) => [...r].forEach((v, i) => { const w = o[id][j][i]; if (v !== w) { const k = v + ">" + w; ch[k] = (ch[k] ?? 0) + 1; if (v !== "." && v !== "1" && v.toLowerCase() !== CH[id]) (lost[k] ??= []).push([2 + 2 * i, 100 + 2 * j]); } }));
  console.log(id, "points changed when powered (from>to; each 4 sq px):", JSON.stringify(ch), "| another station's points taken:", JSON.stringify(Object.fromEntries(Object.entries(lost).map(([k, v]) => [k, v.length, v.slice(0, 3)]))));
}
const count = (m) => { const c = {}; m.forEach((r) => [...r].forEach((v) => (c[v] = (c[v] ?? 0) + 1))); return c; };
console.log("at rest", JSON.stringify(count(o.rest)));
// After use, at rest again, and the empty lab: nothing starts anywhere outside the hotspots and labels.
await L.rest(); const again = await L.page.eval(MAP(L.cam)); let d = 0; again.forEach((r, j) => [...r].forEach((v, i) => (d += v !== o.rest[j][i]))); console.log("rest after use differs at", d, "points");
const empty = []; for (let k = 0; k < 400 && empty.length < 40; k++) { const j = (k * 53) % o.rest.length, i = (k * 197) % o.rest[0].length; if (o.rest[j][i] === ".") empty.push([2.31 + 2 * i, 100.17 + 2 * j]); }
await L.page.eval("(window.__sparks.length = 0, 1)"); for (const p of empty) { await L.to(p); await sleep(160); } console.log("empty points visited", empty.length, "sparks", await L.page.eval("window.__sparks.length"));
await L.page.close(); await out("k6b-map", o); process.exit(0);
