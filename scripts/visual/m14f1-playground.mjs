#!/usr/bin/env node
// M1.4F.1: Playground (and its connection) at rest and fully lifted, captured
// early in the page's life (300 ms after load, lifted by seeking the lift and
// charge animations to their end), for the identity check against M1.4F
// (docs/m1.4f/work/captures/v2/{rest,playground-lifted}.png).
//
// Why early: about 1 s after load Chrome re-rasterises the transformed
// Playground layer slightly softer (pre-existing; it happens with or without
// the M1.4F.1 stations, and in M1.4F's own --before capture), so the identity
// is checked at the same raster state as M1.4F's captures.
//
//   node scripts/visual/m14f1-playground.mjs     (BASE default http://localhost:3002)

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs/m1.4f1/work/captures/playground");
const BASE = process.env.BASE || "http://localhost:3002";
mkdirSync(OUT, { recursive: true });
const page = await launch({ width: 1648, height: 928 });
await page.goto(BASE + "/lab-v2");
await page.mouseMove(4, 924);
await sleep(1000);
const shot = async (f) => writeFileSync(join(OUT, f), Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
await shot("rest.png");
const c = await page.center('[data-hotspot="playground"]');
await page.mouseMove(c.x, c.y);
await sleep(40);
await page.eval(`(() => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 2400; }); return 1; })()`);
await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
await shot("lifted.png");
const lift = await page.eval(`(() => { const l = document.querySelector('.lab-lift[data-lift="playground"]'); const t = getComputedStyle(l).transform; return t === "none" ? 0 : +(new DOMMatrix(t).f / (l.offsetWidth / 1672)).toFixed(2); })()`);
writeFileSync(join(OUT, "lift.json"), JSON.stringify({ lift_px: lift }) + "\n");
console.log({ lift_px: lift });
await page.close();
process.exit(0);
