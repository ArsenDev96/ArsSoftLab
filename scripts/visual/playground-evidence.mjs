#!/usr/bin/env node
// M1.3E.1-M1.3E.3 Playground power transfer + lift evidence (lightweight).
//
//   node scripts/visual/playground-evidence.mjs --url http://localhost:3000 --out docs/m1.3e3 [--no-video] [--no-push]
//
// --no-push records everything without the M1.3E.3 micro camera push.
//
// Writes:
//   idle.png, energy-halfway.png, playground-lifted.png, return-to-idle.png
//   connection-closeup.png       the complete route: unpowered / pulse / arrival burst / powered (3x)
//   ab-camera-push.webm          A/B, side by side: the same sequence with and
//                                without the micro camera push (1:1 crop)
//   checks/ab-station-3x.png     A/B stills of the lifted station at 3x, with a sharpness measure
//   playground-power-lift.webm   full viewport at 1:1, 30 fps: idle, charge,
//                                lift, gameplay, exit
//   checks/timeline.json         charge front / spark head / lift / game per 20 ms
//   checks/*.png                 a few crops used in the notes
//   probes.txt                   behaviour probes (real time)
//
// Frames are made by pausing every animation (and the game clock) and seeking
// it, so the video plays in real time with the exact timing.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL_ = opt("url", "http://localhost:3000");
const OUT = resolve(opt("out", "docs/m1.3e3"));
const VIDEO = !argv.includes("--no-video");
const NO_PUSH = argv.includes("--no-push");
/** Disables the hover push only (the selected shot is inline and unaffected). */
const NO_PUSH_CSS = "[data-lab-hover]:not([data-lab-selected]) .lab-camera{transform:none!important}";
const noPush = (page) => page.eval(`(document.head.insertAdjacentHTML("beforeend", ${JSON.stringify("<style data-no-push>" + NO_PUSH_CSS + "</style>")}), true)`);
/** A/B crop around Playground (viewport px) and its length. */
const AB_CROP = { x: 800, y: 190, width: 824, height: 464 };
const AB_HOVER_MS = 2600;
const AB_EXIT_MS = 1100;
const W = 1648;
const H = 928;
const FPS = 30;
const LEAD_MS = 700;
const HOVER_MS = 4800;
const EXIT_MS = 1500;
/** The traced route (components/lab/playground-route.ts) and its two charge parts. */
const routeSrc = readFileSync(resolve("components/lab/playground-route.ts"), "utf8");
const ROUTE = JSON.parse(routeSrc.match(/PLAYGROUND_ROUTE[^=]*=\s*(\[\[.*?\]\]);/s)[1]);
const BEND = Number(routeSrc.match(/PLAYGROUND_ROUTE_BEND = (\d+)/)[1]);
const arcs = [0];
for (let i = 1; i < ROUTE.length; i++) arcs.push(arcs[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]));
const ROUTE_LEN = arcs.at(-1);
const SEGS = [
  [0, BEND],
  [BEND, ROUTE.length - 1],
].map(([a, b]) => ({ s0: arcs[a], chord: Math.hypot(ROUTE[b][0] - ROUTE[a][0], ROUTE[b][1] - ROUTE[a][1]) }));
const LIFT = 18;
const LINE = { from: ROUTE[BEND], to: ROUTE.at(-1) };
/** Crops (viewport px). */
const CHARGE_CROP = { x: 868, y: 508, width: 236, height: 70 };
const STATION_CROP = { x: 1040, y: 325, width: 345, height: 240 };
mkdirSync(join(OUT, "checks"), { recursive: true });

