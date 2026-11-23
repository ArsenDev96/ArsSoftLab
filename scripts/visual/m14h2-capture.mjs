#!/usr/bin/env node
// M1.4H.2: Educational's activation in /lab-v2 (experimental), in the real browser at the same
// 1648 x 928 viewport and camera as earlier milestones.
//
//   node scripts/visual/m14h2-capture.mjs before      the other stations only, before the change
//   node scripts/visual/m14h2-capture.mjs [--webm]    everything           (BASE default http://localhost:3002)
//   node scripts/visual/m14h2-capture.mjs --only-webm the video alone
//
// Writes docs/m1.4h2/work/captures/{before,after}/:
//   others-*.png, others.json   Engineering, Playground, Creative Studio and Experience, seeked (compared
//                               between before and after by scripts/m14h2-sheets.py)
// and, after only:
//   phase-<name>{,-3x}.png      Educational (with its connection) at each phase
//   orbit-<t>.png               the globe and ring at 4x through the orbit highlight
//   hl-<t>{,-off}.png           the same paused moment with and without the highlight (its confinement)
//   scene-*.png                 the whole scene
//   checks.json                 every state's numbers, interruption, keyboard, deep link, reduced motion, errors
// and with --webm docs/m1.4h2/educational-activation.webm (frame-stepped, true timing).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";
import { encodeWebm } from "./encode-webm.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MODE = process.argv.includes("before") ? "before" : "after";
const OUT = join(ROOT, "docs/m1.4h2/work/captures", MODE);
const BASE = process.env.BASE || "http://localhost:3002";
const W = 1648;
const H = 928;
const NO_DEV = "nextjs-portal{display:none!important}";
const ARRIVE = 460; // SURGE_ARRIVE_MS.educational
const EDU = { x: 620, y: 250, w: 440, h: 330 };
const GLOBE = { x: 660, y: 262, w: 346, h: 240 };
const BOXES = {
  engineering: { x: 232, y: 370, w: 400, h: 300 },
  playground: { x: 1000, y: 330, w: 440, h: 300 },
  creative: { x: 120, y: 520, w: 440, h: 300 },
  experience: { x: 1130, y: 560, w: 440, h: 300 },
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
    const cs = getComputedStyle(document.querySelector(".eng-v2"));
    const n = (v) => +(+cs.getPropertyValue(v)).toFixed(3);
    const l = document.querySelector('.lab-lift[data-lift="playground"]');
    const t = getComputedStyle(l).transform;
    return {
      eng: { strip: pw('.lab-power-dim[data-power="engineering"]'), floor: pw(".eng-floor"), es: n("--es"), ef: n("--ef"), ed: n("--ed"), bars: Array.from({ length: 11 }, (_, k) => n("--eb" + k)), screen: op(".eng-screen-off"), line: op(".eng-scan-band"),
             drawn: getComputedStyle(document.querySelector('[data-eng="station-stable"]')).visibility },
      pg: { lift_px: t === "none" ? 0 : +(new DOMMatrix(t).f / (l.offsetWidth / 1672)).toFixed(2), strip_off: op(".lab-v2-strip-off"), ring_lit: op('[data-v2-ring="playground"] .lab-v2-power-lit'), arcade: op(".lab-arcade"),
            reflection: getComputedStyle(document.querySelector('[data-v2-reflection="playground"]')).transform },
    };
  })()`);

if (process.argv.includes("--only-webm")) {
  await video();
  process.exit(0);
}

// --- the other four stations: one ascending timeline each, seeked, in a fresh page.
{
  const steps = { engineering: [400, 665, 880, 1000, 2000], playground: [400, 700, 900, 2400], creative: [2400], experience: [2400] };
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

// Every number Educational's activation runs on, and what is drawn.
const EDU_STATE = `(() => {
  const root = document.querySelector(".edu-v2");
  const cs = getComputedStyle(root);
  const n = (v) => +(+cs.getPropertyValue(v)).toFixed(3);
  const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
  const pw = (sel) => [...document.querySelectorAll(sel)].map((e) => +(+getComputedStyle(e).getPropertyValue("--pw")).toFixed(3));
  return {
    hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
    selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
    strip_pw: pw('.lab-power-dim[data-power="educational"]'),
    floor_pw: pw(".edu-floor"),
    floor_cyan: op(".edu-floor-cyan"),
    pulse: n("--gp"), globe: n("--gs"), orbit: n("--go"),
    gates: [...document.querySelectorAll(".edu-gate")].map((e) => getComputedStyle(e).display === "none" ? "none" : +(+getComputedStyle(e).opacity).toFixed(3)),
    light: op(".edu-light"),
    shimmer: op(".edu-shimmer"),
    lift: root.closest(".lab-lift") ? "in a lift wrapper" : "none",
    drawn: getComputedStyle(document.querySelector('[data-edu="station-stable"]')).visibility === "visible" ? "station image" : "layers",
  };
})()`;
const eduState = (page) => page.eval(EDU_STATE);

const PHASES = [
  ["rest", null],
  ["spark-approaching", ARRIVE - 120],
  ["energy-arrival", ARRIVE + 80],
  ["base-pulse", ARRIVE + 135],
  ["globe-awakening", ARRIVE + 250],
  ["orbit-front", ARRIVE + 330],
  ["orbit-back", ARRIVE + 400],
  ["orbit-left", ARRIVE + 560],
  ["settling", ARRIVE + 700],
  ["stable", ARRIVE + 1400],
];

// --- the phases, the orbit's close-ups, the highlight's confinement (one ascending timeline: a finished CSS
// transition is retired, so a seek can't go back past it).
{
  const { page, errors, seek, finish, shot, hover, away, css, uncss } = await open("/lab-v2");
  const phases = {};
  phases.rest = await eduState(page);
  await shot("phase-rest.png", EDU);
  await shot("phase-rest-3x.png", EDU, 3);
  await shot("orbit-rest.png", GLOBE, 4);
  await hover("educational");
  await sleep(30);
  const STEPS = [140, 200, 260, 300, 340, 380, 420, 470, 520, 550, 580, 620, 680, 820];
  const events = [
    ...PHASES.filter(([, t]) => t !== null).map(([name, t]) => ({ t, kind: "phase", name })),
    ...STEPS.map((s) => ({ t: ARRIVE + s + 0.25, kind: "step", s })),
    ...[280, 350, 410, 480, 570].map((s) => ({ t: ARRIVE + s + 0.5, kind: "light", s })),
    ...[230, 300].map((s) => ({ t: ARRIVE + s + 0.75, kind: "crest", s })),
  ].sort((a, b) => a.t - b.t);
  for (const e of events) {
    await seek(e.t);
    if (e.kind === "phase") {
      phases[e.name] = { t_after_arrival: e.t - ARRIVE, ...(await eduState(page)) };
      await shot(`phase-${e.name}.png`, EDU);
      await shot(`phase-${e.name}-3x.png`, EDU, 3);
    } else if (e.kind === "step") {
      out[`state+${e.s}`] = await eduState(page);
      await shot(`orbit-${e.s}.png`, GLOBE, 4);
    } else {
      const [name, hide] = e.kind === "light" ? ["hl", '[data-edu="light"],.edu-light{visibility:hidden!important}'] : ["crest", '[data-edu="crest"]{visibility:hidden!important}[data-edu="flare"]{visibility:hidden!important}'];
      await shot(`${name}-${e.s}.png`, EDU, 2);
      await css("off", hide);
      await shot(`${name}-${e.s}-off.png`, EDU, 2);
      await uncss("off");
    }
  }
  await finish();
  await sleep(200);
  await shot("scene-powered.png");
  phases.stable_finished = await eduState(page);
  await away();
  for (const t of [120, 220, 320]) {
    await seek(t);
    phases[`returning-${t}ms`] = await eduState(page);
    await shot(`phase-returning-${t}ms.png`, EDU);
    await shot(`phase-returning-${t}ms-3x.png`, EDU, 3);
  }
  await finish();
  await sleep(600);
  phases.returned = await eduState(page);
  await shot("scene-returned.png");
  await shot("phase-returned-3x.png", EDU, 3);
  out.phases = phases;
  out.phase_errors = errors;
  await page.close();
}

// --- the stable state against the approved scene: Educational forced to its powered end state with the pointer away
// (no hover UI), against the scene before this milestone, where it was always lit.
{
  const { page, errors, shot, css } = await open("/lab-v2");
  await css(
    "forced",
    `.edu-v2 [data-edu-swap="stable"]{visibility:visible!important}.edu-v2 [data-edu-swap="anim"]{visibility:hidden!important}.edu-seq{--gs:1!important;--go:1!important;transition:none!important}.lab-power-dim[data-power="educational"],.edu-floor{--pw:1!important;transition:none!important}`,
  );
  await sleep(400);
  await shot("scene-forced-powered.png");
  // The layers just before the swap, at the same end values.
  await css("layers", `.edu-v2 [data-edu-swap="stable"]{visibility:hidden!important}.edu-v2 [data-edu-swap="anim"]{visibility:visible!important}`);
  await sleep(300);
  await shot("scene-forced-layers.png");
  out.forced_powered_errors = errors;
  await page.close();
}

// --- interruption. Every wait is on the page's own numbers (not on the clock), and every frame is logged:
// [ms since the last hover change, hovered station, globe, orbit, light's drawn opacity, crest's, spark still travelling].
{
  const { page, errors, shot, hover, away } = await open("/lab-v2", { gpu: true });
  await page.eval(`(() => {
    window.__log = [];
    let last = null, t0 = performance.now();
    const gateOf = (sel) => { const e = document.querySelector(sel); return +getComputedStyle(e.closest(".edu-gate")).opacity * +getComputedStyle(e).opacity; };
    (function f() {
      const h = document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null;
      if (h !== last) { last = h; t0 = performance.now(); }
      const c = getComputedStyle(document.querySelector(".edu-v2"));
      window.__log.push([Math.round(performance.now() - t0), h, +(+c.getPropertyValue("--gs")).toFixed(3), +(+c.getPropertyValue("--go")).toFixed(3), +gateOf(".edu-light").toFixed(3), +gateOf(".edu-crest").toFixed(3)]);
      requestAnimationFrame(f);
    })();
    return 1;
  })()`);
  const mark = () => page.eval("window.__log.length");
  const since = async (n) => (await page.eval("window.__log")).slice(n);
  const until = async (cond, ms = 4000) => {
    for (let i = 0; i < ms / 4; i++) {
      const s = (await page.eval("window.__log[window.__log.length - 1]"));
      if (cond(s)) return s;
      await sleep(4);
    }
    return null;
  };
  const settled = (s) => s.globe === 0 && s.orbit === 0 && s.pulse === 0 && s.strip_pw.every((x) => x === 0) && s.floor_pw.every((x) => x === 0) && s.gates.every((x) => x === 0) && s.shimmer === 0 && s.drawn === "layers";
  const sw = {};
  // Leave before the energy arrives.
  let m = await mark();
  await hover("educational");
  await until((s) => s[1] === "educational" && s[0] > 200);
  await hover("playground");
  await sleep(1600);
  let log = await since(m);
  sw.left_before_arrival = { frames: log.length, max_globe: Math.max(...log.map((x) => x[2])), max_orbit: Math.max(...log.map((x) => x[3])), settled: settled(await eduState(page)) };
  // Leave mid-globe, mid-orbit.
  for (const [name, cond] of [["mid_globe", (s) => s[2] > 0.25 && s[3] < 0.25], ["mid_orbit", (s) => s[3] > 0.35 && s[3] < 0.9]]) {
    await away();
    await sleep(900);
    await hover("educational");
    const at = await until(cond);
    m = await mark();
    await hover("engineering");
    await sleep(1600);
    log = await since(m);
    const left = log.filter((x) => x[1] !== "educational");
    sw[name] = { left_at: at, after_leaving: { frames: left.length, light_drawn_frames: left.filter((x) => x[4] > 0).length, crest_drawn_frames: left.filter((x) => x[5] > 0).length, globe_ever_rose: left.some((x, i) => i && x[2] > left[i - 1][2] + 0.001) }, settled: settled(await eduState(page)) };
  }
  await shot("switch-mid-orbit-settled.png", EDU);
  // Leave mid-orbit and come straight back while it drains: nothing that travels may show before the energy is there.
  await away();
  await sleep(900);
  await hover("educational");
  await until((s) => s[3] > 0.35);
  await away();
  await until((s) => s[2] > 0 && s[2] < 0.97);
  m = await mark();
  await hover("educational");
  await sleep(2400);
  log = (await since(m)).filter((x) => x[1] === "educational");
  const pre = log.filter((x) => x[0] < ARRIVE - 40);
  sw.quick_return = { frames_before_arrival: pre.length, held_globe: pre.at(-1)?.[2], light_or_crest_drawn_before_arrival: pre.filter((x) => x[4] > 0 || x[5] > 0).length, powered: (await eduState(page)).drawn };
  // A fast sweep across every station, ending on Educational, then away.
  for (let i = 0; i < 4; i++)
    for (const id of ["educational", "engineering", "playground", "creative", "experience", "educational"]) {
      await hover(id);
      await sleep(40 + 60 * i);
    }
  await hover("educational");
  await sleep(2200);
  sw.sweep_ending_on_educational = (await eduState(page)).drawn;
  await away();
  await sleep(1500);
  sw.sweep_away_settled = settled(await eduState(page));
  // A sweep ending elsewhere.
  for (const id of ["educational", "engineering", "educational", "playground", "educational", "experience"]) {
    await hover(id);
    await sleep(330);
  }
  await sleep(1800);
  sw.sweep_ending_on_experience_settled = settled(await eduState(page));
  await away();
  out.switching = { ...sw, errors };
  await page.close();
}

// --- keyboard, clicking while charging.
{
  const { page, errors, hover } = await open("/lab-v2");
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(30);
    const st = await page.eval(`(() => { const e = document.activeElement; return e && e.closest("h2") ? e.closest("[data-station]")?.dataset.station ?? "" : ""; })()`);
    if (st === "educational") tab = i + 1;
  }
  await sleep(ARRIVE + 1000);
  const url = () => page.eval("location.pathname + location.search");
  const focused = await eduState(page);
  await page.key("Enter", "Enter", 13);
  await sleep(1200);
  const selected = { ...(await eduState(page)), url: await url() };
  await page.eval(`(window.__esc = [], (function f() { const c = getComputedStyle(document.querySelector(".edu-v2")); window.__esc.push([+c.getPropertyValue("--gs"), +c.getPropertyValue("--go"), +getComputedStyle(document.querySelector(".edu-light")).opacity]); requestAnimationFrame(f); })(), 1)`);
  await page.key("Escape", "Escape", 27);
  await sleep(3200);
  const esc = await page.eval("window.__esc");
  out.escape = { frames: esc.length, min_globe: Math.min(...esc.map((x) => x[0])), min_orbit: Math.min(...esc.map((x) => x[1])), light_frames: esc.filter((x) => x[2] > 0).length };
  const escaped = { ...(await eduState(page)), url: await url() };
  await page.mouseMove(4, H - 4);
  await page.eval(`(document.activeElement?.blur?.(), 1)`);
  await sleep(1500);
  const blurred = await eduState(page);
  await hover("educational");
  await sleep(200);
  const c = await page.center('[data-hotspot="educational"]');
  await page.click(c.x, c.y);
  await sleep(1400);
  const clicked_while_charging = { ...(await eduState(page)), url: await url() };
  await page.key("Escape", "Escape", 27);
  await sleep(300);
  out.keyboard = { tab, focused, selected, escaped, blurred, clicked_while_charging, errors };
  await page.close();
}

// --- deep link: every frame from the first, the sequence's numbers (no replay).
{
  const page = await launch({ width: W, height: H });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__f=[];(function t(){const e=document.querySelector(".edu-v2");const l=document.querySelector(".edu-light");if(e&&l){const c=getComputedStyle(e);window.__f.push([+c.getPropertyValue("--gs"),+c.getPropertyValue("--go"),document.querySelector("[data-lab-selected]")?.dataset.labSelected??null,+getComputedStyle(l).opacity])}requestAnimationFrame(t)})()`,
  });
  await page.goto(BASE + "/lab-v2?station=educational");
  await sleep(1200);
  const f = await page.eval("window.__f");
  out.deep_link = {
    ...(await eduState(page)),
    frames: f.length,
    first_frame: f[0],
    frames_with_a_number_between_0_and_1: f.filter(([a, b]) => (a > 0 && a < 1) || (b > 0 && b < 1)).length,
    frames_with_the_light_visible: f.filter((x) => x[3] > 0).length,
    url: await page.eval("location.pathname + location.search"),
    errors,
  };
  await page.close();
}

