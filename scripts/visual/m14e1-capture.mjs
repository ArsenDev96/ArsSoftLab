#!/usr/bin/env node
// M1.4E.1: Playground's grounding and power connection in /lab-v2, at exact
// phases (animations paused and seeked), plus targeted checks: the line stays
// on the floor while the station rises, nothing on the platform activates
// before the spark arrives, interruption, keyboard, deep link, reduced motion.
// The approved homepage (/) is captured at the same phases for reference.
//
//   node scripts/visual/m14e1-capture.mjs        (BASE default http://localhost:3002)
//
// Writes docs/m1.4e1/work/captures/<v2|approved>/*.png and checks.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs/m1.4e1/work/captures");
const BASE = process.env.BASE || "http://localhost:3002";
const W = 1648;
const H = 928;
const STATION = { x: 1000, y: 300, w: 440, h: 320 };
const LINE = { x: 860, y: 480, w: 560, h: 130 };
const NO_SHADOW = ".lab-v2-shadow,.lab-depth-shadow,.lab-lift-shadow,.lab-lift-penumbra{visibility:hidden!important}";
const NO_DEV = "nextjs-portal{display:none!important}";
const LIFT = '.lab-lift[data-lift="playground"]';
const ROUTE_MID_X = 985; // ~ half the route's length (scene px), see NOTES

const checks = {};

