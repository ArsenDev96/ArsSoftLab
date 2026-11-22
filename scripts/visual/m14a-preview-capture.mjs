#!/usr/bin/env node
// M1.4A: Playground's lift with the generated candidates, captured beside the
// approved default build and the M1.3J experimental lift. Isolated: the
// candidate files are served to this headless browser only, by request
// interception (CDP Fetch), from docs/m1.4a/preview/ (built by
// scripts/m14a-preview.py). public/, both servers and both builds are untouched.
//
//   node scripts/visual/m14a-preview-capture.mjs [variant ...] [--record]
//
// Variants (default: all):
//   approved  default build, :3000
//   m13j      experimental build, :3001, as it is
//   strict    :3001 + the M1.3K pipeline's forced staging of the candidates
//             (approved plate outside Playground's footprint)
//   full      :3001 + VISUAL-ONLY: the generated frame replaces the plate
//
// Same viewport (1648 x 928), same pointer positions and the same scene clip
// for every variant; the camera rect is asserted equal. Phases are exact
// (animations paused and seeked): A rest, B power arrival (the first frame
// with the station layers on), C half the lift (by measured translateY),
// D full lift, E full lift without shadows, F half way down on the return,
// plus A2 rest again
// and G a live 3 s hold (real time, the arcade running).
//
// Writes docs/m1.4a/review/captures/<variant>/*.png and meta.json;
// --record also writes docs/m1.4a/review/playground-test.webm (full) and
// playground-test-strict.webm.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";
import { recordWebm } from "./record.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST = JSON.parse(readFileSync(join(ROOT, "docs/m1.4a/preview/manifest.json"), "utf8"));
const OUT = join(ROOT, "docs/m1.4a/review");
const W = 1648;
const H = 928;
const VARIANTS = {
  approved: { url: "http://localhost:3000" },
  m13j: { url: "http://localhost:3001" },
  strict: { url: "http://localhost:3001", map: MANIFEST.strict },
  full: { url: "http://localhost:3001", map: MANIFEST.full },
};
const STATION = { x: 1000, y: 300, w: 440, h: 320 };
const GAP = { x: 1050, y: 495, w: 340, h: 80 };
const NO_SHADOW = ".lab-depth-shadow,.lab-lift-shadow,.lab-lift-penumbra{visibility:hidden!important}";
const LIFT = '.lab-lift[data-lift="playground"]';

/** Serve `map` (URL path -> repo file) to this page; count everything else under /scene/layers25d/. */
async function intercept(page, map = {}) {
  const log = { served: {}, layers25d: 0 };
  await page.send("Fetch.enable", { patterns: [{ urlPattern: "*/scene/*", requestStage: "Request" }] });
  page.on((m) => {
    if (m.method !== "Fetch.requestPaused") return;
    const { requestId, request } = m.params;
    const path = new URL(request.url).pathname;
    if (path.includes("/layers25d/")) log.layers25d++;
    const file = map[path];
    if (!file) {
      page.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }
    log.served[path] = (log.served[path] || 0) + 1;
    page
      .send("Fetch.fulfillRequest", {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "image/png" },
          { name: "Cache-Control", value: "no-store" },
        ],
        body: readFileSync(join(ROOT, file)).toString("base64"),
      })
      .catch((e) => console.error(`fulfil ${path}: ${e.message}`));
  });
  return log;
}

