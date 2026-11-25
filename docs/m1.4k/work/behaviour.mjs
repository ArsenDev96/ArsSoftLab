// M1.4I.1E: what the bridges must not do, and the lift's intermediate positions. Dev server on :3002.
//   node docs/m1.4i1e/work/behaviour.mjs [test,test]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARRIVE, IDS, POWERED, REST, open, sleep } from "./lib.mjs";
import { P, raise } from "./points.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2]?.split(",");
const BRIDGES = JSON.parse(readFileSync(join(HERE, "bridges.json")));
const inside = (poly, [x, y]) => { let r = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) r = !r; return r; };
// A point in the open part of each bridge (neither hotspot nor label).
const OPEN = { engineering: [585, 430], educational: [815, 262], playground: [1365, 420], creative: [520, 625], experience: [1240, 630] };
const CH = { engineering: "e", educational: "d", playground: "p", creative: "c", experience: "x" };
const out = {};

async function lab(path = "/lab-v2", opts = {}) {
  const L = await open(path, { gpu: true, ...opts });
  const S = ([x, y]) => [L.cam.x + x * L.cam.k, L.cam.y + y * L.cam.k];
  const to = (p) => L.page.mouseMove(...S(p));
  await L.page.eval(`(() => {
    window.__h = []; window.__sparks = 0;
    const d = document.querySelector(".lab-camera").closest("main").querySelector("div.contents");
    const now = () => { const v = d.dataset.labHover ?? "-"; if (window.__h.at(-1) !== v) window.__h.push(v); };
    new MutationObserver(now).observe(d, { attributes: true }); now();
    const a = Element.prototype.animate; Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__sparks++; return a.apply(this, x); };
    return 1;
  })()`);
  const mark = () => L.page.eval("(window.__h = window.__h.slice(-1), window.__sparks = 0, 1)");
  const since = () => L.page.eval("({ h: window.__h, sparks: window.__sparks })");
  const hov = () => L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
  const sel = () => L.page.eval(`document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null`);
  const park = async () => { await L.off(); await L.settle((s) => s.hover === null && IDS.every((i) => REST[i](s[i])), 7000); await sleep(120); };
  const under = (p) => L.page.eval(`(() => { const e = document.elementFromPoint(${S(p).join(",")}); return e?.dataset.hotspot ? "hotspot " + e.dataset.hotspot : e?.dataset.bridge ? "bridge " + e.dataset.bridge : e?.closest("li button") ? "chip" : e?.closest("h2 button") ? "title" : e?.closest("[data-station]") ? "label" : "nothing"; })()`);
  // Hit map of the scene (scene px): hotspot e d p c x, label E D P C X, bridge 1, other control N.
  const map = (x0 = 2, y0 = 100, x1 = 1670, y1 = 800, step = 2) => L.page.eval(`(() => { const C = ${JSON.stringify(CH)}; const rows = []; for (let y = ${y0}; y <= ${y1}; y += ${step}) { let r = ""; for (let x = ${x0}; x <= ${x1}; x += ${step}) { const e = document.elementFromPoint(${L.cam.x} + (x + 0.01) * ${L.cam.k}, ${L.cam.y} + (y + 0.01) * ${L.cam.k}); const h = e?.dataset?.hotspot, s = e?.closest?.("[data-station]")?.dataset.station, b = e?.dataset?.bridge; r += h ? C[h] : s ? C[s].toUpperCase() : b ? "1" : e?.closest?.("header,a,button") ? "N" : "."; } rows.push(r); } return rows; })()`);
  const url = () => L.page.eval("location.pathname + location.search");
  return { ...L, S, to, mark, since, hov, sel, park, under, map, url };
}

