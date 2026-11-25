// M1.4K section 6: hover and clicks on all five moving stations. Real pointer, real time.   node k6-hits.mjs [test,test] [station,station]
import { ARRIVE, HEIGHT, IDS, POWERED, SEQ, lab, out, sleep } from "./core.mjs";
const [tests, which] = process.argv.slice(2).map((x) => x.split(","));
const want = (t) => !tests || tests[0] === "all" || tests.includes(t);
const ids = IDS.filter((i) => !which || which.includes(i));
const L = await lab();
const { page } = L;
const PROJ = { engineering: ["sqlorbit", "tablerefresh"], educational: ["arimap", "armat"], playground: ["aziz"], creative: ["wallpapers"], experience: ["koreez"] };
const POLY = {
  engineering: [[262, 505], [290, 480], [338, 472], [340, 388], [470, 384], [540, 410], [548, 462], [592, 490], [600, 530], [566, 553], [340, 553], [336, 545], [262, 540]],
  educational: [[676, 400], [690, 352], [730, 316], [790, 292], [860, 288], [930, 300], [996, 308], [996, 350], [985, 420], [996, 440], [996, 492], [680, 492], [672, 450]],
  playground: [[1060, 505], [1095, 478], [1112, 400], [1130, 352], [1262, 352], [1270, 452], [1330, 458], [1372, 490], [1376, 540], [1340, 556], [1100, 556], [1060, 540]],
  creative: [[92, 700], [140, 660], [160, 560], [176, 548], [332, 548], [336, 650], [440, 662], [506, 690], [508, 748], [470, 780], [100, 780]],
  experience: [[1206, 690], [1260, 650], [1388, 640], [1388, 515], [1532, 515], [1534, 598], [1610, 620], [1664, 668], [1664, 782], [1206, 782]],
};
const MID = { engineering: [440, 490], educational: [836, 400], playground: [1210, 470], creative: [280, 690], experience: [1450, 690] };
const ART = { engineering: [[405, 430], [440, 470], [515, 440], [430, 525]], educational: [[838, 350], [780, 400], [900, 420], [838, 480]], playground: [[1190, 335], [1180, 420], [1290, 480], [1215, 530]], creative: [[250, 600], [300, 620], [370, 690], [300, 740]], experience: [[1450, 610], [1400, 560], [1450, 690], [1400, 740]] };
await page.eval(`(() => { window.__c = []; window.__stop = false; window.__h = []; const now = () => { const v = document.querySelector("[data-lab-hover]")?.dataset.labHover ?? "-"; if (window.__h.at(-1) !== v) window.__h.push(v); }; new MutationObserver(now).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); now();
  window.addEventListener("click", (e) => { const b = e.target.closest?.("button"); window.__c.push(b ? b.textContent.trim() : e.target.dataset?.bridge ? "bridge" : e.target.dataset?.hotspot ? "hotspot " + e.target.dataset.hotspot : e.target.closest?.("[data-station]") ? "label" : "nothing"); if (window.__stop) { e.stopImmediatePropagation(); e.preventDefault(); } }, true); return 1; })()`);
