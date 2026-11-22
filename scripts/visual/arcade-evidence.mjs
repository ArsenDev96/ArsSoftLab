#!/usr/bin/env node
// M1.3E Playground arcade evidence (lightweight).
//
//   node scripts/visual/arcade-evidence.mjs --url http://localhost:3000 --out docs/m1.3e [--no-video]
//
// Writes:
//   idle.png, playground-active.png        full viewport, 1648 x 928
//   playground-activation.webm             full viewport at 1:1, 30 fps:
//                                          idle, hover (energy -> arrival ->
//                                          switch-on -> ~6 s of play), exit
//   playground-screen-zoom.webm            the same hover, cabinet crop at 3x
//   checks/boot-<ms>.png, motion-<ms>.png  cabinet crops (3x) at set times
//   checks/timeline.json                   wrapper opacity / state / canvas
//                                          coverage per 20 ms around arrival
//   probes.txt                             behaviour probes (real time)
//
// Frames are made by pausing every animation (the game's clock included) and
// seeking it, so the video plays back in real time with the exact timing,
// independent of this machine's speed. The probes then run live.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL_ = opt("url", "http://localhost:3000");
const OUT = resolve(opt("out", "docs/m1.3e"));
const VIDEO = !argv.includes("--no-video");
const W = 1648;
const H = 928;
const FPS = 30;
const ARRIVE = 540;
const LEAD_MS = 600; // idle before the hover, in the video
const HOVER_MS = 7000;
const EXIT_MS = 800;
/** Cabinet crop (viewport px) for the zoomed views. */
const CAB = { x: 1062, y: 318, width: 260, height: 168 };
mkdirSync(join(OUT, "checks"), { recursive: true });

/** The game screen's state, read from the page. */
const arcade = (page) =>
  page.eval(`(() => {
    const w = document.querySelector('[data-arcade="playground"]');
    const c = w.querySelector("canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let lit = 0, sig = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) lit++;
    for (let i = 0; i < d.length; i += 4 * 7) sig = (sig * 31 + d[i] + 3 * d[i + 1] + 7 * d[i + 2]) % 1000000007;
    return {
      state: w.dataset.state ?? null,
      opacity: +(+getComputedStyle(w).opacity).toFixed(3),
      coverage: +(lit / (d.length / 4)).toFixed(3),
      clocks: c.getAnimations().length,
      sig,
    };
  })()`);

const raf = (page) => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
const pauseAll = (page) =>
  page.eval(`(() => { window.__base = document.getAnimations().map((a) => { a.pause(); return [a, +a.currentTime || 0]; }); return window.__base.length; })()`);
// After a seek the game repaints on its next frame.
const seek = async (page, t) => {
  await page.eval(`(() => { for (const [a, c] of window.__base) a.currentTime = c + ${t}; return true; })()`);
  await raf(page);
};
// play() on a finished animation rewinds it (auto-rewind) and would restart
// the sequence: finish those, play only what is still in progress.
const playAll = (page) =>
  page.eval(`(() => { for (const [a] of window.__base) { const end = a.effect?.getComputedTiming().endTime ?? Infinity; if (Number.isFinite(end) && +a.currentTime >= end) a.finish(); else a.play(); } return true; })()`);
const waitFor = async (page, expr, ms = 3000) => {
  for (let t = 0; t < ms; t += 20) {
    if (await page.eval(expr)) return true;
    await sleep(20);
  }
  return false;
};
const offScene = (page) => page.mouseMove(4, H - 4);
const hovered = (page, id) => waitFor(page, `document.querySelector("[data-lab-hover]")?.dataset.labHover === ${JSON.stringify(id)}`);
const shot = async (page, clip, scale = 1, format = "jpeg") =>
  (await page.send("Page.captureScreenshot", { format, ...(format === "jpeg" ? { quality: 88 } : {}), ...(clip ? { clip: { ...clip, scale } } : {}) })).data;

const frames = []; // full viewport jpeg (base64)
const zoom = []; // cabinet crop jpeg (base64)

