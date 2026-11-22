#!/usr/bin/env node
// M1.3J.3: Playground's activation, frame by frame and deterministic, in the
// experimental build (:3001). Hover, pause every animation and transition,
// then seek them all to t = 0, 25, 50 ... ms and capture the base's left end
// and the line's end (scene px 1:1). A flash at the switch would show as a
// one-step spike.
//
//   node scripts/visual/playground-arrival-frames.mjs <tag> [stepMs] [endMs]
//
// Writes docs/m1.3j/connection/<tag>/seek/NNNN.png and seek.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [tag, stepArg, endArg] = process.argv.slice(2);
if (!tag) throw new Error("usage: playground-arrival-frames.mjs <tag> [stepMs] [endMs]");
const STEP = Number(stepArg ?? 25);
const END_MS = Number(endArg ?? 1400);
const OUT = join(ROOT, "docs/m1.3j/connection", tag, "seek");
mkdirSync(OUT, { recursive: true });
const CLIP = { x: 1040, y: 495, width: 90, height: 70, scale: 1 };

const page = await launch({ width: 1672, height: 941 });
try {
  await page.goto(process.env.LAB_URL || "http://localhost:3001");
  await page.mouseMove(4, 930);
  await sleep(900);
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  // Let the hover state apply (transitions and animations get created), then hold everything.
  await sleep(30);
  await page.eval(`(() => { window.__anims = document.getAnimations(); window.__anims.forEach((a) => a.pause()); return window.__anims.length; })()`);
  const frames = [];
  for (let t = 0; t <= END_MS; t += STEP) {
    const n = await page.eval(`(() => { const all = document.getAnimations(); all.forEach((a) => { a.pause(); a.currentTime = ${t}; }); return all.length; })()`);
    await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
    const vis = await page.eval(`getComputedStyle(document.querySelector('[data-station-layer="playground"]')).visibility`);
    const r = await page.send("Page.captureScreenshot", { format: "png", clip: CLIP });
    const file = `${String(t).padStart(4, "0")}.png`;
    writeFileSync(join(OUT, file), Buffer.from(r.data, "base64"));
    frames.push({ t, file, layers: vis, animations: n });
  }
  writeFileSync(join(OUT, "../seek.json"), JSON.stringify(frames, null, 1) + "\n");
  console.log(`${frames.length} frames: ${OUT}`);
} finally {
  await page.close();
}
