// M1.4I.2.1: Playground's AZIZ chip under a still pointer, before / during / after the lift, returning, re-entry, keyboard.
//   node chip-fix.mjs <label> [candidate|none] [phase,phase]      (candidate: the one-line fix, injected)
import { writeFileSync } from "node:fs";
import { IDS, POWERED, REST, open, sleep } from "../../../../m1.4i/work/lib.mjs";
const [label = "run", variant = "none", phases] = process.argv.slice(2);
const want = (p) => !phases || phases.split(",").includes(p);
const L = await open("/lab-v2", { gpu: true });
const { page, cam } = L;
const S = ([x, y]) => [cam.x + x * cam.k, cam.y + y * cam.k];
const to = (p) => page.mouseMove(...S(p));
if (variant === "candidate") await page.eval(`(() => { const e = document.createElement("style"); e.textContent = '@media (prefers-reduced-motion: no-preference){[data-lab-hover="playground"]:not([data-lab-selected="playground"]) #lab-stations [data-lift="playground"] .lab-chip:hover::after{top:50%!important;height:calc(50% + var(--u) * 20)!important}}'; document.head.append(e); return 1; })()`);
await page.eval(`(() => {
  window.__sparks = 0; window.__h = []; window.__clicks = [];
  const a = Element.prototype.animate;
  Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__sparks++; return a.apply(this, x); };
  const d = document.querySelector(".lab-camera").closest("main").querySelector("div.contents");
  const now = () => { const v = d.dataset.labHover ?? "-"; if (window.__h.at(-1) !== v) window.__h.push(v); };
  new MutationObserver(now).observe(d, { attributes: true }); now();
  window.addEventListener("click", (e) => { const b = e.target.closest?.("button"); window.__clicks.push(b ? b.textContent.trim() : e.target.dataset?.bridge ? "bridge" : e.target.dataset?.hotspot ? "hotspot" : e.target.closest?.("[data-station]") ? "label" : "nothing"); if (window.__stop) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  return 1; })()`);
const mark = (stop) => page.eval(`(window.__stop = ${!!stop}, window.__clicks = [], window.__sparks = 0, window.__h = window.__h.slice(-1), 1)`);
const since = () => page.eval("({ clicks: window.__clicks, sparks: window.__sparks, h: window.__h, url: location.search })");
const press = async (p) => {
  const [x, y] = S(p);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};
const under = (p) => page.eval(`(() => { const e = document.elementFromPoint(${S(p).join(",")}); return e?.dataset.hotspot ? "hotspot" : e?.dataset.bridge ? "bridge" : e?.closest("li button") ? "chip" : e?.closest("h2 button") ? "title" : e?.closest("[data-station]") ? "label" : "nothing"; })()`);
const lift = async () => (await L.read()).playground.lift;
const settled = () => L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 8000);
const home = async () => {
  for (let k = 0; k < 3 && (await page.eval("location.search !== ''")); k++) { await page.key("Escape", "Escape", 27); await sleep(350); }
  await page.eval("(document.activeElement?.blur?.(), 1)");
  await L.off();
  if (!(await settled())) throw new Error("not at rest: " + JSON.stringify((await L.read()).playground));
  await sleep(100);
};
const AZ = "?station=playground&project=aziz";
// The chip at rest, scene px (measured here).
await settled();
const R = await page.eval(`(() => { const r = document.querySelector('section[data-station="playground"] li button').getBoundingClientRect(); return [(r.left - ${cam.x}) / ${cam.k}, (r.top - ${cam.y}) / ${cam.k}, (r.right - ${cam.x}) / ${cam.k}, (r.bottom - ${cam.y}) / ${cam.k}]; })()`);
const [X0, Y0, X1, Y1] = R, r = (Y1 - Y0) / 2, cy = (Y0 + Y1) / 2;
/** Points d px inside the pill's outline: n along each straight side, m round each end. */
const ring = (d, n, m) => {
  const p = [];
  for (let k = 0; k < n; k++) { const x = X0 + r + ((X1 - X0 - 2 * r) * (k + 0.5)) / n; p.push([x, Y0 + d, "top"], [x, Y1 - d, "bottom"]); }
  for (let k = 0; k < m; k++) { const t = -Math.PI / 2 + (Math.PI * (k + 0.5)) / m; p.push([X0 + r - (r - d) * Math.cos(t), cy + (r - d) * Math.sin(t), "left"], [X1 - r + (r - d) * Math.cos(t), cy + (r - d) * Math.sin(t), "right"]); }
  return p;
};
const inner = [[(X0 + X1) / 2, cy, "centre"]];
const out = { label, variant, chip: R, rows: [] };
const rec = (row) => { out.rows.push(row); if (!row.ok) console.log("  !!", JSON.stringify(row)); };
const start = async (q) => { await home(); return (await under(q)) === "chip"; };