// --- reduced motion.
{
  const { page, errors, shot, hover, away } = await open("/lab-v2", { reducedMotion: true });
  const rest = await eduState(page);
  await hover("educational");
  await sleep(70);
  const mid = { ...(await eduState(page)), gr: await page.eval(`+getComputedStyle(document.querySelector(".edu-v2")).getPropertyValue("--gr")`) };
  await sleep(500);
  const powered = await eduState(page);
  await shot("reduced-motion-powered.png", EDU);
  await away();
  await sleep(600);
  out.reduced_motion = { rest, at_70ms: mid, powered, left: await eduState(page), errors };
  await shot("reduced-motion-left.png", EDU);
  await page.close();
}

// --- frame pacing of one real-time activation.
{
  const page = await launch({ width: W, height: H, gpu: true });
  await page.goto(BASE + "/lab-v2");
  await page.mouseMove(4, H - 4);
  await sleep(1500);
  const c = await page.center('[data-hotspot="educational"]');
  await page.eval(`(window.__t=[],(function t(n){window.__t.push(n);requestAnimationFrame(t)})(performance.now()),1)`);
  await sleep(300);
  const t0 = await page.eval("performance.now()");
  await page.mouseMove(c.x, c.y);
  await sleep(ARRIVE + 900);
  const ts = await page.eval("window.__t");
  const win = (a, b) => {
    const d = ts.map((t, i) => [t, i ? t - ts[i - 1] : 0]).filter(([t]) => t > t0 + a && t < t0 + b).map(([, x]) => x).sort((x, y) => x - y);
    return { frames: d.length, median_ms: +d[d.length >> 1].toFixed(1), p95_ms: +d[Math.floor(d.length * 0.95)].toFixed(1), max_ms: +d.at(-1).toFixed(1) };
  };
  out.pacing = { charging: win(0, ARRIVE), activation: win(ARRIVE, ARRIVE + 850) };
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
  out.homepage = { v2_requests: urls.filter((x) => x.includes("/scene/v2/")).length, edu_v2: await page.eval(`!!document.querySelector(".edu-v2")`) };
  await page.close();
}

