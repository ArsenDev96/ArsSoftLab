// M1.4J.4: the homepage, 8 fresh loads each, alternating.   node home.mjs <out dir> <now url> <checkpoint url>
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, sleep } from "../../../m1.4i/work/lib.mjs";
const [OUT, NOW, BASE] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
for (let k = 0; k < 8; k++) for (const [n, u] of [["base", BASE], ["now", NOW]]) {
  const page = await launch({ width: 1648, height: 928, gpu: true });
  await page.goto(u + "/");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(1500); await page.freezeAnimations(0); await page.finishTransitions(); await sleep(300);
  writeFileSync(`${OUT}/${n}-${k}.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await page.close();
}
process.exit(0);
