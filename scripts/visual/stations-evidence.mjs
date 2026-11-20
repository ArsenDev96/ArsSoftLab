#!/usr/bin/env node
// M1.3A evidence beyond the pass/fail suite: performance on the GPU path,
// re-render / DOM-churn probe, and (with --record) deterministic recording
// frames of station switching.
//
// Usage (against a running production build):
//   node scripts/visual/stations-evidence.mjs --url http://localhost:3100 --out docs/m1.3a [--record]
//
// Writes <out>/performance.txt. With --record, 30 fps frames go to
// <work>/rec (default .visual/stations-work/rec, git-ignored), assembled
// separately into an animated WebP (see docs/m1.3a/NOTES.md).

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";
import { STATION_IDS, panel, trigger } from "./stations.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL_ = opt("url", "http://localhost:3000");
const OUT = resolve(opt("out", ".visual/m1.3a"));
const WORK = resolve(opt("work", ".visual/stations-work"));
const RECORD = argv.includes("--record");
const W = 1648, H = 928;
mkdirSync(OUT, { recursive: true });
const report = [];
const log = (line) => (console.log(line), report.push(line));

// 1. GPU frame timing: hover every station, then select / switch / return ---------
{
  const page = await launch({ width: W, height: H, gpu: true });
  try {
    await page.goto(URL_);
    log(`renderer: ${await page.eval(`(() => { const g = document.createElement("canvas").getContext("webgl"); const e = g?.getExtension("WEBGL_debug_renderer_info"); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unknown"; })()`)}`);
    await page.eval(`window.__dts = []; (function tick(t0) { requestAnimationFrame((t) => { if (t0) __dts.push(t - t0); tick(t); }); })(); true`);
    await page.send("Performance.enable");
    const metrics = async () => Object.fromEntries((await page.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
    const stats = async (label, seconds, m0) => {
      const m1 = await metrics();
      const dts = (await page.eval(`__dts.splice(0)`)).sort((a, b) => a - b);
      const q = (p) => dts[Math.min(dts.length - 1, Math.floor(p * dts.length))].toFixed(1);
      const d = (k) => (m1[k] - m0[k]).toFixed(k.endsWith("Duration") ? 3 : 0);
      log(`${label}: ${dts.length} frames, median ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${dts.at(-1).toFixed(1)} ms, >25 ms: ${dts.filter((x) => x > 25).length}`);
      log(`  main thread over ~${seconds} s: ${d("RecalcStyleCount")} style recalcs (${d("RecalcStyleDuration")} s), ${d("LayoutCount")} layouts (${d("LayoutDuration")} s), script ${d("ScriptDuration")} s, task ${d("TaskDuration")} s`);
    };
    await sleep(1000);
    await page.eval(`__dts.length = 0; true`);
    let m0 = await metrics();
    await sleep(4000);
    await stats("idle (ambient energy + orbit only)", 4, m0);

    m0 = await metrics();
    for (let k = 0; k < 2; k++)
      for (const id of STATION_IDS) {
        const c = await page.center(`[data-hotspot="${id}"]`);
        await page.mouseMove(c.x, c.y);
        await sleep(600);
      }
    await page.mouseMove(4, H - 4);
    await sleep(600);
    await stats("hover across all five stations x2", 6.6, m0);

    m0 = await metrics();
    for (const id of STATION_IDS) {
      await page.eval(`document.querySelector("${trigger(id)}").click(), true`);
      await sleep(1100);
      await page.eval(`document.querySelector(${JSON.stringify(`${panel(id)} .lab-hero-project`)}).click(), true`);
      await sleep(500);
    }
    await page.key("Escape", "Escape", 27);
    await sleep(1200);
    await stats("select + switch through all five, project each, Escape", 9.2, m0);
  } finally {
    await page.close();
  }
}

// 2. Re-render / DOM churn: hover mutates one attribute, nothing else ---------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await page.eval(`window.__muts = []; new MutationObserver((ms) => ms.forEach((m) => __muts.push(m.type + ":" + (m.attributeName ?? "") + ":" + (m.target.id || m.target.className?.toString().slice(0, 24) || m.target.nodeName)))).observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true }); true`);
    for (const id of STATION_IDS) {
      const c = await page.center(`[data-hotspot="${id}"]`);
      await page.mouseMove(c.x, c.y);
      await sleep(250);
    }
    await page.mouseMove(4, H - 4);
    await sleep(500);
    const muts = await page.eval(`__muts.splice(0)`);
    const kinds = [...new Set(muts)];
    log(`hover across all five stations: ${muts.length} DOM mutations, distinct: ${kinds.join(", ")}`);
    await page.eval(`document.querySelector("${trigger("playground")}").click(), true`);
    await sleep(1200);
    const sel = await page.eval(`__muts.splice(0)`);
    log(`selecting a station: ${sel.length} DOM mutations (attributes/text of the panels, triggers, camera, vignette)`);
  } finally {
    await page.close();
  }
}

writeFileSync(join(OUT, "performance.txt"), report.join("\n") + "\n");

// 3. Recording: deterministic 30 fps frames -----------------------------------
// Every frame is rendered at an exact time: infinite CSS animations (energy,
// orbit) are seeked to t, and every transition / one-off animation to t minus
// the moment the event that created it happened.
if (RECORD) {
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await page.eval(`document.getAnimations().forEach((a) => (a.__start = 0)); true`);
    const move = (sel) => async () => { const p = await page.center(sel); await page.mouseMove(p.x, p.y); };
    const click = (sel) => async () => { const p = await page.center(sel); await page.click(p.x, p.y); await page.mouseMove(p.x, p.y); };
    const away = async () => page.mouseMove(4, H - 4);
    const events = [
      [0.8, move('[data-hotspot="educational"]')],
      [1.6, click(trigger("educational"))],
      [2.2, away],
      [3.6, click(trigger("playground"))],
      [4.2, away],
      [5.4, click(`${panel("playground")} .lab-hero-project`)],
      [5.9, away],
      [7.0, click(`${panel("playground")} [aria-keyshortcuts="Escape"]`)],
      [7.4, away],
      [8.6, move('[data-hotspot="creative"]')],
      [9.2, click('[data-hotspot="creative"]')],
      [9.8, away],
      [11.0, click(trigger("experience"))],
      [11.6, away],
      [12.8, async () => page.key("Escape", "Escape", 27)],
    ];
    const FPS = 30, END = 14.4;
    const clip = { x: 0, y: 0, width: W, height: H, scale: 0.5 };
    mkdirSync(join(WORK, "rec"), { recursive: true });
    let n = 0;
    for (let f = 0; f <= END * FPS; f++) {
      const t = f / FPS;
      while (events.length && events[0][0] <= t + 1e-9) {
        const [when, fn] = events.shift();
        await fn();
        await sleep(90); // React applies the state; CSS creates the transitions
        await page.eval(`document.getAnimations().forEach((a) => { if (a.__start === undefined) a.__start = ${when * 1000}; }); true`);
      }
      await page.eval(`document.getAnimations().forEach((a) => { a.pause(); a.currentTime = Math.max(0, ${t * 1000} - (a.__start ?? ${t * 1000})); }); true`);
      const r = await page.send("Page.captureScreenshot", { format: "png", clip });
      writeFileSync(join(WORK, "rec", `f${String(n++).padStart(4, "0")}.png`), Buffer.from(r.data, "base64"));
    }
    console.log(`recording: ${n} frames at ${FPS} fps (${END} s) -> ${join(WORK, "rec")}`);
  } finally {
    await page.close();
  }
}
