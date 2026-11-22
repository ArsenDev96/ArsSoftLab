#!/usr/bin/env node
// M1.4H.1: Engineering's activation in /lab-v2 (experimental), in the real browser at the
// same 1648 x 928 viewport and camera as earlier milestones.
//
//   node scripts/visual/m14h1-capture.mjs [--webm]      (BASE default http://localhost:3002)
//
// Writes docs/m1.4h1/work/captures/:
//   phase-<name>.png, phase-<name>-3x.png   Engineering (with its connection) at each phase, seeked
//   screen-<t>.png, chart-<t>.png           the display and the chart at 4x through the sequence
//   scan-<t>-noband.png                     the same moment without the scan line (its confinement)
//   scene-rest.png, scene-powered.png       the whole scene
//   pg-*.png                                Playground's states, as M1.4G.1 captured them
//   checks.json                             every state's numbers, switching, keyboard, deep link,
//                                           reduced motion, console errors, homepage requests
// and with --webm docs/m1.4h1/engineering-activation.webm (real time).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";
import { recordWebm } from "./record.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs/m1.4h1/work/captures");
const BASE = process.env.BASE || "http://localhost:3002";
const W = 1648;
const H = 928;
const NO_DEV = "nextjs-portal{display:none!important}";
const ARRIVE = 620;
// Scene px boxes: Engineering with its connection to the A; the display; the chart; Playground (as M1.4G.1).
const ENG = { x: 240, y: 370, w: 560, h: 300 };
const SCREEN = { x: 336, y: 380, w: 164, h: 102 };
const CHART = { x: 430, y: 392, w: 132, h: 88 };
const PG = { x: 1000, y: 330, w: 440, h: 300 };
const PG_FLOOR = { x: 1030, y: 500, w: 370, h: 110 };
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
  // The stable state's shimmer repeats forever: parked at its start (the line below the chart, unseen).
  const finish = () => page.eval(`(() => { document.getAnimations().forEach((a) => { try { a.finish(); } catch { a.pause(); a.currentTime = 0; } }); return 1; })()`).then(frame);
  const shot = async (file, r = null, scale = 1) => {
    const p = r ? { format: "png", clip: { x: cam.x + r.x * cam.k, y: cam.y + r.y * cam.k, width: Math.min(r.w * cam.k, W - 1 - (cam.x + r.x * cam.k)), height: r.h * cam.k, scale } } : { format: "png" };
    writeFileSync(join(OUT, file), Buffer.from((await page.send("Page.captureScreenshot", p)).data, "base64"));
  };
  const hover = async (id) => {
    const c = await page.center(`[data-hotspot="${id}"]`);
    await page.mouseMove(c.x, c.y);
  };
  const away = async () => {
    await page.mouseMove(4, H - 4);
    // The lab lets go of a hover a moment after the pointer leaves.
    for (let i = 0; i < 100 && (await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`)); i++) await sleep(10);
  };
  return { page, errors, cam, seek, finish, shot, hover, away };
}

// Every number Engineering's activation runs on, and what is visible.
const engState = (page) =>
  page.eval(`(() => {
    const root = document.querySelector(".eng-v2");
    const cs = getComputedStyle(root);
    const n = (v) => +(+cs.getPropertyValue(v)).toFixed(3);
    const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
    const pw = (sel) => [...document.querySelectorAll(sel)].map((e) => +(+getComputedStyle(e).getPropertyValue("--pw")).toFixed(3));
    return {
      hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
      selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
      strip_pw: pw('.lab-power-dim[data-power="engineering"]'),
      pulse: [...document.querySelectorAll(".eng-pulse")].map((e) => +(+getComputedStyle(e).opacity).toFixed(3)),
      floor_pw: pw(".eng-floor"),
      screen_standby: op(".eng-screen-off"),
      scan: n("--es"),
      scan_shade: op(".eng-scan-shade"),
      scan_line: op(".eng-scan-band"),
      chart_glass: n("--ef"),
      bars: Array.from({ length: 11 }, (_, k) => n("--eb" + k)),
      shimmer: op(".eng-shimmer"),
      drawn: getComputedStyle(document.querySelector('[data-eng="station-stable"]')).visibility === "visible" ? "station image" : "layers",
    };
  })()`);

const PHASES = [
  ["rest", null],
  ["spark-approaching", 400],
  ["energy-arrival", ARRIVE + 45],
  ["laptop-scan", ARRIVE + 260],
  ["chart-activation", ARRIVE + 380],
  ["stable", ARRIVE + 1400],
];

// --- the phases, the close-ups, the scan's confinement
{
  const { page, errors, seek, finish, shot, hover, away } = await open("/lab-v2");
  const phases = {};
  await shot("scene-rest.png");
  // One ascending timeline (a finished CSS transition is retired, so a seek can't go back past it): the
  // phases, the display and the chart at 4x (ms after the energy's arrival), and the scan's confinement
  // (the same paused moment with and without the line).
  const STEPS = [0, 140, 200, 260, 320, 380, 440, 520, 700];
  const events = [
    ...PHASES.filter(([, t]) => t !== null).map(([name, t]) => ({ t, kind: "phase", name })),
    ...STEPS.map((s) => ({ t: ARRIVE + s, kind: "step", s })),
    ...[200, 320, 440].map((s) => ({ t: ARRIVE + s + 0.5, kind: "scan", s })),
  ].sort((a, b) => a.t - b.t);
  phases.rest = await engState(page);
  await shot("phase-rest.png", ENG);
  await shot("phase-rest-3x.png", ENG, 3);
  await shot("screen-rest.png", SCREEN, 4);
  await shot("chart-rest.png", CHART, 4);
  await hover("engineering");
  await sleep(30);
  for (const e of events) {
    await seek(Math.round(e.t));
    if (e.kind === "phase") {
      phases[e.name] = { t_after_hover: e.t, t_after_arrival: e.t - ARRIVE, ...(await engState(page)) };
      await shot(`phase-${e.name}.png`, ENG);
      await shot(`phase-${e.name}-3x.png`, ENG, 3);
    } else if (e.kind === "step") {
      await shot(`screen-${e.s}.png`, SCREEN, 4);
      await shot(`chart-${e.s}.png`, CHART, 4);
      out[`state+${e.s}`] = await engState(page);
    } else {
      await shot(`scan-${e.s}.png`, ENG, 2);
      await page.eval(`(() => { const st = document.createElement("style"); st.id = "noband"; st.textContent = ".eng-scan-band{visibility:hidden!important}"; document.head.append(st); return 1; })()`);
      await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
      await shot(`scan-${e.s}-noband.png`, ENG, 2);
      await page.eval(`(document.getElementById("noband").remove(), 1)`);
    }
  }
  await finish();
  await sleep(200);
  await shot("scene-powered.png");
  phases.stable_finished = await engState(page);
  // Returning to rest.
  await away();
  for (const t of [120, 220, 320]) {
    await seek(t);
    phases[`returning-${t}ms`] = await engState(page);
    await shot(`phase-returning-${t}ms.png`, ENG);
    await shot(`phase-returning-${t}ms-3x.png`, ENG, 3);
  }
  await finish();
  await sleep(600);
  phases.returned = await engState(page);
  await shot("phase-returned.png", ENG);
  await shot("scene-returned.png");
  out.phases = phases;
  out.phase_errors = errors;
  await page.close();
}

// --- the stable state against the approved artwork: Engineering forced to its powered end state with the
// pointer away (no hover UI, no vignette), against M1.4G.1's capture of the same scene.
{
  const { page, errors, shot } = await open("/lab-v2");
  const bars = Array.from({ length: 11 }, (_, k) => `--eb${k}:1!important`).join(";");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(
    `[data-eng-swap="stable"]{visibility:visible!important}[data-eng-swap="anim"]{visibility:hidden!important}.eng-v2{--es:1!important;--ef:1!important;--ed:1!important;${bars}}.eng-screen-off{opacity:0!important}.lab-power-dim[data-power="engineering"],.eng-floor{--pw:1!important}`,
  )}; document.head.append(s); return 1; })()`);
  await sleep(400);
  await shot("scene-forced-powered.png");
  out.forced_powered = { ...(await engState(page)), errors };
  await page.close();
}

// --- rapid switching: leave before arrival, leave mid-sequence, a fast sweep across the stations.
{
  const { page, errors, shot, hover, away } = await open("/lab-v2");
  const sw = {};
  await hover("engineering");
  await sleep(300); // before the energy arrives
  await hover("playground");
  await sleep(150);
  sw.left_before_arrival = await engState(page);
  await sleep(1400);
  sw.left_before_arrival_settled = await engState(page);
  await hover("engineering");
  await sleep(ARRIVE + 260); // mid-scan, bars rising
  sw.mid_sequence = await engState(page);
  await hover("educational");
  await sleep(1500);
  sw.after_mid_sequence_switch = await engState(page);
  for (let i = 0; i < 3; i++)
    for (const id of ["engineering", "educational", "playground", "creative", "experience", "engineering"]) {
      await hover(id);
      await sleep(70 + 40 * i);
    }
  await hover("engineering");
  await sleep(ARRIVE + 200);
  sw.after_sweep_ending_on_engineering_mid = await engState(page);
  await away();
  await sleep(1500);
  sw.after_sweep_away_settled = await engState(page);
  await shot("switch-settled.png", ENG);
  // A quick return while it drains.
  await hover("engineering");
  await sleep(ARRIVE + 900);
  await away();
  await sleep(180);
  await hover("engineering");
  await sleep(ARRIVE + 900);
  sw.quick_return_powered = await engState(page);
  await away();
  await sleep(1500);
  sw.quick_return_away_settled = await engState(page);
  out.switching = { ...sw, errors };
  await page.close();
}

// --- keyboard (Tab to the title, Enter selects, Escape returns), clicking while charging, deep link.
{
  const { page, errors, hover } = await open("/lab-v2");
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(30);
    const st = await page.eval(`(() => { const e = document.activeElement; return e && e.closest("h2") ? e.closest("[data-station]")?.dataset.station ?? "" : ""; })()`);
    if (st === "engineering") tab = i + 1;
  }
  await sleep(ARRIVE + 1000);
  const focused = await engState(page);
  await page.key("Enter", "Enter", 13);
  await sleep(1200);
  const selected = { ...(await engState(page)), url: await page.eval("location.pathname + location.search") };
  await page.key("Escape", "Escape", 27);
  await sleep(1500);
  const escaped = { ...(await engState(page)), url: await page.eval("location.pathname + location.search") };
  await page.mouseMove(4, H - 4);
  await page.eval(`(document.activeElement?.blur?.(), 1)`);
  await sleep(1500);
  const blurred = await engState(page);
  // Click while the energy is still travelling.
  await hover("engineering");
  await sleep(250);
  const c = await page.center('[data-hotspot="engineering"]');
  await page.click(c.x, c.y);
  await sleep(1400);
  const clicked_while_charging = { ...(await engState(page)), url: await page.eval("location.pathname + location.search") };
  await page.key("Escape", "Escape", 27);
  await sleep(300);
  out.keyboard = { tab, focused, selected, escaped, blurred, clicked_while_charging, errors };
  await page.close();
}
{
  const { page, errors, shot } = await open("/lab-v2?station=engineering");
  out.deep_link = { ...(await engState(page)), url: await page.eval("location.pathname + location.search"), errors };
  await shot("deep-link.png", ENG);
  await page.close();
}

