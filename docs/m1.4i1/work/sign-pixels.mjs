// M1.4I.1C: pixels. node sign-pixels.mjs <label>; node sign-pixels.mjs compare a b
// Playground's cabinet is resampled one of a few ways per launch (see navigation-fix.md), so each side is captured four
// times and every "a" capture is compared with its nearest "b".
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { compareImages, prepare } from "../../../scripts/visual/compare.mjs";
import { open } from "../../m1.4i/work/lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const N = 4, NAMES = ["idle", "charging", "lifted", "leaving", "home"];
if (process.argv[2] === "compare") {
  const [a, b] = process.argv.slice(3);
  const page = await launch();
  await prepare(page);
  for (const n of NAMES) {
    const r = [];
    for (let i = 0; i < N; i++) {
      let best = null;
      for (let j = 0; j < N; j++) {
        const c = await compareImages(page, join(HERE, `sign-px-${a}`, `${n}-${i}.png`), join(HERE, `sign-px-${b}`, `${n}-${j}.png`));
        if (!best || c.mean < best.mean) best = c;
      }
      r.push(`max ${best.max} over2 ${best.over2}`);
    }
    console.log(n.padEnd(9), r.join(" | "));
  }
  await page.close();
  process.exit(0);
}
const DIR = join(HERE, `sign-px-${process.argv[2]}`);
mkdirSync(DIR, { recursive: true });
for (let i = 0; i < N; i++) {
  const L = await open("/lab-v2", { gpu: true });
  const shot = async (n) => writeFileSync(join(DIR, `${n}-${i}.png`), Buffer.from((await L.page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await shot("idle");
  await L.hover("playground");
  await sleep(120);
  await L.seek(400);
  await sleep(150);
  await shot("charging");
  await L.page.eval("(document.getAnimations().forEach((a) => a.play()), 1)");
  await sleep(2000);
  // The running game is stopped on one frame.
  await L.page.eval(`(() => { document.querySelector(".lab-arcade canvas").style.visibility = "hidden"; return 1; })()`);
  await sleep(150);
  await L.page.eval("(document.getAnimations().forEach((a) => { if (!(a instanceof CSSTransition) && a.playState === 'running' && a.effect.getTiming().duration < 1e8) { a.pause(); a.currentTime = 0; } }), 1)");
  await sleep(150);
  await shot("lifted");
  await L.away();
  await L.frame();
  await L.seek(200);
  await sleep(150);
  await shot("leaving");
  await L.page.close();
  const H = await launch({ gpu: true });
  await H.goto("http://localhost:3002/");
  await H.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await H.mouseMove(4, 924);
  await sleep(1500);
  await H.freezeAnimations(0);
  await sleep(200);
  await H.screenshot(join(DIR, `home-${i}.png`));
  await H.close();
}
process.exit(0);
