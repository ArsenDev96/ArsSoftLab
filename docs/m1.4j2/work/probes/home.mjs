// M1.4J.2: the homepage at rest, as refs.mjs captures it (after an Engineering hover), repeated.   BASE=... node home.mjs <out prefix> <n>
import { writeFileSync } from "node:fs";
import { BASE, launch, sleep } from "../../../m1.4i/work/lib.mjs";
const [out, n] = process.argv.slice(2);
for (let k = 0; k < +n; k++) {
  const page = await launch({ width: 1648, height: 928, gpu: true });
  await page.goto(BASE + "/");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(1200);
  const c = await page.center('[data-hotspot="engineering"]'); await page.mouseMove(c.x, c.y); await sleep(1800);
  await page.mouseMove(4, 924); await sleep(1500);
  await page.freezeAnimations(0); await page.finishTransitions(); await sleep(300);
  writeFileSync(`${out}-${k}.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await page.close();
}
process.exit(0);
