// M1.4J.1 evidence: frozen frames at the sequence's own times, composed into sheets.   node sheets.mjs <out dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ARRIVE, launch, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const A = ARRIVE.engineering;
const clip = async (p, [x, y, w, h], scale) => (await p.page.send("Page.captureScreenshot", { format: "png", clip: { x: p.cam.x + x * p.cam.k, y: p.cam.y + y * p.cam.k, width: w * p.cam.k, height: h * p.cam.k, scale } })).data;
const STATES = [["Rest", "rest"], ["Spark arrival (+0 ms)", 0], ["25 % (+180 ms)", 180], ["50 % (+247 ms)", 247], ["Full, 12 px (+663 ms on)", 2400], ["Returning, halfway (150 ms after leaving)", "leave"], ["Returned", "back"]];
const R = { station: [225, 290, 440, 320], end: [500, 505, 140, 66], under: [245, 500, 390, 90], screen: [330, 360, 240, 130], ring: [540, 490, 100, 70] };
const shots = {}; // region -> [label, b64]
const info = [];
async function run(path, key) {
  shots[key] = {};
  const take = async (p, label) => {
    await sleep(350);
    const v = await p.page.eval(`(() => { const e = document.querySelector(".eng-rise"), g = document.querySelector("[data-v2-ground]"); return { y: -new DOMMatrix(getComputedStyle(e).transform).f || 0, el: +(+getComputedStyle(e).getPropertyValue("--el")).toFixed(3), soft: getComputedStyle(g).opacity, contact: getComputedStyle(document.querySelector('[data-v2-floor="contact-engineering"]')).opacity }; })()`);
    info.push([key, label, v]);
    shots[key][label] = { v };
    for (const [n, r] of Object.entries(R)) shots[key][label][n] = await clip(p, r, n === "station" ? 1.6 : n === "end" ? 5 : n === "ring" ? 6 : n === "under" ? 2.4 : 3.4);
    if (key === "default") shots[key][label].full = (await p.page.send("Page.captureScreenshot", { format: "png" })).data;
  };
  const p = await open(path, { gpu: true });
  await p.finish();
  await take(p, "Rest");
  const c = await p.page.center('[data-hotspot="engineering"]');
  await p.page.mouseMove(c.x, c.y); await p.frame();
  for (const [label, t] of STATES) if (typeof t === "number") { await p.seek(A + t); await take(p, label); }
  await p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`); await sleep(200);
  await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); queueMicrotask(() => document.getAnimations().forEach((a) => a.pause())); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
  await p.away(); await p.frame(); await p.seek(150); await take(p, STATES[5][0]);
  await p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`); await sleep(1300); await take(p, "Returned");
  await p.page.close();
}
await run("/lab-v2", "default");
await run("/lab-v2?floor=approved", "tone");
for (const [l, s] of Object.entries(shots.default)) writeFileSync(`${OUT}/full-${l.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`, Buffer.from(s.full, "base64"));
// Scan and chart while moving: own moments.
const moving = [];
{
  const p = await open("/lab-v2", { gpu: true }); await p.finish();
  const c = await p.page.center('[data-hotspot="engineering"]'); await p.page.mouseMove(c.x, c.y); await p.frame();
  for (const t of [140, 200, 280, 340, 400, 480]) { await p.seek(A + t); await sleep(300); const y = await p.page.eval(`-new DOMMatrix(getComputedStyle(document.querySelector(".eng-rise")).transform).f || 0`); moving.push([`+${t} ms, ${y.toFixed(1)} px up`, await clip(p, R.screen, 3)]); }
  await p.page.close();
}
// Heights.
const heights = [];
for (const px of [12, 14, 16]) {
  const p = await open("/lab-v2", { gpu: true });
  await p.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ".eng-lift{--eng-rise:round(nearest,calc(var(--u)*${px}),1px)!important}"; document.head.append(e); return 1; })()`);
  await p.finish(); const c = await p.page.center('[data-hotspot="engineering"]'); await p.page.mouseMove(c.x, c.y); await p.frame(); await p.seek(A + 2400); await sleep(400);
  heights.push([`${px} px${px === 12 ? " (chosen)" : ""}`, await clip(p, R.station, 1.4), await clip(p, [400, 345, 120, 45], 5)]);
  await p.page.close();
}
const px = await launch({ width: 1200, height: 800 });
await px.eval(`window.S = {}; 1`);
const put = async (k, b) => { for (let i = 0; i < b.length; i += 1 << 20) await px.eval(`(window.S[${JSON.stringify(k)}] = (window.S[${JSON.stringify(k)}] ?? "") + ${JSON.stringify(b.slice(i, i + (1 << 20)))}, 1)`); };
/** rows of cells [label, key]; every cell's image at its own size. */
async function sheet(file, title, rows) {
  const b = await px.eval(`(async () => { const rows = ${JSON.stringify(rows)}; const im = {}; for (const r of rows) for (const [, k] of r.cells) if (!im[k]) im[k] = await createImageBitmap(await (await fetch("data:image/png;base64," + window.S[k])).blob());
    const G = 12, H = 26, T = 44; let W = 0, Y = T; const place = []; for (const r of rows) { let x = G, mh = 0; if (r.title) { place.push(["t", r.title, G, Y + 16]); Y += 26; } for (const [l, k] of r.cells) { place.push(["i", k, x, Y + H, l]); x += im[k].width + G; mh = Math.max(mh, im[k].height); } W = Math.max(W, x); Y += H + mh + G; }
    const c = document.createElement("canvas"); c.width = W; c.height = Y; const g = c.getContext("2d"); g.fillStyle = "#101114"; g.fillRect(0, 0, W, Y); g.fillStyle = "#fff"; g.font = "600 20px sans-serif"; g.fillText(${JSON.stringify(title)}, G, 29);
    for (const p of place) if (p[0] === "t") { g.fillStyle = "#ffc56c"; g.font = "600 15px sans-serif"; g.fillText(p[1], p[2], p[3]); } else { g.drawImage(im[p[1]], p[2], p[3]); g.fillStyle = "#d2d3d5"; g.font = "14px sans-serif"; g.fillText(p[4], p[2], p[3] - 8); }
    window.O = c.toDataURL("image/png").split(",")[1]; return window.O.length; })()`);
  let o = ""; for (let i = 0; i < b; i += 1 << 20) o += await px.eval(`window.O.slice(${i}, ${i + (1 << 20)})`);
  writeFileSync(`${OUT}/${file}`, Buffer.from(o, "base64")); console.log(file, Math.round((o.length * 3) / 4 / 1024), "kB");
}
for (const key of ["default", "tone"]) for (const [l, s] of Object.entries(shots[key])) for (const n of Object.keys(R)) await put(`${key}|${l}|${n}`, s[n]);
for (const [l, b] of moving) await put(`m|${l}`, b);
for (const [l, b, d] of heights) { await put(`h|${l}`, b); await put(`hc|${l}`, d); }
const lab = STATES.map(([l]) => l), cell = (l, n, key = "default") => [`${l}: ${shots[key][l].v.y.toFixed(1)} px up`, `${key}|${l}|${n}`];
await sheet("engineering-lift-phases.png", "M1.4J.1 Engineering lift, 1648 x 928 (frozen at the sequence's own times; enlarged 1.6x)", [
  { cells: lab.slice(0, 2).map((l) => cell(l, "station")) }, { cells: lab.slice(2, 4).map((l) => cell(l, "station")) }, { cells: lab.slice(4, 6).map((l) => cell(l, "station")) }, { cells: [cell(lab[6], "station"), [`Full, ?floor=approved`, `tone|${lab[4]}|station`]] },
]);
await sheet("engineering-lift-closeup.png", "M1.4J.1 close-ups", [
  { title: "Scan and bars while the station rises (3x)", cells: moving.slice(0, 2).map(([l]) => [l, `m|${l}`]) }, { cells: moving.slice(2, 4).map(([l]) => [l, `m|${l}`]) }, { cells: moving.slice(4, 6).map(([l]) => [l, `m|${l}`]) },
  { title: "Underside and exposed floor (2.4x): rest, half, full", cells: [cell(lab[0], "under")] }, { cells: [cell(lab[3], "under")] }, { cells: [cell(lab[4], "under")] },
  { title: "Floor ring at the right end (6x): rest, full", cells: [cell(lab[0], "ring"), cell(lab[4], "ring")] },
]);
await sheet("connection-and-shadow.png", "M1.4J.1 the connection's end and the ground shadow", [
  { title: "Connection (5x): rest, half, full, returning halfway", cells: [cell(lab[0], "end"), cell(lab[3], "end")] }, { cells: [cell(lab[4], "end"), cell(lab[5], "end")] },
  { title: "Contact (resting) and soft shadow (raised), default floor", cells: [cell(lab[0], "under")] }, { cells: [cell(lab[3], "under")] }, { cells: [cell(lab[4], "under")] }, { cells: [cell(lab[5], "under")] },
  { title: "?floor=approved, full", cells: [cell(lab[4], "under", "tone")] },
]);
await sheet("lift-height-comparison.png", "M1.4J.1 lift heights; the lid against the SQLOrbit chip", [{ cells: heights.map(([l]) => [l, `h|${l}`]) }, { cells: heights.map(([l]) => [l, `hc|${l}`]) }]);
// Hit regions: rest and raised, from the recorded maps.
const M = JSON.parse(readFileSync("out/j1-refs-after.json")), B = JSON.parse(readFileSync("out/j1-refs-before.json"));
const cut = (m) => { const r = []; for (let y = 290; y < 620; y += 2) r.push(m[(y - 100) / 2].slice((220 - 2) / 2, (680 - 2) / 2)); return r; };
await put("bg|rest", shots.default[lab[0]].station); await put("bg|full", shots.default[lab[4]].station);
const bg = [["rest", `default|${lab[0]}|full`, cut(M.rest)], ["full", `default|${lab[4]}|full`, cut(M.engineering)], ["before", null, cut(B.engineering)]];
await put("f|rest", shots.default[lab[0]].full); await put("f|full", shots.default[lab[4]].full);
const n = await px.eval(`(async () => { const maps = ${JSON.stringify(bg.map(([a, , m]) => [a, m]))}; const im = {}; for (const k of ["rest", "full"]) im[k] = await createImageBitmap(await (await fetch("data:image/png;base64," + window.S["f|" + k])).blob());
  const K = 1648 / 1672, Z = 2.2, W = 460, Hh = 330; const cx = (1648 - 1672 * K) / 2, k = K; const c = document.createElement("canvas"); c.width = 3 * (W * Z) + 48; c.height = Hh * Z + 90; const g = c.getContext("2d"); g.fillStyle = "#101114"; g.fillRect(0, 0, c.width, c.height);
  const col = { e: "rgba(0,230,120,.42)", E: "rgba(80,150,255,.5)", "1": "rgba(255,200,0,.38)", c: "rgba(255,60,120,.4)", C: "rgba(255,60,120,.6)", N: "rgba(255,255,255,.2)" };
  const off = ${JSON.stringify(0)}; const cam = ${JSON.stringify(null)};
  const panel = (i, title, img, map, base) => { const X = 12 + i * (W * Z + 12); g.drawImage(im[img], 220 * k + ${0}, 290 * k - 0.0, W * k, Hh * k, X, 60, W * Z, Hh * Z); map.forEach((r, y) => [...r].forEach((ch, x) => { const t = base && base[y][x] !== ch ? "rgba(255,120,0,.75)" : col[ch]; if (!t) return; g.fillStyle = t; g.fillRect(X + x * 2 * Z, 60 + y * 2 * Z, 2 * Z, 2 * Z); })); g.fillStyle = "#fff"; g.font = "600 17px sans-serif"; g.fillText(title, X, 48); };
  const by = Object.fromEntries(maps); panel(0, "At rest (unchanged: 0 points)", "rest", by.rest); panel(1, "Powered and raised, now", "full", by.full); panel(2, "Orange: points that changed against before the lift (918 of 305,090)", "full", by.full, by.before);
  g.fillStyle = "#d2d3d5"; g.font = "14px sans-serif"; g.fillText("green: Engineering's target   blue: its label and chips   yellow: the bridge (holds only)   pink: Creative Studio", 12, 22); window.O = c.toDataURL("image/png").split(",")[1]; return window.O.length; })()`);
let o = ""; for (let i = 0; i < n; i += 1 << 20) o += await px.eval(`window.O.slice(${i}, ${i + (1 << 20)})`);
writeFileSync(`${OUT}/hit-region-comparison.png`, Buffer.from(o, "base64"));
writeFileSync(`${OUT}/states.json`, JSON.stringify(info, null, 0) + "\n");
console.log(JSON.stringify(info.filter((x) => x[0] === "default").map(([, l, v]) => [l, v])));
await px.close();
process.exit(0);
