#!/usr/bin/env node
// M1.2.2 evidence for the independent Engineering station layer.
//
// Usage (against a running production build):
//   node scripts/visual/station-lift.mjs --url http://localhost:3100 --out docs/m1.2.2
//
// Writes:
//   idle.png, engineering-hover.png, engineering-return.png
//   comparison.png        M1.2.1 baseline vs idle, hover, return (+ crops)
//   lift-frames.png       intermediate frames (transitions paused at fixed times)
//   lift-edges.png        station edges at 6x: idle vs lifted vs mid-transition
//   lift-report.txt       swap "pop", label alignment, frame timing
// Optional --record renders 30 fps recording frames into <work>/rec (assembled
// separately into an animated WebP; see docs/m1.2.2/NOTES.md). Intermediate
// frames go to --work (default .visual/station-lift-work, git-ignored).

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";
import { compareImages, composeGrid, prepare } from "./compare.mjs";
import { HOTSPOT, LIFT_REGION, liftState } from "./lift.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL_ = opt("url", "http://localhost:3000");
const OUT = resolve(opt("out", ".visual/m1.2.2"));
const BASELINE = resolve(opt("baseline", "docs/m1.2.1/idle.png"));
const RECORD = argv.includes("--record");
const W = 1648, H = 928;
const WORK = resolve(opt("work", ".visual/station-lift-work"));
mkdirSync(OUT, { recursive: true });
mkdirSync(join(WORK, "frames"), { recursive: true });
const out = (f) => join(OUT, f);
const work = (f) => join(WORK, f);
const report = [];
const log = (line) => (console.log(line), report.push(line));

/** Scene px -> screen px (scene covers the viewport; 1672x941 frame). */
const K = Math.max(W / 1672, H / 941);
const OX = (W - 1672 * K) / 2, OY = (H - 941 * K) / 2;
const screenBox = ([x0, y0, x1, y1]) => [Math.floor(OX + x0 * K), Math.floor(OY + y0 * K), Math.ceil(OX + x1 * K), Math.ceil(OY + y1 * K)];
const REGION = screenBox([LIFT_REGION.x0, LIFT_REGION.y0, LIFT_REGION.x1, LIFT_REGION.y1]);

const settle = async (page) => {
  await sleep(60);
  await page.finishTransitions();
  await sleep(150);
  await page.finishTransitions();
  await sleep(150);
};

/** Wait for the lift's transform transitions to start, then hold them all at `ms`. */
async function holdTransitionsAt(page, ms) {
  for (let i = 0; i < 100; i++) {
    const n = await page.eval(
      `document.getAnimations().filter((a) => a instanceof CSSTransition && a.transitionProperty === "transform" && a.effect.target.classList.contains("lab-lift")).length`,
    );
    if (n >= 2) break;
    await sleep(5);
  }
  await page.eval(`document.getAnimations().filter((a) => a instanceof CSSTransition).forEach((a) => { a.pause(); a.currentTime = ${ms}; }); true`);
  await sleep(120);
}

// 1. States + intermediate frames (software raster, deterministic) -----------
const IN_TIMES = [0, 64, 128, 192, 256, 320];
const OUT_TIMES = [84, 168, 252, 336];
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await page.freezeAnimations(0);
    await page.screenshot(out("idle.png"));
    const hot = await page.center(HOTSPOT);

    for (const t of IN_TIMES) {
      await page.goto(URL_);
      await page.freezeAnimations(0);
      await page.mouseMove(hot.x, hot.y);
      await holdTransitionsAt(page, t);
      await page.screenshot(work(`frames/in-${t}.png`));
    }
    for (const t of OUT_TIMES) {
      await page.goto(URL_);
      await page.freezeAnimations(0);
      await page.mouseMove(hot.x, hot.y);
      await settle(page);
      await page.mouseMove(4, H - 4);
      await holdTransitionsAt(page, t);
      await page.screenshot(work(`frames/out-${t}.png`));
    }

    await page.goto(URL_);
    await page.freezeAnimations(0);
    await page.mouseMove(hot.x, hot.y);
    await settle(page);
    await page.screenshot(out("engineering-hover.png"));
    const s = await liftState(page);
    log(`hover state: scale ${s.scale}, translateY ${s.ty}px (CSS), label offset from rigid transform ${s.labelErr}px`);
    await page.mouseMove(4, H - 4);
    await settle(page);
    await page.freezeAnimations(0);
    await page.screenshot(out("engineering-return.png"));
  } finally {
    await page.close();
  }
}

