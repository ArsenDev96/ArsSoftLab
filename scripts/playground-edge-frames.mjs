#!/usr/bin/env node
// M1.3J.2: real-browser frames of Playground's arrival instant in the
// experimental build (:3001), for scripts/playground-edge.py.
//
//   node scripts/playground-edge-frames.mjs <name>[=<cut-out.png>] ...
//
// For each entry, a fresh page; if a file is given, the browser is served it
// in place of the cut-out the build references (request interception: no
// file on disk changes). Frames, scene px 1:1 (viewport 1672 x 941), region
// x 1040-1400, y 325-575, into docs/m1.3j/hybrid/edge/frames/:
//   <name>-rest.png      idle (the plate shows the station)
//   <name>-rest-on.png   idle, the layers forced on at identity
//   <name>-before.png    hovered, the energy arrived, the layers held off
//   <name>-after.png     the same instant, layers on (lift at identity,
//                        --lp 0): what the switch at arrival shows
//   <name>-lifted.png, <name>-lifted-no-shadow.png   fully lifted
// The arrival instant is pinned with CSS (lift transform none, --lp 0), so
// "before" and "after" differ only by the layers switching on.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./visual/cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/m1.3j/hybrid/edge/frames");
const URL_ = process.env.LAB_URL || "http://localhost:3001";
const R = { x: 1040, y: 325, width: 360, height: 250, scale: 1 };
const CUTOUT = /\/scene\/layers(25d\/playground\/object|\/playground-v2)\.png/;
const PIN = '.lab-depth,.lab-reflection{--lp:0!important;transition:none!important}.lab-lift[data-lift="playground"]{transform:none!important;transition:none!important}';
const HOLD = '.lab-station-layer[data-station-layer="playground"]{visibility:hidden!important}';
const FORCE = '.lab-station-layer[data-station-layer="playground"]{visibility:visible!important;transition:none!important}';
const NO_SHADOW = ".lab-lift-shadow,.lab-lift-penumbra,.lab-gap-sweep,.lab-depth-shadow{visibility:hidden!important}";

mkdirSync(OUT, { recursive: true });
for (const arg of process.argv.slice(2)) {
  const [name, file] = arg.split("=");
  const page = await launch({ width: 1672, height: 941 });
  try {
    if (file) {
      const body = readFileSync(resolve(ROOT, file)).toString("base64");
      await page.send("Fetch.enable", { patterns: [{ urlPattern: "*.png*" }] });
      page.on((m) => {
        if (m.method !== "Fetch.requestPaused") return;
        const { requestId, request } = m.params;
        if (CUTOUT.test(request.url)) page.send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "image/png" }], body });
        else page.send("Fetch.continueRequest", { requestId });
      });
    }
    const css = (t, id) => page.eval(`(() => { const s = document.createElement("style"); s.id = ${JSON.stringify(id)}; s.textContent = ${JSON.stringify(t)}; document.head.append(s); return 1; })()`);
    const uncss = (id) => page.eval(`(() => { document.getElementById(${JSON.stringify(id)})?.remove(); return 1; })()`);
    const shot = async (f) => {
      const s = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return [b.left, b.top, b.width / 1672]; })()`);
      if (s[0] !== 0 || s[1] !== 0 || s[2] !== 1) throw new Error(`scene not 1:1: ${s}`);
      const r = await page.send("Page.captureScreenshot", { format: "png", clip: R });
      writeFileSync(join(OUT, `${name}-${f}.png`), Buffer.from(r.data, "base64"));
    };
    await page.goto(URL_);
    const ready = await page.eval(`!!document.querySelector('[data-station-layer="playground"][data-ready]')`);
    if (!ready) throw new Error("station layer not ready");
    await page.mouseMove(4, 930);
    await sleep(900);
    await page.freezeAnimations(0);
    await shot("rest");
    await css(PIN, "pin");
    await css(FORCE, "force");
    await sleep(200);
    await shot("rest-on");
    await uncss("force");
    await css(HOLD, "hold");
    await sleep(200);
    const c = await page.center('[data-hotspot="playground"]');
    await page.mouseMove(c.x, c.y);
    await sleep(2500);
    await page.freezeAnimations(0);
    await shot("before");
    await uncss("hold");
    await sleep(1200);
    await page.freezeAnimations(0);
    await shot("after");
    await uncss("pin");
    await sleep(1500);
    await page.freezeAnimations(0);
    await shot("lifted");
    await css(NO_SHADOW, "ns");
    await sleep(150);
    await shot("lifted-no-shadow");
    console.log(`frames: ${name}`);
  } finally {
    await page.close();
  }
}
