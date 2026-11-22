#!/usr/bin/env node
// M1.4E.2: Playground's connection endpoint in /lab-v2, at exact phases
// (animations paused and seeked), per endpoint variant, plus the rendered
// geometry and targeted checks.
//
//   node scripts/visual/m14e2-capture.mjs [variants...] [--checks] [--webm]
//     variants  any of: contact extension default (default: the page as built)
//     --checks  geometry, timing, interruption, keyboard, deep link, reduced motion
//     --webm    real-time recording of the arrival (close-up), docs/m1.4e2/connection-arrival.webm
//
// BASE defaults to http://localhost:3002. Writes docs/m1.4e2/work/captures/<variant>/*.png
// and docs/m1.4e2/work/captures/checks.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";
import { recordWebm } from "./record.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs/m1.4e2/work/captures");
const BASE = process.env.BASE || "http://localhost:3002";
const W = 1648;
const H = 928;
/** 1x crop: the line's floor run and the station's base. */
const REGION = { x: 940, y: 380, w: 380, h: 200 };
/** 3x close-up: the endpoint and the uncovered floor. */
const CLOSE = { x: 1040, y: 492, w: 160, h: 64 };
const NO_SHADOW = ".lab-v2-shadow{visibility:hidden!important}";
const NO_DEV = "nextjs-portal{display:none!important}";
const LIFT = '.lab-lift[data-lift="playground"]';
const args = process.argv.slice(2);
const variants = args.filter((a) => !a.startsWith("--"));
const variantCss = (v) => (v === "default" ? "" : `[data-pg-variant]{display:none}[data-pg-variant="${v}"]{display:inline}`);

const checks = { base: BASE };

async function open(path, opts = {}, variant = "default") {
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
  const css = (t) =>
    page.eval(`(() => { document.getElementById("ev")?.remove(); const s = document.createElement("style"); s.id = "ev"; s.textContent = ${JSON.stringify(NO_DEV + variantCss(variant) + t)}; document.head.append(s); return 1; })()`).then(frame);
  // Seek every animation (CSS transitions included), or after leaving only those created since.
  const seek = (t) => page.eval(`(() => { const pre = window.__pre; document.getAnimations().filter((a) => !pre || !pre.has(a)).forEach((a) => { a.pause(); a.currentTime = ${t}; }); return 1; })()`).then(frame);
  const resume = () => page.eval(`(() => { document.getAnimations().forEach((a) => a.play()); return 1; })()`);
  const shot = async (dir, file, r = null, scale = 1) => {
    mkdirSync(join(OUT, dir), { recursive: true });
    const p = r ? { format: "png", clip: { x: cam.x + r.x * cam.k, y: cam.y + r.y * cam.k, width: r.w * cam.k, height: r.h * cam.k, scale } } : { format: "png" };
    const res = await page.send("Page.captureScreenshot", p);
    writeFileSync(join(OUT, dir, file), Buffer.from(res.data, "base64"));
  };
  // Rendered geometry, in scene px (screen -> scene through the camera).
  const state = () =>
    page.eval(`(() => {
      const k = ${cam.k}, cx = ${cam.x}, cy = ${cam.y};
      const sc = (x, y) => [+((x - cx) / k).toFixed(2), +((y - cy) / k).toFixed(2)];
      const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; const a = sc(r.left, r.top), b = sc(r.right, r.bottom); return [a[0], a[1], +(b[0] - a[0]).toFixed(2), +(b[1] - a[1]).toFixed(2)]; };
      const vis = (e) => e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const op = (sel) => { const e = [...document.querySelectorAll(sel)].find(vis); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
      const lift = document.querySelector(${JSON.stringify(LIFT)});
      const m = lift ? new DOMMatrix(getComputedStyle(lift).transform) : null;
      const head = document.querySelector('[data-surge="playground"] [data-pass="core"] [data-surge-turn]');
      const hr = head?.getBoundingClientRect();
      // The line's own end: the last point of its last part, through the SVG's screen matrix.
      let lineEnd = null;
      for (const p of document.querySelectorAll('[data-v2-line="playground"][data-v2-line-kind="dim"] path')) {
        const pt = p.getPointAtLength(p.getTotalLength());
        const s = new DOMPoint(pt.x, pt.y).matrixTransform(p.getScreenCTM());
        const q = sc(s.x, s.y);
        if (!lineEnd || q[0] > lineEnd[0]) lineEnd = q;
      }
      const ext = [...document.querySelectorAll("[data-v2-endpoint] .pg-end-boost path")].filter(vis).map((p) => {
        const a = new DOMPoint(p.getPointAtLength(0).x, p.getPointAtLength(0).y).matrixTransform(p.getScreenCTM());
        const L = p.getTotalLength(), b0 = p.getPointAtLength(L);
        const b = new DOMPoint(b0.x, b0.y).matrixTransform(p.getScreenCTM());
        return [sc(a.x, a.y), sc(b.x, b.y)];
      })[0] ?? null;
      const contact = [...document.querySelectorAll('[data-pg-variant="contact"] ellipse')].find(vis);
      return {
        lift_matrix: m ? { a: +m.a.toFixed(4), d: +m.d.toFixed(4), e: +m.e.toFixed(2), f: +m.f.toFixed(2) } : null,
        lift_px: m ? +(m.f / k).toFixed(2) : null,
        line_end: lineEnd,
        extension: ext,
        contact_rect: rect(contact),
        shadow_ambient_rect: rect(document.querySelector(".lab-v2-shadow-ambient")),
        spark_scene: hr && hr.width >= 0 ? sc(hr.left, hr.top) : null,
        spark_core_opacity: op('[data-surge="playground"] [data-pass="core"] [data-surge-head]'),
        burst_opacity: op('[data-surge="playground"] [data-surge-burst]'),
        strip_off_opacity: op(".lab-v2-strip-off"),
        shadow_ambient_opacity: op(".lab-v2-shadow-ambient"),
        end_boost_opacity: op("[data-v2-endpoint] .pg-end-boost"),
        end_lit_opacity: op("[data-v2-endpoint] .pg-end-lit"),
        end_flash_opacity: op("[data-v2-endpoint] .pg-end-flash"),
      };
    })()`);
  await css("");
  return { page, errors, cam, css, seek, resume, shot, state };
}