// --- reduced motion: hover, a short cross-fade into the powered appearance.
{
  const { page, errors, shot, hover, away } = await open("/lab-v2", { reducedMotion: true });
  await hover("engineering");
  await sleep(70);
  const mid = await engState(page);
  await sleep(500);
  const powered = await engState(page);
  await shot("reduced-motion-powered.png", ENG);
  await shot("reduced-motion-powered-3x.png", ENG, 3);
  await away();
  await sleep(600);
  out.reduced_motion = { at_70ms: mid, powered, left: await engState(page), errors };
  await page.close();
}

// --- Playground, as M1.4G.1 captured it (unchanged by this milestone).
{
  const { page, errors, seek, finish, shot, hover, away } = await open("/lab-v2");
  const pgState = () =>
    page.eval(`(() => {
      const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
      const l = document.querySelector('.lab-lift[data-lift="playground"]');
      const k = l.offsetWidth / 1672;
      const t = getComputedStyle(l).transform;
      return { lift_px: t === "none" ? 0 : +(new DOMMatrix(t).f / k).toFixed(2), strip_off: op(".lab-v2-strip-off"),
               ring_lit: op('[data-v2-ring="playground"] .lab-v2-power-lit'), engineering: getComputedStyle(document.querySelector(".eng-v2")).getPropertyValue("--es") };
    })()`);
  const pg = {};
  pg.rest = await pgState();
  await shot("pg-rest.png", PG);
  await shot("pg-rest-3x.png", PG_FLOOR, 3);
  await hover("playground");
  await sleep(30);
  await seek(2400);
  pg.lifted = await pgState();
  await shot("pg-lifted.png", PG);
  await shot("pg-lifted-3x.png", PG_FLOOR, 3);
  await finish();
  await away();
  await sleep(1500);
  pg.returned = await pgState();
  out.playground = { ...pg, errors };
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
  out.homepage = { v2_requests: urls.filter((u) => u.includes("/scene/v2/")).length, m14h1_requests: urls.filter((u) => u.includes("m14h1")).length, eng_v2: await page.eval(`!!document.querySelector(".eng-v2")`) };
  await page.close();
}

