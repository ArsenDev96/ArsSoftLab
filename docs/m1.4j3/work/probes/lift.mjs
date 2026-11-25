// M1.4J.3: Creative Studio's lift, frame by frame. Real pointer, real time.   node lift.mjs <label> [test,test]
import { writeFileSync } from "node:fs";
import { ARRIVE, IDS, POWERED, REST, open, sleep } from "../../../m1.4i/work/lib.mjs";
const [label = "run", only] = process.argv.slice(2);
const want = (t) => !only || only.split(",").includes(t);
const A = ARRIVE.creative;
const HOOK = `(() => {
  window.__sp = []; const an = Element.prototype.animate;
  Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__sp.push(document.timeline.currentTime); return an.apply(this, x); };
  const rises = () => [...document.querySelectorAll(".cre-rise")];
  const num = (e, v) => +getComputedStyle(e).getPropertyValue(v);
  const op = (s) => { const e = document.querySelector(s); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
  const k = document.querySelector(".lab-camera").offsetWidth / 1672;
  window.__s = () => {
    const ys = rises().map((e) => { const t = getComputedStyle(e).transform; return t === "none" ? 0 : -new DOMMatrix(t).f; });
    const v = document.querySelector(".cre-v2"), mover = document.querySelector('[data-surge="creative"] [data-surge-mover]').getAnimations().at(-1);
    return { t: document.timeline.currentTime, hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, sel: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, spark: mover ? mover.startTime : null,
      y: +(Math.max(...ys) / k).toFixed(3), spread: +(Math.max(...ys) - Math.min(...ys)).toFixed(4), n: ys.length, el: num(document.querySelector(".cre-v2 .cre-lift"), "--cl"), elF: num(document.querySelector('[data-v2-ground="creative"]').parentElement, "--cl"),
      es: num(v, "--cs"), ef: num(v, "--cw"), eb: num(v, "--cg"), band: +(op(".cre-crest") * op('[data-cre="crest"]')).toFixed(3), caps: +(op(".cre-glints") * op('[data-cre="glints"]')).toFixed(3), pool: +(op(".cre-warm") * op('[data-cre="warm"]')).toFixed(3), pw: Math.max(...[...document.querySelectorAll('.lab-power-dim[data-power="creative"]')].map((e) => num(e, "--pw"))),
      ground: op('[data-v2-ground="creative"]'), contact: op('[data-v2-floor="contact-creative"]'), fill: op('[data-cre="fill"]'), steam: op('[data-v2-recovered="steam"]'), steamL: op('[data-v2-recovered="steam-lifted"]'), hot: getComputedStyle(document.querySelector('[data-hotspot="creative"]')).clipPath.slice(0, 60) };
  };
  window.__log = []; window.__rec = false; (function f() { if (window.__rec) window.__log.push(window.__s()); requestAnimationFrame(f); })();
  return 1; })()`;
