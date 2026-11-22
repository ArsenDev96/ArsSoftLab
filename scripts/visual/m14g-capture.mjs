#!/usr/bin/env node
// M1.4G: floor lighting, reflections and grounding in /lab-v2 (experimental).
// Same 1648 x 928 viewport and camera as earlier milestones. Captures:
//   before/      the M1.4G floor layers hidden (M1.4F.1's scene, minus M1.4D's
//                generic ellipses, which M1.4G replaces)
//   after/       default (no floor tone)
//   tone/        ?floor=approved (the optional floor-tone correction)
//   playground/  rest, the lift sequence (seeked), fully lifted, lifted with the
//                shadows disabled; the reflection's offset at each step
//   home/        the approved homepage
// plus targeted checks (layers, console, keyboard, deep link, reduced motion,
// homepage requests) and a frame-time sample during Playground's lift with and
// without the floor layers. Writes docs/m1.4g/work/captures/** and checks.json.
//
//   node scripts/visual/m14g-capture.mjs      (BASE default http://localhost:3003)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs/m1.4g/work/captures");
const BASE = process.env.BASE || "http://localhost:3003";
const W = 1648;
const H = 928;
const NO_DEV = "nextjs-portal{display:none!important}";
const HIDE_FLOOR = "[data-v2-floor],[data-v2-reflection]{display:none!important}";
/** Scene rects: each station's floor area, its 3x close-up, Playground. */
const AREAS = {
  engineering: { x: 230, y: 470, w: 430, h: 150 },
  educational: { x: 640, y: 430, w: 400, h: 130 },
  playground: { x: 1010, y: 460, w: 420, h: 160 },
  creative: { x: 40, y: 670, w: 580, h: 200 },
  experience: { x: 1040, y: 660, w: 631, h: 230 },
};
const CLOSE = {
  engineering: { x: 330, y: 520, w: 300, h: 90 },
  educational: { x: 660, y: 470, w: 350, h: 60 },
  playground: { x: 1030, y: 500, w: 370, h: 90 },
  creative: { x: 380, y: 690, w: 230, h: 130 },
  experience: { x: 1050, y: 690, w: 330, h: 160 },
};
const PG = { x: 1000, y: 330, w: 440, h: 300 };
const checks = { base: BASE };

