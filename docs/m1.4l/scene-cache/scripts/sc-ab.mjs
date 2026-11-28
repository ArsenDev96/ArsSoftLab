// M1.4R.2 A/B comparison (from M1.4P): node sc-ab.mjs <dir-a> <dir-b>. Layout fingerprint equality and pixel deltas per case.
import { readFileSync, readdirSync } from "node:fs";
import { launch } from "../../../../scripts/visual/cdp.mjs";
import { prepare, compareImages } from "../../../../scripts/visual/compare.mjs";
const names = readdirSync(process.argv[3]).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4));
const page = await launch({ width: 800, height: 600 });
await prepare(page);
for (const n of names) {
  const a = readFileSync(`${process.argv[2]}/${n}.txt`, "utf8").split("\n"), b = readFileSync(`${process.argv[3]}/${n}.txt`, "utf8").split("\n");
  const fpSame = a.length === b.length && a.every((l, i) => l === b[i]);
  const r = await compareImages(page, `${process.argv[2]}/${n}.png`, `${process.argv[3]}/${n}.png`, { heatmapPath: `${process.argv[3]}-heat-${n}.png` });
  console.log(`${n.padEnd(20)} fingerprint ${fpSame ? "identical" : "DIFFERS"} (${b.length} el)  pixels: max ${r.max} over2 ${r.over2} over12 ${r.over12}`);
}
await page.close();