writeFileSync(join(OUT, "checks.json"), JSON.stringify(out, null, 1) + "\n");

await video();
async function video() {
  if (!process.argv.some((x) => x.endsWith("webm"))) return;
  // Educational at 2x. The machine these were made on (Radeon HD 5450) can't screencast the page at full rate, so the
  // video is frame-stepped: the real page, its own animations seeked 1/60 s at a time, encoded at their true timing.
  // Real speed (rest, hover to stable, leave), then the activation again at quarter speed.
  const FPS = 60;
  const { page, seek, hover, away } = await open("/lab-v2");
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const grab = async () => (await page.send("Page.captureScreenshot", { format: "jpeg", quality: 92, clip: { x: cam.x + EDU.x * cam.k, y: cam.y + EDU.y * cam.k, width: EDU.w * cam.k, height: EDU.h * cam.k, scale: 2 } })).data;
  const shots = [await grab()];
  const seq = []; // [frame, ms]
  seq.push([0, 500]);
  await hover("educational");
  await sleep(40);
  const on = [];
  for (let k = 0; k * (1000 / FPS) <= ARRIVE + 950; k++) {
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
  writeFileSync(join(ROOT, "docs/m1.4h2/educational-activation.webm"), r.file);
  // The file plays: duration, size, and a frame from the middle of the orbit.
  const chk = await launch({ width: 900, height: 700 });
  const held = await chk.eval(`(async () => {
    const v = document.createElement("video"); v.muted = true; v.src = "data:video/webm;base64,${r.file.toString("base64")}";
    await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error(v.error.message)); });
    v.currentTime = 0.5 + (${ARRIVE} + 330) / 1000; await new Promise((ok) => (v.onseeked = ok));
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
    return { seconds: +v.duration.toFixed(2), w: v.videoWidth, h: v.videoHeight, png: c.toDataURL("image/png").split(",")[1] };
  })()`);
  await chk.close();
  writeFileSync(join(OUT, "webm-frame-orbit-front.png"), Buffer.from(held.png, "base64"));
  console.log("webm", { source_frames: shots.length, encoded: r.frames, kb: Math.round(r.file.length / 1024), seconds: held.seconds, w: held.w, h: held.h });
}