async function phases(variant) {
  const dir = variant;
  const { page, errors, cam, css, seek, resume, shot, state } = await open("/lab-v2", {}, variant);
  const res = { camera: cam };
  const both = async (name) => {
    await shot(dir, `${name}.png`);
    await shot(dir, `${name}-1x.png`, REGION);
    await shot(dir, `${name}-3x.png`, CLOSE, 3);
  };
  await both("A-rest");
  res.rest = await state();
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(20);
  // Just before arrival (seek forward only: finished transitions leave getAnimations()).
  await seek(598);
  res.before_arrival = await state();
  for (const [name, t] of [
    ["B-spark-half", 293],
    ["C-spark-arriving", 612],
    ["D-endpoint-activates", 700],
    ["E-rising", 850],
    ["F-rising-late", 1000],
  ]) {
    await seek(t);
    res[name] = { t, ...(await state()) };
    await both(name);
  }
  await seek(2400);
  res.lifted = await state();
  await both("G-lifted");
  await css(NO_SHADOW);
  await both("H-lifted-no-shadow");
  await css("");
  // Returning, half way down.
  await resume();
  await sleep(300);
  await page.eval(`(() => { window.__pre = new Set(document.getAnimations()); return 1; })()`);
  await page.mouseMove(4, H - 4);
  const t0 = Date.now();
  while ((await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover || ""`)) && Date.now() - t0 < 3000) await sleep(5);
  await sleep(20);
  const full = res.lifted.lift_px;
  let lo = 0;
  let hi = 420;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    await seek(mid);
    if ((await state()).lift_px < full / 2) lo = mid;
    else hi = mid;
  }
  res.return_half_ms = Math.round((lo + hi) / 2);
  await seek(res.return_half_ms);
  res.returning = await state();
  await both("I-returning");
  await page.eval(`(() => { window.__pre = null; return 1; })()`);
  await resume();
  await sleep(1600);
  res.rest_again = await state();
  await both("J-rest-again");
  res.fixed_while_lifting = {
    line_end: JSON.stringify(res.rest.line_end) === JSON.stringify(res.lifted.line_end),
    extension: JSON.stringify(res.rest.extension) === JSON.stringify(res.lifted.extension),
    contact: JSON.stringify(res.rest.contact_rect) === JSON.stringify(res.lifted.contact_rect),
  };
  res.errors = errors;
  await page.close();
  return res;
}

for (const v of variants) checks[v] = await phases(v);

if (args.includes("--checks")) {
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
  // Keyboard: Tab to Playground, Enter (selected), Escape.
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
    const { page, errors, state, shot } = await open("/lab-v2", { reducedMotion: true });
    const c = await page.center('[data-hotspot="playground"]');
    await page.mouseMove(c.x, c.y);
    await sleep(1200);
    checks.reduced_motion = { ...(await state()), errors };
    await shot("reduced-motion", "hovered-1x.png", REGION);
    await page.close();
  }
  // The homepage: untouched (no v2 assets, no endpoint layer).
  {
    const page = await launch({ width: W, height: H });
    const urls = [];
    await page.send("Network.enable");
    page.on((m) => {
      if (m.method === "Network.requestWillBeSent") urls.push(m.params.request.url);
    });
    await page.goto(BASE + "/");
    await sleep(1500);
    checks.homepage = {
      v2_requests: urls.filter((u) => u.includes("/scene/v2/")).length,
      v2_endpoint_nodes: await page.eval(`document.querySelectorAll("[data-v2-endpoint]").length`),
      v2_line_nodes: await page.eval(`document.querySelectorAll("[data-v2-line]").length`),
    };
    await page.close();
  }
}

if (variants.length || args.includes("--checks")) {
  mkdirSync(OUT, { recursive: true });
  const name = args.includes("--checks") ? "checks.json" : `variants-${variants.join("-")}.json`;
  writeFileSync(join(OUT, name), JSON.stringify(checks, null, 1) + "\n");
  console.log(JSON.stringify(checks, (k, v) => (k === "camera" ? undefined : v), 1).slice(0, 6000));
}

if (args.includes("--webm")) {
  // Close-up of the line and the station, 2x, real time: hover -> spark -> endpoint ->
  // strips -> rise; hold; leave -> lower -> dim; then an interrupted hover.
  const crop = { x: 860, y: 340, w: 560, h: 260 };
  let cam = null;
  const out = join(ROOT, "docs/m1.4e2/connection-arrival.webm");
  const r = await recordWebm({
    url: BASE + "/lab-v2",
    width: W,
    height: H,
    out,
    crop: async (page) => {
      cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
      return { x: cam.x + crop.x * cam.k, y: cam.y + crop.y * cam.k, w: crop.w * cam.k, h: crop.h * cam.k, scale: 2 };
    },
    prepare: async (page) => {
      await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(NO_DEV)}; document.head.append(s); return 1; })()`);
      await page.mouseMove(4, H - 4);
      await sleep(1200);
    },
    act: async (page) => {
      const c = await page.center('[data-hotspot="playground"]');
      await page.mouseMove(c.x, c.y);
      await sleep(2600);
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
