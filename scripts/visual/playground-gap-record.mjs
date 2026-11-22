#!/usr/bin/env node
// M1.3J.4: a short real-time recording of Playground's full motion in the
// experimental build (:3001) at desktop size: idle, energy arrives, the
// station lifts 18 px and holds, then returns.
//
//   node scripts/visual/playground-gap-record.mjs [out.webm]

import { resolve } from "node:path";
import { sleep } from "./cdp.mjs";
import { recordWebm } from "./record.mjs";

const out = resolve(process.argv[2] || "docs/m1.3j/black-gap/playground-lift.webm");
const r = await recordWebm({
  url: process.env.LAB_URL || "http://localhost:3001",
  width: 1672,
  height: 941,
  out,
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
console.log(`${out}: ${r.frames} frames, ${r.seconds} s at ${r.fps} fps`);
