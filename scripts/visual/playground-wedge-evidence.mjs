#!/usr/bin/env node
// M1.3J.3: before/after evidence for Playground's connection-layer artifact
// (the floating base-corner wedge at the left end of the lifted gap), in the
// experimental build (:3001), scene px 1:1 (viewport 1672 x 941).
//
//   node scripts/visual/playground-wedge-evidence.mjs <tag>
//
// Writes docs/m1.3j/connection/<tag>/:
//   rest.png                     idle, around the station
//   lifted-no-shadow.png         lifted, every shadow off
//   lifted.png                   lifted, as shipped
//   arrival/NNN.png + arrival.json   the left end of the base through the
//                                real arrival (hover, unpinned), captured as
//                                fast as the browser allows, with timestamps

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tag = process.argv[2];
if (!tag) throw new Error("usage: playground-wedge-evidence.mjs <tag>");
const OUT = join(ROOT, "docs/m1.3j/connection", tag);
mkdirSync(join(OUT, "arrival"), { recursive: true });
const URL_ = process.env.LAB_URL || "http://localhost:3001";
const STATION = { x: 1040, y: 325, width: 360, height: 250, scale: 1 };
/** The base's left end and the line's end. */
const END = { x: 1040, y: 495, width: 90, height: 70, scale: 1 };
const NO_SHADOW = ".lab-lift-shadow,.lab-lift-penumbra,.lab-gap-sweep,.lab-depth-shadow{visibility:hidden!important}";

const page = await launch({ width: 1672, height: 941 });
const shot = async (clip, file) => {
  const s = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return [b.left, b.top, b.width / 1672]; })()`);
  if (s[0] !== 0 || s[1] !== 0 || s[2] !== 1) throw new Error(`scene not 1:1: ${s}`);
  const r = await page.send("Page.captureScreenshot", { format: "png", clip });
  if (file) writeFileSync(join(OUT, file), Buffer.from(r.data, "base64"));
  return r.data;
};
try {
  await page.goto(URL_);
  await page.mouseMove(4, 930);
  await sleep(900);
  await shot(STATION, "rest.png");
  // The real arrival: hover, then capture the line's end continuously.
  const c = await page.center('[data-hotspot="playground"]');
  const t0 = Date.now();
  await page.mouseMove(c.x, c.y);
  const times = [];
  for (let n = 0; Date.now() - t0 < 1600; n++) {
    const t = Date.now() - t0;
    const visible = await page.eval(`getComputedStyle(document.querySelector('[data-station-layer="playground"]')).visibility`);
    await shot(END, `arrival/${String(n).padStart(3, "0")}.png`);
    times.push({ n, t, layers: visible });
  }
  writeFileSync(join(OUT, "arrival.json"), JSON.stringify(times, null, 1) + "\n");
  await sleep(1200);
  await page.freezeAnimations(0);
  await shot(STATION, "lifted.png");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(NO_SHADOW)}; document.head.append(s); return 1; })()`);
  await sleep(150);
  await shot(STATION, "lifted-no-shadow.png");
  console.log(`evidence: ${OUT} (${times.length} arrival frames)`);
} finally {
  await page.close();
}
