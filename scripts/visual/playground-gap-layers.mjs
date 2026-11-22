#!/usr/bin/env node
// M1.3J.4: Playground's lifted gap, layer by layer, in the experimental build
// (:3001). One page, hovered until fully lifted, every animation frozen, then
// the same frame captured with layer groups switched off (CSS visibility only,
// nothing else changes). Scene px 1:1 (viewport 1672 x 941).
//
//   node scripts/visual/playground-gap-layers.mjs <out-dir>
//
//   A-all.png            every layer
//   B-no-shadows.png     contact + ambient shadow off
//   C-no-shadows-joint   ... and the foundation joint off
//   D-floor-station      only the floor (plate, environment, clean background,
//                        floor candidate) and the lifted station
//   E-floor-only         the floor alone, station hidden
// plus per-layer probes (F-*) and the full frame for A.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";

const out = resolve(process.argv[2] || "docs/m1.3j/black-gap/layers");
mkdirSync(out, { recursive: true });
const R = { x: 1000, y: 300, width: 440, height: 320, scale: 1 };
const SHADOWS = ".lab-depth-shadow,.lab-lift-shadow,.lab-lift-penumbra,.lab-gap-sweep";
const JOINT = ".lab-foundation";
const REFLECTION = '[data-reflection="playground"]';
const CONNECTION = ".lab-charge-unpowered,.lab-charge-powered,[data-charge-core]";
const LIGHTS = '[data-layer="lights"],[data-layer="fx"]';
const STATION = '.lab-lift[data-lift="playground"]';
const FLOOR_CANDIDATE = ".lab-floor-candidate";
const BACKDROP = '[data-station-layer="playground"] > div:first-child';
const hide = (sel) => `${sel}{visibility:hidden!important}`;

const page = await launch({ width: 1672, height: 941 });
let n = 0;
const set = async (css) => {
  await page.eval(`(() => { document.getElementById("gapdiag")?.remove(); const s = document.createElement("style"); s.id = "gapdiag"; s.textContent = ${JSON.stringify(css)}; document.head.append(s); return 1; })()`);
  await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  await sleep(60);
};
const shot = async (file, clip = R) => {
  const r = await page.send("Page.captureScreenshot", { format: "png", clip });
  writeFileSync(resolve(out, file), Buffer.from(r.data, "base64"));
  n++;
};
try {
  await page.goto(process.env.LAB_URL || "http://localhost:3001");
  await page.mouseMove(4, 930);
  await sleep(900);
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(2600);
  await page.freezeAnimations(0);
  const lift = await page.eval(`getComputedStyle(document.querySelector('${STATION}')).transform`);
  await set("");
  await shot("A-all.png");
  await shot("A-all-full.png", { x: 0, y: 0, width: 1672, height: 941, scale: 1 });
  await set(hide(SHADOWS));
  await shot("B-no-shadows.png");
  await set(hide(`${SHADOWS},${JOINT}`));
  await shot("C-no-shadows-joint.png");
  await set(hide(`${SHADOWS},${JOINT},${REFLECTION},${CONNECTION},${LIGHTS}`));
  await shot("D-floor-station.png");
  await set(hide(`${SHADOWS},${JOINT},${REFLECTION},${CONNECTION},${LIGHTS},${STATION}`));
  await shot("E-floor-only.png");
  // Single-layer probes: everything on except one group.
  for (const [name, sel] of [
    ["no-floor-candidate", FLOOR_CANDIDATE],
    ["no-backdrop", BACKDROP],
    ["no-reflection", REFLECTION],
    ["no-connection", CONNECTION],
    ["no-station", STATION],
    ["no-contact", ".lab-depth-contact"],
    ["no-ambient", ".lab-depth-ambient"],
  ]) {
    await set(hide(sel));
    await shot(`F-${name}.png`);
  }
  await set("");
  console.log(JSON.stringify({ out, shots: n, lift }));
} finally {
  await page.close();
}
