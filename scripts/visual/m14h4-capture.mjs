#!/usr/bin/env node
// M1.4H.4: Experience's activation in /lab-v2 (experimental), in the real browser at the same
// 1648 x 928 viewport and camera as earlier milestones.
//
//   node scripts/visual/m14h4-capture.mjs before      the other stations only, before the change
//   node scripts/visual/m14h4-capture.mjs [--webm]    everything           (BASE default http://localhost:3002)
//   node scripts/visual/m14h4-capture.mjs --phases    the phases and close-ups alone
//   node scripts/visual/m14h4-capture.mjs --only-webm the video alone
//
// Writes docs/m1.4h4/work/captures/{before,after}/:
//   others-*.png, others.json   Engineering, Educational, Creative Studio and Playground, seeked (compared
//                               between before and after by scripts/m14h4-sheets.py)
// and, after only:
//   phase-<name>{,-3x}.png      Experience (with its connection) at each phase
//   trail-<t>.png               the route at 6x along the journey
//   fx-<t>{,-off}.png           the same paused moment with and without the added light (its confinement)
//   scene-*.png                 the whole scene
//   checks.json                 every state's numbers, interruption, keyboard, deep link, reduced motion, errors
// and with --webm docs/m1.4h4/experience-activation.webm (frame-stepped, true timing).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";
import { encodeWebm } from "./encode-webm.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MODE = process.argv.includes("before") ? "before" : "after";
const OUT = join(ROOT, "docs/m1.4h4/work/captures", MODE);
const BASE = process.env.BASE || "http://localhost:3002";
const W = 1648;
const H = 928;
const NO_DEV = "nextjs-portal{display:none!important}";
const ARRIVE = 660; // SURGE_ARRIVE_MS.experience
const EXP = { x: 1112, y: 490, w: 552, h: 390 };
const TRAIL = { x: 1388, y: 556, w: 176, h: 160 };
const BOXES = {
  engineering: { x: 232, y: 370, w: 400, h: 290 },
  educational: { x: 620, y: 250, w: 440, h: 330 },
  playground: { x: 1000, y: 330, w: 440, h: 300 },
  creative: { x: 90, y: 500, w: 560, h: 390 },
};
const out = { base: BASE, arrive_ms: ARRIVE };
mkdirSync(OUT, { recursive: true });

