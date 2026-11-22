#!/usr/bin/env node
// M1.3C hover activation evidence (lightweight).
//
//   node scripts/visual/hover-evidence.mjs --url http://localhost:3000 --out docs/m1.3c [--no-video]
//
// For Engineering, Playground and Educational:
//   - deterministic frames of hover (0-1600 ms) and exit (0-700 ms): every
//     animation and transition is paused and seeked to exact times, so the
//     timing shown is the real timing, independent of this machine's speed;
//   - stills: checks/<id>-pulse-mid.png (pulse halfway along the line) and
//     <id>-active.png (fully activated); plus idle.png;
//   - hover-activation.webm: the frames encoded at 30 fps in Chrome
//     (MediaRecorder), no external tools.
// Then a few quick behaviour probes in real time (printed, not a test suite):
// early exit, fast switching, keyboard focus, reduced motion.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL_ = opt("url", "http://localhost:3000");
const OUT = resolve(opt("out", "docs/m1.3c"));
const VIDEO = !argv.includes("--no-video");
const W = 1648;
const H = 928;
const FPS = 30;
const HOVER_MS = 2000; // Experience's path highlight ends at ~1.92 s
const EXIT_MS = 500;
const STATIONS = [
  { id: "educational", arrive: 460 },
  { id: "engineering", arrive: 540 },
  { id: "playground", arrive: 540 },
  { id: "creative", arrive: 620 },
  { id: "experience", arrive: 650 },
];
mkdirSync(join(OUT, "checks"), { recursive: true });

/** Snapshot of one station's activation state. */
const probe = (page, id) =>
  page.eval(`(() => {
    const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
    const lift = document.querySelector('.lab-lift[data-lift="${id}"]:not(.lab-station)');
    return {
      hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
      glow: op('.lab-activation[data-zone="${id}"] .lab-activation-glow'),
      platform: op('[data-platform-light="${id}"]') ?? op('.lab-lift-light[data-lift="${id}"]'),
      surge: op('[data-surge="${id}"]'),
      lift: lift ? getComputedStyle(lift).transform : null,
      running: document.getAnimations().filter((a) => a.playState === "running" && !(a instanceof CSSAnimation)).length,
    };
  })()`);

const waitFor = async (page, expr, ms = 3000) => {
  for (let t = 0; t < ms; t += 20) {
    if (await page.eval(expr)) return true;
    await sleep(20);
  }
  return false;
};
const raf = (page) => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);

/** Pause every animation; remember where each was. */
const pauseAll = (page) =>
  page.eval(`(() => { window.__base = document.getAnimations().map((a) => { a.pause(); return [a, +a.currentTime || 0]; }); return window.__base.length; })()`);
const seek = (page, t) => page.eval(`(() => { for (const [a, c] of window.__base) a.currentTime = c + ${t}; return true; })()`);
// play() on a finished animation rewinds it (auto-rewind) and would restart
// the sequence: finish those, play only what is still in progress.
const playAll = (page) =>
  page.eval(`(() => { for (const [a] of window.__base) { const end = a.effect?.getComputedTiming().endTime ?? Infinity; if (Number.isFinite(end) && +a.currentTime >= end) a.finish(); else a.play(); } return true; })()`);

const hotspot = async (page, id) => page.center(`[data-hotspot="${id}"]`);
const offScene = (page) => page.mouseMove(4, H - 4);

const frames = []; // { station, phase, t, jpeg }
const jpeg = async (page) => (await page.send("Page.captureScreenshot", { format: "jpeg", quality: 86 })).data;

// 1. Frames and stills -------------------------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await page.freezeAnimations(0);
    await page.screenshot(join(OUT, "idle.png"));
    for (const { id, arrive } of STATIONS) {
      await page.goto(URL_);
      await offScene(page);
      await sleep(300);
      const c = await hotspot(page, id);
      await page.mouseMove(c.x, c.y);
      await waitFor(page, `document.querySelector("[data-lab-hover]")?.dataset.labHover === "${id}"`);
      await raf(page);
      await pauseAll(page);
      const step = 1000 / FPS;
      for (let t = 0; t <= HOVER_MS; t += step) {
        await seek(page, t);
        frames.push({ station: id, phase: "hover", t: Math.round(t), jpeg: VIDEO ? await jpeg(page) : null });
      }
      await seek(page, arrive * 0.5);
      await page.screenshot(join(OUT, "checks", `${id}-pulse-mid.png`));
      await seek(page, HOVER_MS);
      await page.screenshot(join(OUT, `${id}-active.png`));
      writeFileSync(join(OUT, "checks", `${id}-timeline.json`), JSON.stringify(await timeline(page, id, arrive), null, 1));
      // Exit.
      await playAll(page);
      await offScene(page);
      await waitFor(page, `!document.querySelector("[data-lab-hover]")`);
      await raf(page);
      await pauseAll(page);
      for (let t = 0; t <= EXIT_MS; t += step) {
        await seek(page, t);
        frames.push({ station: id, phase: "exit", t: Math.round(t), jpeg: VIDEO ? await jpeg(page) : null });
      }
      await seek(page, 700);
      await page.screenshot(join(OUT, "checks", `${id}-exit.png`));
      console.log(`frames: ${id} done`);
    }
  } finally {
    await page.close();
  }
}

