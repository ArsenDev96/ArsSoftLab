#!/usr/bin/env node
// M1.4D: the layered v2 lab (/lab-v2) against the approved homepage and the
// M1.3J experimental lift, plus targeted functional checks of /lab-v2.
//
//   node scripts/visual/m14d-capture.mjs
//
// V2 = http://localhost:3002 (serves / and /lab-v2), M13J = http://localhost:3001.
// Same viewport (1648 x 928) for every capture; the camera rect is asserted
// equal. Writes docs/m1.4d/work/captures/*.png and checks.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs/m1.4d/work/captures");
mkdirSync(OUT, { recursive: true });
const V2 = process.env.V2_URL || "http://localhost:3002";
const M13J = process.env.M13J_URL || "http://localhost:3001";
const W = 1648;
const H = 928;
const STATION = { x: 1000, y: 300, w: 440, h: 320 };
const GAP = { x: 1050, y: 495, w: 340, h: 80 };
const NO_LINES = ".lab-charge-dim{visibility:hidden!important}";
const NO_V2_SHADOW = ".lab-v2-shadow{visibility:hidden!important}";
const NO_SHADOW = ".lab-depth-shadow,.lab-lift-shadow,.lab-lift-penumbra{visibility:hidden!important}";
const LIFT = '.lab-lift[data-lift="playground"]{transform:translateY(calc(var(--u) * -18)) scale(1.01)!important;transition:none!important}';
const NO_DEV = "nextjs-portal{display:none!important}";

const checks = {};
const cameras = {};

