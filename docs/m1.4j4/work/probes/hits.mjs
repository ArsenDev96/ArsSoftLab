// M1.4J.4: still pointers on Experience through its lift; its chips' and title's outlines; clicks before, during, lifted, returning.
import { writeFileSync } from "node:fs";
import { ARRIVE, IDS, POWERED, REST, open, sleep } from "../../../m1.4i/work/lib.mjs";
const A = ARRIVE.experience;
const [only] = process.argv.slice(2);
const want = (t) => !only || only.split(",").includes(t);
const L = await open("/lab-v2", { gpu: true });
const { page, cam } = L;
const S = ([x, y]) => [cam.x + x * cam.k, cam.y + y * cam.k];
const to = (p) => page.mouseMove(...S(p));
await page.eval(`(() => {
  window.__sparks = 0; window.__h = []; window.__c = []; window.__stop = false;
  const a = Element.prototype.animate; Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__sparks++; return a.apply(this, x); };
  const d = document.querySelector(".lab-camera").closest("main").querySelector("div.contents"); const now = () => { const v = d.dataset.labHover ?? "-"; if (window.__h.at(-1) !== v) window.__h.push(v); }; new MutationObserver(now).observe(d, { attributes: true }); now();
  window.addEventListener("click", (e) => { const b = e.target.closest?.("button"); window.__c.push(b ? b.textContent.trim() : e.target.dataset?.bridge ? "bridge" : e.target.dataset?.hotspot ? "hotspot " + e.target.dataset.hotspot : e.target.closest?.("[data-station]") ? "label" : "nothing"); if (window.__stop) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  return 1; })()`);