if (want("lifted")) for (const [x, y, side] of [...ring(0.5, 5, 9), ...ring(3, 3, 5), ...inner]) {
  const q = [x, y];
  if (!(await start(q))) { out.rows.push({ phase: "lifted", side, q, skip: true, ok: true }); continue; }
  await mark(false); await to(q); await sleep(1500);
  const u = await under(q), h = await lift();
  await press(q); await sleep(500);
  const s = await since();
  rec({ phase: "lifted", side, q: q.map((v) => +v.toFixed(1)), lift: h, under: u, clicks: s.clicks, url: s.url, sparks: s.sparks, h: s.h, ok: s.url === AZ && s.sparks === 1 });
}
if (want("before")) for (const [x, y, side] of [...ring(0.5, 2, 4), ...inner]) {
  const q = [x, y];
  if (!(await start(q))) continue;
  await mark(false); await to(q); await sleep(300);
  const h = await lift();
  await press(q); await sleep(600);
  const s = await since();
  rec({ phase: "before", side, q: q.map((v) => +v.toFixed(1)), lift: h, clicks: s.clicks, url: s.url, ok: s.url === AZ && h === 0 });
}
if (want("during")) for (const t of [700, 780, 860, 940, 1020]) for (const [x, y, side] of [...ring(0.5, 2, 4), ...inner]) {
  const q = [x, y];
  if (!(await start(q))) continue;
  await mark(true); await to(q);
  await page.eval(`new Promise((r) => setTimeout(r, ${t - 15}))`);
  const h = await lift();
  await press(q); await sleep(120);
  const a = await since();
  await sleep(700);
  const u = await under(q), s = await since();
  rec({ phase: "during", t, side, q: q.map((v) => +v.toFixed(1)), lift: h, clicks: a.clicks, underAfter: u, sparks: s.sparks, ok: a.clicks[0] === "AZIZ" && u === "chip" && s.sparks === 1 });
}
if (want("duringReal")) for (const [x, y, side] of [...ring(0.5, 1, 4)]) {
  const q = [x, y];
  if (!(await start(q))) continue;
  await mark(false); await to(q);
  await page.eval("new Promise((r) => setTimeout(r, 830))");
  const h = await lift();
  await press(q); await sleep(600);
  const s = await since();
  rec({ phase: "duringReal", side, q: q.map((v) => +v.toFixed(1)), lift: h, clicks: s.clicks, url: s.url, ok: s.url === AZ });
}
// The chip as it is drawn now (scene px), and points on it.
const now = () => page.eval(`(() => { const r = document.querySelector('section[data-station="playground"] li button').getBoundingClientRect(); return [(r.left - ${cam.x}) / ${cam.k}, (r.top - ${cam.y}) / ${cam.k}, (r.right - ${cam.x}) / ${cam.k}, (r.bottom - ${cam.y}) / ${cam.k}]; })()`);
const on = (b, side) => { const d = 1.5, mx = (b[0] + b[2]) / 2, my = (b[1] + b[3]) / 2; return { centre: [mx, my], left: [b[0] + d, my], right: [b[2] - d, my], top: [mx, b[1] + d], bottom: [mx, b[3] - d], leftLow: [b[0] + 5, my + 8], rightLow: [b[2] - 5, my + 8] }[side]; };
// Returning to rest: the station is going down, the pointer comes to rest on the chip where it is drawn at that moment.
if (want("returning")) for (const gap of [0, 80, 160, 260, 380]) for (const side of ["centre", "left", "right", "top", "bottom", "leftLow", "rightLow"]) {
  await home(); await mark(true);
  await to([1200, 400]); await L.settle((s) => POWERED.playground(s.playground), 8000); await sleep(100);
  await L.off();
  for (let k = 0; k < 200 && (await page.eval(`!!document.querySelector("[data-lab-hover]")`)); k++) await sleep(2);
  await sleep(gap);
  const b = await now(), h = await lift(), q = on(b, side);
  await mark(true);
  await to(q); await sleep(30);
  const u0 = await under(q);
  await sleep(1570);
  const u = await under(q);
  await press(q); await sleep(120);
  const s = await since();
  // Only a pointer that did land on the visible chip counts (it moves while the command travels).
  rec({ phase: "returning", gap, side, q: q.map((v) => +v.toFixed(1)), liftAtReturn: h, landed: u0, under: u, clicks: s.clicks, sparks: s.sparks, skip: u0 !== "chip", ok: u0 !== "chip" || (s.clicks[0] === "AZIZ" && s.sparks === 1) });
}
// Rapid re-entry at the same point: while the spark travels (inside and outside the grace), and on the raised chip.
if (want("reentry")) for (const side of ["centre", "left", "right", "top", "bottom", "leftLow", "rightLow"]) for (const [state, gap] of [["charging", 20], ["charging", 60], ["charging", 140], ["charging", 300], ["raised", 20], ["raised", 60], ["raised", 110]]) {
  await home(); await mark(true);
  let q;
  if (state === "charging") { q = on(R, side); await to(q); await sleep(250); }
  else { await to([1200, 400]); await L.settle((s) => POWERED.playground(s.playground), 8000); await sleep(100); q = on(await now(), side); await to(q); await sleep(100); }
  await L.off(); await sleep(gap);
  await mark(true); await to(q); await sleep(30);
  const u0 = await under(q);
  await sleep(1570);
  const u = await under(q);
  await press(q); await sleep(120);
  const s = await since();
  rec({ phase: "reentry", state, gap, side, landed: u0, under: u, clicks: s.clicks, sparks: s.sparks, skip: u0 !== "chip", ok: u0 !== "chip" || (s.clicks[0] === "AZIZ" && s.sparks <= 1) });
}
if (want("keyboard")) for (const [when, t] of [["before", 200], ["during", 850], ["lifted", 1500]]) for (const [key, code, kc] of [["Enter", "Enter", 13], [" ", "Space", 32]]) for (const mouse of ["away", "on the chip's left end"]) {
  await home(); await mark(false);
  if (mouse !== "away") { await to([X0 + 2, cy]); await sleep(60); }
  await page.eval(`document.getElementById("station-playground-trigger").focus({ focusVisible: true })`);
  await page.key("Tab", "Tab", 9);
  const f = await page.eval("document.activeElement.textContent.trim()");
  await sleep(t);
  const h = await lift();
  if (key === " ") { await page.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: kc, text: " " }); await page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: kc }); }
  else await page.key(key, code, kc);
  await sleep(600);
  const s = await since();
  rec({ phase: "keyboard", when, key: code, mouse, focus: f, lift: h, url: s.url, ok: s.url === AZ && f === "AZIZ" });
}
out.errors = L.errors;
writeFileSync(`out/chipfix-${label}.json`, JSON.stringify(out) + "\n");
const g = {};
for (const x of out.rows) { const k = (g[x.phase] ??= { runs: 0, failed: 0, skipped: 0, bySide: {} }); if (x.skip) { k.skipped++; continue; } k.runs++; if (!x.ok) { k.failed++; k.bySide[x.side ?? x.when] = (k.bySide[x.side ?? x.when] ?? 0) + 1; } }
console.log(label, variant, "chip", R.map((v) => v.toFixed(1)).join(), JSON.stringify(g), "errors", JSON.stringify(L.errors));
await page.close();
process.exit(0);