// 1. Frames, stills, timeline ------------------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await page.freezeAnimations(0);
    await page.screenshot(join(OUT, "idle.png"));

    await page.goto(URL_);
    await offScene(page);
    await sleep(400);
    const idle = VIDEO ? await shot(page) : null;
    const idleZoom = VIDEO ? await shot(page, CAB, 3) : null;
    for (let t = 0; t < LEAD_MS; t += 1000 / FPS) {
      frames.push(idle);
      zoom.push(idleZoom);
    }
    const c = await page.center(`[data-hotspot="playground"]`);
    await page.mouseMove(c.x, c.y);
    await hovered(page, "playground");
    await raf(page);
    await pauseAll(page);

    // Timeline around arrival.
    const rows = [];
    for (let t = 0; t <= 1200; t += 20) {
      await seek(page, t);
      rows.push({ t, ...(await arcade(page)) });
    }
    const first = (pred) => rows.find(pred)?.t ?? null;
    const timeline = {
      arriveMs: ARRIVE,
      firstDrawnMs: first((r) => r.coverage > 0),
      fullyDrawnMs: first((r) => r.coverage >= 0.99),
      wrapperVisibleMs: first((r) => r.opacity > 0.02),
      wrapperFullMs: first((r) => r.opacity >= 0.99),
      runningMs: first((r) => r.state === "running"),
      rows,
    };
    writeFileSync(join(OUT, "checks", "timeline.json"), JSON.stringify(timeline, null, 1));
    console.log("timeline", JSON.stringify({ ...timeline, rows: undefined }));

    for (const t of [500, 560, 600, 640, 700, 760]) {
      await seek(page, t);
      writeFileSync(join(OUT, "checks", `boot-${t}.png`), Buffer.from(await shot(page, CAB, 3, "png"), "base64"));
    }
    const sigs = [];
    for (const t of [1500, 2000, 2500, 3000, 4000]) {
      await seek(page, t);
      sigs.push({ t, ...(await arcade(page)) });
      writeFileSync(join(OUT, "checks", `motion-${t}.png`), Buffer.from(await shot(page, CAB, 3, "png"), "base64"));
    }
    writeFileSync(join(OUT, "checks", "motion.json"), JSON.stringify(sigs, null, 1));
    await seek(page, 3000);
    await page.screenshot(join(OUT, "playground-active.png"));

    if (VIDEO) {
      for (let t = 0; t <= HOVER_MS; t += 1000 / FPS) {
        await seek(page, t);
        frames.push(await shot(page));
        zoom.push(await shot(page, CAB, 3));
      }
      // Exit.
      await playAll(page);
      await offScene(page);
      await waitFor(page, `!document.querySelector("[data-lab-hover]")`);
      await raf(page);
      await pauseAll(page);
      for (let t = 0; t <= EXIT_MS; t += 1000 / FPS) {
        await seek(page, t);
        frames.push(await shot(page));
        zoom.push(await shot(page, CAB, 3));
      }
      console.log(`frames: ${frames.length}`);
    }
  } finally {
    await page.close();
  }
}