const mark = (stop) => page.eval(`(window.__stop = ${!!stop}, window.__c = [], window.__sparks = 0, window.__h = window.__h.slice(-1), 1)`);
const since = () => page.eval("({ c: window.__c, n: window.__sparks, h: window.__h, url: location.search })");
const under = (p) => page.eval(`(() => { const e = document.elementFromPoint(${S(p).join(",")}); return e?.dataset.hotspot ? "hotspot " + e.dataset.hotspot : e?.dataset.bridge ? "bridge " + e.dataset.bridge : e?.closest("li button") ? "chip " + e.textContent.trim() : e?.closest("h2 button") ? "title" : e?.closest("[data-station]") ? "label" : "nothing"; })()`);
const press = async (p, raw) => { const [x, y] = raw ?? S(p); await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };
const y = () => page.eval(`(-new DOMMatrix(getComputedStyle(document.querySelector(".exp-rise")).transform).f) || 0`);
const home = async () => { for (let k = 0; k < 3 && (await page.eval("location.search !== ''")); k++) { await page.key("Escape", "Escape", 27); await sleep(350); } await page.eval("(document.activeElement?.blur?.(), 1)"); await L.off(); if (!(await L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 8000))) throw new Error("not at rest"); await sleep(120); };
const out = {};
// 1. Every edge of the hotspot at rest, 1.5 px inside, plus points over the artwork: still for 2.4 s.
if (want("still")) {
  const poly = [[1206, 690], [1260, 650], [1388, 640], [1388, 515], [1532, 515], [1534, 598], [1610, 620], [1664, 668], [1664, 782], [1206, 782]];
  const c = [1450, 690], pts = [];
  poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; for (const t of [0.05, 0.35, 0.65, 0.95]) { const m = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], d = Math.hypot(c[0] - m[0], c[1] - m[1]); pts.push([m[0] + ((c[0] - m[0]) * 2) / d, m[1] + ((c[1] - m[1]) * 2) / d]); } });
  pts.push([1450, 610], [1400, 575], [1500, 530], [1400, 730], [1225, 720], [1640, 720], [1420, 776], [1300, 660]);
  out.still = [];
  for (const p of pts) {
    await home(); if ((await under(p)) !== "hotspot experience") continue;
    await mark(true); await to(p); await sleep(A + 1500);
    const u = await under(p), s0 = await since(); await press(p); await sleep(60); const s = await since();
    const r = { p: p.map((v) => +v.toFixed(1)), under: u, n: s.n, h: s0.h, click: s.c[0], y: await y() };
    r.bad = r.n !== 1 || s0.h.length !== 2 || s.c[0] !== "hotspot experience"; out.still.push(r); if (r.bad) console.log("!! still", JSON.stringify(r));
  }
  console.log(`still on the hotspot: ${out.still.length}, flagged ${out.still.filter((r) => r.bad).length}`);
}
// 2. Outlines of both chips and the title, whole pixels: still from rest through the lift, one click.
if (want("outline")) {
  out.outline = {};
  for (const [name, sel, text] of [["Koreez", "li:nth-child(1) button", "Koreez"], ["title", "h2 button", "Experience"]]) {
    await home();
    const px = await page.eval(`(() => { const b = document.querySelector('section[data-station="experience"] ${sel}'), r = b.getBoundingClientRect(), on = (x, y) => document.elementFromPoint(x, y)?.closest?.("button") === b, o = []; for (let y = Math.floor(r.top) - 4; y <= r.bottom + 4; y++) for (let x = Math.floor(r.left) - 2; x <= r.right + 2; x++) if (on(x, y) && !(on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) o.push([x, y]); return o; })()`);
    const step = Math.max(1, Math.floor(px.length / 60)), rows = [];
    for (const q of px.filter((_, i) => i % step === 0)) { await home(); await mark(true); await page.mouseMove(...q); await sleep(A + 900); await press(null, q); await sleep(50); const s = await since(); rows.push({ q, click: s.c[0], n: s.n, ok: s.c[0] === text && s.n === 1 && s.h.length === 2 }); }
    out.outline[name] = { of: px.length, tested: rows.length, bad: rows.filter((r) => !r.ok) };
    console.log(`${name}: outline ${px.length} px, tested ${rows.length}, lost ${rows.filter((r) => !r.ok).length} ${JSON.stringify(rows.filter((r) => !r.ok)).slice(0, 300)}`);
  }
}
// 3. Chips: real clicks before, during (four heights), lifted, and while it sinks; keyboard.
if (want("clicks")) {
  out.clicks = [];
  const box = await page.eval(`[...document.querySelectorAll('section[data-station="experience"] li button')].map((b) => { const r = b.getBoundingClientRect(); return [(r.left - ${cam.x}) / ${cam.k}, (r.top - ${cam.y}) / ${cam.k}, (r.right - ${cam.x}) / ${cam.k}, (r.bottom - ${cam.y}) / ${cam.k}]; })`);
  const url = ["?station=experience&project=koreez"];
  for (const [i, b] of box.entries()) for (const [side, p] of Object.entries({ centre: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], left: [b[0] + 1.5, (b[1] + b[3]) / 2], right: [b[2] - 1.5, (b[1] + b[3]) / 2], bottom: [(b[0] + b[2]) / 2, b[3] - 1.5] }))
    for (const t of [250, A + 120, A + 200, A + 320, A + 500, A + 1200, "sinking 100", "sinking 250"]) {
      await home(); await mark(false);
      if (typeof t === "number") { await to(p); await sleep(t); }
      else { await to([1450, 610]); await L.settle((s) => POWERED.experience(s.experience), 8000); await sleep(300); await L.off(); for (let k = 0; k < 200 && (await page.eval(`!!document.querySelector("[data-lab-hover]")`)); k++) await sleep(2); await sleep(+t.slice(8)); await to(p); }
      const h = await y(); await press(p); await sleep(600); const s = await since();
      const r = { chip: i + 1, side, t, lift: +h.toFixed(1), url: s.url, ok: s.url === url[i] }; out.clicks.push(r); if (!r.ok) console.log("!! click", JSON.stringify(r));
    }
  // the raised panel's top, the floor above the resting one, the foot of the raised platform, the raised left terrain edge
  const extra = [];
  await home(); await mark(false); await to([1450, 610]); await sleep(A + 1300); await to([1450, 510]); await sleep(300); extra.push(["raised panel top, hover held", await under([1450, 510]), (await since()).h.join()]); await press([1450, 510]); await sleep(600); extra.push(["raised panel top, click", (await since()).url]);
  await home(); await mark(false); await to([1450, 510]); await sleep(1200); extra.push(["floor above the resting target", await under([1450, 510]), (await since()).h.join(), (await since()).n]);
  await home(); await mark(false); await to([1420, 778]); await sleep(A + 1300); extra.push(["foot of the platform, raised", await under([1420, 778]), (await since()).h.join(), (await since()).n]); await press([1420, 778]); await sleep(600); extra.push(["...click", (await since()).url]);
  for (const [n, e] of [["empty lab left of the platform", [1120, 760]], ["empty lab right of the panel", [1600, 560]], ["empty lab above the panel", [1480, 430]]]) { await home(); await to([1450, 610]); await L.settle((q) => POWERED.experience(q.experience), 8000); await mark(false); await to(e); await sleep(1900); extra.push([n, await under(e), (await since()).h.join(), "lift " + (await y())]); }
  for (const key of [["Enter", 13], ["Space", 32]]) { await home(); await mark(false); await page.eval(`document.getElementById("station-experience-trigger").focus({ focusVisible: true })`); await page.key("Tab", "Tab", 9); await sleep(A + 300); const h = await y(); if (key[0] === "Space") { await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, text: " " }); await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 }); } else await page.key("Enter", "Enter", 13); await sleep(600); extra.push([`keyboard ${key[0]} on chip 1, lift ${h.toFixed(1)}`, (await since()).url]); }
  out.extra = extra; console.log(`clicks: ${out.clicks.length}, failed ${out.clicks.filter((r) => !r.ok).length}`); extra.forEach((e) => console.log("  ", JSON.stringify(e)));
}
out.errors = L.errors; console.log("errors", JSON.stringify(L.errors));
writeFileSync(`out/j4-hits${only ? "-" + only.replace(/,/g, "-") : ""}.json`, JSON.stringify(out) + "\n");
await page.close(); process.exit(0);
