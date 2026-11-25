// M1.4K: every frame's state of all five stations at once (review only). Real pointer, real time.
import { ARRIVE, BASE, IDS, POWERED, REST, SEQ, launch, open, sleep } from "./lib.mjs";
export { ARRIVE, BASE, IDS, POWERED, REST, SEQ, launch, open, sleep };
export const HEIGHT = { playground: 18, engineering: 12, educational: 10, creative: 10, experience: 10 };
/** Approved delay from the spark's arrival to the first movement, and to full height (ms). */
export const PLAN = { playground: [0, 450], engineering: [60, 660], educational: [90, 770], creative: [90, 770], experience: [90, 790] };
export const RISE = { engineering: ".eng-rise", educational: ".edu-rise", creative: ".cre-rise", experience: ".exp-rise" };

export const HOOK = `(() => {
  const $ = (q, r = document) => r.querySelector(q), $$ = (q, r = document) => [...r.querySelectorAll(q)];
  const ARR = ${JSON.stringify(ARRIVE)}, RISE = ${JSON.stringify(RISE)}, IDS = ${JSON.stringify(IDS)};
  const op = (e) => { if (!e) return 0; const c = getComputedStyle(e); return c.visibility === "hidden" || c.display === "none" ? 0 : +c.opacity; };
  const eff = (sel, top) => { let o = 1; for (let e = $(sel); e && !e.matches(top); e = e.parentElement) o *= op(e); return +o.toFixed(3); };
  const num = (e, v) => +(+getComputedStyle(e).getPropertyValue(v)).toFixed(3);
  const k = $(".lab-camera").offsetWidth / 1672;
  const ty = (e) => { const t = getComputedStyle(e).transform; return t === "none" ? 0 : -new DOMMatrix(t).f; };
  const el = { eng: $(".eng-v2"), edu: $(".edu-v2"), cre: $(".cre-v2"), exp: $(".exp-v2"), pg: $('.lab-lift.pointer-events-none[data-lift="playground"], .absolute.lab-lift[data-lift="playground"]') };
  const pgLift = $$('.lab-lift[data-lift="playground"]').find((e) => !e.classList.contains("lab-station"));
  const rises = Object.fromEntries(Object.entries(RISE).map(([i, s]) => [i, $$(s)]));
  const pw = Object.fromEntries(IDS.map((i) => [i, $$('.lab-power-dim[data-power="' + i + '"]')]));
  const PUL = { engineering: $$(".eng-pulse"), educational: $$(".edu-pulse"), creative: $$(".cre-pulse"), experience: $$(".exp-pulse") };
  const surge = Object.fromEntries(IDS.map((i) => [i, $('[data-surge="' + i + '"]')]));
  const head = Object.fromEntries(IDS.map((i) => [i, $('[data-pass="core"] [data-surge-head]', surge[i])]));
  const max = (a) => Math.max(0, ...a);
  window.__sparks = []; const an = Element.prototype.animate;
  Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__sparks.push(this.dataset.coreFlash || document.querySelector("[data-lab-hover]")?.dataset.labHover || "?"); return an.apply(this, x); };
  window.__s = () => {
    const s = { t: document.timeline.currentTime, p: performance.now(), hover: $("[data-lab-hover]")?.dataset.labHover ?? null, sel: $("[data-lab-selected]")?.dataset.labSelected ?? null };
    for (const i of IDS) {
      const m = $("[data-surge-mover]", surge[i])?.getAnimations().at(-1);
      const r = (s[i] = { spark: m ? m.startTime : null, sv: +(op(surge[i]) * op(head[i])).toFixed(3) });
      if (i === "playground") {
        r.y = +(ty(pgLift) / k).toFixed(3); r.spread = 0;
        r.lights = { lit: op($('[data-v2-ring="playground"] .lab-v2-power-lit')), strip: +(1 - op($(".lab-v2-strip-off"))).toFixed(3), arcade: op($(".lab-arcade")) };
        r.pw = max(pw[i].map((e) => num(e, "--pw")));
        r.n = { lp: num($('[data-v2-ground="playground"]'), "--lp") };
        r.once = 0; r.pulse = 0; r.level = Math.max(r.lights.lit, r.lights.strip, r.lights.arcade);
      } else {
        const ys = rises[i].map(ty);
        r.y = +(max(ys) / k).toFixed(3); r.spread = +(Math.max(...ys) - Math.min(...ys)).toFixed(4);
        r.pulse = +max(PUL[i].map(op)).toFixed(3);
        r.pw = max(pw[i].map((e) => num(e, "--pw")));
        if (i === "engineering") { const c = $(".eng-caps"); r.lights = { scan: op($(".eng-scan-band")), caps: +(op(c) * max($$("span", c).map(op))).toFixed(3) }; r.n = { es: num(el.eng, "--es"), ef: num(el.eng, "--ef"), bars: +Array.from({ length: 11 }, (_, b) => num(el.eng, "--eb" + b)).reduce((a, b) => a + b, 0).toFixed(2) }; }
        if (i === "educational") { r.lights = { pool: eff(".edu-pulse-base", ".edu-v2"), crest: eff(".edu-crest", ".edu-v2"), orbit: eff(".edu-light", ".edu-v2") }; r.n = { gp: num(el.edu, "--gp"), gs: num(el.edu, "--gs"), go: num(el.edu, "--go") }; }
        if (i === "creative") { r.lights = { warm: eff(".cre-warm", ".cre-v2"), crest: eff(".cre-crest", ".cre-v2"), glint: eff(".cre-glints", ".cre-v2") }; r.n = { cw: num(el.cre, "--cw"), cs: num(el.cre, "--cs"), cg: num(el.cre, "--cg") }; }
        if (i === "experience") { r.lights = { trail: eff(".exp-light", ".exp-v2") }; r.n = { xs: num(el.exp, "--xs") }; }
        r.once = max(Object.values(r.lights));
        r.level = Math.max(r.once, max(Object.values(r.n)) / (i === "engineering" ? 11 : 1), r.pw);
      }
    }
    return s;
  };
  window.__log = []; window.__rec = false; window.__hc = [];
  const root = $("[data-lab-hover],[data-lab-selected]") ?? $(".lab-camera").closest("main").querySelector("div.contents");
  let last = "?"; new MutationObserver(() => { const v = $("[data-lab-hover]")?.dataset.labHover ?? null; if (v !== last) { last = v; window.__hc.push([document.timeline.currentTime, v]); } }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] });
  (function f() { if (window.__rec) window.__log.push(window.__s()); requestAnimationFrame(f); })();
  return 1; })()`;