/** Playground's state, read from the page. */
const state = (page) =>
  page.eval(`(() => {
    // On-screen scale (camera zoom included) for positions; layout scale for
    // the lift's own transform, which is in the station's local px.
    const plate = document.querySelector('[data-layer="plate"]');
    const k = plate.getBoundingClientRect().width / 1672;
    const kl = plate.offsetWidth / 1672;
    const ty = (el) => el ? +(new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform).m42 / kl).toFixed(2) : null;
    const lift = document.querySelector('.lab-lift[data-lift="playground"]:not(.lab-station)');
    const layer = document.querySelector('[data-station-layer="playground"]');
    const segs = ${JSON.stringify(SEGS)};
    let front = -20; // route position of the charge front (reference px from the A's circle)
    segs.forEach((g, k) => {
      const w = document.querySelector('[data-charge-window="playground"][data-charge-seg="' + k + '"][data-charge-kind="dim"]');
      const t = getComputedStyle(w).transform;
      const m = new DOMMatrixReadOnly(t === "none" ? undefined : t);
      const s = (m.m41 / w.offsetWidth) * (g.chord + 20 + 40);
      if (s >= g.chord + 20 - 0.01) front = Math.max(front, k === segs.length - 1 ? 1e9 : g.s0 + g.chord);
      else if (s > 0.01) front = Math.max(front, g.s0 + s - 10 + 3.5);
    });
    const L = ${ROUTE_LEN};
    const dim = document.querySelector('.lab-charge-unpowered');
    // Spark head (core pass) projected on the line, 0..1.
    const mv = document.querySelector('[data-surge="playground"] [data-pass="core"] [data-surge-mover]');
    const head = mv?.querySelector("[data-surge-head]");
    let headAt = null;
    if (head && +getComputedStyle(head).opacity > 0.05) {
      const r = head.getBoundingClientRect(), s = document.querySelector('[data-layer="plate"]').getBoundingClientRect();
      const x = (r.x + r.width / 2 - s.x) / k, y = (r.y + r.height / 2 - s.y) / k;
      const R = ${JSON.stringify(ROUTE)}, A = ${JSON.stringify(arcs)};
      let best = 1e9, at = 0;
      for (let i = 1; i < R.length; i++) {
        const [ax, ay] = R[i - 1], [bx, by] = R[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
        if (d < best) { best = d; at = A[i - 1] + t * Math.sqrt(l2); }
      }
      headAt = +(at / ${ROUTE_LEN}).toFixed(3);
    }
    const arcade = document.querySelector('[data-arcade="playground"]');
    return {
      hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
      selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
      lit: +Math.min(1, Math.max(0, front / L)).toFixed(3),
      dimOpacity: +(+getComputedStyle(dim).opacity).toFixed(3),
      head: headAt,
      liftPx: ty(lift),
      layerVisible: getComputedStyle(layer).visibility === "visible",
      shadow: +(+getComputedStyle(document.querySelector('.lab-lift-shadow[data-lift="playground"]')).opacity).toFixed(3),
      game: arcade.dataset.state ?? null,
      gameOpacity: +(+getComputedStyle(arcade).opacity).toFixed(3),
      // The game must ride the lift: its box moves with the lifted station.
      gameTop: +((arcade.getBoundingClientRect().y - document.querySelector('[data-layer="plate"]').getBoundingClientRect().y) / k).toFixed(2),
      surge: +(+getComputedStyle(document.querySelector('[data-surge="playground"]')).opacity).toFixed(3),
      burst: +(+getComputedStyle(document.querySelector('[data-surge="playground"] [data-surge-burst]')).opacity).toFixed(3),
      gapLight: +(+getComputedStyle(document.querySelector('.lab-lift-gap[data-lift="playground"]')).opacity).toFixed(3),
      penumbra: +(+getComputedStyle(document.querySelector('.lab-lift-penumbra[data-lift="playground"]')).opacity).toFixed(3),
      // Camera scale (1 at rest; the micro push, or the selected shot).
      cam: +(() => { const t = getComputedStyle(document.querySelector(".lab-camera")).transform; return t === "none" ? 1 : new DOMMatrixReadOnly(t).a; })().toFixed(4),
    };
  })()`);