async function open(path, opts = {}) {
  const page = await launch({ width: W, height: H, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await page.goto(BASE + path);
  const css = (t) => page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(t)}; document.head.append(s); return 1; })()`);
  await css(NO_DEV);
  if (opts.hideFloor) await css(HIDE_FLOOR);
  await page.mouseMove(4, H - 4);
  await sleep(1200);
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const frame = () => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  const seek = (t) => page.eval(`(() => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${t}; }); return 1; })()`).then(frame);
  const shot = async (dir, file, r = null, scale = 1) => {
    mkdirSync(join(OUT, dir), { recursive: true });
    const p = r ? { format: "png", clip: { x: cam.x + r.x * cam.k, y: cam.y + r.y * cam.k, width: Math.min(r.w * cam.k, W - 1 - (cam.x + r.x * cam.k)), height: r.h * cam.k, scale } } : { format: "png" };
    writeFileSync(join(OUT, dir, file), Buffer.from((await page.send("Page.captureScreenshot", p)).data, "base64"));
  };
  return { page, errors, cam, seek, shot, css };
}

const lift = (page) =>
  page.eval(`(() => {
    const l = document.querySelector('.lab-lift[data-lift="playground"]');
    const r = document.querySelector('[data-v2-reflection="playground"]');
    const k = l.offsetWidth / 1672;
    const f = (e) => { const t = getComputedStyle(e).transform; return t === "none" ? 0 : +(new DOMMatrix(t).f / k).toFixed(2); };
    return { lift_px: f(l), reflection_drop_px: f(r), reflection_opacity: +(+getComputedStyle(r).opacity).toFixed(3), lp: +(+getComputedStyle(r).getPropertyValue("--lp")).toFixed(3), lit: +(+getComputedStyle(r.querySelector(".lab-v2-refl-lit")).opacity).toFixed(3) };
  })()`);

const layers = (page) =>
  page.eval(`(() => Object.fromEntries([...document.querySelectorAll("[data-v2-floor]")].map((e) => [e.dataset.v2Floor, e.tagName === "IMG" ? { loaded: e.complete && e.naturalWidth > 0, size: e.naturalWidth + "x" + e.naturalHeight, blend: getComputedStyle(e).mixBlendMode } : { blend: getComputedStyle(e).mixBlendMode, mask: getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage }])))()`);

// Before (floor layers hidden), after (default) and with the optional tone.
for (const [dir, path, opts] of [["before", "/lab-v2", { hideFloor: true }], ["after", "/lab-v2", {}], ["tone", "/lab-v2?floor=approved", {}]]) {
  const { page, errors, cam, shot } = await open(path, opts);
  checks.camera = cam;
  if (dir !== "before") checks[`layers_${dir}`] = await layers(page);
  await shot(dir, "rest.png");
  for (const [id, r] of Object.entries(AREAS)) await shot(dir, `${id}-1x.png`, r);
  for (const [id, r] of Object.entries(CLOSE)) await shot(dir, `${id}-3x.png`, r, 3);
  checks[`errors_${dir}`] = errors;
  await page.close();
}

// Playground: rest, the lift sequence, fully lifted, lifted with the shadows disabled.
{
  const { page, errors, shot, seek, css } = await open("/lab-v2");
  checks.playground = { rest: await lift(page) };
  await shot("playground", "rest.png", PG);
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(30);
  // The lift waits for the energy's arrival (650 ms) and rises over 450 ms.
  for (const t of [650, 760, 875, 990, 1100, 2400]) {
    await seek(t);
    checks.playground[`t${t}`] = await lift(page);
    await shot("playground", `lift-${t}.png`, PG);
  }
  await shot("playground", "lifted-full.png");
  await css("[data-v2-ground],[data-v2-floor='contact']{display:none!important}");
  await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  await shot("playground", "lifted-no-shadows.png", PG);
  checks.playground.errors = errors;
  await page.close();
}
{
  const { page, shot } = await open("/lab-v2", { hideFloor: true });
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(1800);
  await shot("playground", "lifted-before.png", PG);
  await page.close();
}

// Frame time during Playground's lift, with and without the floor layers (two runs each).
for (const [label, opts] of [["with_floor", {}], ["without_floor", { hideFloor: true }], ["with_floor_2", {}], ["without_floor_2", { hideFloor: true }]]) {
  const { page } = await open("/lab-v2", opts);
  const c = await page.center('[data-hotspot="playground"]');
  const sample = page.eval(`new Promise((res) => { const t = []; let last = performance.now(); const end = last + 1800; const f = (now) => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ frames: t.length, median_ms: +t[Math.floor(t.length / 2)].toFixed(2), p95_ms: +t[Math.floor(t.length * 0.95)].toFixed(2), max_ms: +t[t.length - 1].toFixed(2) }); } }; requestAnimationFrame(f); })`);
  await sleep(100);
  await page.mouseMove(c.x, c.y);
  (checks.frame_time ??= {})[label] = await sample;
  await page.close();
}

// Keyboard, deep link and reduced motion (the floor is static; the reflection must hold still).
{
  const { page, errors } = await open("/lab-v2");
  let found = null;
  for (let i = 0; i < 40 && !found; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(30);
    const st = await page.eval(`(() => { const e = document.activeElement; return e && e.closest("h2") ? e.closest("[data-station]")?.dataset.station ?? "" : ""; })()`);
    if (st === "playground") found = i + 1;
  }
  await sleep(1500);
  checks.keyboard_playground = { tab: found, ...(await lift(page)), errors };
  await page.close();
}
{
  const { page, errors } = await open("/lab-v2?station=playground");
  await sleep(1500);
  checks.deep_link_playground = { ...(await lift(page)), errors };
  await page.close();
}
{
  const { page, errors, shot } = await open("/lab-v2", { reducedMotion: true });
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(1500);
  checks.reduced_motion_playground = { ...(await lift(page)), errors };
  await shot("playground", "reduced-motion-hover.png", PG);
  await page.close();
}

// The approved homepage (twice: the second measures run-to-run noise).
for (const file of ["rest.png", "rest-2.png"]) {
  const page = await launch({ width: W, height: H });
  const urls = [];
  await page.send("Network.enable");
  page.on((m) => {
    if (m.method === "Network.requestWillBeSent") urls.push(m.params.request.url);
  });
  await page.goto(BASE + "/");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(NO_DEV)}; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, H - 4);
  await sleep(1400);
  mkdirSync(join(OUT, "home"), { recursive: true });
  writeFileSync(join(OUT, "home", file), Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  if (file === "rest.png") checks.homepage = { v2_requests: urls.filter((u) => u.includes("/scene/v2/")).length, m14g_requests: urls.filter((u) => u.includes("/m14g/")).length };
  await page.close();
}

writeFileSync(join(OUT, "checks.json"), JSON.stringify(checks, null, 1) + "\n");
console.log(JSON.stringify(checks, null, 1));
