#!/usr/bin/env node
// M1.3J.5: Playground's lift at normal desktop size (1648 x 928), in the
// experimental build (:3001): at rest, during the rise, at full lift and
// during the return (animations paused and seeked, so the phases are exact),
// plus the full lift with shadows off and with the foundation joint off, and
// the gap at 3x (browser-rendered) with shadows off.
//
//   node scripts/visual/playground-depth-evidence.mjs <tag>
//
// Writes docs/m1.3j/depth/<tag>/*.png (station region, desktop pixels).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tag = process.argv[2];
if (!tag) throw new Error("usage: playground-depth-evidence.mjs <tag>");
const OUT = join(ROOT, "docs/m1.3j/depth", tag);
mkdirSync(OUT, { recursive: true });
const W = 1648;
const H = 928;
const NO_SHADOW = ".lab-depth-shadow{visibility:hidden!important}";
const NO_JOINT = ".lab-foundation{visibility:hidden!important}";

const page = await launch({ width: W, height: H });
const cam = () => page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
const clipOf = (c, r, scale = 1) => ({ x: c.x + r.x * c.k, y: c.y + r.y * c.k, width: r.w * c.k, height: r.h * c.k, scale });
const STATION = { x: 1000, y: 300, w: 440, h: 320 };
const GAP = { x: 1050, y: 495, w: 340, h: 80 };
const shot = async (file, r = STATION, scale = 1) => {
  const res = await page.send("Page.captureScreenshot", { format: "png", clip: clipOf(await cam(), r, scale) });
  writeFileSync(join(OUT, file), Buffer.from(res.data, "base64"));
};
const css = (t) => page.eval(`(() => { document.getElementById("ev")?.remove(); const s = document.createElement("style"); s.id = "ev"; s.textContent = ${JSON.stringify(t)}; document.head.append(s); return 1; })()`);
const seek = (t) => page.eval(`(() => { const a = document.getAnimations(); a.forEach((x) => { x.pause(); x.currentTime = ${t}; }); return a.length; })()`).then(() => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`));
const resume = () => page.eval(`(() => { document.getAnimations().forEach((x) => x.play()); return 1; })()`);
try {
  await page.goto(process.env.LAB_URL || "http://localhost:3001");
  await page.mouseMove(4, H - 4);
  await sleep(900);
  await shot("1-rest.png");
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(30);
  // The station layers switch on at ~650 ms (energy arrival); the lift runs 450 ms from there.
  await seek(860);
  await shot("2-rising.png");
  await seek(2400);
  await shot("3-lifted.png");
  await css(NO_SHADOW);
  await shot("3-lifted-no-shadow.png");
  await shot("3-lifted-no-shadow-gap-3x.png", GAP, 3);
  await css(NO_JOINT);
  await shot("3-lifted-no-joint.png");
  await css(`${NO_JOINT}${NO_SHADOW}`);
  await shot("3-lifted-no-joint-no-shadow.png");
  await css("");
  await resume();
  await sleep(300);
  await page.mouseMove(4, H - 4);
  await sleep(30);
  await seek(200);
  await shot("4-returning.png");
  await resume();
  await sleep(1500);
  await shot("5-rest-again.png");
  console.log(`depth evidence: ${OUT}`);
} finally {
  await page.close();
}
