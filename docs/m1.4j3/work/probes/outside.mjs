// M1.4J.3: Creative Studio really raised (real hover, real time) and just back: full frames, to compare everything else with the checkpoint (outside.py).
//   BASE=http://localhost:<port> node outside.mjs <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
for (let k = 0; k < 3; k++) for (const rm of [false, true]) {
  const p = await open("/lab-v2", { gpu: true, reducedMotion: rm });
  const c = await p.page.center('[data-hotspot="creative"]'); await p.page.mouseMove(c.x, c.y); await sleep(3500);
  const s = async (n) => writeFileSync(`${OUT}/${n}${rm ? "-reduced" : ""}-${k}.png`, Buffer.from((await p.page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await s("raised"); await p.away(); await sleep(2000); await s("back"); await p.page.close();
}
process.exit(0);