async function open(path, opts = {}) {
  const page = await launch({ width: W, height: H, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await page.goto(BASE + path);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(NO_DEV)}; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, H - 4);
  await sleep(1200);
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const frame = () => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  const seek = (t) => page.eval(`(() => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${t}; }); return 1; })()`).then(frame);
  const finish = () => page.eval(`(() => { document.getAnimations().forEach((a) => { try { a.finish(); } catch { a.pause(); a.currentTime = 0; } }); return 1; })()`).then(frame);
  const shot = async (file, r = null, scale = 1) => {
    const p = r ? { format: "png", clip: { x: cam.x + r.x * cam.k, y: cam.y + r.y * cam.k, width: Math.min(r.w * cam.k, W - 1 - (cam.x + r.x * cam.k)), height: Math.min(r.h * cam.k, H - 1 - (cam.y + r.y * cam.k)), scale } } : { format: "png" };
    writeFileSync(join(OUT, file), Buffer.from((await page.send("Page.captureScreenshot", p)).data, "base64"));
  };
  const hover = async (id) => {
    const c = await page.center(`[data-hotspot="${id}"]`);
    await page.mouseMove(c.x, c.y);
  };
  const away = async () => {
    await page.mouseMove(4, H - 4);
    for (let i = 0; i < 100 && (await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`)); i++) await sleep(10);
  };
  const css = (id, text) => page.eval(`(() => { const st = document.createElement("style"); st.id = ${JSON.stringify(id)}; st.textContent = ${JSON.stringify(text)}; document.head.append(st); return 1; })()`).then(frame);
  const uncss = (id) => page.eval(`(document.getElementById(${JSON.stringify(id)}).remove(), 1)`).then(frame);
  return { page, errors, cam, seek, finish, shot, hover, away, css, uncss };
}

// Every number another station's activation runs on.
const othersState = (page) =>
  page.eval(`(() => {
    const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
    const pw = (sel) => [...document.querySelectorAll(sel)].map((e) => +(+getComputedStyle(e).getPropertyValue("--pw")).toFixed(3));
    const num = (sel) => { const cs = getComputedStyle(document.querySelector(sel)); return (v) => +(+cs.getPropertyValue(v)).toFixed(3); };
    const n = num(".eng-v2"), e = num(".edu-v2"), c = num(".cre-v2");
    const l = document.querySelector('.lab-lift[data-lift="playground"]');
    const t = getComputedStyle(l).transform;
    return {
      eng: { strip: pw('.lab-power-dim[data-power="engineering"]'), floor: pw(".eng-floor"), es: n("--es"), ef: n("--ef"), ed: n("--ed"), bars: Array.from({ length: 11 }, (_, k) => n("--eb" + k)), screen: op(".eng-screen-off"), line: op(".eng-scan-band"),
             drawn: getComputedStyle(document.querySelector('[data-eng="station-stable"]')).visibility },
      edu: { strip: pw('.lab-power-dim[data-power="educational"]'), floor: pw(".edu-floor"), gp: e("--gp"), gs: e("--gs"), go: e("--go"), light: op(".edu-light"), gates: [...document.querySelectorAll(".edu-gate")].map((g) => +getComputedStyle(g).opacity),
             drawn: getComputedStyle(document.querySelector('[data-edu="station-stable"]')).visibility },
      cre: { strip: pw('.lab-power-dim[data-power="creative"]'), floor: pw(".cre-floor"), cw: c("--cw"), cs: c("--cs"), cg: c("--cg"), gates: [...document.querySelectorAll(".cre-gate")].map((g) => +getComputedStyle(g).opacity), top: op(".cre-floor-top"), drawn: op('.cre-v2 [data-cre-swap="stable"]') },
      pg: { lift_px: t === "none" ? 0 : +(new DOMMatrix(t).f / (l.offsetWidth / 1672)).toFixed(2), strip_off: op(".lab-v2-strip-off"), ring_lit: op('[data-v2-ring="playground"] .lab-v2-power-lit'), arcade: op(".lab-arcade"),
            reflection: getComputedStyle(document.querySelector('[data-v2-reflection="playground"]')).transform },
    };
  })()`);

if (process.argv.includes("--only-webm")) {
  await video();
  process.exit(0);
}

// --- the other four stations: one ascending timeline each, seeked, in a fresh page.
if (!process.argv.includes("--phases")) {
  const steps = { engineering: [400, 665, 880, 1000, 2000], educational: [340, 540, 710, 860, 1020, 1860], playground: [400, 700, 900, 2400], creative: [400, 720, 860, 960, 1140, 2000] };
  const others = {};
  for (const id of Object.keys(steps)) {
    const { page, errors, seek, shot, hover, away, finish } = await open("/lab-v2");
    others[id] = { rest: await othersState(page) };
    await shot(`others-${id}-rest.png`, BOXES[id]);
    await hover(id);
    await sleep(30);
    for (const t of steps[id]) {
      await seek(t);
      others[id][t] = await othersState(page);
      await shot(`others-${id}-${t}.png`, BOXES[id]);
    }
    await finish();
    await away();
    for (const t of [120, 300]) {
      await seek(t);
      others[id][`leave-${t}`] = await othersState(page);
      await shot(`others-${id}-leave-${t}.png`, BOXES[id]);
    }
    others[id].errors = errors;
    await page.close();
  }
  const { page, shot } = await open("/lab-v2");
  await shot("scene-rest.png");
  await page.close();
  writeFileSync(join(OUT, "others.json"), JSON.stringify(others, null, 1) + "\n");
}
if (MODE === "before") process.exit(0);

// Every number Experience's activation runs on, and what is drawn.
const EXP_STATE = `(() => {
  const root = document.querySelector(".exp-v2");
  const cs = getComputedStyle(root);
  const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
  const pw = (sel) => [...document.querySelectorAll(sel)].map((e) => +(+getComputedStyle(e).getPropertyValue("--pw")).toFixed(3));
  const r = document.querySelector('[data-exp="station"]').getBoundingClientRect();
  return {
    hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
    selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
    strip_pw: pw('.lab-power-dim[data-power="experience"]'),
    floor_pw: pw(".exp-floor"),
    floor_top: op(".exp-floor-top"),
    clock: +(+cs.getPropertyValue("--xs")).toFixed(3),
    gate: ((e) => getComputedStyle(e).display === "none" ? "none" : +getComputedStyle(e).opacity)(document.querySelector(".exp-gate")),
    drawn_light: op(".exp-light"),
    lift: root.closest(".lab-lift") ? "in a lift wrapper" : "none",
    rect: [r.x, r.y, r.width, r.height].map((v) => +v.toFixed(2)),
    floor_light: ((o) => (o === 1 ? "approved layer" : o === 0 ? "fronts" : "cross-fading"))(+getComputedStyle(document.querySelector('.exp-v2 [data-exp-swap="stable"]')).opacity),
  };
})()`;
const expState = (page) => page.eval(EXP_STATE);

const PHASES = [
  ["rest", null],
  ["spark-approaching", ARRIVE - 120],
  ["energy-arrival", ARRIVE + 100],
  ["route-25", ARRIVE + 250],
  ["route-50", ARRIVE + 388],
  ["route-75", ARRIVE + 545],
  ["destination", ARRIVE + 790],
  ["settling", ARRIVE + 880],
  ["stable", ARRIVE + 1500],
];

// --- the phases, the route's close-ups, the added light's confinement (one ascending timeline: a finished CSS
// transition is retired, so a seek can't go back past it).
{
  const { page, errors, seek, finish, shot, hover, away, css, uncss } = await open("/lab-v2");
  const phases = {};
  phases.rest = await expState(page);
  await shot("phase-rest.png", EXP);
  await shot("phase-rest-3x.png", EXP, 3);
  await shot("trail-rest.png", TRAIL, 6);
  await hover("experience");
  await sleep(30);
  const STEPS = [100, 150, 200, 250, 300, 350, 388, 450, 500, 545, 600, 650, 700, 750, 790, 830, 880, 1000];
  const events = [
    ...PHASES.filter(([, t]) => t !== null).map(([name, t]) => ({ t, kind: "phase", name })),
    ...STEPS.map((s) => ({ t: ARRIVE + s + 0.25, kind: "step", s })),
    ...[100, 170, 250, 388, 470, 545, 680, 790, 830, 880].map((s) => ({ t: ARRIVE + s + 0.5, kind: "fx", s })),
  ].sort((a, b) => a.t - b.t);
  for (const e of events) {
    await seek(e.t);
    if (e.kind === "phase") {
      phases[e.name] = { t_after_arrival: e.t - ARRIVE, ...(await expState(page)) };
      await shot(`phase-${e.name}.png`, EXP);
      await shot(`phase-${e.name}-3x.png`, EXP, 3);
    } else if (e.kind === "step") {
      out[`state+${e.s}`] = await expState(page);
      await shot(`trail-${e.s}.png`, TRAIL, 6);
    } else {
      await shot(`fx-${e.s}.png`, EXP, 2);
      await css("off", ".exp-gate,.exp-gate *{visibility:hidden!important}");
      await shot(`fx-${e.s}-off.png`, EXP, 2);
      await uncss("off");
    }
  }
  await finish();
  await sleep(200);
  await shot("scene-powered.png");
  phases.stable_finished = await expState(page);
  // Quiet: nothing on the station changes once stable.
  await shot("quiet-a.png", EXP, 2);
  await sleep(2500);
  await shot("quiet-b.png", EXP, 2);
  out.animations_running_when_stable = await page.eval(`document.getAnimations().filter((a) => a.playState === "running" && a.effect?.target?.closest?.(".exp-v2,.exp-seq")).length`);
  await away();
  for (const t of [150, 250, 350]) {
    await seek(t);
    phases[`returning-${t}ms`] = await expState(page);
    await shot(`phase-returning-${t}ms.png`, EXP);
    await shot(`phase-returning-${t}ms-3x.png`, EXP, 3);
  }
  await finish();
  await sleep(600);
  phases.returned = await expState(page);
  await shot("scene-returned.png");
  await shot("phase-returned-3x.png", EXP, 3);
  out.phases = phases;
  out.phase_errors = errors;
  await page.close();
}
if (process.argv.includes("--phases")) process.exit(0);

// --- the stable state against the approved scene: Experience forced to its powered end state with the pointer away
// (no hover UI), against the scene before this milestone, where it was always lit. Also the other end of the settling
// cross-fade of the strips' floor light.
{
  const { page, errors, shot, css } = await open("/lab-v2");
  await css(
    "forced",
    `.exp-v2 [data-exp-swap="stable"]{opacity:1!important}.exp-v2 [data-exp-swap="anim"]{opacity:0!important}.exp-seq{--xs:1!important;transition:none!important}.lab-power-dim[data-power="experience"],.exp-floor{--pw:1!important;transition:none!important}`,
  );
  await sleep(400);
  await shot("scene-forced-powered.png");
  await css("layers", `.exp-v2 [data-exp-swap="stable"]{opacity:0!important}.exp-v2 [data-exp-swap="anim"]{opacity:1!important}`);
  await sleep(300);
  await shot("scene-forced-layers.png");
  out.forced_powered_errors = errors;
  await page.close();
}

// --- interruption. Every wait is on the page's own numbers (not on the clock), and every frame is logged:
// [ms since the last hover change, hovered station, clock, drawn opacity of the added light].
{
  const { page, errors, shot, hover, away } = await open("/lab-v2", { gpu: true });
  await page.eval(`(() => {
    window.__log = [];
    let last = null, t0 = performance.now();
    (function f() {
      const h = document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null;
      if (h !== last) { last = h; t0 = performance.now(); }
      const l = document.querySelector(".exp-light");
      window.__log.push([Math.round(performance.now() - t0), h, +(+getComputedStyle(document.querySelector(".exp-v2")).getPropertyValue("--xs")).toFixed(3), +(+getComputedStyle(l.closest(".exp-gate")).opacity * +getComputedStyle(l).opacity).toFixed(3)]);
      requestAnimationFrame(f);
    })();
    return 1;
  })()`);
  const mark = () => page.eval("window.__log.length");
  const since = async (n) => (await page.eval("window.__log")).slice(n);
  const until = async (cond, ms = 4000) => {
    for (let i = 0; i < ms / 4; i++) {
      const s = await page.eval("window.__log[window.__log.length - 1]");
      if (cond(s)) return s;
      await sleep(4);
    }
    return null;
  };
  const lit = (x) => x[3] > 0;
  const settled = (s) => s.clock === 0 && s.gate === 0 && s.strip_pw.every((x) => x === 0) && s.floor_pw.every((x) => x === 0) && s.floor_light === "fronts";
  const sw = {};
  let m = await mark();
  await hover("experience");
  await until((s) => s[1] === "experience" && s[0] > 300);
  await hover("creative");
  await sleep(1600);
  let log = await since(m);
  sw.left_before_arrival = { frames: log.length, max_clock: Math.max(...log.map((x) => x[2])), frames_with_light: log.filter(lit).length, settled: settled(await expState(page)) };
  for (const [name, cond, to] of [
    ["during_the_journey", (s) => s[2] > 0.25 && s[2] < 0.6, "creative"],
    ["at_the_destination", (s) => s[2] > 0.74 && s[2] < 0.96, "playground"],
    ["during_the_journey_to_nothing", (s) => s[2] > 0.25 && s[2] < 0.6, null],
  ]) {
    await away();
    await sleep(900);
    await hover("experience");
    const at = await until(cond);
    m = await mark();
    await (to ? hover(to) : away());
    await sleep(1600);
    const left = (await since(m)).filter((x) => x[1] !== "experience");
    // Without flicker, and nothing completes late: the clock only ever falls after leaving.
    sw[name] = { left_at: at, after_leaving: { frames: left.length, frames_with_light: left.filter(lit).length, clock_ever_rose: left.some((x, i) => i && x[2] > left[i - 1][2] + 0.001) }, settled: settled(await expState(page)) };
  }
  await shot("switch-settled.png", EXP);
  await away();
  await sleep(900);
  await hover("experience");
  await until((s) => s[2] > 0.5);
  await away();
  await until((s) => s[2] > 0 && s[2] < 0.4);
  m = await mark();
  await hover("experience");
  await sleep(2800);
  log = (await since(m)).filter((x) => x[1] === "experience");
  const pre = log.filter((x) => x[0] < ARRIVE - 40);
  sw.quick_return = { frames_before_arrival: pre.length, held_clock: pre.at(-1)?.[2], clock_rose_before_arrival: pre.some((x, i) => i && x[2] > pre[i - 1][2] + 0.001), frames_with_light_before_arrival: pre.filter(lit).length, then: (await expState(page)).floor_light };
  for (let i = 0; i < 4; i++)
    for (const id of ["experience", "engineering", "educational", "playground", "creative", "experience"]) {
      await hover(id);
      await sleep(40 + 60 * i);
    }
  await hover("experience");
  await sleep(2600);
  sw.sweep_ending_on_experience = (await expState(page)).floor_light;
  await away();
  await sleep(1500);
  sw.sweep_away_settled = settled(await expState(page));
  for (const id of ["experience", "engineering", "experience", "playground", "experience", "creative"]) {
    await hover(id);
    await sleep(330);
  }
  await sleep(1800);
  sw.sweep_ending_on_creative_settled = settled(await expState(page));
  await away();
  out.switching = { ...sw, errors };
  await page.close();
}

// --- keyboard, clicking while charging.
{
  const { page, errors, hover } = await open("/lab-v2");
  let tab = null;
  for (let i = 0; i < 60 && !tab; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(30);
    const st = await page.eval(`(() => { const e = document.activeElement; return e && e.closest("h2") ? e.closest("[data-station]")?.dataset.station ?? "" : ""; })()`);
    if (st === "experience") tab = i + 1;
  }
  await sleep(ARRIVE + 2600);
  const url = () => page.eval("location.pathname + location.search");
  const focused = await expState(page);
  await page.key("Enter", "Enter", 13);
  await sleep(1200);
  const selected = { ...(await expState(page)), url: await url() };
  await page.eval(`(window.__esc = [], (function f() { window.__esc.push([+getComputedStyle(document.querySelector(".exp-v2")).getPropertyValue("--xs"), +getComputedStyle(document.querySelector(".exp-light")).opacity > 0]); requestAnimationFrame(f); })(), 1)`);
  await page.key("Escape", "Escape", 27);
  await sleep(3200);
  const esc = await page.eval("window.__esc");
  out.escape = { frames: esc.length, min_clock: Math.min(...esc.map((x) => x[0])), frames_with_light: esc.filter((x) => x[1]).length };
  const escaped = { ...(await expState(page)), url: await url() };
  await page.mouseMove(4, H - 4);
  await page.eval(`(document.activeElement?.blur?.(), 1)`);
  await sleep(1500);
  const blurred = await expState(page);
  await hover("experience");
  await sleep(250);
  const c = await page.center('[data-hotspot="experience"]');
  await page.click(c.x, c.y);
  await sleep(1600);
  const clicked_while_charging = { ...(await expState(page)), url: await url() };
  await page.key("Escape", "Escape", 27);
  await sleep(300);
  out.keyboard = { tab, focused, selected, escaped, blurred, clicked_while_charging, errors };
  await page.close();
}

// --- deep link: every frame from the first, the sequence's numbers (no replay), and again after leaving and returning.
{
  const page = await launch({ width: W, height: H });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__f=[];(function t(){const e=document.querySelector(".exp-v2");const l=document.querySelector(".exp-light");if(e&&l)window.__f.push([+getComputedStyle(e).getPropertyValue("--xs"),document.querySelector("[data-lab-selected]")?.dataset.labSelected??null,+getComputedStyle(l).opacity>0]);requestAnimationFrame(t)})()`,
  });
  await page.goto(BASE + "/lab-v2?station=experience");
  await sleep(1200);
  // The pointer passing over the selected station and off again must not replay anything.
  const c = await page.eval(`(() => { const b = document.querySelector('[data-exp="station"]').getBoundingClientRect(); return { x: b.x + b.width * 0.83, y: b.y + b.height * 0.78 }; })()`);
  await page.mouseMove(c.x, c.y);
  await sleep(700);
  await page.mouseMove(4, H - 4);
  await sleep(700);
  const f = await page.eval("window.__f");
  out.deep_link = {
    ...(await expState(page)),
    frames: f.length,
    first_frame: f[0],
    frames_mid_sequence: f.filter(([a]) => a > 0 && a < 1).length,
    frames_with_light: f.filter((x) => x[2]).length,
    url: await page.eval("location.pathname + location.search"),
    errors,
  };
  await page.close();
}

// --- reduced motion.
{
  const { page, errors, shot, hover, away } = await open("/lab-v2", { reducedMotion: true, gpu: true });
  const rest = await expState(page);
  await page.eval(`(window.__rm = [], (function f() { window.__rm.push([+getComputedStyle(document.querySelector(".exp-v2")).getPropertyValue("--xr"), +getComputedStyle(document.querySelector('[data-exp="standby"]')).opacity]); requestAnimationFrame(f); })(), 1)`);
  await hover("experience");
  await sleep(600);
  const rm = await page.eval("window.__rm");
  const powered = await expState(page);
  await shot("reduced-motion-powered.png", EXP);
  await away();
  await sleep(600);
  out.reduced_motion = { rest, frames_mid_fade: rm.filter(([a]) => a > 0 && a < 1).length, standby_opacity_start_end: [rm[0][1], rm.at(-1)[1]], powered, left: await expState(page), errors };
  await page.close();
}

// --- frame pacing of three real-time activations.
{
  const page = await launch({ width: W, height: H, gpu: true });
  await page.goto(BASE + "/lab-v2");
  await page.mouseMove(4, H - 4);
  await sleep(1800);
  const c = await page.center('[data-hotspot="experience"]');
  await page.eval(`(window.__t=[],(function t(n){window.__t.push(n);requestAnimationFrame(t)})(performance.now()),1)`);
  out.pacing = [];
  for (let i = 0; i < 3; i++) {
    const t0 = await page.eval("performance.now()");
    await page.mouseMove(c.x, c.y);
    await sleep(ARRIVE + 1200);
    const ts = await page.eval("window.__t");
    const d = ts.map((t, k) => [t, k ? t - ts[k - 1] : 0]).filter(([t]) => t > t0 + ARRIVE && t < t0 + ARRIVE + 1000).map(([, x]) => x).sort((x, y) => x - y);
    out.pacing.push({ frames_in_1000ms: d.length, median_ms: +d[d.length >> 1].toFixed(1), max_ms: +d.at(-1).toFixed(1) });
    await page.mouseMove(4, H - 4);
    await sleep(1200);
  }
  await page.close();
}

// --- the homepage loads nothing of /lab-v2.
{
  const page = await launch({ width: W, height: H });
  const urls = [];
  await page.send("Network.enable");
  page.on((m) => {
    if (m.method === "Network.requestWillBeSent") urls.push(m.params.request.url);
  });
  await page.goto(BASE + "/");
  await sleep(1400);
  out.homepage = { v2_requests: urls.filter((x) => x.includes("/scene/v2/")).length, exp_v2: await page.eval(`!!document.querySelector(".exp-v2")`) };
  await page.close();
}

writeFileSync(join(OUT, "checks.json"), JSON.stringify(out, null, 1) + "\n");

await video();
async function video() {
  if (!process.argv.some((x) => x.endsWith("webm"))) return;
  // Experience at 2x. The machine these were made on (Radeon HD 5450) can't screencast the page at full rate, so
  // the video is frame-stepped: the real page, its own animations seeked 1/60 s at a time, encoded at their true timing
  // (encode-webm.mjs). Real speed (rest, hover to stable, leave), then the activation again at quarter speed.
  const FPS = 60;
  const { page, seek, hover, away } = await open("/lab-v2");
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const grab = async () => (await page.send("Page.captureScreenshot", { format: "jpeg", quality: 92, clip: { x: cam.x + EXP.x * cam.k, y: cam.y + EXP.y * cam.k, width: EXP.w * cam.k, height: EXP.h * cam.k, scale: 2 } })).data;
  const shots = [await grab()];
  const seq = [[0, 500]]; // [frame, ms]
  await hover("experience");
  await sleep(40);
  const on = [];
  for (let k = 0; k * (1000 / FPS) <= ARRIVE + 1100; k++) {
    await seek(k * (1000 / FPS));
    on.push(shots.push(await grab()) - 1);
  }
  await away();
  const off = [];
  for (let k = 0; k * (1000 / FPS) <= 700; k++) {
    await seek(k * (1000 / FPS));
    off.push(shots.push(await grab()) - 1);
  }
  await page.close();
  const play = (list, ms) => list.forEach((f) => seq.push([f, ms]));
  play(on, 1000 / FPS);
  seq.push([on.at(-1), 900]);
  play(off, 1000 / FPS);
  seq.push([off.at(-1), 700]);
  play(on.filter((_, k) => k * (1000 / FPS) > ARRIVE - 120), 4000 / FPS);
  seq.push([on.at(-1), 1200]);
  const r = await encodeWebm({ images: shots, sequence: seq, origin: BASE + "/icon.svg" });
  writeFileSync(join(ROOT, "docs/m1.4h4/experience-activation.webm"), r.file);
  // The file plays: duration, size, and a frame from the journey.
  const chk = await launch({ width: 900, height: 700 });
  const held = await chk.eval(`(async () => {
    const v = document.createElement("video"); v.muted = true; v.src = "data:video/webm;base64,${r.file.toString("base64")}";
    await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error(v.error.message)); });
    v.currentTime = 0.5 + (${ARRIVE} + 450) / 1000; await new Promise((ok) => (v.onseeked = ok));
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
    return { seconds: +v.duration.toFixed(2), w: v.videoWidth, h: v.videoHeight, png: c.toDataURL("image/png").split(",")[1] };
  })()`);
  await chk.close();
  writeFileSync(join(OUT, "webm-frame-journey.png"), Buffer.from(held.png, "base64"));
  console.log("webm", JSON.stringify({ source_frames: shots.length, encoded: r.frames, kb: Math.round(r.file.length / 1024), seconds: held.seconds, w: held.w, h: held.h }));
}