async function capture(name) {
  const v = VARIANTS[name];
  const dir = join(OUT, "captures", name);
  mkdirSync(dir, { recursive: true });
  const page = await launch({ width: W, height: H });
  const cam = () => page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const clipOf = (c, r, scale) => ({ x: c.x + r.x * c.k, y: c.y + r.y * c.k, width: r.w * c.k, height: r.h * c.k, scale });
  const shot = async (file, r = null, scale = 1) => {
    const p = r ? { format: "png", clip: clipOf(await cam(), r, scale) } : { format: "png" };
    const res = await page.send("Page.captureScreenshot", p);
    writeFileSync(join(dir, file), Buffer.from(res.data, "base64"));
  };
  const css = (t) => page.eval(`(() => { document.getElementById("ev")?.remove(); const s = document.createElement("style"); s.id = "ev"; s.textContent = ${JSON.stringify(t)}; document.head.append(s); return 1; })()`);
  const frame = () => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  const seek = async (t) => {
    await page.eval(`(() => { document.getAnimations().forEach((x) => { x.pause(); x.currentTime = ${t}; }); return 1; })()`);
    await frame();
  };
  const resume = () => page.eval(`(() => { document.getAnimations().forEach((x) => x.play()); return 1; })()`);
  const ty = () => page.eval(`(() => { const e = document.querySelector(${JSON.stringify(LIFT)}); return e ? new DOMMatrix(getComputedStyle(e).transform).f : null; })()`);
  const meta = { variant: name, url: v.url };
  try {
    const log = await intercept(page, v.map);
    await page.goto(v.url);
    await page.mouseMove(4, H - 4);
    await sleep(900);
    meta.camera = await cam();
    await shot("A-rest.png");
    const c = await page.center('[data-hotspot="playground"]');
    meta.pointer = c;
    await page.mouseMove(c.x, c.y);
    await sleep(30);
    const delay = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(LIFT)}); return e ? Math.max(...getComputedStyle(e).transitionDelay.split(",").map((s) => parseFloat(s) * 1000)) : null; })()`);
    meta.arrive_ms = delay ?? 650;
    // The CSS lift (-18 scene px). Never seek past the transitions' end before
    // the earlier phases: a finished transition leaves getAnimations().
    const full = (await ty()) === null ? null : -18 * meta.camera.k;
    // C: the time at which the station is half way up (ease-heavy is not linear in time).
    let lo = meta.arrive_ms;
    let hi = meta.arrive_ms + 450;
    if (full) {
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        await seek(mid);
        if ((await ty()) > full / 2) lo = mid;
        else hi = mid;
      }
    }
    meta.half_ms = Math.round(((lo + hi) / 2) * 10) / 10;
    meta.arrival_frame_ms = meta.arrive_ms + 17;
    await seek(meta.arrival_frame_ms);
    meta.lift_px_arrival = await ty();
    await shot("B-arrival.png");
    await seek(meta.half_ms);
    meta.lift_px_half = await ty();
    await shot("C-half.png");
    await seek(2400);
    meta.lift_px_full = await ty();
    await shot("D-lifted.png");
    await shot("D-station-3x.png", STATION, 3);
    await css(NO_SHADOW);
    await shot("E-lifted-no-shadow.png");
    await shot("E-station-3x.png", STATION, 3);
    await shot("E-gap-3x.png", GAP, 3);
    await css("");
    await resume();
    await sleep(300);
    await page.mouseMove(4, H - 4);
    // Hover ends after LabState's grace period (~100 ms); only then does the
    // return transition exist. F is half way down, by measured translateY.
    const t0 = Date.now();
    while ((await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover || ""`)) && Date.now() - t0 < 3000) await sleep(5);
    await sleep(20);
    lo = 0;
    hi = 420;
    if (full) {
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        await seek(mid);
        if ((await ty()) < full / 2) lo = mid;
        else hi = mid;
      }
    }
    meta.return_half_ms = Math.round(((lo + hi) / 2) * 10) / 10;
    await seek(meta.return_half_ms);
    meta.lift_px_returning = await ty();
    await shot("F-returning.png");
    await resume();
    await sleep(1500);
    await shot("A2-rest-again.png");
    await page.mouseMove(c.x, c.y);
    await sleep(3200);
    await shot("G-live-hold.png");
    await shot("G-station-3x.png", STATION, 3);
    meta.requests = log;
    if (v.map) {
      const missing = Object.keys(v.map).filter((p) => !log.served[p]);
      if (missing.length) throw new Error(`${name}: candidate files never requested: ${missing.join(", ")}`);
    }
    writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 1) + "\n");
    console.log(JSON.stringify(meta));
    return meta;
  } finally {
    await page.close();
  }
}

async function record(name, file) {
  const v = VARIANTS[name];
  let log;
  const r = await recordWebm({
    url: v.url,
    width: 1672,
    height: 941,
    out: join(OUT, file),
    setup: async (page) => {
      log = await intercept(page, v.map);
    },
    prepare: async (page) => {
      await page.mouseMove(4, 930);
      await sleep(800);
    },
    act: async (page) => {
      const c = await page.center('[data-hotspot="playground"]');
      await page.mouseMove(c.x, c.y);
      await sleep(3200);
      await page.mouseMove(4, 930);
      await sleep(1800);
    },
  });
  console.log(`${file}: ${r.frames} frames, ${r.seconds} s at ${r.fps} fps; served ${JSON.stringify(log.served)}`);
}

const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith("--"));
const metas = [];
for (const n of names.length ? names : Object.keys(VARIANTS)) {
  if (!VARIANTS[n]) throw new Error(`unknown variant ${n}`);
  metas.push(await capture(n));
}
const cams = new Set(metas.map((m) => JSON.stringify(m.camera)));
if (cams.size > 1) throw new Error(`camera differs between variants: ${[...cams].join(" vs ")}`);
if (args.includes("--record")) {
  await record("full", "playground-test.webm");
  await record("strict", "playground-test-strict.webm");
}