async function open(url, opts = {}) {
  const page = await launch({ width: W, height: H, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await page.goto(url);
  await page.mouseMove(4, H - 4);
  await sleep(900);
  const cam = () => page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const css = (t) => page.eval(`(() => { document.getElementById("ev")?.remove(); const s = document.createElement("style"); s.id = "ev"; s.textContent = ${JSON.stringify(NO_DEV + t)}; document.head.append(s); return 1; })()`).then(() => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`));
  const shot = async (file, r = null, scale = 1) => {
    const c = await cam();
    const p = r ? { format: "png", clip: { x: c.x + r.x * c.k, y: c.y + r.y * c.k, width: r.w * c.k, height: r.h * c.k, scale } } : { format: "png" };
    const res = await page.send("Page.captureScreenshot", p);
    writeFileSync(join(OUT, file), Buffer.from(res.data, "base64"));
  };
  await css("");
  return { page, errors, cam, css, shot };
}

// Approved homepage (same code, default variant).
{
  const { page, errors, cam, shot } = await open(`${V2}/`);
  cameras.approved = await cam();
  await shot("approved-rest.png");
  await shot("approved-station.png", STATION);
  checks.approved_errors = errors;
  await page.close();
}

// /lab-v2 static captures.
{
  const { page, errors, cam, css, shot } = await open(`${V2}/lab-v2`);
  cameras.v2 = await cam();
  checks.v2_layers = await page.eval(`[...document.querySelectorAll("[data-v2-object]")].map((i) => [i.dataset.v2Object, i.naturalWidth, i.naturalHeight, i.complete])`);
  checks.v2_plate_requests = await page.eval(`performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname).filter((p) => p.startsWith("/scene/") && !p.startsWith("/scene/v2/"))`);
  await css(NO_LINES);
  await shot("A-v2-no-connections.png");
  await css(NO_LINES + NO_V2_SHADOW);
  await shot("A-v2-no-connections-no-shadow.png");
  await css("");
  await shot("C-v2-with-connections.png");
  await shot("D-v2-rest-station.png", STATION);
  await shot("D-v2-rest-station-3x.png", STATION, 3);
  await css(LIFT);
  checks.v2_manual_lift_px = await page.eval(`new DOMMatrix(getComputedStyle(document.querySelector('.lab-lift[data-lift="playground"]')).transform).f`);
  await shot("D-v2-lifted-station.png", STATION);
  await shot("D-v2-lifted.png");
  await shot("D-v2-lifted-gap-3x.png", GAP, 3);
  await css(LIFT + NO_V2_SHADOW);
  await shot("E-v2-lifted-no-shadow-station.png", STATION);
  await shot("E-v2-lifted-no-shadow-station-3x.png", STATION, 3);
  await shot("E-v2-lifted-no-shadow-gap-3x.png", GAP, 3);
  // Station edges at 3x, at rest (halos, fringes).
  await css("");
  const R = { engineering: { x: 250, y: 360, w: 370, h: 200 }, educational: { x: 660, y: 270, w: 350, h: 225 }, hub: { x: 630, y: 470, w: 420, h: 195 }, creative: { x: 80, y: 520, w: 450, h: 265 }, experience: { x: 1190, y: 500, w: 480, h: 285 } };
  for (const [k, r] of Object.entries(R)) await shot(`edges-${k}-3x.png`, r, 3);
  checks.v2_errors = errors;
  await page.close();
}

// /lab-v2 behaviour: real hover (energy, lift, arcade), keyboard, deep link, reduced motion.
{
  const { page, errors, css, shot } = await open(`${V2}/lab-v2`);
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(3200);
  await css("");
  checks.v2_hover = await page.eval(`(() => { const l = document.querySelector('.lab-lift[data-lift="playground"]'); const a = document.querySelector('[data-arcade="playground"]'); return { hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, lift_px: new DOMMatrix(getComputedStyle(l).transform).f, arcade_opacity: +getComputedStyle(a).opacity, arcade_state: a.dataset.state ?? null }; })()`);
  await shot("G-v2-hover-live.png");
  await shot("G-v2-hover-live-station.png", STATION);
  await page.mouseMove(4, H - 4);
  await sleep(1500);
  checks.v2_after_leave_lift_px = await page.eval(`new DOMMatrix(getComputedStyle(document.querySelector('.lab-lift[data-lift="playground"]')).transform).f`);
  // Keyboard: focus the Playground hotspot and press Enter.
  await page.eval(`document.querySelector('[data-hotspot="playground"]').focus(); 1`);
  checks.v2_focus = await page.eval(`document.activeElement?.dataset?.hotspot ?? document.activeElement?.tagName`);
  await page.key("Enter", "Enter", 13);
  await sleep(1200);
  checks.v2_keyboard_select = await page.eval(`({ selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, url: location.pathname + location.search })`);
  await shot("H-v2-selected-playground.png");
  checks.v2_behaviour_errors = errors;
  await page.close();
}
{
  const { page, errors, shot } = await open(`${V2}/lab-v2?station=engineering`);
  checks.v2_deep_link = await page.eval(`({ selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, url: location.pathname + location.search })`);
  await shot("I-v2-deep-link-engineering.png");
  checks.v2_deep_link_errors = errors;
  await page.close();
}
{
  const { page, errors } = await open(`${V2}/lab-v2`, { reducedMotion: true });
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(1200);
  checks.v2_reduced_motion = await page.eval(`(() => { const l = document.querySelector('.lab-lift[data-lift="playground"]'); return { hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, lift_px: new DOMMatrix(getComputedStyle(l).transform).f, transition: getComputedStyle(l).transitionDuration }; })()`);
  checks.v2_reduced_errors = errors;
  await page.close();
}

// M1.3J experimental lift for comparison (hover, seeked to full lift).
{
  const { page, cam, css, shot } = await open(M13J);
  cameras.m13j = await cam();
  await shot("m13j-rest-station.png", STATION);
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(30);
  await page.eval(`(() => { document.getAnimations().forEach((x) => { x.pause(); x.currentTime = 2400; }); return 1; })()`);
  await css("");
  await shot("m13j-lifted-station.png", STATION);
  await css(NO_SHADOW);
  await shot("m13j-lifted-no-shadow-station.png", STATION);
  await shot("m13j-lifted-no-shadow-gap-3x.png", GAP, 3);
  await page.close();
}

checks.cameras = cameras;
const cams = new Set(Object.values(cameras).map((c) => JSON.stringify(c)));
checks.camera_identical = cams.size === 1;
writeFileSync(join(OUT, "checks.json"), JSON.stringify(checks, null, 1) + "\n");
console.log(JSON.stringify(checks, null, 1));