// 2. Recordings (WebM, encoded by Chrome) --------------------------------------
async function encode(list, file) {
  const page = await launch({ width: 800, height: 600 });
  try {
    await page.eval(`window.__frames = []; true`);
    for (const f of list) await page.eval(`window.__frames.push(${JSON.stringify(f)}); true`);
    const size = await page.eval(`(async () => {
      const toBitmap = async (b64) => createImageBitmap(await (await fetch("data:image/jpeg;base64," + b64)).blob());
      const first = await toBitmap(window.__frames[0]);
      const c = document.createElement("canvas"); c.width = first.width; c.height = first.height;
      const g = c.getContext("2d");
      const stream = c.captureStream(0); const track = stream.getVideoTracks()[0];
      const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 9e6 });
      const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => (rec.onstop = r));
      rec.start();
      const start = performance.now();
      for (let i = 0; i < window.__frames.length; i++) {
        const bmp = i ? await toBitmap(window.__frames[i]) : first;
        g.drawImage(bmp, 0, 0); bmp.close?.();
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
    writeFileSync(join(OUT, file), Buffer.from(b64, "base64"));
    console.log(`${file}: ${list.length} frames, ${(list.length / FPS).toFixed(1)} s`);
  } finally {
    await page.close();
  }
}
if (VIDEO && frames.length) {
  await encode(frames, "playground-activation.webm");
  await encode(zoom, "playground-screen-zoom.webm");
}

// 3. Behaviour probes (real time) ----------------------------------------------
const lines = [];
const note = (name, ok, detail) => {
  lines.push(`${ok ? "OK  " : "BAD "} ${name}  ${JSON.stringify(detail)}`);
  console.log(lines.at(-1));
};
const off = (s) => s.state !== "running" && s.state !== "booting" && s.state !== "charging" && s.opacity === 0 && s.coverage === 0 && s.clocks === 0;
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    const play = await page.center(`[data-hotspot="playground"]`);
    const eng = await page.center(`[data-hotspot="engineering"]`);
    let s = await arcade(page);
    note("At rest: nothing drawn or scheduled", off(s), s);

    // Live: it runs and visibly moves in real time; draw rate.
    await page.mouseMove(play.x, play.y);
    await hovered(page, "playground");
    await sleep(1400);
    const a = await arcade(page);
    const fps = await page.eval(`new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); })`);
    const b = await arcade(page);
    note("Live: running, content changes in real time", a.state === "running" && a.opacity === 1 && a.coverage > 0.99 && a.sig !== b.sig && a.clocks === 1, { a, b, rafPerSecond: fps });

    // Page hidden: the loop stops; visible again: it resumes.
    await page.eval(`(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); return true; })()`);
    await sleep(100);
    const h1 = await arcade(page);
    await sleep(500);
    const h2 = await arcade(page);
    await page.eval(`(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); return true; })()`);
    await sleep(400);
    const h3 = await arcade(page);
    note("Page hidden: no drawing; visible: resumes", h1.sig === h2.sig && h3.sig !== h2.sig && h3.state === "running", { hidden: [h1.sig, h2.sig], resumed: h3.sig });

    // Leave: fades back into the plate, then stops.
    await offScene(page);
    await sleep(200);
    const mid = await arcade(page);
    await sleep(700);
    s = await arcade(page);
    note("Exit: fades out, then stops and clears", mid.opacity > 0 && mid.opacity < 1 && off(s), { fading: mid, after: s });

    // Quick return during the fade: same game continues, one clock.
    await page.mouseMove(play.x, play.y);
    await sleep(2000);
    await offScene(page);
    await sleep(190); // 90 ms grace + ~100 ms into the fade
    const fading = await arcade(page);
    await page.mouseMove(play.x, play.y);
    await sleep(60);
    const back = await arcade(page);
    await sleep(1000);
    const later = await arcade(page);
    note("Quick return mid-fade: resumes, no restart or duplicate", fading.state === "running" && back.state === "running" && later.state === "running" && later.clocks === 1 && later.opacity === 1, { fading, back, later });
    await offScene(page);
    await sleep(900);

    // Leave before the energy arrives: never switches on.
    await page.mouseMove(play.x, play.y);
    await sleep(300);
    const charging = await arcade(page);
    await offScene(page);
    let lit = 0;
    for (let i = 0; i < 8; i++) {
      await sleep(100);
      lit = Math.max(lit, (await arcade(page)).coverage);
    }
    s = await arcade(page);
    note("Early exit (before arrival): never switches on", charging.state === "charging" && charging.coverage === 0 && lit === 0 && off(s), { charging, maxCoverageAfter: lit, after: s });

    // Repeated quick hovers end clean.
    for (let i = 0; i < 5; i++) {
      await page.mouseMove(play.x, play.y);
      await sleep(150 + 120 * i);
      await offScene(page);
      await sleep(60);
    }
    await sleep(1200);
    s = await arcade(page);
    note("Repeated quick hovers: clean rest state", off(s), s);

    // Switch to another station mid-game.
    await page.mouseMove(play.x, play.y);
    await sleep(1500);
    await page.mouseMove(eng.x, eng.y);
    await sleep(900);
    s = await arcade(page);
    note("Switch to Engineering: game stops", off(s), s);
    await offScene(page);
    await sleep(600);

    // Selection while charging: selected at once; the screen switches on
    // with the station's lights at arrival (their transitions keep their
    // delay), and keeps running.
    await page.mouseMove(play.x, play.y);
    await sleep(150);
    await page.click(play.x, play.y);
    await sleep(100);
    const sel1 = await arcade(page);
    await sleep(800);
    const sel2 = await arcade(page);
    note(
      "Click mid-charge: selected; screen on with the lights, visible",
      (await page.eval(`document.querySelector("[data-lab-selected]")?.dataset.labSelected`)) === "playground" && sel1.state === "charging" && sel2.state === "running" && sel2.opacity === 1 && sel2.coverage > 0.99,
      { atClick: sel1, later: sel2 },
    );
    await page.key("Escape", "Escape", 27);
    await offScene(page);
    await sleep(400);
    s = await arcade(page);
    note("Escape (focus returns to the title): still running, one clock", s.state === "running" && s.clocks === 1 && s.opacity === 1, s);
    await page.eval(`document.activeElement?.blur(), true`);
    await sleep(900);
    s = await arcade(page);
    note("Blur: back to rest", off(s), s);

    // Keyboard focus: the same sequence.
    await page.eval(`document.querySelector("#station-playground-trigger").focus(), true`);
    await sleep(100);
    const k1 = await arcade(page);
    await sleep(1000);
    const k2 = await arcade(page);
    note("Keyboard focus: charging, then running", k1.state === "charging" && k1.coverage === 0 && k2.state === "running" && k2.opacity === 1, { early: k1, later: k2 });
    await page.eval(`document.activeElement?.blur(), true`);
    await sleep(900);
    s = await arcade(page);
    note("Keyboard blur: back to rest", off(s), s);

    // Rest after all that: the lab matches the idle still.
    await page.freezeAnimations(0);
    await page.finishTransitions();
    await page.screenshot(join(OUT, "checks", "rest-after-probes.png"));
  } finally {
    await page.close();
  }
}
{
  const page = await launch({ width: W, height: H, reducedMotion: true });
  try {
    await page.goto(URL_);
    const play = await page.center(`[data-hotspot="playground"]`);
    await page.mouseMove(play.x, play.y);
    await hovered(page, "playground");
    await sleep(350);
    const r1 = await arcade(page);
    await sleep(1000);
    const r2 = await arcade(page);
    await page.screenshot(join(OUT, "checks", "reduced-motion.png"));
    note("Reduced motion: static lit frame at once, no loop", r1.state === "still" && r1.opacity === 1 && r1.coverage > 0.99 && r1.sig === r2.sig && r2.clocks === 0, { r1, r2 });
  } finally {
    await page.close();
  }
}

// 4. Idle unchanged ------------------------------------------------------------
{
  const page = await launch({ width: 800, height: 600 });
  try {
    const png = (p) => "data:image/png;base64," + readFileSync(p).toString("base64");
    const diff = (a, b) =>
      page.eval(`(async () => {
        const load = async (u) => createImageBitmap(await (await fetch(u)).blob());
        const [A, B] = await Promise.all([load(${JSON.stringify(png(a))}), load(${JSON.stringify(png(b))})]);
        const read = (bmp) => { const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext("2d"); g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, bmp.width, bmp.height).data; };
        const x = read(A), y = read(B); let max = 0, over2 = 0;
        for (let i = 0; i < x.length; i += 4) { const m = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])); if (m > max) max = m; if (m > 2) over2++; }
        return { max, over2 };
      })()`);
    const ref = opt("idle-ref", "docs/m1.3d/idle.png");
    const d1 = await diff(join(OUT, "idle.png"), ref);
    note(`Idle matches ${ref}`, d1.max <= 4, d1);
    const d2 = await diff(join(OUT, "checks", "rest-after-probes.png"), join(OUT, "idle.png"));
    note("Rest after the probes matches idle", d2.max <= 4, d2);
  } finally {
    await page.close();
  }
}
writeFileSync(join(OUT, "probes.txt"), lines.join("\n") + "\n");