// 2. Comparisons and sheets ---------------------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await prepare(page);
    const fmt = (r) => `mean ${r.mean.toFixed(4)}, max ${r.max}, >2: ${r.over2}, >12: ${r.over12}`;
    log(`idle vs M1.2.1 idle:                 ${fmt(await compareImages(page, out("idle.png"), BASELINE))}`);
    log(`return vs idle:                      ${fmt(await compareImages(page, out("engineering-return.png"), out("idle.png")))}`);
    log(`hover vs idle, outside station area: ${fmt(await compareImages(page, out("engineering-hover.png"), out("idle.png"), { exclude: [REGION] }))}`);
    // The swap: layers switched on at identity transform (hover, t = 0).
    const pop = await compareImages(page, work("frames/in-0.png"), out("idle.png"), { heatmapPath: work("frames/pop-heat.png") });
    log(`layer swap at t=0 vs idle ("pop"):   ${fmt(pop)}`);

    const crop = screenBox([225, 290, 645, 575]);
    await composeGrid(
      page,
      [
        { label: "M1.2.1 baseline", path: BASELINE, crop },
        { label: "M1.2.2 idle", path: out("idle.png"), crop },
        { label: "M1.2.2 hover (lifted)", path: out("engineering-hover.png"), crop },
        { label: "M1.2.2 return", path: out("engineering-return.png"), crop },
      ],
      out("comparison.png"),
      { columns: 2, scale: 1.6 },
    );

    const fcrop = screenBox([240, 305, 640, 572]);
    await composeGrid(
      page,
      [
        ...IN_TIMES.map((t) => ({ label: `hover +${t} ms`, path: work(`frames/in-${t}.png`), crop: fcrop })),
        ...OUT_TIMES.map((t) => ({ label: `leave +${t} ms`, path: work(`frames/out-${t}.png`), crop: fcrop })),
        { label: "return (settled)", path: out("engineering-return.png"), crop: fcrop },
        { label: "swap at +0 ms vs idle, diff x40", path: work("frames/pop-heat.png"), crop: fcrop },
      ],
      out("lift-frames.png"),
      { columns: 3, scale: 1.25 },
    );

    const edges = [
      ["base, left", [255, 515, 335, 562]],
      ["base, right + line", [545, 505, 625, 562]],
      ["laptop top", [330, 362, 410, 395]],
      ["charts", [480, 400, 560, 440]],
    ];
    const items = [];
    for (const [name, box] of edges) {
      const b = screenBox(box);
      items.push(
        { label: `${name}: idle`, path: out("idle.png"), crop: b },
        { label: `${name}: +128 ms`, path: work("frames/in-128.png"), crop: b },
        { label: `${name}: lifted`, path: out("engineering-hover.png"), crop: b },
      );
    }
    await composeGrid(page, items, out("lift-edges.png"), { columns: 3, scale: 4, pixelated: true });
  } finally {
    await page.close();
  }
}

// 3. Frame timing on the GPU path ---------------------------------------------
{
  const page = await launch({ width: W, height: H, gpu: true });
  try {
    await page.goto(URL_);
    const hot = await page.center(HOTSPOT);
    await page.eval(`window.__dts = []; (function tick(t0) { requestAnimationFrame((t) => { if (t0) __dts.push(t - t0); tick(t); }); })(); true`);
    const metrics = async () => Object.fromEntries((await page.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    await page.send("Performance.enable");
    await sleep(1000);
    const m0 = await metrics();
    await page.eval(`__dts.length = 0; true`);
    for (let i = 0; i < 8; i++) {
      await page.mouseMove(hot.x, hot.y);
      await sleep(600);
      await page.mouseMove(4, H - 4);
      await sleep(700);
    }
    const m1 = await metrics();
    const dts = (await page.eval(`__dts.slice()`)).sort((a, b) => a - b);
    const q = (p) => dts[Math.min(dts.length - 1, Math.floor(p * dts.length))].toFixed(1);
    log(`GPU, 8 hover in/out cycles: ${dts.length} frames, median ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${dts.at(-1).toFixed(1)} ms, >25 ms: ${dts.filter((d) => d > 25).length}`);
    const d = (k) => (m1[k] - m0[k]).toFixed(k.endsWith("Duration") ? 3 : 0);
    log(`  main thread during cycles: ${d("RecalcStyleCount")} style recalcs (${d("RecalcStyleDuration")} s), ${d("LayoutCount")} layouts (${d("LayoutDuration")} s), script ${d("ScriptDuration")} s, task ${d("TaskDuration")} s over ~10.4 s`);

  } finally {
    await page.close();
  }
}

// 4. Recording: deterministic 30 fps frames -----------------------------------
// Headless screencasts drop most frames, so every frame is rendered at an
// exact time instead: all CSS animations (energy, orbit) are seeked to t and
// every transition to t minus the moment its pointer event happened.
if (RECORD) {
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    const hot = await page.center(HOTSPOT);
    const title = await page.center("#station-engineering-trigger");
    const away = { x: 4, y: H - 4 };
    const FPS = 30, END = 6.6;
    const events = [[1.0, hot], [2.6, away], [3.8, title], [5.4, away]];
    const [cx0, cy0, cx1, cy1] = screenBox([170, 290, 730, 600]);
    const clip = { x: cx0, y: cy0, width: cx1 - cx0, height: cy1 - cy0, scale: 1 };
    mkdirSync(work("rec"), { recursive: true });
    let n = 0;
    for (let f = 0; f <= END * FPS; f++) {
      const t = f / FPS;
      while (events.length && events[0][0] <= t + 1e-9) {
        const [at, p] = events.shift();
        await page.mouseMove(p.x, p.y);
        await sleep(80); // let React apply data-lab-hover and CSS create the transitions
        await page.eval(`document.getAnimations().forEach((a) => { if (a instanceof CSSTransition && a.__start === undefined) a.__start = ${at * 1000}; }); true`);
      }
      await page.eval(`document.getAnimations().forEach((a) => { a.pause(); a.currentTime = a instanceof CSSTransition ? Math.max(0, ${t * 1000} - (a.__start ?? ${t * 1000})) : ${t * 1000}; }); true`);
      const r = await page.send("Page.captureScreenshot", { format: "png", clip });
      writeFileSync(work(`rec/f${String(n++).padStart(4, "0")}.png`), Buffer.from(r.data, "base64"));
    }
    log(`recording: ${n} frames at ${FPS} fps (${END} s), clip ${clip.width}x${clip.height} px`);
  } finally {
    await page.close();
  }
}

writeFileSync(out("lift-report.txt"), report.join("\n") + "\n");