writeFileSync(join(OUT, "checks.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1).slice(0, 4000));

if (process.argv.includes("--webm")) {
  // Engineering and its connection at 2x, real time: hover -> spark -> strips -> scan -> chart -> stable;
  // hold; leave -> drain; a second activation.
  let cam = null;
  const r = await recordWebm({
    url: BASE + "/lab-v2",
    width: W,
    height: H,
    out: join(ROOT, "docs/m1.4h1/engineering-activation.webm"),
    crop: async (page) => {
      cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
      return { x: cam.x + ENG.x * cam.k, y: cam.y + ENG.y * cam.k, w: ENG.w * cam.k, h: ENG.h * cam.k, scale: 2 };
    },
    prepare: async (page) => {
      await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(NO_DEV)}; document.head.append(s); return 1; })()`);
      await page.mouseMove(4, H - 4);
      await sleep(1200);
    },
    act: async (page) => {
      const c = await page.center('[data-hotspot="engineering"]');
      await page.mouseMove(c.x, c.y);
      await sleep(3400);
      await page.mouseMove(4, H - 4);
      await sleep(1800);
      await page.mouseMove(c.x, c.y);
      await sleep(2600);
      await page.mouseMove(4, H - 4);
      await sleep(1500);
    },
  });
  console.log("webm", r);
}