async function open(path, opts = {}) {
  const page = await launch({ width: W, height: H, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await page.goto(BASE + path);
  await page.mouseMove(4, H - 4);
  await sleep(900);
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const frame = () => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  const css = (t) => page.eval(`(() => { document.getElementById("ev")?.remove(); const s = document.createElement("style"); s.id = "ev"; s.textContent = ${JSON.stringify(NO_DEV + t)}; document.head.append(s); return 1; })()`).then(frame);
  // Seek every animation, or (after leaving) only those created since: rewinding the
  // finished arrival animations would revive the spark mid-route.
  const seek = (t) => page.eval(`(() => { const pre = window.__pre; document.getAnimations().filter((a) => !pre || !pre.has(a)).forEach((a) => { a.pause(); a.currentTime = ${t}; }); return 1; })()`).then(frame);
  const resume = () => page.eval(`(() => { document.getAnimations().forEach((a) => a.play()); return 1; })()`);
  const shot = async (dir, file, r = null, scale = 1) => {
    mkdirSync(join(OUT, dir), { recursive: true });
    const p = r ? { format: "png", clip: { x: cam.x + r.x * cam.k, y: cam.y + r.y * cam.k, width: r.w * cam.k, height: r.h * cam.k, scale } } : { format: "png" };
    const res = await page.send("Page.captureScreenshot", p);
    writeFileSync(join(OUT, dir, file), Buffer.from(res.data, "base64"));
  };
  const state = () =>
    page.eval(`(() => {
      const k = ${cam.k}, cx = ${cam.x}, cy = ${cam.y};
      const lift = document.querySelector(${JSON.stringify(LIFT)});
      const head = document.querySelector('[data-surge="playground"] [data-pass="core"] [data-surge-turn]');
      const hr = head?.getBoundingClientRect();
      const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
      const line = document.querySelector('[data-v2-line="playground"][data-v2-line-kind="dim"] path');
      const lr = line?.getBoundingClientRect();
      return {
        lift_px: lift ? +new DOMMatrix(getComputedStyle(lift).transform).f.toFixed(2) : null,
        spark_scene: hr ? [+((hr.left - cx) / k).toFixed(1), +((hr.top - cy) / k).toFixed(1)] : null,
        spark_core_opacity: op('[data-surge="playground"] [data-pass="core"] [data-surge-head]'),
        strip_off_opacity: op(".lab-v2-strip-off"),
        shadow_ambient_opacity: op(".lab-v2-shadow-ambient"),
        shadow_contact_opacity: op(".lab-v2-shadow-contact"),
        line_rect: lr ? [+lr.left.toFixed(2), +lr.top.toFixed(2), +lr.width.toFixed(2), +lr.height.toFixed(2)] : null,
      };
    })()`);
  await css("");
  return { page, errors, cam, css, seek, resume, shot, state };
}

async function phases(dir, path) {
  const { page, errors, cam, css, seek, resume, shot, state } = await open(path);
  const res = { camera: cam };
  await shot(dir, "A-rest.png");
  await shot(dir, "A-rest-station.png", STATION);
  await shot(dir, "A-rest-line-3x.png", LINE, 3);
  res.rest = await state();
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(20);
  // B: the spark half way along the route (by its measured position).
  let lo = 0;
  let hi = 600;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    await seek(mid);
    const x = (await state()).spark_scene?.[0] ?? 0;
    if (x < ROUTE_MID_X) lo = mid;
    else hi = mid;
  }
  res.half_ms = Math.round((lo + hi) / 2);
  await seek(res.half_ms);
  res.half = await state();
  await shot(dir, "B-spark-half.png");
  await shot(dir, "B-spark-half-line-3x.png", LINE, 3);
  // Just before arrival: nothing on the platform may have started.
  await seek(598);
  res.before_arrival = await state();
  // C: the spark arriving (the line's end, the landing).
  await seek(612);
  res.arriving = await state();
  await shot(dir, "C-spark-arriving.png");
  await shot(dir, "C-spark-arriving-line-3x.png", LINE, 3);
  await shot(dir, "C-spark-arriving-station.png", STATION);
  // Strips light, station starts to rise.
  await seek(760);
  res.strips_on = await state();
  await shot(dir, "C2-strips-lighting-station.png", STATION);
  // D: full lift; E: without shadows.
  await seek(2400);
  res.lifted = await state();
  await shot(dir, "D-lifted.png");
  await shot(dir, "D-lifted-station.png", STATION);
  await shot(dir, "D-lifted-line-3x.png", LINE, 3);
  await css(NO_SHADOW);
  await shot(dir, "E-lifted-no-shadow.png");
  await shot(dir, "E-lifted-no-shadow-station.png", STATION);
  await shot(dir, "E-lifted-no-shadow-line-3x.png", LINE, 3);
  await css("");
  // F: returning, half way down.
  await resume();
  await sleep(300);
  await page.eval(`(() => { window.__pre = new Set(document.getAnimations()); return 1; })()`);
  await page.mouseMove(4, H - 4);
  const t0 = Date.now();
  while ((await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover || ""`)) && Date.now() - t0 < 3000) await sleep(5);
  await sleep(20);
  const full = res.lifted.lift_px;
  lo = 0;
  hi = 420;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    await seek(mid);
    if ((await state()).lift_px < full / 2) lo = mid;
    else hi = mid;
  }
  res.return_half_ms = Math.round((lo + hi) / 2);
  await seek(res.return_half_ms);
  res.returning = await state();
  await shot(dir, "F-returning.png");
  await shot(dir, "F-returning-station.png", STATION);
  await page.eval(`(() => { window.__pre = null; return 1; })()`);
  await resume();
  await sleep(1600);
  res.rest_again = await state();
  res.errors = errors;
  await page.close();
  return res;
}

checks.v2 = await phases("v2", "/lab-v2");
checks.approved = await phases("approved", "/");
checks.line_fixed_while_lifting = JSON.stringify(checks.v2.rest.line_rect) === JSON.stringify(checks.v2.lifted.line_rect);

// Interruption: leave before the spark arrives; nothing may switch on later.
{
  const { page, errors, state } = await open("/lab-v2");
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(300);
  await page.mouseMove(4, H - 4);
  await sleep(500);
  const mid = await state();
  await sleep(1200);
  checks.interrupted = { at_800ms: mid, at_2000ms: await state(), errors };
  await page.close();
}
// Keyboard: Tab to Playground, Enter (selected: powered, lifted), Escape.
{
  const { page, errors, state } = await open("/lab-v2");
  let tabs = null;
  for (let i = 0; i < 30 && !tabs; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(40);
    const d = await page.eval(`(() => { const e = document.activeElement; return e ? (e.getAttribute("aria-label") || e.textContent || "").trim() : ""; })()`);
    if (/playground/i.test(d)) tabs = i + 1;
  }
  await sleep(1500);
  const focused = await state();
  await page.key("Enter", "Enter", 13);
  await sleep(1500);
  const selected = { ...(await state()), url: await page.eval(`location.pathname + location.search`) };
  await page.key("Escape", "Escape", 27);
  await sleep(1500);
  checks.keyboard = { tabs, focused, selected, after_escape: { ...(await state()), url: await page.eval(`location.pathname + location.search`) }, errors };
  await page.close();
}
{
  const { page, errors, state } = await open("/lab-v2?station=playground");
  checks.deep_link = { ...(await state()), errors };
  await page.close();
}
{
  const { page, errors, state } = await open("/lab-v2", { reducedMotion: true });
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(1200);
  checks.reduced_motion = { ...(await state()), errors };
  await page.close();
}

writeFileSync(join(OUT, "checks.json"), JSON.stringify(checks, null, 1) + "\n");
console.log(JSON.stringify(checks, null, 1));