/**
 * Measured timeline (paused + seeked): when the pulse head reaches the
 * station end of its line, and when each activation effect starts moving.
 */
async function timeline(page, id, arrive) {
  const rows = [];
  for (let t = 0; t <= HOVER_MS; t += 20) {
    await seek(page, t);
    rows.push({ t, ...(await probe(page, id)), head: await headProgress(page, id) });
  }
  const first = (k, pred) => rows.find((r) => pred(r[k]))?.t ?? null;
  return {
    station: id,
    arriveMs: arrive,
    headAtStationMs: first("head", (v) => v !== null && v >= 0.99),
    platformStartsMs: first("platform", (v) => v > 0.02),
    glowStartsMs: first("glow", (v) => v > 0.02),
    liftStartsMs: first("lift", (v) => v && v !== "none" && v !== "matrix(1, 0, 0, 1, 0, 0)"),
    platformFullMs: first("platform", (v) => v >= 0.74),
    rows: rows.filter((r) => r.t % 100 === 0),
  };
}
/** 0 at the line start (A side), 1 at the station end. */
function headProgress(page, id) {
  return page.eval(`(() => {
    const m = document.querySelector('[data-surge="${id}"] [data-pass="core"] [data-surge-mover]');
    const head = m?.querySelector("[data-surge-head]");
    if (!m || !head || +getComputedStyle(head).opacity < 0.05 && !m.getAnimations().length) return null;
    const box = m.getBoundingClientRect(), r = head.getBoundingClientRect();
    const scene = document.querySelector('[data-layer="plate"]').getBoundingClientRect();
    const k = scene.width / 1672;
    const x = (r.x + r.width / 2 - scene.x) / k, y = (r.y + r.height / 2 - scene.y) / k;
    const P = ${JSON.stringify(Object.fromEntries([["engineering", [[716, 569.5], [586, 540.8]]], ["playground", [[967, 567.2], [1088, 536.5]]], ["educational", [[838.5, 528], [838.5, 462]]], ["creative", [[721, 645.7], [505, 695.2]]], ["experience", [[964, 648.1], [1212, 696.2]]]]))}["${id}"];
    const [a, b] = P; const dx = b[0] - a[0], dy = b[1] - a[1];
    return +(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)).toFixed(3);
  })()`);
}

// 2. Recording (WebM, encoded by Chrome) -------------------------------------
if (VIDEO && frames.length) {
  const page = await launch({ width: 800, height: 600 });
  try {
    await page.eval(`window.__frames = []; true`);
    for (const f of frames) await page.eval(`window.__frames.push(${JSON.stringify(f.jpeg)}); true`);
    const size = await page.eval(`(async () => {
      const toBitmap = async (b64) => createImageBitmap(await (await fetch("data:image/jpeg;base64," + b64)).blob());
      const first = await toBitmap(window.__frames[0]);
      const c = document.createElement("canvas"); c.width = Math.round(first.width * 0.75); c.height = Math.round(first.height * 0.75);
      const g = c.getContext("2d");
      const stream = c.captureStream(0); const track = stream.getVideoTracks()[0];
      const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 6e6 });
      const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => (rec.onstop = r));
      rec.start();
      const start = performance.now();
      for (let i = 0; i < window.__frames.length; i++) {
        const bmp = i ? await toBitmap(window.__frames[i]) : first;
        g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
        track.requestFrame();
        const due = start + ((i + 1) * 1000) / ${FPS};
        await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())));
      }
      rec.stop(); await done;
      const buf = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      window.__webm = btoa(s); return window.__webm.length;
    })()`);
    // Read it back in slices: one multi-megabyte DevTools response can stall.
    let b64 = "";
    for (let i = 0; i < size; i += 1 << 20) b64 += await page.eval(`window.__webm.slice(${i}, ${i + (1 << 20)})`);
    writeFileSync(join(OUT, "hover-activation.webm"), Buffer.from(b64, "base64"));
    console.log(`recording: ${frames.length} frames, ${(frames.length / FPS).toFixed(1)} s`);
  } finally {
    await page.close();
  }
}