const raf = (page) => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))`);
const pauseAll = (page) =>
  page.eval(`(() => { window.__base = document.getAnimations().map((a) => { a.pause(); return [a, +a.currentTime || 0]; }); return window.__base.length; })()`);
const seek = async (page, t) => {
  await page.eval(`(() => { for (const [a, c] of window.__base) a.currentTime = c + ${t}; return true; })()`);
  await raf(page);
};
// Resume after seeking. play() on a finished animation rewinds it to the
// start (auto-rewind), which would restart the whole hover sequence: finish
// those instead, and only play what is still in progress.
const playAll = (page) =>
  page.eval(`(() => {
    for (const [a] of window.__base) {
      const end = a.effect?.getComputedTiming().endTime ?? Infinity;
      if (Number.isFinite(end) && +a.currentTime >= end) a.finish();
      else a.play();
    }
    return true;
  })()`);
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
const save = (name, b64) => writeFileSync(join(OUT, name), Buffer.from(b64, "base64"));

const frames = [];

// 1. Stills, timeline, frames ------------------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(400);
    await page.freezeAnimations(0);
    await page.screenshot(join(OUT, "idle.png"));
    save("checks/idle-line.png", await shot(page, CHARGE_CROP, 3, "png"));

    await page.goto(URL_);
    await offScene(page);
    await sleep(400);
    if (NO_PUSH) await noPush(page);
    const idle = VIDEO ? await shot(page) : null;
    for (let t = 0; t < LEAD_MS; t += 1000 / FPS) frames.push(idle);
    const c = await page.center(`[data-hotspot="playground"]`);
    await page.mouseMove(c.x, c.y);
    await hovered(page, "playground");
    await raf(page);
    await pauseAll(page);

    const rows = [];
    for (let t = 0; t <= 1600; t += 20) {
      await seek(page, t);
      rows.push({ t, ...(await state(page)) });
    }
    const first = (pred) => rows.find(pred)?.t ?? null;
    const timeline = {
      litHalfMs: first((r) => r.lit >= 0.5),
      litFullMs: first((r) => r.lit >= 1),
      headAtStationMs: first((r) => r.head !== null && r.head >= 0.99),
      liftStartsMs: first((r) => r.liftPx !== null && r.liftPx < -0.05),
      liftFullMs: first((r) => r.liftPx !== null && r.liftPx <= -LIFT + 0.05),
      platformPartLitMs: first((r) => r.lit >= SEGS[1].s0 / ROUTE_LEN),
      gameStartsMs: first((r) => r.game === "booting" || r.game === "running"),
      burstFromMs: first((r) => r.burst > 0.02),
      burstPeakMs: rows.reduce((b, r) => (r.burst > b.burst ? r : b), rows[0]).t,
      burstGoneMs: (() => { const p = rows.findIndex((r) => r.burst > 0.02); return p < 0 ? null : rows.slice(p).find((r) => r.burst <= 0.02)?.t ?? null; })(),
      pushStartsMs: first((r) => r.cam > 1.0005),
      pushFullMs: first((r) => r.cam >= 1.0245),
      gapLightFullMs: first((r) => r.gapLight >= 0.69),
      rows,
    };
    writeFileSync(join(OUT, "checks", "timeline.json"), JSON.stringify(timeline, null, 1));
    console.log("timeline", JSON.stringify({ ...timeline, rows: undefined }));

    // Halfway: when the charge front has covered half the line.
    await seek(page, timeline.litHalfMs ?? 300);
    await page.screenshot(join(OUT, "energy-halfway.png"));
    for (const t of [150, 300, 450, 600]) {
      await seek(page, t);
      save(`checks/charge-${t}.png`, await shot(page, CHARGE_CROP, 3, "png"));
    }
    await seek(page, 2000);
    await page.screenshot(join(OUT, "playground-lifted.png"));
    save("checks/station-lifted-3x.png", await shot(page, STATION_CROP, 3, "png"));
    const close = [];
    for (const t of [0, Math.round((timeline.litHalfMs ?? 300) / 20) * 20, timeline.burstPeakMs ?? 640, 1400]) {
      await seek(page, t);
      close.push({ t, png: await shot(page, CHARGE_CROP, 3, "png") });
    }
    await seek(page, 0);
    save("checks/station-rest-3x.png", await shot(page, STATION_CROP, 3, "png"));
    save("connection-closeup.png", await page.eval(`(async () => {
      const parts = ${JSON.stringify(close)};
      const imgs = await Promise.all(parts.map(async (p) => createImageBitmap(await (await fetch("data:image/png;base64," + p.png)).blob())));
      const w = imgs[0].width, h = imgs[0].height, gap = 6;
      const c = new OffscreenCanvas(w, h * imgs.length + gap * (imgs.length - 1)); const g = c.getContext("2d");
      g.fillStyle = "#111"; g.fillRect(0, 0, c.width, c.height);
      const labels = ["At rest: unpowered", "Pulse (" + parts[1].t + " ms): hot head, short trail, line charging behind it", "Arrival burst (" + parts[2].t + " ms) where the line meets the platform", "Powered (" + parts[3].t + " ms), station lifted"];
      imgs.forEach((im, i) => { const y = i * (h + gap); g.drawImage(im, 0, y); g.fillStyle = "#000b"; g.fillRect(0, y, 520, 26); g.fillStyle = "#fff"; g.font = "16px sans-serif"; g.fillText(labels[i], 8, y + 18); });
      const b = await c.convertToBlob({ type: "image/png" }); const buf = new Uint8Array(await b.arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    })()`));

    if (VIDEO) {
      for (let t = 0; t <= HOVER_MS; t += 1000 / FPS) {
        await seek(page, t);
        frames.push(await shot(page));
      }
    }
    // Leave from the fully active state (also when no video was recorded).
    await seek(page, HOVER_MS);
    await playAll(page);
    // Pause from inside the page, two frames after the hover clears (by then
    // the exit's transitions and drain exist), without DevTools round trips
    // that can let the whole exit play out first.
    await page.eval(`(window.__left = new Promise((r) => {
      const f = () => document.querySelector("[data-lab-hover]") ? requestAnimationFrame(f) : requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__base = document.getAnimations().map((a) => { a.pause(); return [a, +a.currentTime || 0]; });
        r(window.__base.length);
      }));
      f();
    }), true)`);
    await offScene(page);
    await page.eval(`window.__left`);
    const exitRows = [];
    for (let t = 0; t <= EXIT_MS; t += VIDEO ? 1000 / FPS : 100) {
      await seek(page, t);
      if (VIDEO) frames.push(await shot(page));
      if (Math.round(t) % 100 < 34) exitRows.push({ t: Math.round(t), ...(await state(page)) });
    }
    writeFileSync(join(OUT, "checks", "exit.json"), JSON.stringify(exitRows, null, 1));
    const lowered = exitRows.find((r) => r.liftPx > -0.5)?.t ?? null;
    const draining = exitRows.find((r) => r.lit < 1)?.t ?? null;
    console.log("exit", JSON.stringify({ stationDownMs: lowered, drainStartsMs: draining, drainedMs: exitRows.find((r) => r.lit === 0)?.t ?? null, cameraHomeMs: exitRows.find((r) => r.cam === 1)?.t ?? null }));
    await page.screenshot(join(OUT, "return-to-idle.png"));
    console.log(`frames: ${frames.length}`);
  } finally {
    await page.close();
  }
}

// 1b. A/B: the same sequence with and without the micro camera push ----------
const ab = { A: [], B: [] };
const abStill = {};
for (const side of ["A", "B"]) {
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(400);
    if (side === "B") await noPush(page);
    const idle = VIDEO ? await shot(page, AB_CROP) : null;
    for (let t = 0; t < 500; t += 1000 / FPS) ab[side].push(idle);
    const c = await page.center(`[data-hotspot="playground"]`);
    await page.mouseMove(c.x, c.y);
    await hovered(page, "playground");
    await raf(page);
    await pauseAll(page);
    await seek(page, 2000);
    abStill[side] = { png: await shot(page, STATION_CROP, 3, "png"), cam: (await state(page)).cam };
    if (VIDEO) {
      for (let t = 0; t <= AB_HOVER_MS; t += 1000 / FPS) {
        await seek(page, t);
        ab[side].push(await shot(page, AB_CROP));
      }
      await seek(page, AB_HOVER_MS);
      await playAll(page);
      await page.eval(`(window.__left = new Promise((r) => {
        const f = () => document.querySelector("[data-lab-hover]") ? requestAnimationFrame(f) : requestAnimationFrame(() => requestAnimationFrame(() => {
          window.__base = document.getAnimations().map((a) => { a.pause(); return [a, +a.currentTime || 0]; });
          r(window.__base.length);
        }));
        f();
      }), true)`);
      await offScene(page);
      await page.eval(`window.__left`);
      for (let t = 0; t <= AB_EXIT_MS; t += 1000 / FPS) {
        await seek(page, t);
        ab[side].push(await shot(page, AB_CROP));
      }
    }
  } finally {
    await page.close();
  }
}
{
  // Sharpness of the lifted station: mean |Laplacian| of luminance (3x crop).
  const page = await launch({ width: 800, height: 600 });
  try {
    await page.eval(`window.__pa = ${JSON.stringify(abStill.A.png)}; true`);
    await page.eval(`window.__pb = ${JSON.stringify(abStill.B.png)}; true`);
    const len = await page.eval(`(async () => {
      const load = async (b64) => createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
      const [a, b] = await Promise.all([load(window.__pa), load(window.__pb)]);
      const sharp = (bmp) => {
        const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext("2d"); g.drawImage(bmp, 0, 0);
        const d = g.getImageData(0, 0, bmp.width, bmp.height).data, w = bmp.width, h = bmp.height;
        const L = (x, y) => { const i = (y * w + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
        let s = 0, n = 0;
        for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) { s += Math.abs(4 * L(x, y) - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1)); n++; }
        return +(s / n).toFixed(3);
      };
      const gap = 8, c = new OffscreenCanvas(a.width * 2 + gap, a.height); const g = c.getContext("2d");
      g.fillStyle = "#111"; g.fillRect(0, 0, c.width, c.height); g.drawImage(a, 0, 0); g.drawImage(b, a.width + gap, 0);
      window.__sa = sharp(a); window.__sb = sharp(b);
      g.font = "20px sans-serif";
      [["A: micro camera push (x${abStill.A.cam}), sharpness " + window.__sa, 0], ["B: no camera movement (x${abStill.B.cam}), sharpness " + window.__sb, a.width + gap]].forEach(([t, x]) => { g.fillStyle = "#000b"; g.fillRect(x, 0, 500, 32); g.fillStyle = "#fff"; g.fillText(t, x + 8, 22); });
      const blob = await c.convertToBlob({ type: "image/png" }); const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      window.__out = btoa(s); return window.__out.length;
    })()`);
    let b64 = "";
    for (let i = 0; i < len; i += 1 << 20) b64 += await page.eval(`window.__out.slice(${i}, ${i + (1 << 20)})`);
    save("checks/ab-station-3x.png", b64);
    const sharp = await page.eval(`({ A: window.__sa, B: window.__sb })`);
    console.log("ab sharpness (mean |Laplacian|, lifted station at 3x)", JSON.stringify({ ...sharp, camA: abStill.A.cam, camB: abStill.B.cam }));
    writeFileSync(join(OUT, "checks", "ab.json"), JSON.stringify({ sharpness: sharp, camA: abStill.A.cam, camB: abStill.B.cam }, null, 1));
  } finally {
    await page.close();
  }
}
if (VIDEO && ab.A.length) {
  const page = await launch({ width: 800, height: 600 });
  try {
    await page.eval(`window.__a = []; window.__b = []; true`);
    for (let i = 0; i < ab.A.length; i++) await page.eval(`window.__a.push(${JSON.stringify(ab.A[i])}); window.__b.push(${JSON.stringify(ab.B[i] ?? ab.B.at(-1))}); true`);
    const size = await page.eval(`(async () => {
      const bmp = async (b64) => createImageBitmap(await (await fetch("data:image/jpeg;base64," + b64)).blob());
      const w = ${AB_CROP.width}, h = ${AB_CROP.height}, gap = 8, top = 34;
      const c = document.createElement("canvas"); c.width = w * 2 + gap; c.height = h + top;
      const g = c.getContext("2d");
      const stream = c.captureStream(0); const track = stream.getVideoTracks()[0];
      const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 9e6 });
      const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
      const done = new Promise((r) => (rec.onstop = r));
      rec.start();
      const start = performance.now();
      for (let i = 0; i < window.__a.length; i++) {
        const [a, b] = await Promise.all([bmp(window.__a[i]), bmp(window.__b[i])]);
        g.fillStyle = "#111"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(a, 0, top); g.drawImage(b, w + gap, top);
        g.fillStyle = "#fff"; g.font = "18px sans-serif";
        g.fillText("A: micro camera push (1.025x, from arrival)", 10, 23);
        g.fillText("B: same sequence, no camera movement", w + gap + 10, 23);
        track.requestFrame();
        const due = start + ((i + 1) * 1000) / ${FPS};
        await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())));
      }
      rec.stop(); await done;
      const buf = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      window.__webm = btoa(s); return window.__webm.length;
    })()`);
    let b64 = "";
    for (let i = 0; i < size; i += 1 << 20) b64 += await page.eval(`window.__webm.slice(${i}, ${i + (1 << 20)})`);
    writeFileSync(join(OUT, "ab-camera-push.webm"), Buffer.from(b64, "base64"));
    console.log(`ab-camera-push.webm: ${ab.A.length} frames, ${(ab.A.length / FPS).toFixed(1)} s`);
  } finally {
    await page.close();
  }
}

// 2. Recording (WebM, encoded by Chrome) --------------------------------------
if (VIDEO && frames.length) {
  const page = await launch({ width: 800, height: 600 });
  try {
    await page.eval(`window.__frames = []; true`);
    for (const f of frames) await page.eval(`window.__frames.push(${JSON.stringify(f)}); true`);
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
    let b64 = "";
    for (let i = 0; i < size; i += 1 << 20) b64 += await page.eval(`window.__webm.slice(${i}, ${i + (1 << 20)})`);
    writeFileSync(join(OUT, "playground-power-lift.webm"), Buffer.from(b64, "base64"));
    console.log(`playground-power-lift.webm: ${frames.length} frames, ${(frames.length / FPS).toFixed(1)} s`);
  } finally {
    await page.close();
  }
}

// 3. Probes (real time) ---------------------------------------------------------
const lines = [];
const note = (name, ok, detail) => {
  lines.push(`${ok ? "OK  " : "BAD "} ${name}  ${JSON.stringify(detail)}`);
  console.log(lines.at(-1));
};
const atRest = (s) => s.lit === 0 && s.liftPx === 0 && !s.layerVisible && (s.game === null || s.game === "off") && s.gameOpacity === 0 && s.cam === 1;

/** Pixel difference between two PNG/JPEG data URLs (in a page): max, count > 2, bounding box. */
async function diff(page, a, b, exclude) {
  return page.eval(`(async () => {
    const load = async (u) => createImageBitmap(await (await fetch(u)).blob());
    const [A, B] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
    const read = (bmp) => { const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext("2d"); g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, bmp.width, bmp.height).data; };
    const x = read(A), y = read(B), w = A.width; let max = 0, over2 = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    const ex = ${JSON.stringify(exclude ?? null)};
    for (let i = 0; i < x.length; i += 4) {
      const px = (i / 4) % w, py = Math.floor(i / 4 / w);
      if (ex && px >= ex.x && px < ex.x + ex.width && py >= ex.y && py < ex.y + ex.height) continue;
      const m = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]));
      if (m > max) max = m;
      if (m > 2) { over2++; bx0 = Math.min(bx0, px); by0 = Math.min(by0, py); bx1 = Math.max(bx1, px); by1 = Math.max(by1, py); }
    }
    return { max, over2, box: over2 ? { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 } : null };
  })()`);
}
const png = (b64) => "data:image/png;base64," + b64;
const file = (p) => "data:image/png;base64," + readFileSync(p).toString("base64");

{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(500);
    // Idle: nothing moves on the lines. (Educational's globe orbit is the
    // only ambient animation left; its box is excluded.)
    const k = W / 1672;
    const orbit = { x: Math.floor(640 * k), y: Math.floor(280 * k), width: Math.ceil(380 * k), height: Math.ceil(180 * k) };
    const i1 = await shot(page, null, 1, "png");
    await sleep(1500);
    const i2 = await shot(page, null, 1, "png");
    const still = await diff(page, png(i1), png(i2), orbit);
    const anims = await page.eval(`document.getAnimations().filter((a) => a.playState === "running").map((a) => a.effect?.target?.closest?.("[data-surge],[data-charge-window],[data-charge-content],.lab-energy") ? "energy" : "other")`);
    note("Idle: no energy moves (1.5 s apart, outside the globe orbit)", still.max <= 2 && !anims.includes("energy"), { ...still, runningEnergyAnimations: anims.filter((a) => a === "energy").length });
    let s = await state(page);
    note("Idle: line unpowered, station at rest (layer hidden)", atRest(s) && s.dimOpacity === 1, s);

    const play = await page.center(`[data-hotspot="playground"]`);
    const eng = await page.center(`[data-hotspot="engineering"]`);

    // Live: charge -> lift -> game.
    await page.mouseMove(play.x, play.y);
    await hovered(page, "playground");
    await sleep(2100); // the push eases until ~1.85 s
    s = await state(page);
    note("Live hover: whole route powered, station lifted 18 px, game running, under-light on, camera pushed", s.lit === 1 && s.liftPx <= -LIFT + 0.1 && s.layerVisible && s.game === "running" && s.gameOpacity === 1 && s.gapLight >= 0.69 && Math.abs(s.cam - 1.025) < 0.001, s);
    // The fixed navigation and hero copy live outside the camera: never scaled or moved.
    const fixedRects = `[...document.querySelectorAll("header, .lab-hero")].map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => +v.toFixed(2)).join(","); })`;
    const fixed = await page.eval(fixedRects);
    await offScene(page);
    await sleep(1300);
    const fixedRest = await page.eval(fixedRects);
    note("Navigation and hero copy unchanged by the push", fixed.length >= 2 && fixed.join("|") === fixedRest.join("|"), { hovered: fixed, rest: fixedRest });
    await page.mouseMove(play.x, play.y);
    await sleep(1500);
    await offScene(page);
    await sleep(1300);
    s = await state(page);
    note("Exit: back to rest (charge drained, lowered, game off)", atRest(s), s);

    // Fast exit before arrival.
    await page.mouseMove(play.x, play.y);
    await sleep(250);
    const early = await state(page);
    await offScene(page);
    let maxLift = 0;
    for (let i = 0; i < 10; i++) {
      await sleep(100);
      maxLift = Math.min(maxLift, (await state(page)).liftPx ?? 0);
    }
    s = await state(page);
    note("Fast exit (250 ms): no lift or game ever; charge drained", early.lit < 1 && maxLift === 0 && atRest(s), { early, maxLiftAfter: maxLift, after: s });

    // Switch to Engineering mid-charge: Playground never activates.
    await page.mouseMove(play.x, play.y);
    await sleep(300);
    await page.mouseMove(eng.x, eng.y);
    await sleep(1400);
    s = await state(page);
    note("Switch to Engineering mid-charge: Playground stays at rest", atRest(s), s);
    await offScene(page);
    await sleep(1000);

    // Repeated quick hovers.
    for (let i = 0; i < 5; i++) {
      await page.mouseMove(play.x, play.y);
      await sleep(150 + 130 * i);
      await offScene(page);
      await sleep(60);
    }
    await sleep(1500);
    s = await state(page);
    note("Repeated quick hovers: clean rest", atRest(s), s);

    // Click, Escape, blur.
    await page.mouseMove(play.x, play.y);
    await sleep(1300);
    await page.click(play.x, play.y);
    await sleep(900);
    s = await state(page);
    note("Click: selected, the click camera takes over (1.09x), stays lifted and powered", s.selected === "playground" && s.liftPx <= -LIFT + 0.1 && s.dimOpacity === 0 && s.game === "running" && Math.abs(s.cam - 1.09) < 0.001, s);
    await page.key("Escape", "Escape", 27);
    await offScene(page);
    await sleep(200);
    const flash = await page.eval(`document.querySelector("[data-core-flash]").getAnimations().length`);
    await sleep(800);
    s = await state(page);
    note("Escape: focus keeps it lifted and powered, no second pulse", !s.selected && s.hover === "playground" && s.liftPx <= -LIFT + 0.1 && s.lit === 1 && s.dimOpacity === 1 && !flash, { ...s, flash });
    await page.eval(`document.activeElement?.blur(), true`);
    await sleep(1400);
    s = await state(page);
    note("Blur: back to rest", atRest(s), s);

    // Keyboard focus.
    await page.eval(`document.querySelector("#station-playground-trigger").focus(), true`);
    await sleep(120);
    const k1 = await state(page);
    await sleep(1300);
    const k2 = await state(page);
    note("Keyboard focus: same sequence (charging, then lifted and running)", k1.lit < 1 && k1.liftPx === 0 && k2.lit === 1 && k2.liftPx <= -LIFT + 0.1 && k2.game === "running", { early: k1, later: k2 });
    await page.eval(`document.activeElement?.blur(), true`);
    await sleep(1400);
    s = await state(page);
    note("Keyboard blur: back to rest", atRest(s), s);

    // Rest after all that matches idle (as it is: not frozen, which would
    // rewind the finished drain; the globe orbit's box is excluded).
    await sleep(500);
    const rest = await shot(page, null, 1, "png");
    const d = await diff(page, png(rest), file(join(OUT, "idle.png")), orbit);
    note("Rest after the probes matches idle", d.max <= 4, d);
  } finally {
    await page.close();
  }
}
{
  // Deep link: selected at load, lifted at once (no pulse, no lift animation).
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(`${URL_.replace(/\/$/, "")}/?station=playground`);
    await sleep(1200);
    const s = await state(page);
    const running = await page.eval(`document.getAnimations().filter((a) => a.playState === "running" && a instanceof CSSTransition && a.transitionProperty === "transform" && a.effect?.target?.matches?.('.lab-lift[data-lift="playground"]')).length`);
    note("Deep link ?station=playground: selected and lifted on load, no lift animation, game on", s.selected === "playground" && s.liftPx <= -LIFT + 0.1 && s.dimOpacity === 0 && !running && s.game === "running", { ...s, liftTransitionsRunning: running });
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
    await sleep(400);
    const s = await state(page);
    const surge = await page.eval(`getComputedStyle(document.querySelector(".lab-surge")).display`);
    await page.screenshot(join(OUT, "checks", "reduced-motion.png"));
    note("Reduced motion: powered at once (line lit, lights, still game), no spark, no lift", s.dimOpacity === 0 && s.liftPx === 0 && s.game === "still" && surge === "none", { ...s, surge });
    await offScene(page);
    await sleep(600);
    const r = await state(page);
    note("Reduced motion exit: back to rest", r.dimOpacity === 1 && r.gameOpacity === 0 && r.liftPx === 0, r);
  } finally {
    await page.close();
  }
}
{
  // What changed at rest vs M1.3E (expected: only the dimmed Playground line).
  const page = await launch({ width: 800, height: 600 });
  try {
    const ref = opt("idle-ref", "docs/m1.3e2/idle.png");
    const d = await diff(page, file(join(OUT, "idle.png")), file(ref));
    note(`Idle vs ${ref}: unchanged at rest`, d.max <= 2, d);
  } finally {
    await page.close();
  }
}
writeFileSync(join(OUT, "probes.txt"), lines.join("\n") + "\n");