const T = {
  /** At rest a bridge is not there: standing in it starts nothing. Active, it holds; leaving lets go. */
  async hold() {
    const L = await lab();
    for (const id of IDS) {
      const p = OPEN[id], r = (out.hold[id] = {});
      await L.park(); await L.mark();
      await L.to(p); await sleep(1200);
      r.restUnder = await L.under(p);
      r.startsFromEmpty = (await L.since()).sparks;
      await L.park(); await L.mark();
      await L.to(P[id].art); await L.settle((s) => POWERED[id](s[id]), 8000);
      await L.to(p); await sleep(3500);
      const s = await L.since();
      r.holds = { under: await L.under(p), changes: s.h, sparks: s.sparks, powered: POWERED[id]((await L.read())[id]) };
      r.cursor = await L.page.eval(`getComputedStyle(document.querySelector('[data-bridge="${id}"]')).cursor`);
      await L.page.click(...L.S(p)); await sleep(500);
      r.clickSelects = await L.sel();
      // Out for 40 ms and back (inside the grace): still held. Out for good: at rest.
      await L.mark();
      await L.to(P[id].empty); await sleep(40); await L.to(p); await sleep(600);
      r.backWithinGrace = (await L.since()).h;
      await L.to(P[id].empty);
      r.leavesToRest = await L.settle((x) => x.hover === null && IDS.every((i) => REST[i](x[i])), 6000);
      r.afterUnder = await L.under(p);
      // Back into the empty bridge afterwards: nothing.
      await L.mark(); await L.to(p); await sleep(700);
      r.restartsFromBridge = (await L.since()).sparks;
    }
    out.hold.errors = L.errors;
    await L.page.close();
  },
  /** With each station active: only its own bridge appears; every other point of the scene keeps its owner. */
  async ownership() {
    const L = await lab();
    const hub = { x0: 645, y0: 528, x1: 1035, y1: 656 };
    const routes = ["charge-routes", "playground-route"].map((f) => readFileSync(join(HERE, `../../../components/lab/${f}.ts`), "utf8")).join("");
    const pts = [...routes.matchAll(/\[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]/g)].map((m) => [+m[1], +m[2]]);
    out.ownership.routePoints = pts.length;
    await L.park();
    const rest = await L.map();
    out.ownership.restBridgePoints = rest.join("").split("1").length - 1;
    for (const id of IDS) {
      await L.park(); await L.to(P[id].art); await L.settle((s) => POWERED[id](s[id]), 8000); await sleep(400);
      const m = await L.map();
      let bridge = 0, otherChanged = 0, onHub = 0, ownMoved = 0;
      m.forEach((row, j) => [...row].forEach((c, i) => {
        const b = rest[j][i], x = 2 + 2 * i, y = 100 + 2 * j;
        if (c === "1") { bridge++; if (x >= hub.x0 && x <= hub.x1 && y >= hub.y0 && y <= hub.y1) onHub++; }
        if (c === b) return;
        const own = CH[id] + CH[id].toUpperCase();
        if (b === "." && c === "1") return;
        if ((own + ".1").includes(b) && (own + ".1").includes(c)) ownMoved++;
        else otherChanged++;
      }));
      const others = IDS.filter((o) => o !== id);
      out.ownership[id] = { bridgePx: bridge * 4, otherStationsPointsChanged: otherChanged, ownPointsMoved: ownMoved, bridgePointsOverHub: onHub, routePointsInBridge: pts.filter((q) => inside(BRIDGES[id], q)).length, bridgesOnForOthers: await L.page.eval(`${JSON.stringify(others)}.filter((o) => getComputedStyle(document.querySelector('[data-bridge="' + o + '"]')).pointerEvents !== "none")`) };
    }
    out.ownership.errors = L.errors;
    await L.page.close();
  },
  /** Playground: every px of its region (label at rest and raised, bridge, hotspot between) through the whole lift, paused every 25 ms. */
  async lift() {
    const L = await lab();
    const box = [1250, 296, 1400, 510];
    await L.park(); await L.to(P.playground.art); await sleep(250);
    const steps = {};
    for (const t of [...Array(11)].map((_, k) => 600 + 50 * k)) {
      await L.page.eval(`(() => { document.getAnimations().forEach((a) => { const n = a.transitionProperty; if (n === "transform" || n === "clip-path" || n === "--lp") { a.pause(); a.currentTime = ${t}; } }); return 1; })()`);
      await L.frame();
      const lift = (await L.read()).playground.lift;
      const m = await L.map(...box, 1);
      let holes = 0, total = 0;
      m.forEach((row, j) => [...row].forEach((c, i) => { if (inside(BRIDGES.playground, [box[0] + i + 0.5, box[1] + j + 0.5])) { total++; if (!"pP1".includes(c)) holes++; } }));
      steps[t] = { lift, holes, total, hover: await L.hov() };
    }
    out.lift.steps = steps;
    // A still pointer at every 6 px of the label's column, from rest through the lift (real time): never a restart.
    await L.page.eval("(document.getAnimations().forEach((a) => a.play()), 1)");
    const still = [];
    for (let y = 328; y <= 380; y += 6) for (const x of [1292, 1330]) {
      await L.park(); await L.mark(); await L.to([x, y]); await sleep(1700);
      const r = await L.since();
      const started = r.h.includes("playground");
      still.push({ at: [x, y], started, changes: r.h.length - 1, sparks: r.sparks, after: await L.under([x, y]) });
    }
    out.lift.still = { tried: still.length, started: still.filter((s) => s.started).length, restarted: still.filter((s) => s.sparks > 1 || (s.started && s.changes > 1)).length, after: still.map((s) => `${s.at}: ${s.after}${s.started ? "" : " (not a start)"}`) };
    out.lift.errors = L.errors;
    await L.page.close();
  },
  /** Random straight moves between the hotspot and the label, slow enough for the grace not to help. */
  async random() {
    const L = await lab();
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const id of IDS) {
      const shape = await L.page.eval(`(() => { const R = (e) => { const b = e.getBoundingClientRect(); return [(b.left - ${L.cam.x}) / ${L.cam.k}, (b.top - ${L.cam.y}) / ${L.cam.k}, (b.right - ${L.cam.x}) / ${L.cam.k}, (b.bottom - ${L.cam.y}) / ${L.cam.k}]; }; const s = document.querySelector('section[data-station="${id}"]'); return { hot: R(document.querySelector('[data-hotspot="${id}"]')), label: [s.querySelector("h2 button"), ...s.querySelectorAll("li button")].map(R) }; })()`);
      const r = { moves: 0, drops: 0, restarts: 0, skipped: 0, bad: [] };
      await L.park(); await L.to(P[id].art); await L.settle((s) => POWERED[id](s[id]), 8000); await sleep(200);
      let at = P[id].art;
      for (let k = 0; k < 16; k++) {
        let q;
        for (;;) {
          const b = k % 2 ? shape.hot : shape.label[Math.floor(rnd() * shape.label.length)];
          q = [b[0] + 2 + rnd() * (b[2] - b[0] - 4), b[1] + 2 + rnd() * (b[3] - b[1] - 4)];
          if (k % 2 === 0 && id === "playground") q = raise(q);
          if (k % 2 === 0 || (await L.under(q)) === `hotspot ${id}`) break;
        }
        await L.mark();
        const n = 44;
        for (let i = 1; i <= n; i++) { await L.to([at[0] + ((q[0] - at[0]) * i) / n, at[1] + ((q[1] - at[1]) * i) / n]); await sleep(28); }
        await sleep(160);
        const s = await L.since();
        r.moves++;
        if (s.h.length > 1 || s.sparks) { r.drops += s.h.slice(1).filter((v) => v !== id).length; r.restarts += s.sparks; r.bad.push({ from: at.map(Math.round), to: q.map(Math.round), h: s.h }); await L.settle((x) => POWERED[id](x[id]), 8000); }
        at = q;
      }
      out.random[id] = r;
    }
    out.random.errors = L.errors;
    await L.page.close();
  },
  /** Keyboard: order, focus lighting with the mouse resting in a bridge, Enter, Escape. */
  async keyboard() {
    const L = await lab();
    const stop = async () => L.page.eval(`document.activeElement?.closest("[data-station]")?.dataset.station ?? null`);
    // The mouse rests in Engineering's bridge (nothing is lit), then Tab goes through all the stations.
    await L.park(); await L.to(OPEN.engineering); await sleep(300);
    const seen = [];
    for (let k = 0; k < 24; k++) { await L.page.key("Tab", "Tab", 9); await sleep(220); const s = await stop(); if (s) seen.push([s, await L.hov()]); }
    out.keyboard.tabWithMouseInBridge = { stops: seen.length, wrong: seen.filter(([s, h]) => s !== h) };
    await L.park();
    for (const id of IDS) {
      await L.page.eval(`document.getElementById("station-${id}-trigger").focus({ focusVisible: true })`);
      await sleep(150);
      const lit = await L.hov();
      await L.page.key("Enter", "Enter", 13); await sleep(1500);
      const s = await L.sel(), u = await L.url(), f = await L.page.eval("document.activeElement?.id");
      await L.page.key("Escape", "Escape", 27); await sleep(1500);
      out.keyboard[id] = { lit, enter: s, url: u, focus: f, afterEscape: await L.sel(), backFocus: await L.page.eval("document.activeElement?.id") };
      await L.page.eval("document.activeElement.blur()");
      await L.settle((x) => x.hover === null && IDS.every((i) => REST[i](x[i])), 6000);
    }
    out.keyboard.controls = await L.page.eval(`({ bridges: [...document.querySelectorAll("[data-bridge]")].map((e) => [e.dataset.bridge, e.getAttribute("aria-hidden"), e.tabIndex, e.getAttribute("role"), e.childElementCount]), stationButtons: document.querySelectorAll("#lab-stations button").length })`);
    out.keyboard.errors = L.errors;
    await L.page.close();
  },
  /** The controls keep their own clicks, reached from the platform by mouse. */
  async clicks() {
    for (const id of IDS) {
      const r = (out.clicks[id] = {});
      const p = P[id], up = id === "playground" ? raise : (x) => x;
      for (const [i, c] of p.chips.entries()) {
        const L = await lab();
        await L.to(p.platform); await L.settle((s) => POWERED[id](s[id]), 8000);
        const q = up(c);
        for (let k = 1; k <= 30; k++) { await L.to([p.platform[0] + ((q[0] - p.platform[0]) * k) / 30, p.platform[1] + ((q[1] - p.platform[1]) * k) / 30]); await sleep(16); }
        await L.page.click(...L.S(q)); await sleep(1300);
        r[`chip ${i + 1}`] = { url: await L.url(), sparks: (await L.since()).sparks, errors: L.errors };
        await L.page.close();
      }
      const L = await lab();
      const t = up(p.title);
      await L.to(p.art); await L.settle((s) => POWERED[id](s[id]), 8000);
      await L.to(t); await sleep(100); await L.page.click(...L.S(t)); await sleep(1300);
      r.title = await L.url();
      await L.off(); await L.page.key("Escape", "Escape", 27); await sleep(1400);
      r.escape = [await L.url(), await L.page.eval("document.activeElement?.id")];
      await L.page.eval("document.activeElement.blur()");
      await L.park(); await L.to(p.platform); await sleep(200); await L.page.click(...L.S(p.platform)); await sleep(1300);
      r.platform = await L.url();
      await L.page.close();
    }
  },
  /** A direct link powers at once with no spark; Escape goes back to rest. Selected, the zoomed label and platform still hold together. */
  async direct() {
    for (const id of IDS) {
      const L = await lab(`/lab-v2?station=${id}`);
      const first = await L.read();
      const r = (out.direct[id] = { selected: first.selected, powered: POWERED[id](first[id]), sparks: (await L.since()).sparks });
      await L.page.key("Escape", "Escape", 27); await sleep(300);
      await L.page.eval("document.activeElement.blur()");
      r.rest = await L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 6000);
      r.errors = L.errors;
      await L.page.close();
    }
  },
  /** Reduced motion: holds across the same moves; nothing lifts. */
  async reduced() {
    const L = await lab("/lab-v2", { reducedMotion: true });
    for (const id of IDS) {
      const p = P[id];
      await L.park(); await L.mark(); await L.to(p.art); await sleep(500);
      const pts = [p.art, p.title, p.art, p.platform, p.chips[0], p.platform];
      for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 40; k++) { await L.to([pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / 40, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / 40]); await sleep(24); }
      const s = await L.since();
      out.reduced[id] = { changes: s.h, sparks: s.sparks, lift: (await L.read()).playground.lift, label: await L.page.eval(`getComputedStyle(document.querySelector('section[data-station="${id}"]')).transform`) };
    }
    out.reduced.errors = L.errors;
    await L.page.close();
  },
  /** Engineering's label: same place at rest and active; before, it rose. */
  async engineering() {
    const L = await lab();
    const at = () => L.page.eval(`(() => { const b = (e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => +v.toFixed(2)); }; const s = document.querySelector('section[data-station="engineering"]'); return { title: b(s.querySelector("h2 button")), chips: [...s.querySelectorAll("li button")].map(b), font: getComputedStyle(s.querySelector("h2 button")).font, transform: getComputedStyle(s).transform }; })()`);
    const rest = await at();
    await L.to(P.engineering.art); await L.settle((s) => POWERED.engineering(s.engineering), 8000); await sleep(700);
    const on = await at();
    const pg = await L.page.eval(`document.querySelector('section[data-station="playground"]').className`);
    out.engineering = { rest, active: on, same: JSON.stringify(rest) === JSON.stringify(on), playgroundLabelClass: pg };
    await L.page.close();
  },
};
for (const [n, fn] of Object.entries(T)) {
  if (only && !only.includes(n)) continue;
  out[n] = {};
  await fn();
  console.log(n, JSON.stringify(out[n], null, 1).replace(/\n\s{2,}/g, " "));
}
writeFileSync(join(HERE, `behaviour${only ? "-" + only.join("-") : ""}.json`), JSON.stringify(out, null, 1) + "\n");
process.exit(0);