// 3. Quick behaviour probes (real time) --------------------------------------
const lines = [];
const note = (name, ok, detail) => {
  lines.push(`${ok ? "OK  " : "BAD "} ${name}  ${JSON.stringify(detail)}`);
  console.log(lines.at(-1));
};
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    const eng = await hotspot(page, "engineering");
    const edu = await hotspot(page, "educational");
    const play = await hotspot(page, "playground");

    // Early exit: leave Engineering before the energy arrives.
    await page.mouseMove(eng.x, eng.y);
    await sleep(250);
    await offScene(page);
    await sleep(1400);
    let s = await probe(page, "engineering");
    note("Early exit leaves nothing active", !s.hover && !s.glow && !s.platform && s.lift === "none" && !s.surge, s);

    // Fast switching: Engineering -> Educational mid-flight.
    await page.mouseMove(eng.x, eng.y);
    await sleep(200);
    await page.mouseMove(edu.x, edu.y);
    await sleep(1600);
    const e1 = await probe(page, "engineering");
    const e2 = await probe(page, "educational");
    note("Fast switch: only the new station activates", !e1.glow && !e1.platform && e1.lift === "none" && e2.glow > 0.5 && e2.platform > 0.5, { engineering: e1, educational: e2 });

    // Creative -> Experience mid-flight; then Experience left mid-path.
    const cre = await hotspot(page, "creative");
    const exp = await hotspot(page, "experience");
    await page.mouseMove(cre.x, cre.y);
    await sleep(300);
    await page.mouseMove(exp.x, exp.y);
    await sleep(2300);
    const c1 = await probe(page, "creative");
    const x1 = await probe(page, "experience");
    note("Fast switch Creative -> Experience: only Experience active", !c1.glow && !c1.platform && !c1.surge && x1.glow > 0.5 && x1.platform > 0.5, { creative: c1, experience: x1 });
    await offScene(page);
    await page.mouseMove(exp.x, exp.y);
    await sleep(1100); // path highlight in flight
    await offScene(page);
    await sleep(1500);
    const x2 = await probe(page, "experience");
    const comet = await page.eval(`Math.max(...[...document.querySelectorAll('[data-path-comet="experience"]')].map((e) => +getComputedStyle(e).opacity))`);
    note("Leaving Experience mid-path: highlight and glow gone", !x2.hover && !x2.glow && !x2.platform && comet < 0.01, { ...x2, comet });

    // Repeated hovers of the same station end in a clean state.
    for (let i = 0; i < 4; i++) {
      await page.mouseMove(play.x, play.y);
      await sleep(120 + 90 * i);
      await offScene(page);
      await sleep(60);
    }
    await sleep(1400);
    s = await probe(page, "playground");
    note("Repeated quick hovers: no stale activation", !s.hover && !s.glow && !s.platform && !s.surge, s);

    // Select while the sequence is running: selection takes over at once.
    await page.mouseMove(play.x, play.y);
    await sleep(150);
    await page.click(play.x, play.y);
    await sleep(900);
    s = await probe(page, "playground");
    note("Select mid-sequence: station selected and active", (await page.eval(`document.querySelector("[data-lab-selected]")?.dataset.labSelected`)) === "playground" && s.glow > 0.5, s);
    // Escape returns focus to the station's title (M1.3A), which keeps it
    // lit like hover. It was powered all along, so no second pulse runs.
    await page.key("Escape", "Escape", 27);
    await offScene(page);
    await sleep(150);
    const flash = await page.eval(`document.querySelector("[data-core-flash]").getAnimations().length`);
    const heads = await page.eval(`[...document.querySelectorAll('[data-surge="playground"] [data-surge-mover]')].flatMap((m) => m.getAnimations()).filter((a) => a.playState === "running").length`);
    await sleep(1350);
    s = await probe(page, "playground");
    note("Escape after select: focus keeps it lit, no second pulse", (await page.eval(`!document.querySelector("[data-lab-selected]")`)) && s.hover === "playground" && s.glow > 0.5 && !flash && !heads, { ...s, flash, heads });
    await page.eval(`document.activeElement?.blur(), true`);
    await sleep(1300);
    s = await probe(page, "playground");
    note("Then blur: back to rest", !s.hover && !s.glow && !s.platform && !s.surge, s);

    // Keyboard focus is the same trigger.
    await page.eval(`document.activeElement?.blur(), true`);
    await page.eval(`document.querySelector("#station-engineering-trigger").focus(), true`);
    await sleep(80);
    const early = await probe(page, "engineering");
    await sleep(1500);
    s = await probe(page, "engineering");
    note("Keyboard focus: same sequence (dark at 80 ms, active later)", early.hover === "engineering" && !early.glow && s.glow > 0.5 && s.lift !== "none", { early, later: s });
    await page.eval(`document.activeElement?.blur(), true`);
    await sleep(1200);
    s = await probe(page, "engineering");
    note("Keyboard blur: back to rest", !s.glow && s.lift === "none", s);
  } finally {
    await page.close();
  }
}
{
  const page = await launch({ width: W, height: H, reducedMotion: true });
  try {
    await page.goto(URL_);
    const c = await hotspot(page, "engineering");
    await page.mouseMove(c.x, c.y);
    await sleep(300);
    const s = await probe(page, "engineering");
    const surge = await page.eval(`getComputedStyle(document.querySelector(".lab-surge")).display`);
    note("Reduced motion: lights at once, no lift, no pulse", s.glow > 0.5 && s.lift === "none" && surge === "none", { ...s, surge });
  } finally {
    await page.close();
  }
}
writeFileSync(join(OUT, "probes.txt"), lines.join("\n") + "\n");