const mark = (stop) => page.eval(`(window.__stop = ${!!stop}, window.__c = [], window.__sparks.length = 0, window.__h = window.__h.slice(-1), 1)`);
const since = () => page.eval("({ c: window.__c, n: window.__sparks.length, h: window.__h, url: location.search })");
const press = async ([x, y]) => { await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };
const R = {};
const add = (t, r) => (R[t] ??= []).push(r);
const under = ([x, y]) => page.eval(`(() => { const e = document.elementFromPoint(${x}, ${y}); return e?.dataset.hotspot ? "hotspot " + e.dataset.hotspot : e?.dataset.bridge ? "bridge " + e.dataset.bridge : e?.closest("li button") ? e.textContent.trim() : e?.closest("h2 button") ? "title" : e?.closest("[data-station]") ? "label" : "nothing"; })()`);
for (const id of ids) {
  const A = ARRIVE[id];
  // Chips, real clicks with real navigation: before, charging, ascent (2), raised, sinking (2); centre and both ends.
  if (want("chips")) for (let c = 0; c < PROJ[id].length; c++) for (const where of ["centre", "left end", "right end"]) for (const t of ["at once", 250, A + 130, A + 300, A + 600, A + SEQ[id] + 300, "sinking 120", "sinking 260"]) {
    await L.home(); await mark(false);
    const b = await page.eval(`(() => { const r = document.querySelectorAll('section[data-station="${id}"] li button')[${c}].getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()`);
    const p = [where === "centre" ? (b[0] + b[2]) / 2 : where === "left end" ? b[0] + 2.5 : b[2] - 2.5, (b[1] + b[3]) / 2];
    if (typeof t === "number") { await page.mouseMove(...p); await sleep(t); }
    else if (t === "at once") await page.mouseMove(...p);
    else { await L.on(id); await L.settle((s) => POWERED[id](s[id]), 8000); await sleep(250); await L.off(); await L.hovUntil(null); await sleep(+t.slice(8)); await page.mouseMove(...p); }
    const y = (await L.st())[id].y; await press(p); await sleep(450); const s = await since();
    const r = { id, chip: PROJ[id][c], where, t, y, url: s.url, ok: s.url === `?station=${id}&project=${PROJ[id][c]}`, hit: s.c[0] };
    // Playground's chip rises with its label: while it sinks, the place it had at rest may not be the chip's yet.
    add("chips", r); if (!r.ok) console.log("!! chip", JSON.stringify(r));
  }
  // A still pointer through the whole lift: artwork and the hotspot's outline, 2 px inside.
  if (want("still")) {
    const poly = POLY[id], m = MID[id], pts = [...ART[id]];
    poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; for (const t of [0.1, 0.5, 0.9]) { const x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], d = Math.hypot(m[0] - x[0], m[1] - x[1]); pts.push([x[0] + ((m[0] - x[0]) * 2) / d, x[1] + ((m[1] - x[1]) * 2) / d]); } });
    for (const p0 of pts) {
      const p = L.S(p0);
      await L.home(); if ((await under(p)) !== "hotspot " + id) continue;
      await mark(true); await page.mouseMove(...p); await sleep(A + 1100);
      const u = await under(p), s0 = await since(); await press(p); await sleep(40); const s = await since();
      const r = { id, p: p0.map((v) => +v.toFixed(1)), under: u, n: s.n, h: s0.h, click: s.c[0] };
      r.ok = r.n === 1 && s0.h.length === 2 && s0.h[1] === id && [`hotspot ${id}`, "bridge"].includes(r.click) ? true : false;
      if (r.click === "bridge") r.note = "holds, click does nothing";
      r.ok = r.ok && r.click === `hotspot ${id}`;
      add("still", r); if (!r.ok) console.log("!! still", JSON.stringify(r));
    }
  }
  // Outlines of the title and the chips, whole px: still from rest through the lift, one click (recorded, not followed).
  if (want("outline")) for (const [sel, n] of [["h2 button", 1], ...PROJ[id].map((_, k) => [`li:nth-child(${k + 1}) button`, 1])]) {
    await L.home();
    const q = await page.eval(`(() => { const b = document.querySelector('section[data-station="${id}"] ${sel}'), r = b.getBoundingClientRect(), on = (x, y) => document.elementFromPoint(x, y)?.closest?.("button") === b, o = []; for (let y = Math.floor(r.top) - 3; y <= r.bottom + 3; y++) for (let x = Math.floor(r.left) - 2; x <= r.right + 2; x++) if (on(x, y) && !(on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) o.push([x, y]); return { o, text: b.textContent.trim(), box: [r.left, r.top, r.right, r.bottom] }; })()`);
    const full = id === "playground" && sel === "h2 button", step = full ? 1 : Math.max(1, Math.floor(q.o.length / 30)), bad = [];
    const px = q.o.filter((_, i) => i % step === 0);
    for (const p of px) { await L.home(); await mark(true); await page.mouseMove(...p); await sleep(A + 800); await press(p); await sleep(40); const s = await since(); if (!((s.c[0] === q.text || (full && s.c[0] === "AZIZ")) && s.n === 1 && s.h.length === 2)) bad.push([...p, s.c[0], s.n, s.h.join()]); }
    add("outline", { id, what: q.text, box: q.box.map((v) => +v.toFixed(2)), outline: q.o.length, tested: px.length, bad });
    console.log("outline", id, q.text, "px", q.o.length, "tested", px.length, "lost", bad.length, JSON.stringify(bad).slice(0, 900));
  }
}
for (const t of ["chips", "still"]) if (R[t]) for (const id of ids) { const q = R[t].filter((r) => r.id === id); if (q.length) console.log(t, id, "tested", q.length, "failed", q.filter((r) => !r.ok).length); }
console.log("errors", JSON.stringify(L.errors));
await out("k6-hits" + (tests ? "-" + tests.join("-") : "") + (which ? "-" + which.join("-") : ""), R); await page.close(); process.exit(0);