const lab = async (path = "/lab-v2", o = {}) => {
  const L = await open(path, { gpu: true, ...o });
  await L.page.eval(HOOK);
  const c = await L.page.center('[data-hotspot="creative"]');
  const on = () => L.page.mouseMove(c.x, c.y);
  const start = () => L.page.eval("(window.__log.length = 0, window.__sp.length = 0, window.__rec = true, 1)");
  const stop = async () => JSON.parse(await L.page.eval("(window.__rec = false, JSON.stringify(window.__log))"));
  const rest = async () => { await L.off(); const ok = await L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 8000); await sleep(150); return ok && (await L.page.eval("window.__s().y")) === 0; };
  const st = () => L.page.eval("window.__s()");
  return { ...L, c, on, start, stop, rest, st };
};
const out = {};
const T = {
  /** Spark start + 620 = arrival. First movement, quarter, half, full; monotone; every layer together. */
  async timing() {
    const L = await lab(); out.timing = [];
    for (let k = 0; k < 5; k++) {
      await L.rest(); await L.start(); await L.on(); await sleep(A + 1500);
      const f = (await L.stop()).filter((x) => x.hover === "creative");
      const arr = f.find((x) => x.spark !== null).spark + A;
      const first = (p) => { const x = f.find(p); return x ? Math.round(x.t - arr) : null; };
      const full = Math.max(...f.map((x) => x.y));
      out.timing.push({ full, firstMove: first((x) => x.y > 0.01), q: first((x) => x.y >= full * 0.25), half: first((x) => x.y >= full * 0.5), p99: first((x) => x.y >= full * 0.99), fullAt: first((x) => x.y >= full - 0.001), beforeArrival: Math.max(...f.filter((x) => x.t < arr).map((x) => x.y)), fell: f.filter((x, i) => i && x.y < f[i - 1].y - 0.001).length, spread: Math.max(...f.map((x) => x.spread)), layers: f[0].n, floorOff: Math.max(...f.map((x) => Math.abs(x.el - x.elF))), scan: [first((x) => x.band > 0.02), Math.round(f.findLast((x) => x.band > 0.02).t - arr)], caps: [first((x) => x.caps > 0.02 && x.eb > 0), first((x) => x.eb === 1)], esDone: first((x) => x.es === 1), liftAtScanStart: f.find((x) => x.band > 0.02)?.y, liftAtScanEnd: f.findLast((x) => x.band > 0.02)?.y, strip: first((x) => x.pw > 0.01), frames: f.filter((x) => x.t > arr && x.t < arr + 700).length, contact: [f[0].contact, f.at(-1).contact], ground: [f[0].ground, f.at(-1).ground] });
      await L.start(); await L.off(); await sleep(1000);
      const d = (await L.stop()), i0 = d.findIndex((x) => x.hover === null), t0 = d[i0].t, after = d.slice(i0);
      Object.assign(out.timing.at(-1), { down: { half: Math.round(after.find((x) => x.y <= full / 2).t - t0), done: Math.round(after.find((x) => x.y === 0).t - t0), rose: after.filter((x, i) => i && x.y > after[i - 1].y + 0.001).length, spread: Math.max(...after.map((x) => x.spread)) } });
    }
    out.timingErrors = L.errors; await L.page.close();
  },
  /** Leave at moments of the rise and the descent, return after gaps (from the moment the hover drops; "held" = inside the grace). */
  async interrupt() {
    const L = await lab(); out.interrupt = [];
    for (const at of [-250, 40, 140, 260, 400, 560, 800, 1200]) for (const gap of [0, 30, 60, 120, 200, 350, 500]) {
      await L.rest(); await L.start(); await L.on();
      for (let i = 0; i < 100 && (await L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`)) !== "creative"; i++) await sleep(3);
      await L.page.eval(`new Promise((r) => setTimeout(r, ${Math.max(0, A + at - 90)}))`);
      await L.off();
      for (let i = 0; i < 100 && (await L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`)) !== null; i++) await sleep(2);
      if (gap) await sleep(gap);
      await L.on(); await sleep(A + 1300);
      const s = await L.st();
      const ok = POWERED.creative((await L.read()).creative);
      await L.off(); await sleep(900);
      const f = await L.stop();
      const end = f.at(-1);
      const i1 = f.findIndex((x) => x.hover === "creative"), i2 = f.findIndex((x, i) => i > i1 && x.hover !== "creative"), i3 = f.findIndex((x, i) => i > i2 && x.hover === "creative"), i4 = f.findIndex((x, i) => i > i3 && x.hover !== "creative");
      if (i3 < 0) { out.interrupt.push({ at, gap, held: true, bad: false }); continue; }
      const arr2 = f.slice(i3, i4).findLast((x) => x.spark !== null).spark + A;
      const dropY = f[i2].y, retY = f[i3].y;
      const away = f.slice(i2, i3), charge = f.slice(i3, i4).filter((x) => x.t < arr2 - 1), after = f.slice(i3, i4).filter((x) => x.t >= arr2 - 1), tail = f.slice(i4);
      const maxStep = Math.max(...f.slice(1).map((x, i) => Math.abs(x.y - f[i].y) / Math.max(1, (x.t - f[i].t) / 16.7)));
      const r = { at, gap, dropY, retY, roseAway: away.filter((x, i) => i && x.y > away[i - 1].y + 0.001).length, roseInCharge: charge.filter((x, i) => i && x.y > charge[i - 1].y + 0.001).length, atArrival: charge.at(-1)?.y ?? null, hung: charge.filter((x, i) => i && x.y > 0.01 && x.y === charge[i - 1].y && x.t > charge[i - 1].t).length, fellAfter: after.filter((x, i) => i && x.y < after[i - 1].y - 0.001).length, premScan: charge.filter((x) => x.band > 0.02 || x.caps > 0.02).length, end: s.y, ok, rest: end.y === 0 && end.el === 0, tailRose: tail.filter((x, i) => i && x.y > tail[i - 1].y + 0.001).length, maxStep: +maxStep.toFixed(2), spread: Math.max(...f.map((x) => x.spread)) };
      r.bad = r.roseAway > 0 || r.roseInCharge > 0 || (r.atArrival ?? 0) > 0.01 || r.hung > 2 || r.fellAfter > 0 || r.premScan > 0 || !r.ok || !r.rest || r.tailRose > 0 || r.spread > 0.001 || Math.abs(r.end - 10) > 0.6;
      out.interrupt.push(r); if (r.bad) console.log("!!", JSON.stringify(r));
    }
    const R = out.interrupt; console.log(`interrupt: ${R.length} runs, flagged ${R.filter((r) => r.bad).length}; held ${R.filter((r) => r.held).length}; largest step in a 60 Hz frame ${Math.max(...R.filter((r) => !r.held).map((r) => r.maxStep))} px; hung frames ${R.reduce((a, r) => a + (r.hung ?? 0), 0)}`);
    out.interruptErrors = L.errors; await L.page.close();
  },
  /** Every other station and back, from several moments. */
  async switching() {
    const L = await lab(); out.switching = [];
    for (const id of IDS.filter((x) => x !== "creative")) for (const wait of [300, A + 150, A + 350, A + 1200]) {
      await L.rest(); await L.start(); await L.on(); await sleep(wait);
      await L.hover(id); const ok = await L.settle((s) => s.hover === id && POWERED[id](s[id]) && REST.creative(s.creative), 8000); const y1 = (await L.st()).y;
      await L.on(); const ok2 = await L.settle((s) => s.hover === "creative" && POWERED.creative(s.creative) && REST[id](s[id]), 8000); await sleep(400);
      const y2 = (await L.st()).y; const f = await L.stop();
      const r = { id, wait, otherPowered: ok, creOnFloor: y1 === 0, back: ok2, y: y2, sparks: (await L.page.eval("window.__sp.length")), spread: Math.max(...f.map((x) => x.spread)) };
      r.bad = !ok || !ok2 || y1 !== 0 || Math.abs(y2 - 10) > 0.6 || r.sparks !== 3 || r.spread > 0.001; out.switching.push(r); if (r.bad) console.log("!!", JSON.stringify(r));
    }
    console.log(`switching: ${out.switching.length}, flagged ${out.switching.filter((r) => r.bad).length}`); await L.page.close();
  },
  /** Keyboard focus, Enter, Escape, browser Back, Back to Lab; leaving the selection. */
  async keyboard() {
    const L = await lab(); const r = (out.keyboard = {});
    const rec = async (act, ms) => { await L.start(); await act(); await sleep(ms); const f = await L.stop(); return { min: Math.min(...f.map((x) => x.y)), max: Math.max(...f.map((x) => x.y)), end: f.at(-1).y, hover: f.at(-1).hover, sel: f.at(-1).sel, focus: await L.page.eval("document.activeElement?.id ?? null"), scan: f.filter((x) => x.band > 0.02).length }; };
    await L.rest();
    r.focus = await rec(() => L.page.eval(`document.getElementById("station-creative-trigger").focus({ focusVisible: true })`), A + 1300);
    r.enter = await rec(() => L.page.key("Enter", "Enter", 13), 1600);
    r.escape = await rec(() => L.page.key("Escape", "Escape", 27), A + 1300);
    r.blur = await rec(() => L.page.eval("(document.activeElement.blur(), 1)"), 1200);
    await L.rest(); await L.on(); await sleep(A + 1200); await L.page.click(L.c.x, L.c.y); await sleep(1300);
    r.escapePointerOver = await rec(() => L.page.key("Escape", "Escape", 27), A + 1300);
    await L.off(); await L.page.eval("(document.activeElement.blur(), 1)"); await L.rest();
    await L.on(); await sleep(A + 1200); await L.page.click(L.c.x, L.c.y); await sleep(1300); await L.off(); await sleep(300);
    r.browserBack = await rec(() => L.page.eval("(history.back(), 1)"), A + 1300);
    await L.page.eval("(document.activeElement.blur(), 1)"); await L.rest();
    // Escape while charging, and during the rise.
    r.escapes = [];
    for (const [click, esc] of [[200, 100], [A - 100, 250], [A + 120, 120], [A + 300, 150], [A + 600, 200]]) {
      await L.rest(); await L.start(); await L.on(); await sleep(click); await L.page.click(L.c.x, L.c.y); await L.off(); await sleep(esc); await L.page.key("Escape", "Escape", 27); await sleep(A + 1300);
      const s = await L.st(); await L.page.eval("(document.activeElement.blur(), 1)"); await sleep(1000); const e = await L.st(); const f = await L.stop();
      r.escapes.push({ click, esc, lifted: s.y, rest: e.y, maxStep: +Math.max(...f.slice(1).map((x, i) => Math.abs(x.y - f[i].y) / Math.max(1, (x.t - f[i].t) / 16.7))).toFixed(2), spread: Math.max(...f.map((x) => x.spread)) });
    }
    const b = async () => { await L.rest(); await L.on(); await sleep(A + 1200); await L.page.click(L.c.x, L.c.y); await sleep(1300); const q = await L.page.center('[data-station-panel="creative"] button[aria-keyshortcuts="Escape"]'); await L.page.click(q.x, q.y); };
    r.backToLab = await rec(b, 1500); await L.off(); await L.page.eval("(document.activeElement.blur(), 1)"); r.backToLabRest = await L.rest();
    r.errors = L.errors; await L.page.close();
  },
  async direct() {
    const L = await lab("/lab-v2?station=creative"); await L.start(); await sleep(900); const f = await L.stop();
    const r = (out.direct = { yFrom: f[0].y, yTo: f.at(-1).y, sparks: await L.page.eval("window.__sp.length"), scan: f.filter((x) => x.band > 0.02).length, hot: f.at(-1).hot, powered: POWERED.creative((await L.read()).creative) });
    await L.page.key("Escape", "Escape", 27); await sleep(900); r.afterEscape = (await L.st()).y; await L.page.eval("(document.activeElement.blur(), 1)"); await sleep(300); r.rest = await L.rest(); r.errors = L.errors;
    await L.page.close();
  },
  async reduced() {
    const L = await lab("/lab-v2", { reducedMotion: true }); await L.rest(); await L.start(); await L.on(); await sleep(1500); const f = await L.stop();
    const r = (out.reduced = { maxY: Math.max(...f.map((x) => x.y)), powered: POWERED.creative((await L.read()).creative), sparks: await L.page.eval("window.__sp.length"), ground: f.at(-1).ground, contact: f.at(-1).contact, hotSame: f[0].hot === f.at(-1).hot });
    const ch = await L.page.center('section[data-station="creative"] li button'); await L.page.click(ch.x, ch.y); await sleep(700); r.chip = await L.page.eval("location.search"); r.selY = (await L.st()).y; r.errors = L.errors; await L.page.close();
    const D = await lab("/lab-v2?station=creative", { reducedMotion: true }); r.direct = (await D.st()).y; await D.page.close();
  },
};
for (const [n, fn] of Object.entries(T)) { if (!want(n)) continue; try { await fn(); } catch (e) { out[n + "Failed"] = String(e.stack ?? e).slice(0, 500); console.log(n, "FAILED", out[n + "Failed"]); } if (!["interrupt", "switching"].includes(n)) console.log(n, JSON.stringify(out[n])); writeFileSync(`out/j3-lift-${label}.json`, JSON.stringify(out) + "\n"); }
process.exit(0);
