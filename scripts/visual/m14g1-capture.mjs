#!/usr/bin/env node
// M1.4G.1: Playground's floor lighting following its power, Creative Studio's
// colour artifact, and the floor tone, in /lab-v2 (experimental).
//
//   node scripts/visual/m14g1-capture.mjs <label>     (BASE default http://localhost:3003)
//
// <label> is "before" (M1.4G) or "after" (M1.4G.1). Same 1648 x 928 viewport and
// camera as earlier milestones. Writes docs/m1.4g1/work/captures/<label>/:
//   scene-default.png, scene-tone.png     the whole scene at rest, both floor options
//   creative-3x.png                       Creative Studio's right end at 3x
//   pg-<state>.png, pg-<state>-3x.png     Playground at rest, charging, powered,
//                                         lifted and returning (1x and its floor at 3x)
// and <label>.json: each state's lift, strip and floor-light opacities, the
// reflection's drop; keyboard, reduced motion, console errors, homepage requests.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LABEL = process.argv[2] || "after";
const OUT = join(ROOT, "docs/m1.4g1/work/captures", LABEL);
const BASE = process.env.BASE || "http://localhost:3003";
const W = 1648;
const H = 928;
const NO_DEV = "nextjs-portal{display:none!important}";
const PG = { x: 1000, y: 330, w: 440, h: 300 };
const PG_FLOOR = { x: 1030, y: 500, w: 370, h: 110 };
const CREATIVE = { x: 400, y: 690, w: 200, h: 110 };
const out = { base: BASE, label: LABEL };
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
  const finish = () => page.eval(`(() => { document.getAnimations().forEach((a) => a.finish()); return 1; })()`).then(frame);
  const shot = async (file, r = null, scale = 1) => {
    const p = r ? { format: "png", clip: { x: cam.x + r.x * cam.k, y: cam.y + r.y * cam.k, width: Math.min(r.w * cam.k, W - 1 - (cam.x + r.x * cam.k)), height: r.h * cam.k, scale } } : { format: "png" };
    writeFileSync(join(OUT, file), Buffer.from((await page.send("Page.captureScreenshot", p)).data, "base64"));
  };
  return { page, errors, cam, seek, finish, shot };
}

// Every opacity that should follow Playground's power, the lift and the reflection's drop.
const pgState = (page) =>
  page.eval(`(() => {
    const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
    const l = document.querySelector('.lab-lift[data-lift="playground"]');
    const r = document.querySelector('[data-v2-reflection="playground"]');
    const k = l.offsetWidth / 1672;
    const f = (e) => { if (!e) return null; const t = getComputedStyle(e).transform; return t === "none" ? 0 : +(new DOMMatrix(t).f / k).toFixed(2); };
    return {
      hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
      lift_px: f(l),
      strip_off: op(".lab-v2-strip-off"),
      strip_reflection_lit: op('[data-v2-reflection="playground"] .lab-v2-refl-lit, [data-v2-reflection="playground"] .lab-v2-power-lit'),
      ring_lit: op('[data-v2-ring="playground"] .lab-v2-power-lit'),
      reflection_drop_px: f(r),
    };
  })()`);

// Both floor options at the same moment after load, the pointer away.
for (const [file, path] of [["scene-default.png", "/lab-v2"], ["scene-tone.png", "/lab-v2?floor=approved"]]) {
  const { page, errors, shot, finish } = await open(path);
  await finish();
  await shot(file);
  if (file === "scene-default.png") await shot("creative-3x.png", CREATIVE, 3);
  out[`errors_${file}`] = errors;
  await page.close();
}

// Playground through its states (the energy arrives at 650 ms, the lift takes 450 ms).
{
  const { page, errors, seek, finish, shot } = await open("/lab-v2");
  const states = {};
  const snap = async (name) => {
    states[name] = await pgState(page);
    await shot(`pg-${name}.png`, PG);
    await shot(`pg-${name}-3x.png`, PG_FLOOR, 3);
  };
  await snap("rest");
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(30);
  await seek(320);
  await snap("charging");
  await seek(700);
  await snap("powered");
  await seek(2400);
  await snap("lifted");
  await finish();
  await page.mouseMove(4, H - 4);
  // The lab lets go of a hover a moment after the pointer leaves: wait for it, then seek the return.
  for (let i = 0; i < 100 && (await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`)); i++) await sleep(10);
  await seek(150);
  await snap("returning-150ms");
  await seek(300);
  await snap("returning-300ms");
  await finish();
  await sleep(100);
  await snap("returned");
  out.playground = states;
  out.playground_errors = errors;
  await page.close();
}

// Keyboard (Tab to the title, Enter selects, Escape returns) and reduced motion.
{
  const { page, errors } = await open("/lab-v2");
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(30);
    const st = await page.eval(`(() => { const e = document.activeElement; return e && e.closest("h2") ? e.closest("[data-station]")?.dataset.station ?? "" : ""; })()`);
    if (st === "playground") tab = i + 1;
  }
  await sleep(1500);
  const focused = await pgState(page);
  await page.key("Enter", "Enter", 13);
  await sleep(1200);
  const selected = { ...(await pgState(page)), url: await page.eval("location.pathname + location.search") };
  await page.key("Escape", "Escape", 27);
  await sleep(1500);
  const escaped = { ...(await pgState(page)), url: await page.eval("location.pathname + location.search") };
  out.keyboard = { tab, focused, selected, escaped, errors };
  await page.close();
}
{
  const { page, errors, shot } = await open("/lab-v2", { reducedMotion: true });
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(1500);
  out.reduced_motion = { ...(await pgState(page)), errors };
  await shot("pg-reduced-motion.png", PG);
  await page.close();
}
{
  const page = await launch({ width: W, height: H });
  const urls = [];
  await page.send("Network.enable");
  page.on((m) => {
    if (m.method === "Network.requestWillBeSent") urls.push(m.params.request.url);
  });
  await page.goto(BASE + "/");
  await sleep(1400);
  out.homepage = { v2_requests: urls.filter((u) => u.includes("/scene/v2/")).length };
  await page.close();
}

writeFileSync(join(OUT, `${LABEL}.json`), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