export async function lab(path = "/lab-v2", opts = {}) {
  const L = await open(path, { gpu: true, ...opts });
  await L.page.eval(HOOK);
  const C = {};
  for (const i of IDS) C[i] = await L.page.center(`[data-hotspot="${i}"]`);
  const on = (i) => L.page.mouseMove(C[i].x, C[i].y);
  const S = ([x, y]) => [L.cam.x + x * L.cam.k, L.cam.y + y * L.cam.k];
  const to = (p) => L.page.mouseMove(...S(p));
  const start = () => L.page.eval("(window.__log.length = 0, window.__sparks.length = 0, window.__hc.length = 0, window.__rec = true, 1)");
  const stop = async () => { const n = await L.page.eval("(window.__rec = false, window.__log.length)"); const out = []; for (let k = 0; k < n; k += 150) out.push(...JSON.parse(await L.page.eval(`JSON.stringify(window.__log.slice(${k}, ${k + 150}))`))); return out; };
  const st = () => L.page.eval("window.__s()");
  const hov = () => L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
  const hovUntil = async (v, ms = 1500) => { for (let t = 0; t < ms; t += 3) { if ((await hov()) === v) return true; await sleep(3); } return false; };
  const rest = async () => { await L.off(); const ok = await L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 9000); for (let k = 0; k < 40; k++) { const s = await st(); if (IDS.every((i) => s[i].y === 0)) return ok; await sleep(50); } return false; };
  const home = async () => { for (let k = 0; k < 4 && (await L.page.eval("location.search.includes('station')")); k++) { await L.page.key("Escape", "Escape", 27); await sleep(400); } await L.page.eval("(document.activeElement?.blur?.(), 1)"); return rest(); };
  const x = (i) => [(C[i].x - L.cam.x) / L.cam.k, (C[i].y - L.cam.y) / L.cam.k];
  return { ...L, C, x, on, S, to, start, stop, st, hov, hovUntil, rest, home };
}
export const out = (name, data) => import("node:fs").then(({ writeFileSync }) => writeFileSync(new URL(`./results/${name}.json`, import.meta.url), JSON.stringify(data) + "\n"));
